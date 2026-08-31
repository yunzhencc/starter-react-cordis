import { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'

export interface Page {
  id: string
  path: string
  label: string
  Component: ComponentType
}

export interface AppServices {}

export interface SettingsItem {
  id: string
  order: number
  Component: ComponentType
}

export interface AppContext {
  addPage(page: Page): () => void
  addSettingsItem(item: SettingsItem): () => void
  provide<K extends keyof AppServices>(key: K, value: AppServices[K]): () => void
}

export type AppPlugin = (app: AppContext) => void | (() => void)

export interface AppRuntime {
  readonly pages: readonly Page[]
  readonly settingsItems: readonly SettingsItem[]
  get<K extends keyof AppServices>(key: K): AppServices[K] | undefined
  dispose(): Promise<void>
}

export async function createAppRuntime(plugins: readonly AppPlugin[]): Promise<AppRuntime> {
  const cordis = new Context()
  const pages: Page[] = []
  const settingsItems: SettingsItem[] = []
  const services = new Map<keyof AppServices, unknown>()
  const app: AppContext = {
    addPage(page) {
      pages.push(page)

      return () => {
        const index = pages.indexOf(page)
        if (index !== -1) pages.splice(index, 1)
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
      services.set(key, value)

      return () => {
        if (services.get(key) === value) services.delete(key)
      }
    },
  }
  const fibers = plugins.map((plugin) => cordis.plugin(() => plugin(app)))

  await Promise.all(fibers)

  return {
    get pages() {
      return [...pages]
    },
    get settingsItems() {
      return [...settingsItems]
    },
    get(key) {
      return services.get(key) as AppServices[typeof key] | undefined
    },
    async dispose() {
      await Promise.all(fibers.map((fiber) => fiber.dispose()))
    },
  }
}
