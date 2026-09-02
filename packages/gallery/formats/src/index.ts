import type { Context } from '@deepseek-ai/cordis';
import type { ComponentType } from 'react';
import { Service } from '@deepseek-ai/cordis';

export interface AssetRecord {
  id: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: number;
}

export interface Thumbnail {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/webp';
}

export interface PluginFormatDescriptor {
  extension: string;
  thumbnailWorker: string;
  viewer: string;
}

export interface GalleryFormatPluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  formats: Record<string, Omit<PluginFormatDescriptor, 'extension'>>;
}

export interface InstalledGalleryPlugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  formats: readonly PluginFormatDescriptor[];
}

export interface GalleryPluginApi {
  install: () => Promise<InstalledGalleryPlugin>;
  list: () => Promise<readonly InstalledGalleryPlugin[]>;
  setEnabled: (id: string, enabled: boolean) => Promise<readonly InstalledGalleryPlugin[]>;
  uninstall: (id: string) => Promise<readonly InstalledGalleryPlugin[]>;
}

export interface FormatExtension {
  id: string;
  version: string;
  extensions: readonly string[];
  createThumbnail: (source: Uint8Array) => Promise<Thumbnail>;
  Viewer: ComponentType<{ source: Uint8Array; name: string }>;
}

export interface GalleryMediaApi {
  chooseRoot: () => Promise<readonly AssetRecord[]>;
  listAssets: () => Promise<readonly AssetRecord[]>;
  readAsset: (id: string) => Promise<Uint8Array>;
  readThumbnail: (id: string, processor: string) => Promise<Thumbnail | undefined>;
  writeThumbnail: (id: string, processor: string, thumbnail: Thumbnail) => Promise<void>;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    formats: FormatRegistry;
  }
}

export class FormatRegistry extends Service {
  private readonly extensions = new Map<string, FormatExtension>();

  constructor(ctx: Context) {
    super(ctx, 'formats');
  }

  register(extension: FormatExtension) {
    const suffixes = extension.extensions.map(suffix => suffix.toLowerCase());
    for (const suffix of suffixes) {
      const existing = this.extensions.get(suffix);
      if (existing && existing !== extension)
        throw new Error(`format extension already registered for suffix: ${suffix}`);
    }

    for (const suffix of suffixes) this.extensions.set(suffix, extension);
    return () => {
      for (const suffix of suffixes) {
        if (this.extensions.get(suffix) === extension)
          this.extensions.delete(suffix);
      }
    };
  }

  find(extension: string) {
    return this.extensions.get(extension.toLowerCase());
  }
}

export const inject: string[] = [];

export function apply(ctx: Context) {
  createFormatRegistry(ctx);
}

function createFormatRegistry(ctx: Context) {
  return new FormatRegistry(ctx);
}
