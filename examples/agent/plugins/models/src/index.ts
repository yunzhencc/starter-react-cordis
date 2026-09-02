import type { Context } from '@deepseek-ai/cordis';
import type { ModelMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

export interface ModelsConfig {
  apiKey?: string;
}

export interface ModelStreamRequest {
  abortSignal?: AbortSignal;
  messages: ModelMessage[];
}

export const MODEL_CONFIG_STORAGE_KEY = '@examples/agent-models:config';
const deepseek = {
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  name: 'deepseek',
};

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

  settings() {
    return this.config;
  }

  update(config: unknown) {
    this.config = parseConfig(config);
    writeStorage(MODEL_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
  }

  async* stream({ abortSignal, messages }: ModelStreamRequest): AsyncIterable<string> {
    const provider = createOpenAICompatible({
      apiKey: this.config.apiKey,
      baseURL: deepseek.baseURL,
      name: deepseek.name,
    });
    const result = streamText({
      abortSignal,
      maxRetries: 0,
      messages,
      model: provider(deepseek.model),
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
  if (!isRecord(value) || (value.apiKey !== undefined && typeof value.apiKey !== 'string'))
    throw new TypeError('models config apiKey must be a string');
  if (Object.keys(value).some(key => key !== 'apiKey'))
    throw new TypeError('models config only supports apiKey');
  return { apiKey: value.apiKey as string | undefined };
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
