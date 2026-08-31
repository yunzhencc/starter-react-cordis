import { describe, expect, it } from 'vitest'
import { createAppRuntime, type AppPlugin } from '@yunzhen/cordis-runtime'

declare module '@yunzhen/cordis-runtime' {
  interface AppServices {
    testService: { name: string }
  }
}

describe('createAppRuntime', () => {
  it('keeps pages contributed by plugins in registration order', async () => {
    const first: AppPlugin = (app) => app.addPage({ id: 'home', path: '/', label: 'Home', Component: () => null })
    const second: AppPlugin = (app) => app.addPage({ id: 'settings', path: '/settings', label: 'Settings', Component: () => null })

    const runtime = await createAppRuntime([first, second])

    expect(runtime.pages.map((page) => page.id)).toEqual(['home', 'settings'])
    await runtime.dispose()
  })

  it('collects a service declared through the public package entry', async () => {
    const plugin: AppPlugin = (app) => {
      const removeTheme = app.provide('testService', { name: 'light' })
      const removeItem = app.addSettingsItem({ id: 'appearance', order: 100, Component: () => null })
      return () => { removeItem(); removeTheme() }
    }
    const runtime = await createAppRuntime([plugin])
    expect(runtime.get('testService')).toEqual({ name: 'light' })
    expect(runtime.settingsItems.map((item) => item.id)).toEqual(['appearance'])
    await runtime.dispose()
  })
})
