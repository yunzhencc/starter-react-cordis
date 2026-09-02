import type { LayoutController } from '@yunzhen/cordis-ui-layout';
import type { CSSProperties } from 'react';
import { JustifiedInfiniteGrid } from '@egjs/react-infinitegrid';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
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

function getItems(groupKey: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    groupKey,
    key: groupKey * count + index,
  }));
}

export function HomePage() {
  const [items, setItems] = useState(() => getItems(0, 10));

  return (
    <section className={styles.page}>
      <JustifiedInfiniteGrid
        className={styles.grid}
        gap={5}
        onRequestAppend={(event) => {
          const nextGroupKey = (+event.groupKey! || 0) + 1;
          setItems(items => [...items, ...getItems(nextGroupKey, 10)]);
        }}
      >
        {items.map(item => (
          <article key={item.key} className={styles.item} data-grid-groupkey={item.groupKey}>
            <img alt={`egjs ${item.key}`} className={styles.image} data-grid-maintained-target="true" src={`https://naver.github.io/egjs-infinitegrid/assets/image/${(item.key % 33) + 1}.jpg`} />
            <div className={styles.info}>
              egjs
              {' '}
              {item.key}
            </div>
          </article>
        ))}
      </JustifiedInfiniteGrid>
    </section>
  );
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
