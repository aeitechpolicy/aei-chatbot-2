const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const { neonConfig } = require('@neondatabase/serverless');
const { PostgresStorage, neonDriver } = require('../storage/postgres');
const { createPilot, MODEL } = require('../utils/pilot');
const { createApp } = require('../server');

// All Neon HTTP requests are intercepted below and evaluated by local PGlite.
// This is a deliberately fake credential, never a real account or endpoint.
const CONNECTION = 'postgresql://test:test-only-password@ep-local-test.us-east-2.aws.neon.tech/neondb?sslmode=require';
const OWNER = 'test-only-intern-password';
const SUPERVISOR = 'test-only-ra-password';
const BASE_TIME = Date.parse('2026-10-29T18:00:00Z');
const response = () => ({ model: MODEL, choices: [{ message: { content: 'Local test answer.' } }], usage: { prompt_tokens: 5000, completion_tokens: 500 } });

function wireResult(result) {
  const fields = result.fields || [];
  return { fields, rowCount: result.affectedRows ?? result.rows.length, command: 'SELECT',
    rows: result.rows.map(row => fields.map(field => {
      const value = row[field.name];
      if (value === null || value === undefined) return null;
      if (field.dataTypeID === 3802 || field.dataTypeID === 114) return JSON.stringify(value);
      if (value instanceof Date) return value.toISOString();
      return String(value);
    })) };
}

