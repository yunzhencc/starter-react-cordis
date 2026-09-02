import type { LayoutController } from '@yunzhen/cordis-ui-layout';
import type { CSSProperties } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import styles from './home-page.module.css';

interface HomeProps {
  layout: LayoutController;
  onToggleSidebar: () => void;
}

const headerActionStyle = {
  left: '92px',
  position: 'absolute',
  top: '8px',
  zIndex: 1,
} satisfies CSSProperties;

export function HomePage() {
  return <h1>Hello, Gallery!</h1>;
}

export function SidebarToggle({ layout, onToggleSidebar }: HomeProps) {
  const sidebarOpen = useSyncExternalStore(layout.subscribe, () => layout.snapshot().sidebarOpen, () => layout.snapshot().sidebarOpen);
  const label = sidebarOpen ? '折叠左侧栏' : '展开左侧栏';

  return (
    <div data-sidebar-header-action style={headerActionStyle}>
      <button aria-expanded={sidebarOpen} aria-label={label} className={styles.toggle} data-sidebar-toggle title={label} type="button" onClick={onToggleSidebar}>
        {sidebarOpen ? <PanelLeftClose aria-hidden="true" size={16} strokeWidth={2} /> : <PanelLeftOpen aria-hidden="true" size={16} strokeWidth={2} />}
      </button>
    </div>
  );
}
