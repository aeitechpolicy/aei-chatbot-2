const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPilot } = require('../utils/pilot');

test('separate ledger connections share the same pending budget reservations', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-ledger-concurrency-'));
  const env = { CHATBOT_INTERN_PASSWORD: 'test-only-long-password', CHATBOT_DAILY_ESTIMATE_USD: '0.003', CHATBOT_INPUT_USD_PER_MILLION: '1', CHATBOT_OUTPUT_USD_PER_MILLION: '1' };
  const options = { env, now: () => Date.parse('2026-10-28T18:00:00Z'), dataDir: dir };
  const first = createPilot(options); const second = createPilot(options);
  t.after(async () => { await first.close(); await second.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const messages = [{ role: 'user', content: 'A short question' }];
  await first.begin('owner', messages);
  await assert.rejects(() => second.begin('owner', messages), /daily estimated cost allowance/);
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
