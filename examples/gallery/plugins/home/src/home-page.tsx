import type { LayoutController } from '@yunzhen/cordis-ui-layout';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import styles from './home-page.module.css';

interface HomeProps {
  layout: LayoutController;
  onToggleSidebar: () => void;
}

export function HomePage() {
  return <h1>Hello, Gallery!</h1>;
}

export function SidebarToggle({ layout, onToggleSidebar, placement }: HomeProps & { placement: 'rail' | 'toolbar' }) {
  const sidebarOpen = useSyncExternalStore(layout.subscribe, () => layout.snapshot().sidebarOpen, () => layout.snapshot().sidebarOpen);
  if ((placement === 'toolbar') !== sidebarOpen)
    return null;

  const label = sidebarOpen ? '折叠左侧栏' : '展开左侧栏';

  return (
    <button aria-expanded={sidebarOpen} aria-label={label} className={styles.toggle} data-sidebar-toggle data-sidebar-trigger={placement} title={label} type="button" onClick={onToggleSidebar}>
      {sidebarOpen ? <PanelLeftClose aria-hidden="true" size={16} strokeWidth={2} /> : <PanelLeftOpen aria-hidden="true" size={16} strokeWidth={2} />}
    </button>
  );
}
