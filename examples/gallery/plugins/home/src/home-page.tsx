import type { LayoutController } from '@yunzhen/cordis-ui-layout';
import type { CSSProperties } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore } from 'react';

interface HomeProps {
  layout: LayoutController;
  onToggleSidebar: () => void;
}

const sidebarToggleStyle = {
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: '4px',
  color: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  height: '40px',
  justifyContent: 'center',
  padding: 0,
  width: '40px',
} satisfies CSSProperties;

const overlayStyle = {
  left: '8px',
  position: 'absolute',
  top: '46px',
  zIndex: 1,
} satisfies CSSProperties;

export function HomePage() {
  return <h1>Hello, Gallery!</h1>;
}

export function SidebarToggle({ layout, onToggleSidebar }: HomeProps) {
  const sidebarOpen = useSyncExternalStore(layout.subscribe, () => layout.snapshot().sidebarOpen, () => layout.snapshot().sidebarOpen);
  const label = sidebarOpen ? '折叠左侧栏' : '展开左侧栏';

  return (
    <div style={overlayStyle}>
      <button aria-label={label} data-sidebar-toggle style={sidebarToggleStyle} title={label} type="button" onClick={onToggleSidebar}>
        {sidebarOpen ? <PanelLeftClose aria-hidden="true" size={20} strokeWidth={2} /> : <PanelLeftOpen aria-hidden="true" size={20} strokeWidth={2} />}
      </button>
    </div>
  );
}
