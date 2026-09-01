import type { Context } from '@deepseek-ai/cordis';
import { createRoot } from 'react-dom/client';
import { Slot, SlotOwner, SlotRegistry } from './registry';

export { Slot, SlotOwner, SlotRegistry };
export type { SlotOwnerHandle } from './registry';

export interface UiRendererService {
  mount: (container: HTMLElement) => () => void;
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotRegistry;
    uiRenderer: UiRendererService;
  }
}

export const inject: string[] = [];

export function apply(ctx: Context) {
  const slots = new SlotRegistry(ctx);
  ctx.provide('uiRenderer', {
    mount(container) {
      const root = createRoot(container);
      root.render(
        <SlotOwner owner={slots.createRootOwner()}>
          <Slot name="root" />
        </SlotOwner>,
      );
      return () => root.unmount();
    },
  });
}
