import type { Context } from '@deepseek-ai/cordis';
import type { ModelsConfig } from '@examples/agent-models';
import type {} from '@examples/agent-settings-layout';
import { Bot } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './index.module.css';

const messages = {
  'zh-CN': {
    models: {
      apiKey: 'API 密钥',
      baseURL: 'Base URL',
      defaultModel: '默认模型',
      model: '模型名称',
      provider: '供应商',
      saved: '已保存',
      save: '保存',
      title: '模型提供商',
    },
    settings: { groups: { coding: '编码' } },
  },
  'en-US': {
    models: {
      apiKey: 'API key',
      baseURL: 'Base URL',
      defaultModel: 'Default model',
      model: 'Model',
      provider: 'Provider',
      saved: 'Saved',
      save: 'Save',
      title: 'Model providers',
    },
    settings: { groups: { coding: 'Coding' } },
  },
} as const;

export const inject = ['i18n', 'models', 'settings'];

export function apply(ctx: Context) {
  ctx.i18n.register(messages);
  const models = ctx.models;
  ctx.settings.register({
    id: 'models',
    group: { id: 'coding', label: 'Coding', labelKey: 'settings.groups.coding', order: 200 },
    label: 'Model providers',
    labelKey: 'models.title',
    Icon: Bot,
    order: 0,
    Component: () => <ModelSettings models={models} />,
  });
}

function ModelSettings({ models }: Pick<Context, 'models'>) {
  const { t } = useTranslation();
  const [config, setConfig] = useState(() => models.settings());
  const [saved, setSaved] = useState(false);

  function updateModel(index: number, field: keyof ModelsConfig['models'][number], value: string) {
    setSaved(false);
    setConfig(current => ({
      ...current,
      models: current.models.map((model, modelIndex) => modelIndex === index ? { ...model, [field]: value } : model),
    }));
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        models.update(config);
        setSaved(true);
      }}
    >
      <label className={styles.field}>
        <span>{t('models.defaultModel')}</span>
        <select value={config.defaultModel} onChange={event => setConfig(current => ({ ...current, defaultModel: event.currentTarget.value }))}>
          {config.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
      </label>
      {config.models.map((model, index) => (
        <fieldset key={model.id} className={styles.provider}>
          <legend>{model.label}</legend>
          <label className={styles.field}>
            <span>{t('models.provider')}</span>
            <input required value={model.provider} onChange={event => updateModel(index, 'provider', event.currentTarget.value)} />
          </label>
          <label className={styles.field}>
            <span>{t('models.baseURL')}</span>
            <input required type="url" value={model.baseURL} onChange={event => updateModel(index, 'baseURL', event.currentTarget.value)} />
          </label>
          <label className={styles.field}>
            <span>{t('models.model')}</span>
            <input required value={model.model} onChange={event => updateModel(index, 'model', event.currentTarget.value)} />
          </label>
          <label className={styles.field}>
            <span>{t('models.apiKey')}</span>
            <input autoComplete="off" type="password" value={model.apiKey ?? ''} onChange={event => updateModel(index, 'apiKey', event.currentTarget.value)} />
          </label>
        </fieldset>
      ))}
      <div className={styles.actions}>
        <button type="submit">{t('models.save')}</button>
        {saved && <output>{t('models.saved')}</output>}
      </div>
    </form>
  );
}
