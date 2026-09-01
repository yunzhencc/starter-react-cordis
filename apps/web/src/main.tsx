import { Context } from '@deepseek-ai/cordis';
import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app';

async function bootstrap() {
  const ctx = new Context();

  for (const module of webAppPlugins) {
    const fiber = ctx.plugin(module);
    await fiber.await();
  }

  ctx.uiRenderer.mount(document.getElementById('root')!);
}

void bootstrap();
