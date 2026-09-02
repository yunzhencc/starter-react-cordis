import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-i18n';
import type {} from '@yunzhen/cordis-ui-renderer';
import type {} from '@yunzhen/cordis-ui-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardMessages } from './locales';

export function DashboardPage({ closeWorkbench, openWorkbench }: { closeWorkbench: () => void; openWorkbench: () => void }) {
  const { t } = useTranslation();
  useEffect(() => () => closeWorkbench(), [closeWorkbench]);

  return (
    <>
      <h1>{t('dashboard.title')}</h1>
      <button type="button" onClick={openWorkbench}>{t('dashboard.openWorkbench')}</button>
    </>
  );
}

function DashboardWorkbench() {
  const { t } = useTranslation();
  return (
    <section>
      <h2>{t('dashboard.workbenchTitle')}</h2>
      <p>{t('dashboard.description')}</p>
    </section>
  );
}

export const inject = ['i18n', 'layout', 'routes', 'slots'];

export function apply(ctx: Context) {
  ctx.i18n.register(dashboardMessages);
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
    navigation: { label: 'Dashboard', labelKey: 'dashboard.title', order: 0 },
  }));
}
