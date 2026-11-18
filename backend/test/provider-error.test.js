const { test } = require('node:test');
const assert = require('node:assert/strict');
const { providerErrorDetails } = require('../utils/providerError');

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
