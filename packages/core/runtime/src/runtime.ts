import { Context } from '@deepseek-ai/cordis'
import type { ComponentType } from 'react'

export interface Page {
  id: string
  path: string
  label: string
  Component: ComponentType
}

export interface AppContext {
  addPage(page: Page): () => void
}

export type AppPlugin = (app: AppContext) => void | (() => void)

export interface AppRuntime {
  readonly pages: readonly Page[]
  dispose(): Promise<void>
}

export async function createAppRuntime(plugins: readonly AppPlugin[]): Promise<AppRuntime> {
  const cordis = new Context()
  const pages: Page[] = []
  const app: AppContext = {
    addPage(page) {
      pages.push(page)

      return () => {
        const index = pages.indexOf(page)
        if (index !== -1) pages.splice(index, 1)
      }
    },
  }
  const fibers = plugins.map((plugin) => cordis.plugin(() => plugin(app)))

  await Promise.all(fibers)

  return {
    get pages() {
      return [...pages]
    },
    async dispose() {
      await Promise.all(fibers.map((fiber) => fiber.dispose()))
    },
  }
}
