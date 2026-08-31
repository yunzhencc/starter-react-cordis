// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FONT_SIZE_STORAGE_KEY,
  PREFERENCE_STORAGE_KEY,
  ThemeRuntime,
} from './theme'

class MediaQuery {
  matches = true
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>()

  addEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'change', listener: (event: MediaQueryListEvent) => void) {
    this.listeners.delete(listener)
  }

  emit(matches: boolean) {
    this.matches = matches
    for (const listener of this.listeners) listener({ matches } as MediaQueryListEvent)
  }
}

const mediaQuery = new MediaQuery()

describe('ThemeRuntime', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
    mediaQuery.matches = true
    vi.stubGlobal('matchMedia', () => mediaQuery)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses system dark mode when there is no saved preference', () => {
    const theme = new ThemeRuntime()

    expect(theme.snapshot).toMatchObject({ preference: 'system', resolvedTheme: 'dark', fontSize: 16 })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('restores valid storage and falls back from invalid font size', () => {
    localStorage.setItem(PREFERENCE_STORAGE_KEY, 'light')
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, '200')

    expect(new ThemeRuntime().snapshot).toMatchObject({ preference: 'light', resolvedTheme: 'light', fontSize: 16 })
  })

  it('reacts to media changes only while preference is system', () => {
    const theme = new ThemeRuntime()
    mediaQuery.emit(true)
    expect(theme.snapshot.resolvedTheme).toBe('dark')
    theme.setTheme('light')
    mediaQuery.emit(false)
    expect(theme.snapshot.resolvedTheme).toBe('light')
  })

  it('clamps font size, persists it, and updates the CSS custom property', () => {
    const theme = new ThemeRuntime()
    theme.setFontSize(100)

    expect(theme.snapshot.fontSize).toBe(20)
    expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe('20')
    expect(document.documentElement.style.getPropertyValue('--app-content-font-size')).toBe('20px')
  })

  it('keeps the page usable when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(() => new ThemeRuntime()).not.toThrow()
  })

  it('ignores media changes after disposal', () => {
    const theme = new ThemeRuntime()
    theme.dispose()
    mediaQuery.emit(false)

    expect(theme.snapshot.resolvedTheme).toBe('dark')
  })
})
