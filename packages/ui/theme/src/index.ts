import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-renderer';
import { createElement } from 'react';
import { AppearanceSettings } from './appearance-settings-item';
import { installThemeStyles } from './styles';
import { ThemeRuntime } from './theme';

declare module '@deepseek-ai/cordis' {
  interface Context {
    theme: ThemeRuntime;
  }
}

export const inject = ['slots'];

export function apply(ctx: Context) {
  const theme = new ThemeRuntime();
  ctx.reflect.provide('theme', theme);
  ctx.effect(installThemeStyles, 'theme.styles()');
  ctx.effect(() => () => theme.dispose(), 'theme.dispose()');
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    { name: 'settings.section', id: 'appearance', order: 100 },
    () => createElement(AppearanceSettings, { theme }),
  ));
}
