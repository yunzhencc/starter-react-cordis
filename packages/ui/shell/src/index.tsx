import { useRuntime } from '@yunzhen/cordis-react-bridge'
import { NavLink, Outlet } from 'react-router-dom'
import styles from './index.module.css'
import { getNavigationItems } from './navigation'

export function AppShell() {
  const runtime = useRuntime()

  return (
    <div className={styles.appShell}>
      <nav className={styles.navigation} aria-label="Main navigation">
        {getNavigationItems(runtime.routes).map(item => (
          <NavLink className={({ isActive }) => isActive ? styles.activeLink : styles.link} key={item.id} to={item.path} end={item.path === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
