import { useRuntime } from '@yunzhen/cordis-react-bridge'
import { NavLink, Outlet } from 'react-router-dom'

export function AppShell() {
  const runtime = useRuntime()

  return (
    <div className="app-shell">
      <nav aria-label="Main navigation">
        {runtime.pages.map((page) => (
          <NavLink key={page.id} to={page.path} end={page.path === '/'}>
            {page.label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
