import * as dashboard from '@yunzhen/cordis-feature-dashboard';
import * as settings from '@yunzhen/cordis-feature-settings';
import * as layout from '@yunzhen/cordis-ui-layout';
import * as renderer from '@yunzhen/cordis-ui-renderer';
import * as router from '@yunzhen/cordis-ui-router';
import * as theme from '@yunzhen/cordis-ui-theme';

export const webAppPlugins = [renderer, router, layout, theme, dashboard, settings] as const;
