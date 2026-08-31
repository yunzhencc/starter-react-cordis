// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app'
import { createAppRuntime } from '@yunzhen/cordis-runtime'

describe('webAppPlugins', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.querySelector('style[data-cordis-ui-theme]')?.remove()
  })

  it('loads the built-in dashboard and settings pages', async () => {
    const runtime = await createAppRuntime(webAppPlugins)

    expect(runtime.pages.map(({ id, path }) => [id, path])).toEqual([
      ['dashboard', '/'],
      ['settings', '/settings'],
    ])
    expect(runtime.get('theme')).toBeDefined()
    expect(runtime.settingsItems.map((item) => item.id)).toEqual(['appearance'])
    await runtime.dispose()
  })
})
