/** Curated design-time options. Provider access is checked by the future execution service. */
export const modelCatalog = [
  { provider: 'anthropic', id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { provider: 'anthropic', id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { provider: 'anthropic', id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { provider: 'anthropic', id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  { provider: 'openai', id: 'gpt-5.1', name: 'GPT-5.1' },
  { provider: 'openai', id: 'gpt-5-mini', name: 'GPT-5 mini' },
  { provider: 'google', id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { provider: 'google', id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
] as const;

export type ModelProvider = (typeof modelCatalog)[number]['provider'];
export type ModelEffort = 'low' | 'medium' | 'high';
export type ModelConfig = {
  provider: ModelProvider;
  modelId: string;
  effort: ModelEffort;
};

export const providers: { id: ModelProvider; label: string }[] = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'google', label: 'Google' },
];

export function modelName(config?: ModelConfig) {
  if (!config) return 'Choose a model';
  return modelCatalog.find((model) => model.id === config.modelId)?.name ?? config.modelId;
}
