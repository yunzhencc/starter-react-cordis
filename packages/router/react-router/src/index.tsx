import type { AppRuntime, RouteNode } from '@yunzhen/cordis-runtime'
import { AppShell } from '@yunzhen/cordis-ui-shell'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { NotFoundPage } from './not-found-page'
import { RouteErrorPage } from './route-error-page'

function toReactRouterRoute(route: RouteNode): RouteObject {
  const base = {
    Component: route.Component,
    ...(route.ErrorComponent ? { ErrorBoundary: route.ErrorComponent } : {}),
  }

  if (route.index) return { ...base, index: true }

  return {
    ...base,
    path: route.path,
    ...(route.children ? { children: route.children.map(toReactRouterRoute) } : {}),
  }
}

export function createAppRouter(runtime: AppRuntime) {
  return createBrowserRouter([
    {
      Component: AppShell,
      ErrorBoundary: RouteErrorPage,
      children: [
        ...runtime.routes.map(toReactRouterRoute),
        { path: '*', Component: NotFoundPage },
      ],
    },
  ])
}
