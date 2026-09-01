import { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'
import type { AppServices } from './index'

export interface RouteNavigation {
  label: string
  order: number
}

export interface RouteNode {
  id: string
  Component: ComponentType
  path?: string
  index?: boolean
  ErrorComponent?: ComponentType
  children?: readonly RouteNode[]
  navigation?: RouteNavigation
}

export interface SettingsItem {
  id: string
  order: number
  Component: ComponentType
}

export interface AppContext {
  addRoute(route: RouteNode): () => void
  addSettingsItem(item: SettingsItem): () => void
  provide<K extends keyof AppServices>(key: K, value: AppServices[K]): () => void
}

export type AppPlugin = (app: AppContext) => void | (() => void)

export interface AppRuntime {
  readonly routes: readonly RouteNode[]
  readonly settingsItems: readonly SettingsItem[]
  get<K extends keyof AppServices>(key: K): AppServices[K] | undefined
  dispose(): Promise<void>
}

export async function createAppRuntime(plugins: readonly AppPlugin[]): Promise<AppRuntime> {
  const cordis = new Context()
  const routes: RouteNode[] = []
  const settingsItems: SettingsItem[] = []
  const services = new Map<keyof AppServices, { value: unknown }>()
  const app: AppContext = {
    addRoute(route) {
      routes.push(route)

      return () => {
        const index = routes.indexOf(route)
        if (index !== -1) routes.splice(index, 1)
      }
    },
    addSettingsItem(item) {
      settingsItems.push(item)

      return () => {
        const index = settingsItems.indexOf(item)
        if (index !== -1) settingsItems.splice(index, 1)
      }
    },
    provide(key, value) {
      const entry = { value }
      services.set(key, entry)

      return () => {
        if (services.get(key) === entry) services.delete(key)
      }
    },
  }
  const fibers = plugins.map((plugin) => cordis.plugin(() => plugin(app)))

  await Promise.all(fibers)
  validateRoutes(routes)

  return {
    get routes() {
      return [...routes]
    },
    get settingsItems() {
      return [...settingsItems]
    },
    get(key) {
      return services.get(key)?.value as AppServices[typeof key] | undefined
    },
    async dispose() {
      await Promise.all(fibers.map((fiber) => fiber.dispose()))
    },
  }
}

function validateRoutes(routes: readonly RouteNode[]) {
  const ids = new Set<string>()

  const validateSiblings = (siblings: readonly RouteNode[]) => {
    const paths = new Set<string>()
    let hasIndex = false

    for (const route of siblings) {
      if (ids.has(route.id)) throw new Error(`duplicate id: ${route.id}`)
      ids.add(route.id)

      if (route.index) {
        if (route.path !== undefined) throw new Error(`index route cannot have a path: ${route.id}`)
        if (route.children) throw new Error(`index route cannot have children: ${route.id}`)
        if (hasIndex) throw new Error('only one index route is allowed per sibling group')
        hasIndex = true
      }
      else {
        if (route.navigation && !route.path) throw new Error(`navigation route requires an index or path: ${route.id}`)
        if (!route.path || route.path.startsWith('/') || route.path === '.' || route.path === '..') {
          throw new Error(`route path must be a non-empty relative path: ${route.id}`)
        }
        if (paths.has(route.path)) throw new Error(`duplicate sibling path: ${route.path}`)
        paths.add(route.path)
      }

      if (route.children) validateSiblings(route.children)
    }
  }

  validateSiblings(routes)
}
