const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createPilot, MODEL } = require('../utils/pilot');
const { createApp } = require('../server');
const ChatManager = require('../utils/chatManager');

const OWNER = 'test-only-intern-password';
const SUPERVISOR = 'test-only-ra-password';
const FIXED = Date.parse('2026-10-28T18:00:00Z');
const answer = () => ({ model: MODEL, choices: [{ message: { content: 'A stubbed answer. No external service was called.' } }], usage: { prompt_tokens: 10000, completion_tokens: 100 } });

async function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-pilot-test-'));
  const env = { CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_RA_PASSWORD: SUPERVISOR, ...overrides.env };
  const pilot = createPilot({ env, now: () => FIXED, dataDir: dir });
  const manager = new ChatManager(path.join(dir, 'chats'));
  let calls = 0;
  const complete = overrides.realComplete ? undefined : async request => { calls++; assert.equal(request.model, MODEL); assert.equal(request.max_tokens, 1024); return overrides.complete ? overrides.complete(request) : answer(); };
  const app = createApp({ env, pilot, complete, fileRoutes: overrides.fileRoutes || express.Router(), chatDependencies: {
    manager, knowledgeBase: { loadDomainContent: async () => ({}) }, fetchArticles: overrides.fetchArticles || (async () => [])
  } });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  async function request(route, { token, body, method = 'GET', headers = {} } = {}) {
    return fetch(url + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function login(account = 'owner', password = account === 'owner' ? OWNER : SUPERVISOR) {
    const response = await request('/api/auth/login', { method: 'POST', body: { account, password } });
    assert.equal(response.status, 200); return response.json();
  }
  async function newChat(token, domainName = 'General') {
    const response = await request('/api/chat/new', { token, method: 'POST', body: { domainName } });
    assert.equal(response.status, 200); return response.json();
  }
  t.after(async () => {
    await new Promise(resolve => server.close(resolve)); await pilot.close(); fs.rmSync(dir, { recursive: true, force: true });
  });
  return { request, login, newChat, pilot, dir, calls: () => calls };
}

test('signed-out callers cannot access chat, files, reports or public uploads', async t => {
  const f = await fixture(t);
  for (const route of ['/api/chat/history', '/api/files/domains', '/api/usage', '/api/usage.csv', '/public/example.txt']) assert.equal((await f.request(route)).status, 401);
  assert.equal((await f.request('/api/health')).status, 200);
  assert.equal(f.calls(), 0);
});

test('missing login settings fail closed', async t => {
  const f = await fixture(t, { env: { CHATBOT_INTERN_PASSWORD: undefined } });
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { account: 'owner', password: OWNER } })).status, 503);
  assert.equal((await f.request('/api/usage')).status, 503);
});

test('signed-in file editing accepts article text while unsigned requests are refused', async t => {
  const files = express.Router();
  files.put('/content/Test/article.txt', (req, res) => res.json({ length: req.body.content.length }));
  const f = await fixture(t, { fileRoutes: files });
  const body = { content: 'x'.repeat(150000) };
  assert.equal((await f.request('/api/files/content/Test/article.txt', { method: 'PUT', body })).status, 401);
  const { token } = await f.login();
  const response = await f.request('/api/files/content/Test/article.txt', { token, method: 'PUT', body });
  assert.equal(response.status, 200); assert.equal((await response.json()).length, 150000);
});

test('a forged session and an incorrect password are refused', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { account: 'owner', password: 'incorrect' } })).status, 401);
  const session = await f.login();
  const forged = session.token.slice(0, 10) + 'X' + session.token.slice(11);
  assert.equal((await f.request('/api/usage', { token: forged })).status, 401);
});

test('login attempts are limited even before the caller is signed in', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { account: 'owner', password: 'incorrect' } })).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { account: 'owner', password: OWNER } })).status, 429);
});

test('signing out invalidates that session on the server', async t => {
  const f = await fixture(t); const { token } = await f.login();
  assert.equal((await f.request('/api/auth/logout', { token, method: 'POST' })).status, 200);
  assert.equal((await f.request('/api/usage', { token })).status, 401);
});

test('one account cannot read, send to, or delete another account’s chat', async t => {
  const f = await fixture(t); const owner = await f.login(); const supervisor = await f.login('supervisor');
  assert.equal(owner.user.label, 'Chatbot Intern');
  assert.equal(supervisor.user.label, 'Chatbot RA');
  const chat = await f.newChat(owner.token);
  for (const [method, suffix, body] of [['GET', '', undefined], ['DELETE', '', undefined], ['POST', '/message', { message: 'A question' }]]) {
    const response = await f.request(`/api/chat/${chat.id}${suffix}`, { token: supervisor.token, method, body, headers: { 'x-user-id': 'owner' } });
    assert.equal(response.status, 404);
  }
  assert.equal(f.calls(), 0);
});

