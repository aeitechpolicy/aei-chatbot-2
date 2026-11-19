function providerErrorDetails(error, apiKey = process.env.TOGETHER_API_KEY) {
  const body = error?.error;
  const message = [body?.message, body?.error?.message, typeof body === 'string' ? body : null, error?.message]
    .find(value => typeof value === 'string' && value.trim()) || 'No provider explanation returned.';
  const redact = value => {
    let text = String(value);
    if (apiKey) text = text.split(apiKey).join('[redacted]');
    return text.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
      .replace(/\b(?:tgp_v\d+_|sk-)[A-Za-z0-9_-]+\b/g, '[redacted]')
      .replace(/\b[a-f0-9]{64}\b/gi, '[redacted]')
      .replace(/[\r\n\t]+/g, ' ').slice(0, 800);
  };
  const headers = error?.headers;
  const requestId = error?.request_id || headers?.get?.('x-request-id') || headers?.['x-request-id'];
  return {
    status: Number.isInteger(error?.status) ? error.status : null,
    code: typeof error?.code === 'string' ? redact(error.code) : null,
    message: redact(message),
    ...(typeof requestId === 'string' ? { requestId: redact(requestId) } : {})
  };
}

// Numeric completion metadata only. Never log question, source, answer or reasoning text.
function completionDetails(response) {
  const usage = response?.usage;
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const finish = response?.choices?.[0]?.finish_reason;
  return {
    finishReason: ['stop', 'eos', 'length', 'tool_calls', 'function_call', 'content_filter'].includes(finish) ? finish : null,
    inputTokens: number(usage?.prompt_tokens),
    outputTokens: number(usage?.completion_tokens),
    reasoningTokens: number(usage?.completion_tokens_details?.reasoning_tokens),
    answerCharacters: typeof response?.choices?.[0]?.message?.content === 'string' ? response.choices[0].message.content.length : 0
  };
}

function emptyAnswerError(response) {
  const limited = response?.choices?.[0]?.finish_reason === 'length';
  return Object.assign(new Error(limited
    ? 'The model reached its output allowance before returning answer text. Review Usage and costs before retrying.'
    : 'The model returned no answer text. Review Usage and costs before retrying.'), {
    status: 502, code: limited ? 'empty_answer_output_limit' : 'empty_answer'
  });
}

function usageFailureCode(error) {
  return ['empty_answer', 'empty_answer_output_limit'].includes(error.code)
    ? error.code : String(error.status || error.code || 'request_error');
}

module.exports = { providerErrorDetails, completionDetails, emptyAnswerError, usageFailureCode };
