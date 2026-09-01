import type { Context } from '@deepseek-ai/cordis';
import type { SlotRenderer } from '@yunzhen/cordis-ui-renderer';
import { Slot } from '@yunzhen/cordis-ui-renderer';
import { useSyncExternalStore } from 'react';
import styles from './index.module.css';
import { LayoutController } from './layout-controller';

export { LayoutController } from './layout-controller';
export type { LayoutSnapshot } from './layout-controller';

export const inject = ['routes', 'slots'];

export function apply(ctx: Context) {
  const controller = new LayoutController();
  const slots = ctx.get('uiRenderer')!.slots;
  ctx.effect(() => ctx.reflect.provide('layout', controller), 'layout.provide()');
  ctx.routes.register({
    id: 'app-layout',
    Component: () => <AppLayout controller={controller} slots={slots} />,
    children: {
      'sidebar': { kind: 'single', scope: 'root' },
      'main': { kind: 'single', scope: 'root' },
      'workbench': { kind: 'single', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  });
}

function AppLayout({ controller, slots }: { controller: LayoutController; slots: SlotRenderer }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  useSyncExternalStore(
    listener => slots.subscribe('workbench', listener),
    () => slots.version('workbench'),
    () => slots.version('workbench'),
  );
  const hasWorkbench = snapshot.workbenchOpen && slots.entries('workbench').length > 0;
  const gridTemplateColumns = [
    snapshot.sidebarOpen && '16rem',
    'minmax(0, 1fr)',
    hasWorkbench && '16rem',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.layout} data-app-layout data-sidebar-open={String(snapshot.sidebarOpen)} style={{ gridTemplateColumns }}>
      {snapshot.sidebarOpen && <aside className={styles.sidebar} data-sidebar-column><Slot name="sidebar" /></aside>}
      <main className={styles.main}><Slot name="main" /></main>
      {hasWorkbench && <aside className={styles.workbench} data-workbench-column><Slot name="workbench" /></aside>}
      <Slot name="shell.overlay" />
    </div>
  );
}
