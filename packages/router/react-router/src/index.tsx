import type { AppRuntime } from '@yunzhen/cordis-runtime'
import { AppShell } from '@yunzhen/cordis-ui-shell'
import { createBrowserRouter } from 'react-router-dom'

export function createAppRouter(runtime: AppRuntime) {
  return createBrowserRouter([
    {
      Component: AppShell,
      children: runtime.pages.map(({ Component, path }) => ({ Component, path })),
    },
  ])
}
