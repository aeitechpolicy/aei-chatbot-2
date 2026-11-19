const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createApp } = require('../server');
const { createPilot } = require('../utils/pilot');
const { TEST_MODELS, MUSE_TEST_MODEL, INTERN_OUTPUT_TOKENS, INTERN_TIMEOUT_MS, selectedModels } = require('../utils/modelTesting');

const OWNER = 'test-only-owner-password';
const TESTER = 'test-only-model-tester-password';
const messages = [{ role: 'user', content: 'Compare this policy question.' }];
const answer = () => ({ choices: [{ message: { content: 'TITLE: Spectrum Policy\nThe supplied article discusses spectrum policy. [S1]' } }], usage: { prompt_tokens: 1000, completion_tokens: 100 } });

async function fixture(t, { env = {}, complete = async () => answer(), fetchArticles, searchWeb } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-model-testing-'));
  const settings = { CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_TESTER_PASSWORD: TESTER, ...env };
  const pilot = createPilot({ env: settings, dataDir: dir });
  const app = createApp({ env: settings, pilot, complete, fileRoutes: express.Router(),
    chatDependencies: { fetchArticles: fetchArticles || (async () => [{ title: 'Spectrum article', author: 'Shane Tews',
      date: '2026-11-10', url: 'https://www.aei.org/articles/spectrum/', body: 'The supplied article discusses spectrum policy.' }]), searchWeb } });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await pilot.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const sessions = {};
  function session(user) { return sessions[user] || (sessions[user] = pilot.login(user, user === 'owner' ? OWNER : TESTER, user)); }
  async function request(route, body, user = 'tester') {
    return fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: {
      Authorization: `Bearer ${session(user).token}`, 'Content-Type': 'application/json'
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function chat(user = 'tester') { return (await request('/api/chat/new', { domainName: 'General' }, user)).json(); }
  return { pilot, request, chat };
}

test('Intern Muse trial uses the selected model, stores its identity and charges its own prices', async t => {
  const requests = [];
  const f = await fixture(t, { env: { CHATBOT_INPUT_USD_PER_MILLION: '0.01', CHATBOT_OUTPUT_USD_PER_MILLION: '0.01' },
    complete: async request => { requests.push(request); return { ...answer(), model: request.model }; } });
  const chat = await f.chat('owner');
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'Summarize the supplied spectrum article.', modelId: MUSE_TEST_MODEL.id }, 'owner');
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(requests.length, 1); assert.equal(requests[0].model, MUSE_TEST_MODEL.id);
  assert.equal(requests[0].reasoning_effort, 'low'); assert.equal(requests[0].temperature, 1.0); assert.equal(requests[0].reasoning, undefined);
  assert.equal(requests[0].max_tokens, INTERN_OUTPUT_TOKENS);
  assert.equal(data.model, MUSE_TEST_MODEL.id);
  assert.equal(data.chat.messages.at(-1).model, MUSE_TEST_MODEL.id);
  assert.equal(data.citationNotice, null);
  const rows = await f.pilot.rows('owner');
  assert.equal(rows.length, 1); assert.equal(rows[0].model, MUSE_TEST_MODEL.id);
  assert.equal(rows[0].input_rate, 1.25); assert.equal(rows[0].output_rate, 4.25);
  assert.ok(Math.abs(rows[0].estimated_usd - 0.001675) < 1e-12);
});

test('Muse trial refuses non-Intern and arbitrary model requests before spending', async t => {
  let calls = 0;
  const f = await fixture(t, { complete: async () => { calls++; return answer(); } });
  const other = await f.chat(); const own = await f.chat('owner');
  assert.equal((await f.request(`/api/chat/${other.id}/message`, { message: 'Policy', modelId: MUSE_TEST_MODEL.id })).status, 403);
  for (const modelId of ['unknown/model', '', null, [MUSE_TEST_MODEL.id]]) {
    assert.equal((await f.request(`/api/chat/${own.id}/message`, { message: 'Policy', modelId }, 'owner')).status, 400);
  }
  assert.equal((await f.request(`/api/chat/${other.id}/message`, { message: 'Policy', modelId: MUSE_TEST_MODEL.id }, 'owner')).status, 404);
  assert.equal(calls, 0); assert.equal((await f.pilot.rows('owner')).length, 0);
});

