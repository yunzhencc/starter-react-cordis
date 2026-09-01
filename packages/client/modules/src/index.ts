export interface WebBootEntry {
  id: string;
  url: string;
  rev: string;
  inject?: readonly string[];
  immediately?: boolean;
  external?: readonly string[];
}

export interface WebBootGraph {
  revision: string;
  entries: readonly WebBootEntry[];
}

export interface PluginCatalogProvider {
  id: string;
  snapshot: () => Promise<WebBootGraph>;
  watch?: (onChange: () => void) => () => void;
}
