import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-router';

export function DashboardPage() {
  return <h1>Dashboard</h1>;
}

export const inject = ['routes'];

export function apply(ctx: Context) {
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'dashboard',
    parentId: 'app-layout',
    index: true,
    Component: DashboardPage,
    navigation: { label: 'Dashboard', order: 0 },
  }));
}
