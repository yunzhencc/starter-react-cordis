import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-renderer';
import type {} from '@yunzhen/cordis-ui-router';
import { useEffect } from 'react';

export function DashboardPage({ closeWorkbench, openWorkbench }: { closeWorkbench: () => void; openWorkbench: () => void }) {
  useEffect(() => () => closeWorkbench(), [closeWorkbench]);

  return (
    <>
      <h1>Dashboard</h1>
      <button type="button" onClick={openWorkbench}>Open workbench</button>
    </>
  );
}

function DashboardWorkbench() {
  return (
    <section>
      <h2>Dashboard workbench</h2>
      <p>Contextual tools for the Dashboard.</p>
    </section>
  );
}

export const inject = ['layout', 'routes', 'slots'];

export function apply(ctx: Context) {
  const { closeWorkbench, openWorkbench } = ctx.layout;
  ctx.slots.inject('workbench', () => ctx.slots.register(
    { name: 'workbench' },
    DashboardWorkbench,
  ));
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'dashboard',
    parentId: 'app-layout',
    index: true,
    Component: () => <DashboardPage closeWorkbench={closeWorkbench} openWorkbench={openWorkbench} />,
    navigation: { label: 'Dashboard', order: 0 },
  }));
}
