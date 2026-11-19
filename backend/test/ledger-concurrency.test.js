const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPilot } = require('../utils/pilot');

test('separate ledger connections share the same pending budget reservations', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-ledger-concurrency-'));
  const env = { CHATBOT_INTERN_PASSWORD: 'test-only-long-password', CHATBOT_DAILY_ESTIMATE_USD: '0.03', CHATBOT_INPUT_USD_PER_MILLION: '1', CHATBOT_OUTPUT_USD_PER_MILLION: '1' };
  const options = { env, now: () => Date.parse('2026-10-28T18:00:00Z'), dataDir: dir };
  const first = createPilot(options); const second = createPilot(options);
  t.after(async () => { await first.close(); await second.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const messages = [{ role: 'user', content: 'A short question' }];
  await first.begin('supervisor', messages);
  await assert.rejects(() => second.begin('supervisor', messages), /daily estimated cost allowance/);
  assert.equal((await second.rows('owner')).length, 1);
});

test('an unfinished request prevents another paid request in the same pilot', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-ledger-busy-'));
  const pilot = createPilot({ env: { CHATBOT_INTERN_PASSWORD: 'test-only-long-password' }, dataDir: dir });
  t.after(async () => { await pilot.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const messages = [{ role: 'user', content: 'A short question' }];
  const id = await pilot.begin('owner', messages);
  await assert.rejects(() => pilot.begin('supervisor', messages), /already being prepared/);
  await pilot.finish(id, { attempted: false, errorCode: 'local_failure' });
  await assert.doesNotReject(() => pilot.begin('supervisor', messages));
});

test('Intern bypasses daily, minute and per-request caps while other accounts retain their shared allowance', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-intern-exemption-'));
  const pilot = createPilot({ env: { CHATBOT_INTERN_PASSWORD: 'test-only-long-password', CHATBOT_DAILY_QUESTIONS: '1',
    CHATBOT_PERSON_DAILY_QUESTIONS: '1', CHATBOT_DAILY_ESTIMATE_USD: '0.03' }, dataDir: dir });
  t.after(async () => { await pilot.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const messages = [{ role: 'user', content: 'A short question' }];
  for (let i = 0; i < 7; i++) {
    const id = await pilot.begin('owner', messages);
    await pilot.finish(id, { response: { usage: { prompt_tokens: 100000, completion_tokens: 10000 } } });
  }
  const other = await pilot.begin('supervisor', messages);
  await pilot.finish(other, { attempted: false });
  await assert.rejects(pilot.begin('demo1', messages), /daily question allowance/);
  const id = await pilot.begin('owner', messages);
  await pilot.finish(id, { response: { usage: { prompt_tokens: 100, completion_tokens: 100 } } });
  const rows = await pilot.rows('owner');
  assert.equal(rows.length, 9);
  assert.equal(rows.filter(row => row.user_id === 'owner').length, 8);
  assert.ok(rows.filter(row => row.user_id === 'owner').every(row => row.estimated_usd > 0));
});
