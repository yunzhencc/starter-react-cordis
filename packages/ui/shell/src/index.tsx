import { useRuntime } from '@yunzhen/cordis-react-bridge'
import { NavLink, Outlet } from 'react-router-dom'
import styles from './index.module.css'

export function AppShell() {
  const runtime = useRuntime()

  return (
    <div className={styles.appShell}>
      <nav className={styles.navigation} aria-label="Main navigation">
        {runtime.pages.map((page) => (
          <NavLink className={({ isActive }) => isActive ? styles.activeLink : styles.link} key={page.id} to={page.path} end={page.path === '/'}>
            {page.label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