test('Intern ordinary and Muse answers use longer output and timeout in all three AI modes', async t => {
  const requests = [];
  const f = await fixture(t, { searchWeb: async () => [{ title: 'Web result', url: 'https://example.org/news', content: 'External spectrum development.' }],
    env: { CHATBOT_DAILY_ESTIMATE_USD: '0.000001', CHATBOT_DAILY_QUESTIONS: '1', CHATBOT_PERSON_DAILY_QUESTIONS: '1' },
    complete: async (request, options) => { requests.push({ request, options }); return { ...answer(), choices: [{ ...answer().choices[0], finish_reason: 'length' }] }; } });
  for (const mode of ['archive', 'compare', 'web']) {
    for (const modelId of [undefined, MUSE_TEST_MODEL.id]) {
      const own = await f.chat('owner');
      const response = await f.request(`/api/chat/${own.id}/message`, { message: 'Summarize spectrum policy.', mode, ...(modelId ? { modelId } : {}) }, 'owner');
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.truncated, true);
      assert.equal(data.chat.messages.at(-1).truncated, true);
    }
  }
  assert.equal(requests.length, 6);
  for (const { request, options } of requests) {
    assert.equal(request.max_tokens, INTERN_OUTPUT_TOKENS);
    assert.deepEqual(options, { timeoutMs: INTERN_TIMEOUT_MS });
  }
  assert.equal((await f.pilot.rows('owner')).length, 6);
});

test('Muse records the larger allowance without a five-cent ceiling and still bounds output settings', async t => {
  const f = await fixture(t);
  const [id] = await f.pilot.beginBatch('owner', messages, [MUSE_TEST_MODEL]);
  const [row] = await f.pilot.rows('owner');
  const expected = ((Buffer.byteLength(JSON.stringify(messages), 'utf8') + 1024) * 1.25 + INTERN_OUTPUT_TOKENS * 4.25) / 1e6;
  assert.ok(Math.abs(row.reserved_usd - expected) < 1e-12);
  assert.ok(row.reserved_usd > 0.05);
  await f.pilot.finish(id, { attempted: false });
  for (const maxOutputTokens of [0, -1, 32768, '16384']) {
    await assert.rejects(f.pilot.beginBatch('owner', messages, [{ ...MUSE_TEST_MODEL, maxOutputTokens }]), error => error.code === 'model_setup');
  }
  await assert.rejects(f.pilot.beginBatch('tester', messages, [MUSE_TEST_MODEL]), error => error.code === 'model_setup');
});

test('a per-request estimate ceiling still applies to capped accounts, not Intern', async t => {
  const f = await fixture(t);
  const capped = { ...MUSE_TEST_MODEL, maxOutputTokens: 1024, maxEstimatedUsd: 0.05 };
  const longContext = [{ role: 'user', content: 'x'.repeat(40000) }];
  await assert.rejects(f.pilot.beginBatch('tester', longContext, [capped]), /\$0\.05 estimated limit/);
  assert.equal((await f.pilot.rows('owner')).length, 0);
  const [id] = await f.pilot.beginBatch('owner', longContext, [capped]);
  assert.ok((await f.pilot.rows('owner'))[0].reserved_usd > 0.05);
  await f.pilot.finish(id, { response: answer() });
});

test('model choices are a server allowlist with no duplicates or arbitrary model IDs', () => {
  assert.equal(selectedModels().length, 3);
  for (const ids of [[], ['unknown/model'], [TEST_MODELS[0].id, TEST_MODELS[0].id], 'all', [null]]) {
    assert.throws(() => selectedModels(ids), /Choose one to three/);
  }
});

