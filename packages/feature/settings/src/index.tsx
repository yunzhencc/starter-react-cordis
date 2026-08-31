import type { AppPlugin } from '@yunzhen/cordis-runtime'

export function SettingsPage() {
  return <h1>Settings</h1>
}

export const settingsPlugin: AppPlugin = (app) => {
  return app.addPage({
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    Component: SettingsPage,
  })
}
