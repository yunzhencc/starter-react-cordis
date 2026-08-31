import type { AppPlugin } from '@yunzhen/cordis-runtime'
import { createAppearanceSettingsItem } from './appearance-settings-item'
import { installThemeStyles } from './styles'
import { ThemeRuntime } from './theme'

declare module '@yunzhen/cordis-runtime' {
  interface AppServices {
    theme: ThemeRuntime
  }
}

export const uiThemePlugin: AppPlugin = (app) => {
  const theme = new ThemeRuntime()
  const removeStyles = installThemeStyles()
  const removeTheme = app.provide('theme', theme)
  const removeSettingsItem = app.addSettingsItem(createAppearanceSettingsItem(theme))

  return () => {
    removeSettingsItem()
    removeTheme()
    removeStyles()
    theme.dispose()
  }
}
