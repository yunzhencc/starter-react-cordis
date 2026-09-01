// @vitest-environment jsdom

import type { AppSlot } from '@yunzhen/cordis-runtime';
import { RuntimeProvider } from '@yunzhen/cordis-react-bridge';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './index';
import styles from './index.module.css';

describe('appShell', () => {
  it('marks only the current non-root navigation item as active', async () => {
    const EmptyPage = () => null;
    const runtime = {
      routes: [
        { id: 'dashboard', index: true, Component: EmptyPage, navigation: { label: 'Dashboard', order: 0 } },
        { id: 'settings', path: 'settings', Component: EmptyPage, navigation: { label: 'Settings', order: 10 } },
      ],
      settingsItems: [],
      getSlotItems: (_slot: AppSlot) => [],
      get: () => undefined,
      dispose: async () => {},
    } as Parameters<typeof RuntimeProvider>[0]['runtime'];
    const router = createMemoryRouter([
      {
        Component: AppShell,
        children: [
          { index: true, Component: () => null },
          { path: 'settings', Component: () => null },
        ],
      },
    ], { initialEntries: ['/settings'] });
    const container = document.createElement('div');
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <RuntimeProvider runtime={runtime}>
            <RouterProvider router={router} />
          </RuntimeProvider>,
        );
      });

      expect(container.querySelector('a[href="/"]')?.className).toBe(styles.link);
      expect(container.querySelector('a[href="/settings"]')?.className).toBe(styles.activeLink);
      expect(container.querySelector('main > header')).toBeNull();
    }
    finally {
      await act(async () => root.unmount());
      router.dispose();
      container.remove();
      await runtime.dispose();
    }
  });

  it('renders header before route content and footer after navigation links', async () => {
    const EmptyPage = () => null;
    const ContentHeader = () => <div data-testid="content-header" />;
    const NavigationFooter = () => <div data-testid="navigation-footer" />;
    const runtime = {
      routes: [
        { id: 'dashboard', index: true, Component: EmptyPage, navigation: { label: 'Dashboard', order: 0 } },
        { id: 'settings', path: 'settings', Component: EmptyPage, navigation: { label: 'Settings', order: 10 } },
      ],
      settingsItems: [],
      getSlotItems: (slot: AppSlot) => slot === 'shell.content.header'
        ? [{ id: 'header', slot, order: 0, Component: ContentHeader }]
        : [{ id: 'footer', slot, order: 0, Component: NavigationFooter }],
      get: () => undefined,
      dispose: async () => {},
    } as Parameters<typeof RuntimeProvider>[0]['runtime'];
    const router = createMemoryRouter([
      {
        Component: AppShell,
        children: [
          { index: true, Component: () => <div data-testid="route-content" /> },
          { path: 'settings', Component: EmptyPage },
        ],
      },
    ]);
    const container = document.createElement('div');
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <RuntimeProvider runtime={runtime}>
            <RouterProvider router={router} />
          </RuntimeProvider>,
        );
      });

      const main = container.querySelector('main');
      const navigation = container.querySelector('nav');
      const header = container.querySelector('[data-testid="content-header"]');
      const routeContent = container.querySelector('[data-testid="route-content"]');
      const footer = container.querySelector('[data-testid="navigation-footer"]');

      expect(header).not.toBeNull();
      expect(footer).not.toBeNull();
      expect(main?.firstElementChild?.querySelector('[data-testid="content-header"]')).toBe(header);
      expect(main?.lastElementChild).toBe(routeContent);
      expect(navigation?.lastElementChild?.querySelector('[data-testid="navigation-footer"]')).toBe(footer);
      expect(navigation?.firstElementChild?.querySelector('a[href="/settings"]')).not.toBeNull();
    }
    finally {
      await act(async () => root.unmount());
      router.dispose();
      container.remove();
      await runtime.dispose();
    }
  });
});
