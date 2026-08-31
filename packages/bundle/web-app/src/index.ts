import { dashboardPlugin } from '@yunzhen/cordis-feature-dashboard'
import { settingsPlugin } from '@yunzhen/cordis-feature-settings'
import { uiThemePlugin } from '@yunzhen/cordis-ui-theme'

export const webAppPlugins = [uiThemePlugin, dashboardPlugin, settingsPlugin] as const