test('tester login is optional, unique and separate from staff history and files', async t => {
  const f = await fixture(t);
  const config = await (await f.request('/api/chat/capabilities')).json();
  assert.deepEqual(config.models.map(model => model.id), TEST_MODELS.map(model => model.id));
  const ownerConfig = await (await f.request('/api/chat/capabilities', undefined, 'owner')).json();
  assert.equal(ownerConfig.models, undefined);
  const own = await f.chat();
  assert.equal((await f.request(`/api/chat/${own.id}`, undefined, 'owner')).status, 404);
  assert.equal((await f.request('/api/files/content/Will_Rinehart/article.txt')).status, 403);
  assert.equal((await f.request('/api/feedback')).status, 403);
  assert.equal((await f.request('/api/usage')).status, 200);
  const staffChat = await f.chat('owner');
  assert.equal((await f.request(`/api/chat/${staffChat.id}/message`, { message: 'Policy', modelIds: TEST_MODELS.map(model => model.id) }, 'owner')).status, 403);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-tester-login-'));
  const disabled = createPilot({ env: { CHATBOT_INTERN_PASSWORD: OWNER, CHATBOT_TESTER_PASSWORD: OWNER }, dataDir: dir });
  try { assert.throws(() => disabled.login('tester', OWNER, 'test'), /not recognized/); }
  finally { await disabled.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('three models start together using identical library context and record their own prices', { timeout: 15000 }, async t => {
  let lookups = 0;
  const requests = [];
  let release;
  const allStarted = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { fetchArticles: async () => { lookups++; return [{ title: 'Spectrum article',
    author: 'Shane Tews', body: 'The supplied article discusses spectrum policy.', url: 'https://www.aei.org/articles/spectrum/' }]; },
    complete: async request => { requests.push(request); if (requests.length === 3) release(); await allStarted; return answer(); } });
  const chat = await f.chat();
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'What does the scholar say about spectrum?' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(lookups, 1); assert.equal(requests.length, 3);
  for (const request of requests) assert.deepEqual(request.messages, requests[0].messages);
  assert.equal(requests[0].reasoning.enabled, false);
  assert.equal(requests[1].reasoning_effort, 'low');
  assert.equal(data.modelResponses.length, 3);
  assert.ok(data.modelResponses.every(item => item.status === 'complete' && item.usageRecorded));
  assert.equal(data.chat.title, 'Spectrum Policy');
  const saved = await (await f.request(`/api/chat/${chat.id}`)).json();
  assert.equal(saved.messages[1].modelResponses.length, 3);
  const rows = await f.pilot.rows('tester');
  assert.equal(rows.length, 3);
  for (const model of TEST_MODELS) {
    const row = rows.find(item => item.model === model.id);
    assert.equal(row.status, 'complete'); assert.equal(row.account_label, 'Model Tester');
    assert.ok(Math.abs(row.estimated_usd - (1000 * model.inputRate + 100 * model.outputRate) / 1e6) < 1e-12);
  }
});

test('experimental web evidence is fetched once and a failed model does not discard successful answers', async t => {
  let searches = 0;
  const requests = [];
  const f = await fixture(t, { searchWeb: async () => { searches++; return [{ title: 'Web result', url: 'https://example.org/news', content: 'External spectrum development.' }]; },
    complete: async request => {
      requests.push(request);
      if (request.model === TEST_MODELS[1].id) throw Object.assign(new Error('simulated unavailable model'), { status: 503 });
      return answer();
    } });
  const chat = await f.chat();
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'What changed in spectrum policy?', mode: 'web' });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(searches, 1); assert.equal(requests.length, 3);
  assert.ok(requests.every(request => request.messages[0].content.includes('External spectrum development.')));
  assert.ok(data.sources.some(source => source.id === 'W1'));
  assert.equal(data.modelResponses.filter(item => item.status === 'complete').length, 2);
  assert.equal(data.modelResponses.filter(item => item.status === 'failed').length, 1);
  assert.equal((await f.pilot.rows('tester')).find(row => row.model === TEST_MODELS[1].id).status, 'unknown_cost');
});

