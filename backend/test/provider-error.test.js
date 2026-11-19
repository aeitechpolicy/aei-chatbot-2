const { test } = require('node:test');
const assert = require('node:assert/strict');
const { providerErrorDetails, completionDetails, emptyAnswerError, usageFailureCode } = require('../utils/providerError');

test('provider errors retain their explanation and request ID while removing credentials', () => {
  const key = 'test-only-secret-value';
  const details = providerErrorDetails({
    status: 403,
    error: { message: `Access restricted for ${key}. Authorization: Bearer ${key}` },
    headers: { 'x-request-id': 'test-request-id' },
    request: { messages: [{ content: 'Private question marker' }] }
  }, key);
  assert.equal(details.status, 403);
  assert.equal(details.requestId, 'test-request-id');
  assert.match(details.message, /Access restricted/);
  assert.doesNotMatch(JSON.stringify(details), /test-only-secret-value|Private question marker/);
});

test('provider diagnostics support nested JSON and text errors and bound their length', () => {
  assert.equal(providerErrorDetails({ error: { error: { message: 'Model access unavailable' } } }).message, 'Model access unavailable');
  assert.match(providerErrorDetails({ error: 'Proxy rejected request' }).message, /Proxy rejected/);
  assert.doesNotMatch(providerErrorDetails({ message: 'Invalid key ' + 'f'.repeat(64) }).message, /f{64}/);
  assert.ok(providerErrorDetails({ message: 'x'.repeat(5000) }).message.length <= 800);
  assert.equal(providerErrorDetails({}).message, 'No provider explanation returned.');
});

test('completion diagnostics retain only safe counts and a known finish reason', () => {
  const response = { choices: [{ finish_reason: 'length', message: { content: '', reasoning: 'private-reasoning-marker' } }],
    usage: { prompt_tokens: 3796, completion_tokens: 16384, completion_tokens_details: { reasoning_tokens: 16384 } },
    messages: [{ content: 'private-question-marker' }] };
  assert.deepEqual(completionDetails(response), { finishReason: 'length', inputTokens: 3796, outputTokens: 16384, reasoningTokens: 16384, answerCharacters: 0 });
  assert.doesNotMatch(JSON.stringify(completionDetails(response)), /private-/);
  assert.deepEqual(completionDetails({ choices: [{ finish_reason: 'private-finish-marker', message: { content: 'abc' } }],
    usage: { prompt_tokens: -1, completion_tokens: '100', completion_tokens_details: { reasoning_tokens: 0 } } }),
    { finishReason: null, inputTokens: null, outputTokens: null, reasoningTokens: 0, answerCharacters: 3 });
});

test('empty answers distinguish a reported output limit from other blank responses without guessing reasoning', () => {
  const limited = emptyAnswerError({ choices: [{ finish_reason: 'length' }] });
  assert.equal(limited.status, 502); assert.equal(limited.code, 'empty_answer_output_limit');
  assert.match(limited.message, /output allowance/);
  assert.equal(usageFailureCode(limited), 'empty_answer_output_limit');
  const blank = emptyAnswerError({ choices: [{ finish_reason: 'stop' }] });
  assert.equal(blank.code, 'empty_answer'); assert.doesNotMatch(blank.message, /output allowance/);
  assert.equal(usageFailureCode(blank), 'empty_answer');
  assert.equal(usageFailureCode({ status: 403, code: 'provider_error' }), '403');
});
