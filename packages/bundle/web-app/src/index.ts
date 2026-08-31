import { dashboardPlugin } from '@yunzhen/cordis-feature-dashboard'
import { settingsPlugin } from '@yunzhen/cordis-feature-settings'
import type { AppPlugin } from '@yunzhen/cordis-runtime'

export const webAppPlugins: readonly AppPlugin[] = [dashboardPlugin, settingsPlugin]
