// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
import { ThemeRuntime } from './theme'
import { uiThemePlugin } from './index'

describe('uiThemePlugin', () => {
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

  it('contributes the theme service, appearance settings item, and removable styles', async () => {
    const runtime = await createAppRuntime([uiThemePlugin])

    expect(runtime.get('theme')).toBeInstanceOf(ThemeRuntime)
    expect(runtime.settingsItems.map(({ id, order }) => [id, order])).toEqual([['appearance', 100]])
    expect(document.head.querySelector('style[data-cordis-ui-theme]')).not.toBeNull()

    await runtime.dispose()

    expect(document.head.querySelector('style[data-cordis-ui-theme]')).toBeNull()
  })
})
