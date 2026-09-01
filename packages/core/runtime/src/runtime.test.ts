import type { AppPlugin, RouteNode } from '@yunzhen/cordis-runtime'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
import { describe, expect, it } from 'vitest'

declare module '@yunzhen/cordis-runtime' {
  interface AppServices {
    primitiveService: string
    testService: { name: string }
  }
}

describe('createAppRuntime', () => {
  it('keeps nested routes contributed by plugins in registration order', async () => {
    const first: AppPlugin = app => app.addRoute({
      id: 'dashboard',
      index: true,
      Component: () => null,
      navigation: { label: 'Dashboard', order: 0 },
    })
    const second: AppPlugin = app => app.addRoute({
      id: 'settings',
      path: 'settings',
      Component: () => null,
      navigation: { label: 'Settings', order: 100 },
      children: [{ id: 'appearance', path: 'appearance', Component: () => null }],
    })

    const runtime = await createAppRuntime([first, second])

    expect(runtime.routes).toEqual([
      expect.objectContaining({ id: 'dashboard', index: true }),
      expect.objectContaining({ id: 'settings', path: 'settings', children: [expect.objectContaining({ id: 'appearance' })] }),
    ])
    expect(runtime.routes).not.toBe(runtime.routes)
    await runtime.dispose()
  })

  it('removes only the route registered by its disposer', async () => {
    let removeFirst!: () => void
    const runtime = await createAppRuntime([
      (app) => {
        removeFirst = app.addRoute({ id: 'dashboard', index: true, Component: () => null })
      },
      app => app.addRoute({ id: 'settings', path: 'settings', Component: () => null }),
    ])

    removeFirst()
    expect(runtime.routes.map(route => route.id)).toEqual(['settings'])
    await runtime.dispose()
  })

  it.each<[string, RouteNode, string]>([
    ['duplicate ids across levels', {
      id: 'dashboard',
      path: 'dashboard',
      Component: () => null,
      children: [{ id: 'dashboard', path: 'nested', Component: () => null }],
    }, 'duplicate id'],
    ['index routes with paths', { id: 'dashboard', index: true, path: 'dashboard', Component: () => null }, 'index route'],
    ['index routes with children', {
      id: 'dashboard',
      index: true,
      Component: () => null,
      children: [{ id: 'nested', path: 'nested', Component: () => null }],
    }, 'index route cannot have children'],
    ['two index siblings', {
      id: 'settings',
      path: 'settings',
      Component: () => null,
      children: [
        { id: 'first', index: true, Component: () => null },
        { id: 'second', index: true, Component: () => null },
      ],
    }, 'index route'],
    ['duplicate sibling paths', {
      id: 'settings',
      path: 'settings',
      Component: () => null,
      children: [
        { id: 'first', path: 'appearance', Component: () => null },
        { id: 'second', path: 'appearance', Component: () => null },
      ],
    }, 'duplicate sibling path'],
    ['absolute paths', { id: 'settings', path: '/settings', Component: () => null }, 'relative'],
    ['empty paths', { id: 'settings', path: '', Component: () => null }, 'relative'],
    ['current-directory paths', { id: 'settings', path: '.', Component: () => null }, 'relative'],
    ['parent-directory paths', { id: 'settings', path: '..', Component: () => null }, 'relative'],
    ['navigation without a route target', {
      id: 'settings',
      Component: () => null,
      navigation: { label: 'Settings', order: 100 },
    }, 'navigation'],
  ])('rejects %s', async (_, route, message) => {
    await expect(createAppRuntime([app => app.addRoute(route)])).rejects.toThrow(message)
  })

  it('collects a service declared through the public package entry', async () => {
    const plugin: AppPlugin = (app) => {
      const removeTheme = app.provide('testService', { name: 'light' })
      const removeItem = app.addSettingsItem({ id: 'appearance', order: 100, Component: () => null })
      return () => {
        removeItem()
        removeTheme()
      }
    }
    const runtime = await createAppRuntime([plugin])
    expect(runtime.get('testService')).toEqual({ name: 'light' })
    expect(runtime.settingsItems.map(item => item.id)).toEqual(['appearance'])
    await runtime.dispose()
  })

  it('does not let an older registration remove the same service object registered later', async () => {
    const service = { name: 'shared' }
    let removeFirst!: () => void
    let removeSecond!: () => void
    const runtime = await createAppRuntime([
      (app) => {
        removeFirst = app.provide('testService', service)
        return removeFirst
      },
      (app) => {
        removeSecond = app.provide('testService', service)
        return removeSecond
      },
    ])

    removeFirst()
    expect(runtime.get('testService')).toBe(service)
    removeSecond()
    expect(runtime.get('testService')).toBeUndefined()
    await runtime.dispose()
  })

  it('does not let an older registration remove the same primitive registered later', async () => {
    let removeFirst!: () => void
    let removeSecond!: () => void
    const runtime = await createAppRuntime([
      (app) => {
        removeFirst = app.provide('primitiveService', 'shared')
        return removeFirst
      },
      (app) => {
        removeSecond = app.provide('primitiveService', 'shared')
        return removeSecond
      },
    ])

    removeFirst()
    expect(runtime.get('primitiveService')).toBe('shared')
    removeSecond()
    expect(runtime.get('primitiveService')).toBeUndefined()
    await runtime.dispose()
  })
})
