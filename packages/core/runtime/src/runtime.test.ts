import { describe, expect, it } from 'vitest'
import { createAppRuntime, type AppPlugin } from './runtime'

describe('createAppRuntime', () => {
  it('keeps pages contributed by plugins in registration order', async () => {
    const first: AppPlugin = (app) => app.addPage({ id: 'home', path: '/', label: 'Home', Component: () => null })
    const second: AppPlugin = (app) => app.addPage({ id: 'settings', path: '/settings', label: 'Settings', Component: () => null })

    const runtime = await createAppRuntime([first, second])

    expect(runtime.pages.map((page) => page.id)).toEqual(['home', 'settings'])
    await runtime.dispose()
  })
})
