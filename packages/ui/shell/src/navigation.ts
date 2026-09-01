import type { RouteNode } from '@yunzhen/cordis-runtime'

export interface NavigationItem {
  id: string
  label: string
  path: string
}

export function getNavigationItems(routes: readonly RouteNode[]): readonly NavigationItem[] {
  const items: Array<NavigationItem & { order: number }> = []

  const visit = (nodes: readonly RouteNode[], parentPath: string) => {
    for (const route of nodes) {
      const routePath = route.index ? parentPath : [parentPath, route.path].filter(Boolean).join('/')

      if (route.navigation) {
        items.push({
          id: route.id,
          label: route.navigation.label,
          path: routePath ? `/${routePath}` : '/',
          order: route.navigation.order,
        })
      }

      if (route.children)
        visit(route.children, routePath)
    }
  }

  visit(routes, '')
  return items.sort((a, b) => a.order - b.order).map(({ order: _, ...item }) => item)
}
