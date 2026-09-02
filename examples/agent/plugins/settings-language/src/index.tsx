import type { Context } from '@deepseek-ai/cordis';
import type { I18nRuntime, Locale } from '@yunzhen/cordis-ui-i18n';
import type {} from '@yunzhen/cordis-ui-renderer';
import { useTranslation } from 'react-i18next';
import styles from './language-settings.module.css';

const messages = {
  'zh-CN': {
    language: {
      description: '应用 UI 语言',
      label: '界面语言',
      title: '语言',
    },
    settings: {
      groups: { personal: '个人' },
    },
  },
  'en-US': {
    language: {
      description: 'Application UI language',
      label: 'Interface language',
      title: 'Language',
    },
    settings: {
      groups: { personal: 'Personal' },
    },
  },
} as const;

export const inject = ['i18n', 'slots'];

export function apply(ctx: Context) {
  const i18n = ctx.i18n;
  i18n.register(messages);
  ctx.slots.inject('settings.general.items', () => ctx.slots.register(
    { name: 'settings.general.items', id: 'language', order: 0 },
    () => <LanguageSettings i18n={i18n} />,
  ));
}

function LanguageSettings({ i18n }: { i18n: I18nRuntime }) {
  const { t } = useTranslation();
  return (
    <section className={styles.row}>
      <div className={styles.copy}>
        <h2>{t('language.title')}</h2>
        <p>{t('language.description')}</p>
      </div>
      <select className={styles.select} aria-label={t('language.label')} value={i18n.locale} onChange={event => void i18n.setLocale(event.currentTarget.value as Locale)}>
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
    </section>
  );
}
