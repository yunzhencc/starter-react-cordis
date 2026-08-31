import { describe, expect, it } from 'vitest'
import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app'
import { createAppRuntime } from '@yunzhen/cordis-runtime'

describe('webAppPlugins', () => {
  it('loads the built-in dashboard and settings pages', async () => {
    const runtime = await createAppRuntime(webAppPlugins)

    expect(runtime.pages.map(({ id, path }) => [id, path])).toEqual([
      ['dashboard', '/'],
      ['settings', '/settings'],
    ])
    await runtime.dispose()
  })
})