test('request model is fixed and returned usage is recorded without question text', async t => {
  const f = await fixture(t); const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'private-question-marker', model: 'unapproved-model' } });
  assert.equal(response.status, 200); assert.equal(f.calls(), 1);
  const saved = await response.json();
  assert.equal(saved.chat.messages.length, 2);
  assert.equal(saved.chat.messages[0].content, 'private-question-marker');
  const row = (await f.pilot.rows('owner'))[0];
  assert.equal(row.model, MODEL); assert.equal(row.input_tokens, 10000); assert.equal(row.output_tokens, 100);
  assert.ok(Math.abs(row.estimated_usd - 0.010504) < 1e-10);
  assert.equal(row.status, 'complete');
  const csv = await (await f.request('/api/usage.csv', { token })).text();
  assert.ok(csv.includes('Chatbot Intern'));
  assert.ok(csv.includes('10000')); assert.ok(!csv.includes('private-question-marker')); assert.ok(!csv.includes(OWNER));
});

test('daily question allowance blocks the provider call', async t => {
  const f = await fixture(t, { env: { CHATBOT_DAILY_QUESTIONS: '1' } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  for (const expected of [200, 429]) assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } })).status, expected);
  assert.equal(f.calls(), 1); assert.equal((await f.pilot.rows('owner')).length, 1);
});

test('estimated budget is reserved before a paid request is allowed', async t => {
  const f = await fixture(t, { env: { CHATBOT_DAILY_ESTIMATE_USD: '0.000001' } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } })).status, 429);
  assert.equal(f.calls(), 0);
});

test('an oversized question or source is rejected before the provider is called', async t => {
  const f = await fixture(t, { fetchArticles: async () => [{ title: 'Long article', body: 'x'.repeat(125000) }] });
  const { token } = await f.login(); const chat = await f.newChat(token, 'Clay_Calvert');
  for (const message of ['x'.repeat(6001), 'A question']) assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message } })).status, 413);
  assert.equal(f.calls(), 0);
});

test('provider errors retain unknown costs and do not expose the raw provider error', async t => {
  const f = await fixture(t, { complete: async () => { throw Object.assign(new Error('private-provider-error-marker'), { status: 502 }); } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('private-provider-error-marker'));
  const row = (await f.pilot.rows('owner'))[0]; assert.equal(row.estimated_usd, null); assert.ok(row.reserved_usd > 0); assert.equal(row.status, 'unknown_cost');
});

test('missing provider credentials do not crash login or count as a paid request', async t => {
  const f = await fixture(t, { realComplete: true }); const { token } = await f.login(); const chat = await f.newChat(token);
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } })).status, 503);
  assert.equal((await f.pilot.rows('owner'))[0].estimated_usd, 0); assert.equal((await f.pilot.rows('owner'))[0].status, 'not_sent');
});

test('supervisor reports exclude researcher activity', async t => {
  const f = await fixture(t); const owner = await f.login(); const supervisor = await f.login('supervisor');
  for (const account of [owner, supervisor]) {
    const chat = await f.newChat(account.token);
    assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token: account.token, method: 'POST', body: { message: 'A question' } })).status, 200);
  }
  assert.equal((await (await f.request('/api/usage', { token: owner.token })).json()).rows.length, 2);
  const data = await (await f.request('/api/usage', { token: supervisor.token })).json();
  assert.equal(data.rows.length, 1); assert.equal(data.rows[0].user_id, 'supervisor');
});

test('Render requests fail closed until a persistent data location is configured', async t => {
  const f = await fixture(t, { env: { RENDER: 'true' } }); const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'storage_setup'); assert.equal(f.calls(), 0);
});

test('usage and pending reservations survive reopening the same database', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-ledger-test-'));
  const env = { CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_DAILY_QUESTIONS: '1' };
  const first = createPilot({ env, now: () => FIXED, dataDir: dir });
  await first.begin('owner', [{ role: 'user', content: 'A question' }]); await first.close();
  const second = createPilot({ env, now: () => FIXED, dataDir: dir });
  t.after(async () => { await second.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  assert.equal((await second.rows('owner'))[0].status, 'pending');
  await assert.rejects(() => second.begin('owner', [{ role: 'user', content: 'Another question' }]), /daily question allowance/);
});

test('sessions expire and the retired legacy endpoint cannot bypass the new route', async t => {
  const f = await fixture(t); const { token } = await f.login();
  assert.equal((await f.request('/api/chat', { token, method: 'POST', body: { messages: [{ role: 'user', content: 'A question' }] } })).status, 410);
  assert.equal(f.calls(), 0);
  let at = FIXED;
  const p = createPilot({ env: { CHATBOT_INTERN_PASSWORD: OWNER }, now: () => at, dataDir: path.join(f.dir, 'expiry') });
  t.after(() => p.close());
  const session = p.login('owner', OWNER, 'test'); at += 8 * 3600000 + 1;
  assert.equal(p.authenticate(session.token), null);
});
