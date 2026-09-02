/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the runnable agent example under examples/agent', () => {
  expect(existsSync(new URL('../examples/agent/cordis.yml', import.meta.url))).toBe(true);
});

it.each(['dashboard', 'settings-general', 'settings-appearance', 'settings-language', 'settings-layout'])('keeps the %s plugin with the agent example', (plugin) => {
  expect(existsSync(new URL(`../examples/agent/plugins/${plugin}/package.json`, import.meta.url))).toBe(true);
  expect(existsSync(new URL(`../packages/feature/${plugin}/package.json`, import.meta.url))).toBe(false);
});

it('does not keep the agent settings layout in the UI package layer', () => {
  expect(existsSync(new URL('../packages/ui/settings-layout/package.json', import.meta.url))).toBe(false);
});

it('names agent packages in the @examples namespace', () => {
  const names = [
    '../examples/agent/package.json',
    '../examples/agent/plugins/dashboard/package.json',
    '../examples/agent/plugins/settings-general/package.json',
    '../examples/agent/plugins/settings-appearance/package.json',
    '../examples/agent/plugins/settings-language/package.json',
    '../examples/agent/plugins/settings-layout/package.json',
  ].map(path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')).name);

  expect(names).toEqual([
    '@examples/agent',
    '@examples/agent-dashboard',
    '@examples/agent-settings-general',
    '@examples/agent-settings-appearance',
    '@examples/agent-settings-language',
    '@examples/agent-settings-layout',
  ]);
});
