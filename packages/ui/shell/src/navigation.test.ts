import type { RouteNode } from '@yunzhen/cordis-runtime'
import { describe, expect, it } from 'vitest'
import { getNavigationItems } from './navigation'

const EmptyPage = () => null

describe('getNavigationItems', () => {
  it('collects navigable routes with their resolved paths and order', () => {
    const routes: RouteNode[] = [
      {
        id: 'dashboard',
        index: true,
        Component: EmptyPage,
        navigation: { label: 'Dashboard', order: 20 },
      },
      {
        id: 'settings',
        path: 'settings',
        Component: EmptyPage,
        navigation: { label: 'Settings', order: 30 },
      },
      {
        id: 'workspace',
        path: 'workspace',
        Component: EmptyPage,
        children: [
          {
            id: 'workspace-item',
            path: ':id',
            Component: EmptyPage,
            navigation: { label: 'Workspace', order: 10 },
          },
        ],
      },
    ]

    expect(getNavigationItems(routes)).toEqual([
      { id: 'workspace-item', label: 'Workspace', path: '/workspace/:id' },
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'settings', label: 'Settings', path: '/settings' },
    ])
  })
})
