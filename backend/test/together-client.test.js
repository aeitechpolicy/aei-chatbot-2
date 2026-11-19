const { test } = require('node:test');
const assert = require('node:assert/strict');
const Together = require('together-ai');
const { MODEL, MODEL_PARAMETERS, MAX_OUTPUT_TOKENS } = require('../utils/pilot');
const { togetherCompletion } = require('../utils/togetherCompletion');

test('the Together SDK streams GLM text and returns final usage for the existing chat flow', async () => {
  let calls = 0;
  const client = new Together({ apiKey: 'test-only-not-a-real-key', baseURL: 'http://127.0.0.1:9', maxRetries: 0, timeout: 45000,
    fetch: async (input, options) => {
      calls++;
      assert.equal(new URL(input).pathname, '/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, MODEL); assert.equal(body.max_tokens, MAX_OUTPUT_TOKENS);
      assert.equal(body.model, 'zai-org/GLM-5.3-Flash');
      assert.equal(body.reasoning_effort, 'low'); assert.equal(body.reasoning, undefined);
      assert.equal(body.stream, true);
      assert.deepEqual(body.stream_options, { include_usage: true });
      assert.ok(options.signal instanceof AbortSignal);
      const chunks = [
        { model: MODEL, choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: 'Private reasoning to exclude' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: { content: 'TITLE: Policy Research\nSimulated ' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: { content: 'answer [S1].' }, finish_reason: 'stop' }] },
        { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20 } }
      ];
      const data = chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
      return new Response(data, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
  });
  const result = await togetherCompletion(client, { model: MODEL, messages: [{ role: 'user', content: 'A test question' }], max_tokens: MAX_OUTPUT_TOKENS, ...MODEL_PARAMETERS, stream: false });
  assert.equal(calls, 1); assert.equal(result.usage.prompt_tokens, 100);
  assert.equal(result.choices[0].message.content, 'TITLE: Policy Research\nSimulated answer [S1].');
  assert.equal(result.usage.completion_tokens, 20);
  assert.doesNotMatch(JSON.stringify(result), /Private reasoning/);
});

test('provider failures are not automatically retried', async () => {
  let calls = 0;
  const client = new Together({ apiKey: 'test-only-not-a-real-key', baseURL: 'http://127.0.0.1:9', maxRetries: 0,
    fetch: async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Simulated outage' } }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
  });
  await assert.rejects(() => togetherCompletion(client, { model: MODEL, messages: [{ role: 'user', content: 'A test question' }] }));
  assert.equal(calls, 1);
});

test('a stream interrupted before its finish marker cannot return a partial answer', async () => {
  const client = { chat: { completions: { create: async function* () {
    yield { choices: [{ index: 0, delta: { content: 'Incomplete answer' } }] };
  } } } };
  await assert.rejects(() => togetherCompletion(client, { model: MODEL }), { code: 'incomplete_stream' });
});

test('completed streams without usage preserve uncertainty and network failures propagate', async () => {
  const client = { chat: { completions: { create: async function* () {
    yield { choices: [{ index: 0, delta: { content: 'Final answer' }, finish_reason: 'length' }] };
  } } } };
  const response = await togetherCompletion(client, { model: MODEL });
  assert.equal(response.usage, undefined);
  assert.equal(response.choices[0].finish_reason, 'length');
  const failure = Object.assign(new Error('Disconnected'), { code: 'ECONNRESET' });
  client.chat.completions.create = async function* () { throw failure; };
  await assert.rejects(() => togetherCompletion(client, { model: MODEL }), failure);
});

test('longer Intern timeout overrides the SDK timeout without leaking transport options into the model request', async () => {
  let seen;
  const client = { chat: { completions: { create: (body, options) => {
    seen = { body, options };
    return (async function* () { yield { choices: [{ index: 0, delta: { content: 'A completed answer' }, finish_reason: 'stop' }] }; })();
  } } } };
  await togetherCompletion(client, { model: MODEL }, { timeoutMs: 120000 });
  assert.equal(seen.options.timeout, 120000);
  assert.ok(seen.options.signal instanceof AbortSignal);
  assert.equal(seen.body.timeoutMs, undefined);
  await togetherCompletion(client, { model: MODEL });
  assert.equal(seen.options.timeout, 45000);
});

test('Muse low-effort settings reach the real SDK and reasoning token counts survive without reasoning text', async () => {
  let calls = 0;
  const { MUSE_TEST_MODEL, INTERN_OUTPUT_TOKENS } = require('../utils/modelTesting');
  const client = new Together({ apiKey: 'test-only-not-a-real-key', baseURL: 'http://127.0.0.1:9', maxRetries: 0,
    fetch: async (url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.model, MUSE_TEST_MODEL.id); assert.equal(body.reasoning_effort, 'low');
      assert.equal(body.temperature, 1.0); assert.equal(body.max_tokens, INTERN_OUTPUT_TOKENS);
      const chunks = [
        { choices: [{ index: 0, delta: { reasoning_content: 'private-reasoning-marker' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: 'length' }] },
        { choices: [], usage: { prompt_tokens: 3796, completion_tokens: 16384, completion_tokens_details: { reasoning_tokens: 16384 } } }
      ];
      return new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n',
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
  });
  const result = await togetherCompletion(client, { model: MUSE_TEST_MODEL.id, messages: [{ role: 'user', content: 'A simulated question' }],
    max_tokens: INTERN_OUTPUT_TOKENS, ...MUSE_TEST_MODEL.parameters });
  assert.equal(calls, 1); assert.equal(result.choices[0].message.content, '');
  assert.equal(result.choices[0].finish_reason, 'length');
  assert.equal(result.usage.completion_tokens_details.reasoning_tokens, 16384);
  assert.doesNotMatch(JSON.stringify(result), /private-reasoning-marker/);
});
