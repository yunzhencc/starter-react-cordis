import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-router';
import { Slot } from '@yunzhen/cordis-ui-renderer';

export function SettingsPage() {
  return (
    <>
      <h1>Settings</h1>
      <Slot name="settings.section" />
    </>
  );
}

export const inject = ['routes'];

export function apply(ctx: Context) {
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'settings',
    parentId: 'app-layout',
    path: 'settings',
    Component: SettingsPage,
    navigation: { label: 'Settings', order: 100 },
    children: {
      'settings.section': { kind: 'list', scope: 'root' },
    },
  }));
}
