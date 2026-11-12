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
const answer = () => ({ model: MODEL, choices: [{ message: { content: 'A stubbed answer based on a saved article. [S1]' } }], usage: { prompt_tokens: 10000, completion_tokens: 100 } });

async function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-pilot-test-'));
  const env = { CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_RA_PASSWORD: SUPERVISOR, ...overrides.env };
  const pilot = createPilot({ env, now: () => FIXED, dataDir: dir });
  const manager = new ChatManager(path.join(dir, 'chats'));
  let calls = 0;
  const complete = overrides.realComplete ? undefined : async request => { calls++; assert.equal(request.model, MODEL); assert.equal(request.max_tokens, 1024); assert.deepEqual(request.reasoning, { enabled: false }); return overrides.complete ? overrides.complete(request) : answer(); };
  const app = createApp({ env, pilot, complete, researchDependencies: { findSource: overrides.findSource, search: overrides.searchArticles || (async () => ({ articles: [], matchedCount: 0, coverage: { articles: 0 }, aiUsed: false })) }, fileRoutes: overrides.fileRoutes || express.Router(), chatDependencies: {
    manager, searchWeb: overrides.searchWeb, knowledgeBase: { loadDomainContent: async () => ({}) }, fetchArticles: overrides.fetchArticles || (async () => [{ title: 'Fixture article', author: 'Clay Calvert', date: '2025-01-02', url: 'https://www.aei.org/articles/fixture/', body: 'Simulated source evidence for the test question.' }])
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
  for (const route of ['/api/chat/history', '/api/files/domains', '/api/usage', '/api/usage.csv', '/api/research/search?q=AI', '/public/example.txt']) assert.equal((await f.request(route)).status, 401);
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

test('the demo’s original version has frozen files and separate chats under the same usage account', async t => {
  const password = 'test-only-demo-password';
  const f = await fixture(t, { env: { CHATBOT_DEMO_PASSWORD: password } });
  const { token } = await f.login('demo', password);
  const owner = await f.login();
  const archiveRoute = '/api/chat/archive?version=1';
  assert.equal((await f.request(archiveRoute)).status, 401);
  assert.equal((await f.request(archiveRoute, { token: owner.token })).status, 404);
  const { domains } = await (await f.request(archiveRoute, { token })).json();
  assert.deepEqual(Object.values(domains).map(domain => domain.file_count), [636, 195, 607, 102]);
  const fileRoute = '/api/chat/archive/Shane_Tews';
  const { files } = await (await f.request(`${fileRoute}?version=1`, { token })).json();
  assert.equal(files.length, 607);
  const file = await (await f.request(`${fileRoute}/${encodeURIComponent(files[0])}?version=1`, { token })).json();
  assert.ok(file.content.length > 0);

  const latest = await f.newChat(token);
  const created = await f.request('/api/chat/new?version=1', { token, method: 'POST', body: { domainName: 'Shane_Tews' } });
  assert.equal(created.status, 200);
  const original = await created.json();
  assert.equal((await f.request(`/api/chat/${original.id}`, { token })).status, 404);
  assert.equal((await f.request(`/api/chat/${latest.id}?version=1`, { token })).status, 404);
  const question = 'What has Shane Tews written about spectrum allocation and sharing?';
  const response = await f.request(`/api/chat/${original.id}/message?version=1`, { token, method: 'POST', body: { message: question } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.chat.title, question.slice(0, 50) + '...');
  assert.ok(result.sources.length > 0 && result.sources.every(source => typeof source === 'string'));
  assert.equal((await f.pilot.rows('demo')).length, 1);
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
  assert.ok(Math.abs(row.estimated_usd - 0.001547) < 1e-10);
  assert.equal(row.input_rate, 0.15); assert.equal(row.output_rate, 0.47);
  assert.equal(row.status, 'complete');
  const csv = await (await f.request('/api/usage.csv', { token })).text();
  assert.ok(csv.includes('Chatbot Intern'));
  assert.ok(csv.includes('10000')); assert.ok(!csv.includes('private-question-marker')); assert.ok(!csv.includes(OWNER));
});

test('the first answer titles the chat in the same request and follow-ups use only current evidence', async t => {
  const f = await fixture(t, { complete: async request => {
    const prompt = request.messages[0].content;
    assert.ok(request.messages.every(message => message.role !== 'assistant'));
    const first = request.messages.length === 2;
    assert.equal(prompt.includes('TITLE:'), first);
    const content = first
      ? 'TITLE: Spectrum Sharing and Broadband\nAn initial observation [S1].'
      : 'A follow-up observation [S1].';
    return { ...answer(), choices: [{ message: { content } }] };
  } });
  const { token } = await f.login();
  const chat = await f.newChat(token);
  const route = `/api/chat/${chat.id}/message`;
  const first = await f.request(route, { token, method: 'POST', body: { message: 'What has Shane Tews written about sharing spectrum for broadband?' } });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.response, 'An initial observation [S1].');
  assert.equal(firstBody.chat.title, 'Spectrum Sharing and Broadband');
  assert.equal(f.calls(), 1);

  const second = await f.request(route, { token, method: 'POST', body: { message: 'What about rural deployment?' } });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).chat.title, firstBody.chat.title);
  const history = await (await f.request('/api/chat/history', { token })).json();
  assert.equal(history[0].title, firstBody.chat.title);
  assert.equal(f.calls(), 2);
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

test('oversized questions are refused while long sources are excerpted before the provider call', async t => {
  const f = await fixture(t, { fetchArticles: async () => [{ title: 'Long article', body: 'x'.repeat(125000) }] });
  const { token } = await f.login(); const chat = await f.newChat(token, 'Clay_Calvert');
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'x'.repeat(6001) } })).status, 413);
  assert.equal(f.calls(), 0);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 200); assert.equal(f.calls(), 1);
  assert.equal((await response.json()).sources[0].excerpt.length, 2200);
});

