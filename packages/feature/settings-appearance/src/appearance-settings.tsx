import type { ThemeRuntime } from '@yunzhen/cordis-ui-theme';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './appearance-settings.module.css';

export function AppearanceSettings({ theme }: { theme: ThemeRuntime }) {
  const { t } = useTranslation();
  const snapshot = useSyncExternalStore(theme.subscribe, () => theme.snapshot);

  return (
    <fieldset className={styles.panel}>
      <legend>{t('appearance.title')}</legend>
      {(['system', 'light', 'dark'] as const).map(value => (
        <label key={value}>
          <input
            checked={snapshot.preference === value}
            name="theme"
            type="radio"
            value={value}
            onChange={() => theme.setTheme(value)}
          />
          {t(`appearance.preference.${value}`)}
        </label>
      ))}
      <label>
        {t('appearance.fontSize')}
        <input
          min={12}
          max={20}
          type="range"
          value={snapshot.fontSize}
          onChange={event => theme.setFontSize(Number(event.currentTarget.value))}
        />
      </label>
    </fieldset>
  );
}
