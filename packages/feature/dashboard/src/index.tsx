import type { AppPlugin } from '@yunzhen/cordis-runtime'

export function DashboardPage() {
  return <h1>Dashboard</h1>
}

export const dashboardPlugin: AppPlugin = (app) => {
  return app.addPage({
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    Component: DashboardPage,
  })
}