test('provider errors retain unknown costs and do not expose the raw provider error', async t => {
  const f = await fixture(t, { complete: async () => { throw Object.assign(new Error('private-provider-error-marker'), { status: 502 }); } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('private-provider-error-marker'));
  const row = (await f.pilot.rows('owner'))[0]; assert.equal(row.estimated_usd, null); assert.ok(row.reserved_usd > 0); assert.equal(row.status, 'unknown_cost');
});

test('a reasoning-only or blank reply records its usage but is not saved as an answer or retried', async t => {
  const f = await fixture(t, { complete: async () => ({ ...answer(), choices: [{ message: { content: '', reasoning: 'private-reasoning-marker' } }] }) });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 502);
  const body = await response.json(); assert.equal(body.code, 'empty_answer');
  assert.ok(!JSON.stringify(body).includes('private-reasoning-marker'));
  assert.equal(f.calls(), 1);
  const row = (await f.pilot.rows('owner'))[0];
  assert.equal(row.status, 'failed'); assert.ok(Math.abs(row.estimated_usd - 0.001547) < 1e-10);
  const saved = await (await f.request(`/api/chat/${chat.id}`, { token })).json();
  assert.equal(saved.messages.length, 1); assert.equal(saved.messages[0].role, 'user');
});

test('missing provider credentials do not crash login or count as a paid request', async t => {
  const f = await fixture(t, { realComplete: true }); const { token } = await f.login(); const chat = await f.newChat(token);
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } })).status, 503);
  assert.equal((await f.pilot.rows('owner'))[0].estimated_usd, 0); assert.equal((await f.pilot.rows('owner'))[0].status, 'not_sent');
});

