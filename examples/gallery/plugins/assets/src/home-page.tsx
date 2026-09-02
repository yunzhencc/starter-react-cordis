import type { LayoutController } from '@yunzhen/cordis-ui-layout';
import type { CSSProperties } from 'react';
import type { MediaStore } from './media';
import { JustifiedInfiniteGrid } from '@egjs/react-infinitegrid';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
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

interface HomePageProps {
  layout: LayoutController;
  media: MediaStore;
}

export function HomePage({ layout, media }: HomePageProps) {
  const snapshot = useSyncExternalStore(media.subscribe, media.snapshot, media.snapshot);
  const openAsset = async (id: string) => {
    if (await media.open(id))
      layout.openWorkbench();
  };
  useEffect(() => {
    void media.listAssets();
    return layout.closeWorkbench;
  }, [layout, media]);

  return (
    <section className={styles.page}>
      <button className={styles.chooseRoot} data-choose-root type="button" onClick={media.chooseRoot}>选择素材文件夹</button>
      <JustifiedInfiniteGrid
        className={styles.grid}
        gap={5}
      >
        {snapshot.assets.map(item => (
          <button
            key={item.asset.id}
            className={styles.item}
            data-asset-id={item.asset.id}
            data-grid-groupkey="assets"
            data-selected={snapshot.selectedId === item.asset.id ? 'true' : undefined}
            title={item.asset.name}
            type="button"
            onClick={() => media.select(item.asset.id)}
            onDoubleClick={() => openAsset(item.asset.id)}
            onKeyDown={(event) => {
              if (event.key === ' ') {
                event.preventDefault();
                media.select(item.asset.id);
              }
              else if (event.key === 'Enter') {
                event.preventDefault();
                void openAsset(item.asset.id);
              }
            }}
          >
            {item.thumbnailUrl && <img alt={item.asset.name} className={styles.image} data-grid-maintained-target="true" src={item.thumbnailUrl} />}
            {item.status !== 'ready' && (
              <div className={styles.placeholder} data-grid-maintained-target="true">
                {item.status === 'error' ? '预览失败' : '正在生成预览'}
              </div>
            )}
            <div className={styles.info}>
              {item.asset.name}
            </div>
          </button>
        ))}
      </JustifiedInfiniteGrid>
    </section>
  );
}

export function AssetsWorkbench({ media }: { media: MediaStore }) {
  const { opened } = useSyncExternalStore(media.subscribe, media.snapshot, media.snapshot);
  if (!opened)
    return null;
  const Viewer = opened.format.Viewer;
  return (
    <section className={styles.workbench}>
      <Viewer name={opened.asset.name} source={opened.source} />
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
