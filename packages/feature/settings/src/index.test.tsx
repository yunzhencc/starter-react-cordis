import { RuntimeProvider } from '@yunzhen/cordis-react-bridge'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { SettingsPage } from './index'

let container: HTMLDivElement | undefined

afterEach(() => {
  container?.remove()
  container = undefined
})

describe('settingsPage', () => {
  it('renders runtime settings items by order', async () => {
    const runtime = await createAppRuntime([
      app => app.addSettingsItem({ id: 'second', order: 20, Component: () => <>second</> }),
      app => app.addSettingsItem({ id: 'first', order: 10, Component: () => <>first</> }),
    ])
    container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <RuntimeProvider runtime={runtime}>
          <SettingsPage />
        </RuntimeProvider>,
      )
    })

    expect(container.textContent).toBe('Settingsfirstsecond')

    await act(async () => root.unmount())
    await runtime.dispose()
  })
})