test('demo can research and chat while staff retain billing and file controls', async t => {
  const password = 'test-only-demo-password';
  const files = express.Router();
  files.get('/domains', (req, res) => res.json({ General: {} }));
  const f = await fixture(t, { env: { CHATBOT_DEMO_PASSWORD: password }, fileRoutes: files });
  const owner = await f.login();
  const ownerChat = await f.newChat(owner.token);
  const demo = await f.login('demo', password);
  const { token } = demo;
  assert.equal(demo.user.label, 'Demo User');
  for (const route of ['/api/usage', '/api/usage.csv', '/api/files/list', '/public/example.txt']) {
    assert.equal((await f.request(route, { token })).status, 403);
  }
  assert.equal((await f.request('/api/files/upload', { token, method: 'POST' })).status, 403);
  assert.equal((await f.request('/api/files/import-publications', { token, method: 'POST', body: [] })).status, 403);
  assert.equal((await f.request('/api/files/domains', { token })).status, 200);
  assert.equal((await f.request('/api/research/search?q=spectrum', { token })).status, 200);
  assert.equal((await f.request(`/api/chat/${ownerChat.id}`, { token })).status, 404);
  const chat = await f.newChat(token);
  const answer = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'How does spectrum sharing work?' } });
  assert.equal(answer.status, 200);
  const report = await (await f.request('/api/usage', { token: owner.token })).json();
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].account_label, 'Demo User');
  assert.equal(report.rows[0].user_id, 'demo');
  assert.equal(f.calls(), 1);
});

test('an unset, short, or reused demo password leaves the demo login disabled', async t => {
  for (const password of [undefined, 'short', OWNER, SUPERVISOR]) {
    const f = await fixture(t, { env: { CHATBOT_DEMO_PASSWORD: password } });
    const attempt = await f.request('/api/auth/login', { method: 'POST', body: { account: 'demo', password } });
    assert.equal(attempt.status, 401);
    await f.login();
  }
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


test('article search requires login but no provider key, AI allowance or usage reservation', async t => {
  const f = await fixture(t, { env: { RENDER: 'true' }, searchArticles: async ({ query, scholar }) => ({ articles: [{ title: query, author: scholar }], matchedCount: 1, coverage: { articles: 1 }, aiUsed: false }) });
  assert.equal((await f.request('/api/research/search?q=training')).status, 401);
  const { token } = await f.login();
  const r = await f.request('/api/research/search?q=training&scholar=Brent_Orrell', { token });
  assert.equal(r.status, 200); assert.equal((await r.json()).aiUsed, false);
  assert.equal(f.calls(), 0); assert.equal((await f.pilot.rows('owner')).length, 0);
  for (const route of ['/api/research/search?q=', '/api/research/search?q=AI&scholar=..%2Fprivate', '/api/research/search?q=a&q=b']) assert.equal((await f.request(route, { token })).status, 400);
});
test('catalog-only results produce a saved response without a provider call or charge', async t => {
  const f = await fixture(t, { fetchArticles: async () => [{ title: 'Catalog only', body: 'Catalog summary', fullText: false }] });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'An unsupported topic' } });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.aiUsed, false); assert.match(body.response, /couldn't find matching evidence/);
  assert.equal(body.chat.messages.length, 2); assert.equal(body.chat.title, 'An unsupported topic'); assert.equal(f.calls(), 0); assert.equal((await f.pilot.rows('owner')).length, 0);
});
test('General mode supplies bounded article sources and records citation notices in history', async t => {
  const f = await fixture(t, { complete: async request => {
    assert.ok(request.messages[0].content.includes('Fixture article'));
    assert.ok(!request.messages[0].content.includes('LIVE ARTICLES'));
    return { ...answer(), choices: [{ message: { content: 'A supported observation [S1], followed by an invented reference [S90].' } }] };
  } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'What do these scholars discuss?' } });
  const body = await response.json(); assert.equal(response.status, 200);
  assert.equal(body.sources[0].url, 'https://www.aei.org/articles/fixture/');
  assert.match(body.response, /Open Article sources/);
  assert.doesNotMatch(body.response, /invented reference/);
  assert.match(body.citationNotice, /unknown source/);
  assert.equal(body.chat.messages[1].citationNotice, body.citationNotice);
});
test('an unavailable archive does not trigger a general-knowledge provider fallback', async t => {
  const f = await fixture(t, { fetchArticles: async () => { throw new Error('private-file-error'); } });
  const { token } = await f.login(); const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'A question' } });
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'archive_unavailable');
  assert.equal(f.calls(), 0); assert.equal((await f.pilot.rows('owner')).length, 0);
});

