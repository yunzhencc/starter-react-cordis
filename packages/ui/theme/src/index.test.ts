// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uiThemePlugin } from './index'
import { ThemeRuntime } from './theme'

const tokens = readFileSync('packages/ui/theme/src/tokens.css', 'utf8')

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
    const style = document.head.querySelector<HTMLStyleElement>('style[data-cordis-ui-theme]')
    expect(style).not.toBeNull()

    const theme = runtime.get('theme')

    await runtime.dispose()

    expect(theme).toBeInstanceOf(ThemeRuntime)
    expect(runtime.get('theme')).toBeUndefined()
    expect(runtime.settingsItems).toEqual([])
    expect(document.head.querySelector('style[data-cordis-ui-theme]')).toBeNull()
  })

  it('applies the system font stack from the theme tokens', () => {
    const style = document.createElement('style')
    style.textContent = tokens
    document.head.append(style)

    expect(getComputedStyle(document.documentElement).fontFamily).toBe('system-ui, sans-serif')
    style.remove()
  })
})
