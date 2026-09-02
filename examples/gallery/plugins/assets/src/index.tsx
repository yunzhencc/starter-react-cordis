import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-router';
import type { GalleryMediaApi } from '@yunzhen/gallery-formats';
import { AssetsWorkbench, HomePage, SidebarToggle } from './home-page';
import { MediaStore } from './media';
import { nativeFormat } from './native-format';

export const inject = ['formats', 'layout', 'routes', 'slots'];
const sidebarStorageKey = 'gallery.sidebar-open';

export function apply(ctx: Context) {
  ctx.effect(() => ctx.formats.register(nativeFormat), 'gallery.assets.native-format()');
  const mediaApi = (window as typeof window & { galleryMedia: GalleryMediaApi }).galleryMedia;
  const media = new MediaStore(ctx.formats, mediaApi, ctx.layout.closeWorkbench);
  ctx.effect(() => () => media.dispose(), 'gallery.assets.dispose()');

  if (readSidebarState() === false)
    ctx.layout.closeSidebar();

  const toggleSidebar = () => {
    ctx.layout.toggleSidebar();
    try {
      localStorage.setItem(sidebarStorageKey, String(ctx.layout.snapshot().sidebarOpen));
    }
    catch {}
  };
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'sidebar-toggle' },
    () => <SidebarToggle layout={ctx.layout} onToggleSidebar={toggleSidebar} />,
  ));
  ctx.slots.inject('assets.workbench', () => registerWorkbench(ctx, media));
  ctx.routes.inject('app-layout', () => ctx.routes.register({
    id: 'home',
    parentId: 'app-layout',
    index: true,
    Component: () => <HomePage layout={ctx.layout} media={media} />,
    children: { 'assets.workbench': { kind: 'single', scope: 'root' } },
  }));
}

function registerWorkbench(ctx: Context, media: MediaStore) {
  let disposeWorkbench: (() => void) | undefined;
  const reconcile = () => {
    const shouldRegister = Boolean(media.snapshot().opened);
    if (shouldRegister === Boolean(disposeWorkbench))
      return;
    disposeWorkbench?.();
    disposeWorkbench = shouldRegister
      ? ctx.slots.inject('workbench', () => ctx.slots.register(
          { name: 'workbench' },
          () => <AssetsWorkbench media={media} />,
        ))
      : undefined;
  };
  const unsubscribe = media.subscribe(reconcile);
  reconcile();
  return () => {
    unsubscribe();
    disposeWorkbench?.();
  };
}

function readSidebarState() {
  try {
    return localStorage.getItem(sidebarStorageKey) !== 'false';
  }
  catch {
    return true;
  }
}
