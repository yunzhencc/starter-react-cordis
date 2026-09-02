import type { Context } from '@deepseek-ai/cordis';
import type {} from '@yunzhen/cordis-ui-settings-layout';
import type {} from '@yunzhen/cordis-ui-theme';
import { Palette } from 'lucide-react';
import { AppearanceSettings } from './appearance-settings';

export const inject = ['settings', 'theme'];

export function apply(ctx: Context) {
  const theme = ctx.theme;
  ctx.settings.register({
    id: 'appearance',
    group: { id: 'personal', label: 'Personal', order: 100 },
    label: 'Appearance',
    Icon: Palette,
    order: 100,
    Component: () => <AppearanceSettings theme={theme} />,
  });
}
