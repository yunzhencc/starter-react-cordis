import type { AppPlugin } from '@yunzhen/cordis-runtime'

export function DashboardPage() {
  return <h1>Dashboard</h1>
}

export const dashboardPlugin: AppPlugin = (app) => {
  return app.addRoute({
    id: 'dashboard',
    index: true,
    Component: DashboardPage,
    navigation: { label: 'Dashboard', order: 0 },
  })
}
