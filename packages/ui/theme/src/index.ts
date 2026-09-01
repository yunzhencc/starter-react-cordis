import type { AppPlugin } from '@yunzhen/cordis-runtime';
import { createElement } from 'react';
import { createAppearanceSettingsItem } from './appearance-settings-item';
import { installThemeStyles } from './styles';
import { ThemeRuntime } from './theme';
import { ThemeToggle } from './theme-toggle';

declare module '@yunzhen/cordis-runtime' {
  interface AppServices {
    theme: ThemeRuntime;
  }
}

export const uiThemePlugin: AppPlugin = (app) => {
  const theme = new ThemeRuntime();
  const removeStyles = installThemeStyles();
  const removeTheme = app.provide('theme', theme);
  const removeSettingsItem = app.addSettingsItem(createAppearanceSettingsItem(theme));
  const removeThemeToggle = app.addSlotItem({
    id: 'theme-toggle',
    slot: 'shell.content.header',
    order: 100,
    Component: () => createElement(ThemeToggle, { theme }),
  });

  return () => {
    removeThemeToggle();
    removeSettingsItem();
    removeTheme();
    removeStyles();
    theme.dispose();
  };
};
