/// <reference types="node" />

import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the runnable agent example under examples/agent', () => {
  expect(existsSync(new URL('../examples/agent/cordis.yml', import.meta.url))).toBe(true);
});

it.each(['dashboard', 'settings-general', 'settings-appearance', 'settings-language'])('keeps the %s plugin with the agent example', (plugin) => {
  expect(existsSync(new URL(`../examples/agent/plugins/${plugin}/package.json`, import.meta.url))).toBe(true);
  expect(existsSync(new URL(`../packages/feature/${plugin}/package.json`, import.meta.url))).toBe(false);
});
