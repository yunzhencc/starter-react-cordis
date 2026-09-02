interface Window {
  galleryMedia: import('@yunzhen/gallery-formats').GalleryMediaApi;
}

declare module 'virtual:cordis-gallery-boot' {
  import type { PluginRegistry, WebBootGraph } from '@yunzhen/cordis-client-modules';

  export const graph: WebBootGraph;
  export const registry: PluginRegistry;
}
