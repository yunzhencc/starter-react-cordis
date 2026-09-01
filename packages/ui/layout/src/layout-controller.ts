export interface LayoutSnapshot {
  readonly sidebarOpen: boolean;
  readonly workbenchOpen: boolean;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    layout: LayoutController;
  }
}

export class LayoutController {
  private current: LayoutSnapshot = Object.freeze({ sidebarOpen: true, workbenchOpen: false });
  private readonly listeners = new Set<() => void>();

  snapshot = () => this.current;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  toggleSidebar = () => this.update({ sidebarOpen: !this.current.sidebarOpen });

  openWorkbench = () => this.update({ workbenchOpen: true });

  closeWorkbench = () => this.update({ workbenchOpen: false });

  toggleWorkbench = () => this.update({ workbenchOpen: !this.current.workbenchOpen });

  private update(change: Partial<LayoutSnapshot>) {
    const next = { ...this.current, ...change };
    if (next.sidebarOpen === this.current.sidebarOpen && next.workbenchOpen === this.current.workbenchOpen)
      return;
    this.current = Object.freeze(next);
    for (const listener of [...this.listeners]) listener();
  }
}
