import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-renderer';
import type {} from '@yunzhen/cordis-ui-router';
import { Settings } from 'lucide-react';
import { createElement, useSyncExternalStore } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import styles from './index.module.css';
import { SettingsRegistry } from './registry';

export { SettingsRegistry } from './registry';
export type { SettingsEntry } from './registry';

export const inject = ['routes', 'slots'];

export function apply(ctx: Context) {
  const settings = new SettingsRegistry(ctx);
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'settings',
    parentId: 'app-layout',
    path: 'settings',
    Component: () => <SettingsLayout settings={settings} />,
    Sidebar: () => <SettingsSidebar settings={settings} />,
  }));
  ctx.slots.inject('sidebar.footer', () => ctx.slots.register(
    { name: 'sidebar.footer', id: 'settings', order: 100 },
    SettingsFooterLink,
  ));
}

function SettingsLayout({ settings }: { settings: SettingsRegistry }) {
  const entries = useSettingsEntries(settings);
  const location = useLocation();
  if (!entries.length) {
    return (
      <section className={styles.empty}>
        <h1>Settings</h1>
        <p>No settings available.</p>
      </section>
    );
  }
  if (location.pathname === '/settings' || location.pathname === '/settings/')
    return <Navigate replace to={entries[0]!.id} />;

  const current = entries.find(entry => location.pathname === `/settings/${entry.id}`);
  return (
    <section className={styles.content}>
      <h1>{current?.label ?? 'Settings'}</h1>
      <Outlet />
    </section>
  );
}

function SettingsSidebar({ settings }: { settings: SettingsRegistry }) {
  const entries = useSettingsEntries(settings);
  const groups = Map.groupBy(entries, entry => entry.group.id);
  return (
    <div className={styles.sidebar} data-settings-sidebar>
      <NavLink className={styles.returnLink} to="/">Return to app</NavLink>
      <nav className={styles.menu} data-settings-menu aria-label="Settings">
        {[...groups.values()].map(group => (
          <section key={group[0]!.group.id}>
            <h2>{group[0]!.group.label}</h2>
            {group.map(entry => (
              <NavLink key={entry.id} className={styles.menuItem} to={`/settings/${entry.id}`}>
                {entry.Icon && createElement(entry.Icon, { size: 18 })}
                {entry.label}
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
    </div>
  );
}

function SettingsFooterLink() {
  return (
    <NavLink className={styles.footerLink} to="/settings">
      <Settings size={18} />
      Settings
    </NavLink>
  );
}

function useSettingsEntries(settings: SettingsRegistry) {
  return useSyncExternalStore(settings.subscribe, settings.snapshot, settings.snapshot);
}
