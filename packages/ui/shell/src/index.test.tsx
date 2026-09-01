// @vitest-environment jsdom

import { RuntimeProvider } from '@yunzhen/cordis-react-bridge'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from './index'
import styles from './index.module.css'

describe('appShell', () => {
  it('marks only the current non-root navigation item as active', async () => {
    const EmptyPage = () => null
    const runtime = {
      routes: [
        { id: 'dashboard', index: true, Component: EmptyPage, navigation: { label: 'Dashboard', order: 0 } },
        { id: 'settings', path: 'settings', Component: EmptyPage, navigation: { label: 'Settings', order: 10 } },
      ],
      settingsItems: [],
      get: () => undefined,
      dispose: async () => {},
    } as Parameters<typeof RuntimeProvider>[0]['runtime']
    const router = createMemoryRouter([
      {
        Component: AppShell,
        children: [
          { index: true, Component: () => null },
          { path: 'settings', Component: () => null },
        ],
      },
    ], { initialEntries: ['/settings'] })
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <RuntimeProvider runtime={runtime}>
            <RouterProvider router={router} />
          </RuntimeProvider>,
        )
      })

      expect(container.querySelector('a[href="/"]')?.className).toBe(styles.link)
      expect(container.querySelector('a[href="/settings"]')?.className).toBe(styles.activeLink)
    }
    finally {
      await act(async () => root.unmount())
      router.dispose()
      container.remove()
      await runtime.dispose()
    }
  })
})
