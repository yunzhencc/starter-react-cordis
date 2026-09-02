import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-router';
import { HomePage, SidebarToggle } from './home-page';

export const inject = ['layout', 'routes', 'slots'];
const sidebarStorageKey = 'gallery.sidebar-open';

export function apply(ctx: Context) {
  if (readSidebarState() === false)
    ctx.layout.closeSidebar();

  const toggleSidebar = () => {
    ctx.layout.toggleSidebar();
    try {
      localStorage.setItem(sidebarStorageKey, String(ctx.layout.snapshot().sidebarOpen));
    }
    catch {}
  };
  ctx.slots.inject('sidebar.trigger', () => ctx.slots.register(
    { name: 'sidebar.trigger', id: 'gallery-sidebar-toggle' },
    () => <SidebarToggle layout={ctx.layout} placement="toolbar" onToggleSidebar={toggleSidebar} />,
  ));
  ctx.slots.inject('sidebar.rail', () => ctx.slots.register(
    { name: 'sidebar.rail', id: 'gallery-sidebar-toggle' },
    () => <SidebarToggle layout={ctx.layout} placement="rail" onToggleSidebar={toggleSidebar} />,
  ));
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'home',
    parentId: 'app-layout',
    index: true,
    Component: HomePage,
  }));
}

function readSidebarState() {
  try {
    return localStorage.getItem(sidebarStorageKey) !== 'false';
  }
  catch {
    return true;
  }
}
