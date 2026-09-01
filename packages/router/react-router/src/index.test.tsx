// @vitest-environment jsdom

import type { AppPlugin } from '@yunzhen/cordis-runtime'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
import { AppShell } from '@yunzhen/cordis-ui-shell'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from './index'
import { NotFoundPage } from './not-found-page'
import { RouteErrorPage } from './route-error-page'

describe('createAppRouter', () => {
  it('converts nested route contributions and appends a fallback route', async () => {
    const Workspace = () => null
    const WorkspaceIndex = () => null
    const WorkspaceItem = () => null
    const WorkspaceError = () => null
    const plugin: AppPlugin = app => app.addRoute({
      id: 'workspace',
      path: 'workspace',
      Component: Workspace,
      children: [
        { id: 'workspace-index', index: true, Component: WorkspaceIndex },
        { id: 'workspace-item', path: ':id', Component: WorkspaceItem, ErrorComponent: WorkspaceError },
      ],
    })
    const runtime = await createAppRuntime([plugin])
    const [root] = createAppRouter(runtime).routes
    const [workspace, fallback] = root?.children ?? []

    expect(root).toMatchObject({
      element: { type: AppShell },
      errorElement: { type: RouteErrorPage },
    })
    expect(workspace).toMatchObject({ path: 'workspace', element: { type: Workspace } })
    expect(workspace?.children).toMatchObject([
      { index: true, element: { type: WorkspaceIndex } },
      { path: ':id', element: { type: WorkspaceItem }, errorElement: { type: WorkspaceError } },
    ])
    expect(fallback).toMatchObject({ path: '*', element: { type: NotFoundPage } })
    await runtime.dispose()
  })
})
