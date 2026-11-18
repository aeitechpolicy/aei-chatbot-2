const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { PostgresStorage } = require('../storage/postgres');
const { createPilot } = require('../utils/pilot');
const { TEST_MODELS } = require('../utils/modelTesting');

test('Postgres reserves comparisons atomically and finishes each model using its own price', async t => {
  const pg = new PGlite();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-model-postgres-'));
  const driver = {
    query: async (text, values = []) => (await pg.query(text, values)).rows,
    batch: async statements => pg.transaction(async tx => { for (const text of statements) await tx.query(text); })
  };
  const storage = new PostgresStorage({ driver });
  const env = { CHATBOT_INTERN_PASSWORD: 'test-only-owner-password', CHATBOT_DAILY_ESTIMATE_USD: '0.0015' };
  const pilot = createPilot({ env, storage, dataDir: dir });
  const messages = [{ role: 'user', content: 'Spectrum policy' }];
  t.after(async () => { await pilot.close(); await pg.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  await assert.rejects(() => pilot.beginBatch('tester', messages, TEST_MODELS), /daily estimated cost allowance/);
  assert.equal((await pilot.rows('owner')).length, 0);
  // The last candidate's reservation fits on its own. A failed batch releases the busy guard.
  const [id] = await pilot.beginBatch('tester', messages, [TEST_MODELS[2]]);
  await pilot.finish(id, { response: { usage: { prompt_tokens: 1000, completion_tokens: 100 } } });
  const [row] = await pilot.rows('tester');
  assert.equal(row.model, TEST_MODELS[2].id);
  assert.equal(row.input_rate, 0.15); assert.equal(row.output_rate, 0.60);
  assert.ok(Math.abs(row.estimated_usd - 0.00021) < 1e-12);
  assert.equal(row.status, 'complete');
});
