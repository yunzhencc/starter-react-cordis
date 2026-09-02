import type { Context } from '@deepseek-ai/cordis';
import type { I18nRuntime, Locale } from '@yunzhen/cordis-ui-i18n';
import type {} from '@yunzhen/cordis-ui-settings-layout';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const messages = {
  'zh-CN': {
    language: {
      label: '界面语言',
      title: '语言',
    },
    settings: {
      groups: { personal: '个人' },
    },
  },
  'en-US': {
    language: {
      label: 'Interface language',
      title: 'Language',
    },
    settings: {
      groups: { personal: 'Personal' },
    },
  },
} as const;

export const inject = ['i18n', 'settings'];

export function apply(ctx: Context) {
  const i18n = ctx.i18n;
  i18n.register(messages);
  ctx.settings.register({
    id: 'language',
    group: { id: 'personal', label: 'Personal', labelKey: 'settings.groups.personal', order: 100 },
    label: 'Language',
    labelKey: 'language.title',
    Icon: Languages,
    order: 0,
    Component: () => <LanguageSettings i18n={i18n} />,
  });
}

function LanguageSettings({ i18n }: { i18n: I18nRuntime }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend>{t('language.title')}</legend>
      <label>
        {t('language.label')}
        <select aria-label={t('language.label')} value={i18n.locale} onChange={event => void i18n.setLocale(event.currentTarget.value as Locale)}>
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </label>
    </fieldset>
  );
}
