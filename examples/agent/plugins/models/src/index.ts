import type { Context } from '@deepseek-ai/cordis';
import type { ModelMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

export interface ModelDefinition {
  baseURL: string;
  id: string;
  label: string;
  model: string;
  provider: string;
}

export interface ModelsConfig {
  defaultModel: string;
  models: readonly ModelConfig[];
}

export interface ModelStreamRequest {
  abortSignal?: AbortSignal;
  messages: ModelMessage[];
  modelId: string;
}

export interface ModelConfig extends ModelDefinition {
  apiKey?: string;
}

export const MODEL_CONFIG_STORAGE_KEY = '@examples/agent-models:config';

declare module '@deepseek-ai/cordis' {
  interface Context {
    models: ModelRegistry;
  }
}

export class ModelRegistry {
  private config: ModelsConfig;

  constructor(config: unknown) {
    this.config = readStoredConfig(config);
  }

  get defaultModelId() {
    return this.config.defaultModel;
  }

  snapshot() {
    return Object.freeze(this.config.models.map(({ apiKey: _apiKey, ...model }) => Object.freeze(model)));
  }

  settings() {
    return this.config;
  }

  update(config: unknown) {
    this.config = parseConfig(config);
    writeStorage(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
  }

  async* stream({ abortSignal, messages, modelId }: ModelStreamRequest): AsyncIterable<string> {
    const entry = this.config.models.find(item => item.id === modelId);
    if (!entry)
      throw new Error(`unknown model: ${modelId}`);

    const provider = createOpenAICompatible({
      apiKey: entry.apiKey,
      baseURL: entry.baseURL,
      name: entry.provider,
    });
    const result = streamText({
      abortSignal,
      maxRetries: 0,
      messages,
      model: provider(entry.model),
    });
    for await (const text of result.textStream) yield text;
  }
}

export const inject: string[] = [];

export function apply(ctx: Context, config: unknown) {
  const models = new ModelRegistry(config);
  ctx.reflect.provide('models', models);
}

function parseConfig(value: unknown): ModelsConfig {
  if (!isRecord(value) || typeof value.defaultModel !== 'string' || !Array.isArray(value.models))
    throw new TypeError('models config requires defaultModel and models');

  const models = value.models.map(parseModel);
  const ids = new Set<string>();
  for (const model of models) {
    if (ids.has(model.id))
      throw new TypeError(`duplicate model: ${model.id}`);
    ids.add(model.id);
  }
  if (!ids.has(value.defaultModel))
    throw new TypeError(`default model is not configured: ${value.defaultModel}`);
  return { defaultModel: value.defaultModel, models: Object.freeze(models) };
}

function parseModel(value: unknown): ModelConfig {
  if (!isRecord(value))
    throw new TypeError('model config must be an object');

  const fields = ['id', 'label', 'provider', 'baseURL', 'model'] as const;
  for (const field of fields) {
    if (typeof value[field] !== 'string' || value[field].trim() === '')
      throw new TypeError(`model ${field} must be a non-empty string`);
  }
  if (value.apiKey !== undefined && typeof value.apiKey !== 'string')
    throw new TypeError('model apiKey must be a string');

  return {
    apiKey: value.apiKey as string | undefined,
    baseURL: value.baseURL as string,
    id: value.id as string,
    label: value.label as string,
    model: value.model as string,
    provider: value.provider as string,
  };
}

function readStoredConfig(defaultConfig: unknown) {
  const value = readStorage(MODEL_CONFIG_STORAGE_KEY);
  if (value === null)
    return parseConfig(defaultConfig);
  try {
    return parseConfig(JSON.parse(value));
  }
  catch {
    return parseConfig(defaultConfig);
  }
}

function readStorage(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  }
  catch {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
