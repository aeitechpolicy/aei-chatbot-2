const { test } = require('node:test');
const assert = require('node:assert/strict');
const Together = require('together-ai');
const { MODEL, MAX_OUTPUT_TOKENS } = require('../utils/pilot');

test('the current Together SDK preserves non-thinking Qwen request settings and returns usage', async () => {
  let calls = 0;
  const client = new Together({ apiKey: 'test-only-not-a-real-key', baseURL: 'http://127.0.0.1:9', maxRetries: 0, timeout: 45000,
    fetch: async (input, options) => {
      calls++;
      assert.equal(new URL(input).pathname, '/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, MODEL); assert.equal(body.max_tokens, MAX_OUTPUT_TOKENS);
      assert.equal(body.model, 'Qwen/Qwen3.8-Flash');
      assert.deepEqual(body.reasoning, { enabled: false });
      return new Response(JSON.stringify({ model: MODEL, choices: [{ message: { content: 'Simulated answer' } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  const result = await client.chat.completions.create({ model: MODEL, messages: [{ role: 'user', content: 'A test question' }], max_tokens: MAX_OUTPUT_TOKENS, reasoning: { enabled: false }, stream: false });
  assert.equal(calls, 1); assert.equal(result.usage.prompt_tokens, 100);
  assert.equal(result.choices[0].message.content, 'Simulated answer');
});

test('provider failures are not automatically retried', async () => {
  let calls = 0;
  const client = new Together({ apiKey: 'test-only-not-a-real-key', baseURL: 'http://127.0.0.1:9', maxRetries: 0,
    fetch: async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Simulated outage' } }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
  });
  await assert.rejects(() => client.chat.completions.create({ model: MODEL, messages: [{ role: 'user', content: 'A test question' }] }));
  assert.equal(calls, 1);
});
