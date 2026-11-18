// Server-controlled choices only. Prices are uncached USD per million tokens.
// Together model pages checked 2026-11-17. Final billing can differ.
const TEST_MODELS = Object.freeze([
  { id: 'Qwen/Qwen3.8-Flash', label: 'Qwen3.8 Flash', inputRate: 0.15, outputRate: 0.47,
    parameters: { reasoning: { enabled: false } }, priceUrl: 'https://www.together.ai/models/qwen3-8-flash' },
  { id: 'zai-org/GLM-5.3-Flash', label: 'GLM-5.3-Flash', inputRate: 0.15, outputRate: 0.50,
    parameters: { reasoning_effort: 'low' }, priceUrl: 'https://www.together.ai/models/glm-5-3-flash' },
  { id: 'openai/gpt-oss-120b', label: 'gpt-oss-120B', inputRate: 0.15, outputRate: 0.60,
    parameters: { reasoning_effort: 'low' }, priceUrl: 'https://www.together.ai/models/gpt-oss-120b' }
].map(model => Object.freeze({ ...model, priceSource: `${model.priceUrl}, checked 2026-11-17; uncached estimates, not final billing` })));

// A single owner-only trial; ordinary accounts and the three-model tester keep
// their existing defaults and limits.
const MUSE_TEST_MODEL = Object.freeze({
  id: 'meta-models/Muse-Spark-Open-816B-A42B', label: 'Meta Muse Spark Open',
  inputRate: 1.25, outputRate: 4.25, parameters: Object.freeze({}),
  maxOutputTokens: 4096,
  maxEstimatedUsd: 0.05,
  priceSource: 'https://www.together.ai/models/muse-spark-open, checked 2026-11-18; uncached estimates, not final billing'
});

function selectedModels(ids) {
  const selected = ids === undefined ? TEST_MODELS.map(model => model.id) : ids;
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > TEST_MODELS.length ||
      new Set(selected).size !== selected.length || selected.some(id => !TEST_MODELS.some(model => model.id === id))) {
    throw Object.assign(new Error('Choose one to three of the listed comparison models.'), { status: 400, code: 'model_selection' });
  }
  return selected.map(id => TEST_MODELS.find(model => model.id === id));
}

function estimatedCost(usage, model) {
  return usage && Number.isSafeInteger(usage.prompt_tokens) && usage.prompt_tokens >= 0 &&
    Number.isSafeInteger(usage.completion_tokens) && usage.completion_tokens >= 0
    ? (usage.prompt_tokens * model.inputRate + usage.completion_tokens * model.outputRate) / 1e6 : null;
}

module.exports = { TEST_MODELS, MUSE_TEST_MODEL, selectedModels, estimatedCost };