test('free database storage through the real Neon HTTP driver', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-postgres-test-'));
  const databaseDir = path.join(dir, 'postgres');
  let pg = new PGlite(databaseDir);
  let now = BASE_TIME;
  let unavailable = false;
  let httpRequests = 0;
  const originalFetch = neonConfig.fetchFunction;
  neonConfig.fetchFunction = async (url, options) => {
    httpRequests++;
    assert.equal(new URL(url).hostname, 'api.us-east-2.aws.neon.tech');
    assert.equal(new URL(url).protocol, 'https:');
    assert.ok(options.signal instanceof AbortSignal);
    if (unavailable) throw new Error('simulated database outage');
    const body = JSON.parse(options.body);
    try {
      const execute = async (db, item) => wireResult(await db.query(item.query, item.params || []));
      const result = body.queries
        ? { results: await pg.transaction(async tx => {
          const results = [];
          for (const item of body.queries) results.push(await execute(tx, item));
          return results;
        }) }
        : await execute(pg, body);
      return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({ message: error.message, code: error.code, severity: 'ERROR' }), { status: 400 });
    }
  };
  t.after(async () => {
    neonConfig.fetchFunction = originalFetch;
    await pg.close(); fs.rmSync(dir, { recursive: true, force: true });
  });
  const store = () => new PostgresStorage({ connectionString: CONNECTION, now: () => now });
  const makePilot = (extra = {}) => createPilot({ env: {
    CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_RA_PASSWORD: SUPERVISOR,
    RENDER: 'true', ...extra
  }, dataDir: path.join(dir, 'app'), now: () => now, storage: store() });
  const bootstrap = store(); await bootstrap.initialize();
  t.beforeEach(async () => {
    unavailable = false; now = BASE_TIME;
    await pg.exec("SET TIMEZONE TO 'UTC'; TRUNCATE aei_pilot_usage, aei_pilot_chats");
  });

  await t.test('records returned tokens, estimates and separate account reports', async () => {
    const pilot = makePilot();
    for (const user of ['owner', 'supervisor']) {
      const id = await pilot.begin(user, [{ role: 'user', content: 'A test question' }]);
      await pilot.finish(id, { response: response() });
    }
    const rows = await pilot.rows('owner');
    assert.equal(rows.length, 2); assert.ok(rows.every(row => row.status === 'complete'));
    assert.ok(rows.every(row => Math.abs(row.estimated_usd - 0.00572) < 1e-9));
    assert.equal((await pilot.rows('supervisor')).length, 1);
    const csv = await pilot.csv('owner');
    assert.ok(csv.includes('Chatbot Intern')); assert.ok(csv.includes('Chatbot RA'));
    assert.ok(csv.includes('5000')); assert.ok(!csv.includes('A test question')); assert.ok(!csv.includes(OWNER));
    assert.equal(pilot.settings.storageConfigured, true);
    assert.equal(fs.existsSync(path.join(dir, 'app', 'usage.sqlite')), false);
    await pilot.close();
  });

  await t.test('chat JSON, ownership, titles and deletion survive normal database round trips', async () => {
    const chats = store().chatManager;
    const title = "Research '; DROP TABLE aei_pilot_chats; --";
    const chat = await chats.createChat('Clay_Calvert', title, 'owner');
    await chats.addMessage(chat.id, { role: 'user', content: 'A private research question.' });
    await chats.addMessage(chat.id, { role: 'assistant', content: 'A cited answer.', sources: ['Test source'] });
    assert.equal((await chats.getChat(chat.id)).messages.length, 2);
    assert.equal(await chats.getChatWithUserCheck(chat.id, 'supervisor'), null);
    assert.equal((await chats.getUserChats('owner'))[0].messageCount, 2);
    assert.equal((await chats.getUserChats('supervisor')).length, 0);
    assert.equal((await chats.getChat(chat.id)).title, title);
    await chats.updateChatTitle(chat.id, 'Updated research title');
    assert.equal((await chats.getChat(chat.id)).title, 'Updated research title');
    assert.equal(await chats.deleteChat(chat.id), true);
    assert.equal(await chats.getChat(chat.id), null);
  });

  await t.test('chat history and unfinished cost reservations survive a fresh app and reopened database', async () => {
    const first = makePilot({ CHATBOT_DAILY_QUESTIONS: '1' });
    const chat = await first.chatManager.createChat('General', null, 'owner');
    await first.chatManager.addMessage(chat.id, { role: 'user', content: 'Preserved after restart' });
    await first.begin('owner', [{ role: 'user', content: 'A question' }]);
    const session = first.login('owner', OWNER, 'test');
    await first.close(); await pg.close(); pg = new PGlite(databaseDir);
    const next = makePilot({ CHATBOT_DAILY_QUESTIONS: '1' });
    assert.equal((await next.chatManager.getChatWithUserCheck(chat.id, 'owner')).messages[0].content, 'Preserved after restart');
    assert.equal((await next.rows('owner'))[0].status, 'pending');
    assert.equal(next.authenticate(session.token), null);
    await assert.rejects(() => next.begin('owner', [{ role: 'user', content: 'Another question' }]), /daily question allowance/);
    await next.close();
  });

  await t.test('separate app instances share pending spending reservations', async () => {
    const first = makePilot({ CHATBOT_DAILY_ESTIMATE_USD: '0.003' });
    const second = makePilot({ CHATBOT_DAILY_ESTIMATE_USD: '0.003' });
    const messages = [{ role: 'user', content: 'A short question' }];
    const results = await Promise.allSettled([first.begin('owner', messages), second.begin('supervisor', messages)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(results.find(result => result.status === 'rejected').reason.message, /daily estimated cost allowance/);
    assert.equal((await first.rows('owner')).length, 1);
    await first.close(); await second.close();
  });

  await t.test('per-minute, per-account and daily limits are enforced using stored records', async () => {
    const pilot = makePilot({ CHATBOT_PERSON_DAILY_QUESTIONS: '6', CHATBOT_DAILY_QUESTIONS: '7' });
    const messages = [{ role: 'user', content: 'A question' }];
    for (let i = 0; i < 5; i++) {
      const id = await pilot.begin('owner', messages); await pilot.finish(id, { attempted: false, errorCode: 'local_test' });
    }
    await assert.rejects(() => pilot.begin('owner', messages), /wait a minute/);
    now += 60001;
    const id = await pilot.begin('owner', messages); await pilot.finish(id, { attempted: false, errorCode: 'local_test' });
    await assert.rejects(() => pilot.begin('owner', messages), /daily question allowance/);
    const other = await pilot.begin('supervisor', messages); await pilot.finish(other, { attempted: false, errorCode: 'local_test' });
    await assert.rejects(() => pilot.begin('supervisor', messages), /daily question allowance/);
    now += 86400000;
    await assert.doesNotReject(() => pilot.begin('owner', messages));
    await pilot.close();
  });

  await t.test('a database outage prevents any provider request and does not fall back to local files', async () => {
    const pilot = makePilot();
    const env = { RENDER: 'true' };
    let aiCalls = 0;
    const app = createApp({ env, pilot, fileRoutes: express.Router(),
      chatDependencies: { knowledgeBase: { loadDomainContent: async () => ({}) }, fetchArticles: async () => [] },
      complete: async () => { aiCalls++; return response(); }
    });
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const session = pilot.login('owner', OWNER, 'test');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` };
      const created = await fetch(`${origin}/api/chat/new`, { method: 'POST', headers, body: JSON.stringify({ domainName: 'General' }) });
      const chat = await created.json(); assert.equal(created.status, 200);
      unavailable = true;
      const result = await fetch(`${origin}/api/chat/${chat.id}/message`, { method: 'POST', headers, body: JSON.stringify({ message: 'A question' }) });
      assert.equal(result.status, 500); assert.equal(aiCalls, 0);
      assert.equal(fs.existsSync(path.join(dir, 'app', 'usage.sqlite')), false);
      unavailable = false;
      const good = await fetch(`${origin}/api/chat/${chat.id}/message`, { method: 'POST', headers, body: JSON.stringify({ message: 'A question' }) });
      assert.equal(good.status, 200); assert.equal(aiCalls, 1);
      const saved = await good.json(); assert.equal(saved.chat.messages.length, 2);
      const report = await fetch(`${origin}/api/usage`, { headers });
      assert.equal((await report.json()).rows.length, 1);
    } finally {
      unavailable = false;
      await new Promise(resolve => server.close(resolve)); await pilot.close();
    }
  });

  await t.test('a failed completion-record write retains the reservation', async () => {
    const pilot = makePilot();
    const id = await pilot.begin('owner', [{ role: 'user', content: 'A question' }]);
    unavailable = true;
    await assert.rejects(() => pilot.finish(id, { response: response() }));
    unavailable = false;
    const row = (await pilot.rows('owner'))[0];
    assert.equal(row.status, 'pending'); assert.equal(row.estimated_usd, null);
    assert.ok(row.reserved_usd > 0);
    await pilot.close();
  });

  await t.test('daily limits use full UTC days even with a non-UTC database timezone', async () => {
    await pg.exec("SET TIMEZONE TO 'America/New_York'");
    now = Date.parse('2026-03-08T23:30:00Z');
    const pilot = makePilot({ CHATBOT_DAILY_QUESTIONS: '1' });
    const messages = [{ role: 'user', content: 'A question' }];
    const id = await pilot.begin('owner', messages);
    await pilot.finish(id, { attempted: false, errorCode: 'local_test' });
    await assert.rejects(() => pilot.begin('owner', messages), /daily question allowance/);
    await pilot.close();
  });
  assert.ok(httpRequests > 0);
});

test('invalid database destinations are rejected without exposing the connection password', () => {
  for (const url of ['not-a-url', 'postgresql://test:private-marker@example.com/db', 'http://ep-fake.us-east-2.aws.neon.tech/db']) {
    assert.throws(() => neonDriver(url), error => !error.message.includes('private-marker'));
  }
});
