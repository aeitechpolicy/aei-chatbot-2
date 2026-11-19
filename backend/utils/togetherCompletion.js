async function togetherCompletion(client, request, { timeoutMs = 45000 } = {}) {
  const stream = await client.chat.completions.create({
    ...request,
    stream: true,
    stream_options: { include_usage: true }
  }, { signal: AbortSignal.timeout(timeoutMs), timeout: timeoutMs });

  let content = '';
  let model = request.model;
  let finishReason = null;
  let usage;
  for await (const chunk of stream) {
    if (chunk.model) model = chunk.model;
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.find(item => item.index === 0);
    if (typeof choice?.delta?.content === 'string') content += choice.delta.content;
    if (choice?.finish_reason) finishReason = choice.finish_reason;
  }

  if (!['stop', 'eos', 'length'].includes(finishReason)) {
    throw Object.assign(new Error('The model response was interrupted. Check Usage and costs before trying again.'), {
      status: 502,
      code: 'incomplete_stream'
    });
  }

  return {
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage
  };
}

module.exports = { togetherCompletion };
