import { useRuntime } from '@yunzhen/cordis-react-bridge'
import type { AppPlugin } from '@yunzhen/cordis-runtime'

export function SettingsPage() {
  const runtime = useRuntime()
  const settingsItems = [...runtime.settingsItems].sort((left, right) => left.order - right.order)

  return (
    <>
      <h1>Settings</h1>
      {settingsItems.map(({ id, Component }) => <Component key={id} />)}
    </>
  )
}

export const settingsPlugin: AppPlugin = (app) => {
  return app.addPage({
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    Component: SettingsPage,
  })
}