test('experimental mode searches only the submitted question and keeps web citations distinct', async t => {
  const searches = [];
  const f = await fixture(t, {
    searchWeb: async question => {
      searches.push(question);
      return [{ title: 'Current policy', url: 'https://example.org/policy', content: 'A current policy example.' }];
    },
    complete: async request => {
      const web = request.messages[0].content.includes('"id":"W1"');
      const content = web
        ? 'External context provides a current policy example [W1].\nArchive material provides context [S1].\nFOLLOW_UP: What tradeoffs did the archive passage raise?'
        : 'A scholar passage provides context [S1].';
      return { ...answer(), choices: [{ message: { content } }] };
    }
  });
  const { token } = await f.login();
  const capability = await f.request('/api/chat/capabilities', { token });
  assert.equal((await capability.json()).webSearch, true);
  const chat = await f.newChat(token);
  const route = `/api/chat/${chat.id}/message`;
  const archive = await f.request(route, { token, method: 'POST', body: { message: 'Earlier private question' } });
  assert.equal(archive.status, 200);
  assert.equal(searches.length, 0);
  const web = await f.request(route, { token, method: 'POST', body: { message: 'Current public policy question', mode: 'web' } });
  assert.equal(web.status, 200);
  const body = await web.json();
  assert.deepEqual(searches, ['Current public policy question']);
  assert.deepEqual(body.sources.map(source => source.id), ['S1', 'W1']);
  assert.equal(body.sources[1].kind, 'web');
  assert.match(body.response, /\[W1\]/);
  assert.equal(body.citationNotice, null);
  assert.deepEqual(body.chat.messages.at(-1).followUps, ['What tradeoffs did the archive passage raise?']);
  assert.equal(f.calls(), 2);
});

test('scholar comparisons keep four rows and reject a citation belonging to another scholar', async t => {
  const f = await fixture(t, {
    fetchArticles: async key => {
      if (key !== 'Brent_Orrell' && key !== 'Shane_Tews') return [];
      const author = key.replace(/_/g, ' ');
      return [{ title: `An article by ${author}`, author, body: 'A policy tradeoff discussed in the article.' }];
    },
    complete: async () => ({ ...answer(), choices: [{ message: { content:
      'COMPARE Brent_Orrell | The passage discusses a policy tradeoff [S1].\nCOMPARE Shane_Tews | A claim using the wrong scholar [S1].'
    } }] })
  });
  const { token } = await f.login();
  const chat = await f.newChat(token);
  const response = await f.request(`/api/chat/${chat.id}/message`, { token, method: 'POST', body: { message: 'How do the scholars approach age verification?', mode: 'compare' } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.comparison.length, 4);
  assert.deepEqual(body.comparison.map(row => [row.scholar, row.limited]), [
    ['Brent Orrell', false], ['Clay Calvert', true], ['Shane Tews', true], ['Will Rinehart', true]
  ]);
  assert.doesNotMatch(body.response, /wrong scholar/);
  assert.deepEqual(body.chat.messages.at(-1).comparison, body.comparison);
  assert.equal(f.calls(), 1);
});


test('feedback shares only an owned selected answer, and only staff can read the inbox', async t => {
  const demoPassword = 'test-only-demo-feedback-password';
  const f = await fixture(t, { env: { CHATBOT_DEMO_PASSWORD: demoPassword } });
  const { token: demo } = await f.login('demo', demoPassword);
  const { token: owner } = await f.login();
  const { token: supervisor } = await f.login('supervisor');
  const chat = await f.newChat(demo);
  const chatUrl = `/api/chat/${chat.id}`;
  const reply = await f.request(`${chatUrl}/message`, { token: demo, method: 'POST', body: { message: 'Private question marker' } });
  assert.equal(reply.status, 200);
  const answer = (await reply.json()).response;
  const report = { messageIndex: 1, category: 'Citation issue', detail: 'The passage missed the tradeoff.', answer: 'Forged replacement' };

  const inbox = token => f.request('/api/feedback', { token });
  const send = (token, body) => f.request(`${chatUrl}/feedback`, { token, method: 'POST', body });
  assert.equal((await inbox()).status, 401);
  assert.equal((await inbox(demo)).status, 403);
  assert.deepEqual((await (await inbox(owner)).json()).reports, []);
  assert.equal((await send(owner, report)).status, 404);
  assert.equal((await send(demo, { ...report, messageIndex: 0 })).status, 404);
  assert.equal((await send(demo, { ...report, detail: '  ' })).status, 400);
  assert.equal((await send(demo, report)).status, 200);
  assert.equal((await send(demo, report)).status, 200);

  const { reports } = await (await inbox(supervisor)).json();
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reporterLabel, 'Demo User');
  assert.equal(reports[0].answer, answer);
  assert.equal(reports[0].detail, report.detail);
  assert.doesNotMatch(JSON.stringify(reports), /Private question marker|Forged replacement/);
  assert.equal((await f.request(chatUrl, { token: supervisor })).status, 404);
});

