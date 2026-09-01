import { useRuntime } from '@yunzhen/cordis-react-bridge';
import { NavLink, Outlet } from 'react-router-dom';
import styles from './index.module.css';
import { getNavigationItems } from './navigation';

export function AppShell() {
  const runtime = useRuntime();
  const navigationFooterItems = runtime.getSlotItems('shell.navigation.footer');
  const contentHeaderItems = runtime.getSlotItems('shell.content.header');

  return (
    <div className={styles.appShell}>
      <nav className={styles.navigation} aria-label="Main navigation">
        <div className={styles.navigationLinks}>
          {getNavigationItems(runtime.routes).map(item => (
            <NavLink className={({ isActive }) => isActive ? styles.activeLink : styles.link} key={item.id} to={item.path} end={item.path === '/'}>
              {item.label}
            </NavLink>
          ))}
        </div>
        {navigationFooterItems.length > 0 && (
          <div className={styles.navigationFooter}>
            {navigationFooterItems.map(({ Component, id }) => <Component key={id} />)}
          </div>
        )}
      </nav>
      <main className={styles.main}>
        {contentHeaderItems.length > 0 && (
          <header className={styles.contentHeader}>
            {contentHeaderItems.map(({ Component, id }) => <Component key={id} />)}
          </header>
        )}
        <Outlet />
      </main>
    </div>
  );
}
