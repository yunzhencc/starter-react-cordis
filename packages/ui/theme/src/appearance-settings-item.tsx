import type { SettingsItem } from '@yunzhen/cordis-runtime'
import type { ThemeRuntime } from './theme'
import { useSyncExternalStore } from 'react'
import styles from './appearance-settings-item.module.css'

export function createAppearanceSettingsItem(theme: ThemeRuntime): SettingsItem {
  return { id: 'appearance', order: 100, Component: () => <AppearanceSettings theme={theme} /> }
}

function AppearanceSettings({ theme }: { theme: ThemeRuntime }) {
  const snapshot = useSyncExternalStore(theme.subscribe, () => theme.snapshot)

  return (
    <fieldset className={styles.panel}>
      <legend>Appearance</legend>
      {(['system', 'light', 'dark'] as const).map(value => (
        <label key={value}>
          <input
            checked={snapshot.preference === value}
            name="theme"
            type="radio"
            value={value}
            onChange={() => theme.setTheme(value)}
          />
          {value}
        </label>
      ))}
      <label>
        Content font size
        <input
          min={12}
          max={20}
          type="range"
          value={snapshot.fontSize}
          onChange={event => theme.setFontSize(Number(event.currentTarget.value))}
        />
      </label>
    </fieldset>
  )
}
