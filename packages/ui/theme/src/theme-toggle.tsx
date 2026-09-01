import type { ThemeRuntime } from './theme';
import { useSyncExternalStore } from 'react';

export function ThemeToggle({ theme }: { theme: ThemeRuntime }) {
  const { resolvedTheme } = useSyncExternalStore(theme.subscribe, () => theme.snapshot);
  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <button type="button" onClick={() => theme.setTheme(nextTheme)}>
      Switch to
      {' '}
      {nextTheme}
      {' '}
      theme
    </button>
  );
}
