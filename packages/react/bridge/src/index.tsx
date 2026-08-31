import { createContext, useContext, type ReactNode } from 'react'
import type { AppRuntime } from '@yunzhen/cordis-runtime'

const RuntimeContext = createContext<AppRuntime | null>(null)

export function RuntimeProvider({ children, runtime }: { children: ReactNode, runtime: AppRuntime }) {
  return <RuntimeContext value={runtime}>{children}</RuntimeContext>
}

export function useRuntime() {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('App runtime is unavailable')
  return runtime
}
