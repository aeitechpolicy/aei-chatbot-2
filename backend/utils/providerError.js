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

module.exports = { providerErrorDetails };
