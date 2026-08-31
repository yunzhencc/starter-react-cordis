// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createAppRuntime, type AppPlugin } from '@yunzhen/cordis-runtime'
import { createAppRouter } from './index'

describe('createAppRouter', () => {
  it('creates routes for every registered page', async () => {
    const plugin: AppPlugin = (app) => app.addPage({ id: 'home', path: '/', label: 'Home', Component: () => null })
    const runtime = await createAppRuntime([plugin])

    expect(createAppRouter(runtime).routes[0]?.children).toHaveLength(1)
    await runtime.dispose()
  })
})