test('article and web source corrections reach the staff inbox without sharing the search or answer', async t => {
  const demoPassword = 'test-only-source-report-password';
  const sourceRef = 'a'.repeat(64);
  const f = await fixture(t, {
    env: { CHATBOT_DEMO_PASSWORD: demoPassword },
    findSource: async ref => ref === sourceRef ? { title: 'Saved article', authors: ['Clay Calvert'], date: '2025-01-02', url: 'https://www.aei.org/articles/fixture/', key: 'Clay_Calvert/fixture.txt' } : null,
    searchWeb: async () => [{ title: 'Web article', url: 'https://example.org/policy', content: 'Selected web passage.' }],
    complete: async () => ({ ...answer(), choices: [{ message: { content: 'Answer to keep private [W1].' } }] })
  });
  const { token: demo } = await f.login('demo', demoPassword);
  const { token: owner } = await f.login();
  const report = { category: 'Broken or incorrect link', detail: 'The article moved.', source: { title: 'Forged title' }, answer: 'Forged replacement' };
  const send = (route, token, body) => f.request(route, { method: 'POST', token, body });
  const articleRoute = '/api/research/feedback';
  assert.equal((await send(articleRoute, undefined, { ...report, sourceRef })).status, 401);
  assert.equal((await send(articleRoute, demo, { ...report, sourceRef: 'invalid' })).status, 400);
  assert.equal((await send(articleRoute, demo, { ...report, sourceRef: 'b'.repeat(64) })).status, 404);
  assert.equal((await send(articleRoute, demo, { ...report, sourceRef })).status, 200);
  assert.equal((await send(articleRoute, demo, { ...report, sourceRef })).status, 200);
  assert.equal(f.calls(), 0);

  const chat = await f.newChat(demo);
  const chatUrl = `/api/chat/${chat.id}`;
  const answerResponse = await send(`${chatUrl}/message`, demo, { message: 'Private question marker', mode: 'web' });
  assert.equal(answerResponse.status, 200);
  const webReport = { ...report, messageIndex: 1, sourceId: 'W1' };
  assert.equal((await send(`${chatUrl}/feedback`, owner, webReport)).status, 404);
  assert.equal((await send(`${chatUrl}/feedback`, demo, { ...webReport, sourceId: 'W2' })).status, 404);
  assert.equal((await send(`${chatUrl}/feedback`, demo, webReport)).status, 200);
  assert.equal(f.calls(), 1);

  const { reports } = await (await f.request('/api/feedback', { token: owner })).json();
  assert.deepEqual(reports.map(item => item.source.title).sort(), ['Saved article', 'Web article']);
  assert.ok(reports.every(item => item.answer === null && item.reporterLabel === 'Demo User'));
  assert.equal(reports.find(item => item.source.kind === 'article').source.libraryFile, 'Clay_Calvert/fixture.txt');
  assert.equal(reports.find(item => item.source.kind === 'web').source.excerpt, 'Selected web passage.');
  assert.doesNotMatch(JSON.stringify(reports), /Private question marker|Answer to keep private|Forged/);
});
