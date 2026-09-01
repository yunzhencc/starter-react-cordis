import type { Context } from '@deepseek-ai/cordis';
import type { SlotRenderer } from '@yunzhen/cordis-ui-renderer';
import type { PanelSize } from 'react-resizable-panels';
import type { PanelBounds } from './layout-controller';
import { Slot } from '@yunzhen/cordis-ui-renderer';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import styles from './index.module.css';
import { getSidebarBounds, getWorkbenchBounds, getWorkspaceWidth, LayoutController, MAIN_MIN_WIDTH } from './layout-controller';

export { LayoutController } from './layout-controller';
export type { LayoutSnapshot } from './layout-controller';

export const inject = ['routes', 'slots'];

export function apply(ctx: Context) {
  const controller = new LayoutController();
  const slots = ctx.get('uiRenderer')!.slots;
  ctx.effect(() => ctx.reflect.provide('layout', controller), 'layout.provide()');
  ctx.routes.register({
    id: 'app-layout',
    Component: () => <AppLayout controller={controller} slots={slots} />,
    children: {
      'sidebar': { kind: 'single', scope: 'root' },
      'main': { kind: 'single', scope: 'root' },
      'workbench': { kind: 'single', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  });
}

function AppLayout({ controller, slots }: { controller: LayoutController; slots: SlotRenderer }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const viewport = useViewport();
  const autoHidden = useRef({ sidebar: false, workbench: false });
  useSyncExternalStore(
    listener => slots.subscribe('workbench', listener),
    () => slots.version('workbench'),
    () => slots.version('workbench'),
  );
  const hasWorkbenchOccupant = slots.entries('workbench').length > 0;
  const hasWorkbench = snapshot.workbenchOpen && hasWorkbenchOccupant;
  const sidebarBounds = getSidebarBounds(viewport.width);
  const [sidebarSize, setSidebarSize] = useStoredSize('sidebar-width', sidebarBounds);
  const sidebarDefaultSize = useRef(sidebarSize).current;
  const workspaceWidth = getWorkspaceWidth(viewport.width, snapshot.sidebarOpen, sidebarSize);
  const workbenchBounds = getWorkbenchBounds(workspaceWidth, viewport.height);
  const workbenchSize = useStoredRatio('app-shell:right-panel-width:v3', workspaceWidth, workbenchBounds);
  const sidebarSizeRef = useRef(sidebarSize);
  const workbenchSizeRef = useRef(workbenchSize);

  useEffect(() => {
    if (viewport.width <= 720 && snapshot.sidebarOpen) {
      autoHidden.current.sidebar = true;
      controller.closeSidebar();
    }
    else if (viewport.width > 720 && autoHidden.current.sidebar) {
      autoHidden.current.sidebar = false;
      controller.openSidebar();
    }

    if (viewport.width <= 960 && hasWorkbench) {
      autoHidden.current.workbench = true;
      controller.closeWorkbench();
    }
    else if (viewport.width > 960 && autoHidden.current.workbench && hasWorkbenchOccupant) {
      autoHidden.current.workbench = false;
      controller.openWorkbench();
    }
  }, [controller, hasWorkbench, hasWorkbenchOccupant, snapshot.sidebarOpen, viewport.width]);

  const updateSidebarSize = ({ inPixels }: PanelSize) => {
    sidebarSizeRef.current = inPixels;
  };
  const updateWorkbenchSize = ({ inPixels }: PanelSize) => {
    workbenchSizeRef.current = inPixels;
    if (inPixels < 160)
      controller.closeWorkbench();
  };
  const persistLayout = (_layout: unknown, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction)
      return;
    const nextSidebarSize = sidebarSizeRef.current;
    setSidebarSize(nextSidebarSize);
    writeStorage('sidebar-width', sidebarSizeRef.current);
    const nextWorkspaceWidth = getWorkspaceWidth(viewport.width, snapshot.sidebarOpen, nextSidebarSize);
    if (nextWorkspaceWidth > 0)
      writeStorage('app-shell:right-panel-width:v3', workbenchSizeRef.current / nextWorkspaceWidth);
  };

  return (
    <div className={styles.layout} data-app-layout data-sidebar-open={String(snapshot.sidebarOpen)}>
      <Group className={styles.group} id="app-layout-panels" orientation="horizontal" resizeTargetMinimumSize={{ coarse: 16, fine: 16 }} onLayoutChanged={persistLayout}>
        {snapshot.sidebarOpen && (
          <>
            <Panel defaultSize={`${sidebarDefaultSize}px`} groupResizeBehavior="preserve-pixel-size" id="sidebar" maxSize={`${sidebarBounds.maxSize}px`} minSize={`${sidebarBounds.minSize}px`} onResize={updateSidebarSize}>
              <aside className={styles.sidebar} data-sidebar-column><Slot name="sidebar" /></aside>
            </Panel>
            <Separator className={styles.separator} id="sidebar-resize" />
          </>
        )}
        <Panel groupResizeBehavior="preserve-relative-size" id="main" minSize={`${MAIN_MIN_WIDTH}px`}>
          <main className={styles.main}><Slot name="main" /></main>
        </Panel>
        {hasWorkbench && (
          <>
            <Separator className={styles.separator} id="workbench-resize" />
            <Panel collapsedSize="0px" collapsible defaultSize={`${workbenchSize}px`} groupResizeBehavior="preserve-pixel-size" id="workbench" maxSize={`${workbenchBounds.maxSize}px`} minSize={`${workbenchBounds.minSize}px`} onResize={updateWorkbenchSize}>
              <aside className={styles.workbench} data-workbench-column><Slot name="workbench" /></aside>
            </Panel>
          </>
        )}
      </Group>
      <Slot name="shell.overlay" />
    </div>
  );
}

function useViewport() {
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    const update = () => setViewport(readViewport());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return viewport;
}

function useStoredSize(key: string, bounds: PanelBounds) {
  const [size, setSize] = useState(() => clamp(readStorage(key) ?? bounds.defaultSize, bounds));
  return [clamp(size, bounds), setSize] as const;
}

function useStoredRatio(key: string, width: number, bounds: PanelBounds) {
  const [ratio] = useState(() => readStorage(key));
  return clamp(ratio === undefined ? bounds.defaultSize : ratio * width, bounds);
}

function readViewport() {
  return { height: window.innerHeight, width: window.innerWidth };
}

function readStorage(key: string) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : undefined;
  }
  catch {
    return undefined;
  }
}

function writeStorage(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  }
  catch {}
}

function clamp(value: number, bounds: PanelBounds) {
  return Math.min(Math.max(value, bounds.minSize), bounds.maxSize);
}