test('a budget too small for the whole comparison prevents all provider calls and rolls reservations back', async t => {
  let calls = 0;
  const f = await fixture(t, { env: { CHATBOT_DAILY_ESTIMATE_USD: '0.0015' }, complete: async () => { calls++; return answer(); } });
  const chat = await f.chat();
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'What does the scholar say?' });
  assert.equal(response.status, 429); assert.equal(calls, 0);
  assert.equal((await f.pilot.rows('tester')).length, 0);
  const id = await f.pilot.begin('owner', messages);
  await f.pilot.finish(id, { attempted: false });
});

test('missing web results leave zero paid calls and mark every unused reservation as not sent', async t => {
  let calls = 0;
  const f = await fixture(t, { searchWeb: async () => [], complete: async () => { calls++; return answer(); } });
  const chat = await f.chat();
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { message: 'Spectrum policy', mode: 'web' })).status, 502);
  assert.equal(calls, 0);
  const rows = await f.pilot.rows('tester');
  assert.equal(rows.length, 3); assert.ok(rows.every(row => row.status === 'not_sent' && row.estimated_usd === 0));
});

test('citation failures remain visible for the tester and invalid model choices never spend credits', async t => {
  let calls = 0;
  const f = await fixture(t, { complete: async () => { calls++; return { ...answer(), choices: [{ message: { content: 'Unsupported candidate response without a citation.' } }] }; } });
  const chat = await f.chat();
  assert.equal((await f.request(`/api/chat/${chat.id}/message`, { message: 'Spectrum policy', modelIds: ['arbitrary/model'] })).status, 400);
  assert.equal(calls, 0);
  const data = await (await f.request(`/api/chat/${chat.id}/message`, { message: 'Spectrum policy', modelIds: [TEST_MODELS[0].id] })).json();
  assert.equal(calls, 1); assert.equal(data.modelResponses[0].status, 'citation_warning');
  assert.match(data.modelResponses[0].content, /Unsupported candidate/);
});

test('an unconnected provider leaves comparison reservations marked as not sent', async t => {
  const f = await fixture(t, { complete: async () => { throw Object.assign(new Error('The AI service is not connected yet.'), { status: 503, code: 'ai_setup' }); } });
  const chat = await f.chat();
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'Spectrum policy' });
  assert.equal(response.status, 200);
  const rows = await f.pilot.rows('tester');
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.status === 'not_sent' && row.estimated_usd === 0));
});

test('empty Muse answers preserve charges, disclose the stop reason safely and never retry', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...parts) => logs.push(parts.join(' ')));
  let calls = 0;
  const f = await fixture(t, { complete: async () => {
    calls++;
    return { model: MUSE_TEST_MODEL.id, choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'private-reasoning-marker' } }],
      usage: { prompt_tokens: 3796, completion_tokens: 16384, completion_tokens_details: { reasoning_tokens: 16384 } } };
  } });
  const chat = await f.chat('owner');
  const response = await f.request(`/api/chat/${chat.id}/message`, { message: 'private-question-marker', modelId: MUSE_TEST_MODEL.id }, 'owner');
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.code, 'empty_answer_output_limit'); assert.match(body.error, /output allowance/);
  assert.equal(calls, 1);
  const [row] = await f.pilot.rows('owner');
  assert.equal(row.status, 'failed'); assert.equal(row.error_code, 'empty_answer_output_limit');
  assert.equal(row.output_tokens, 16384);
  assert.ok(Math.abs(row.estimated_usd - 0.074377) < 1e-12);
  const saved = await (await f.request(`/api/chat/${chat.id}`, undefined, 'owner')).json();
  assert.equal(saved.messages.length, 1); assert.equal(saved.messages[0].role, 'user');
  assert.match(logs.join(' '), /"finishReason":"length"/);
  assert.match(logs.join(' '), /"reasoningTokens":16384/);
  assert.doesNotMatch(logs.join(' ') + JSON.stringify(body) + JSON.stringify(row), /private-reasoning-marker|private-question-marker/);
});
