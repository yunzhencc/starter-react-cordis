import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-router';
import { HomePage } from './home-page';

export const inject = ['routes'];

export function apply(ctx: Context) {
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'home',
    parentId: 'app-layout',
    index: true,
    Component: HomePage,
  }));
}
