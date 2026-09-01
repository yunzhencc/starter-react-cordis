import type { AppRuntime } from '@yunzhen/cordis-runtime'
import type { ReactNode } from 'react'
import { createContext, use } from 'react'

const RuntimeContext = createContext<AppRuntime | null>(null)

export function RuntimeProvider({ children, runtime }: { children: ReactNode, runtime: AppRuntime }) {
  return <RuntimeContext value={runtime}>{children}</RuntimeContext>
}

export function useRuntime() {
  const runtime = use(RuntimeContext)
  if (!runtime)
    throw new Error('App runtime is unavailable')
  return runtime
}
