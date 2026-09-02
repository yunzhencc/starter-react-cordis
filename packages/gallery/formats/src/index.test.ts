import { Context } from '@deepseek-ai/cordis';
import { expect, it, vi } from 'vitest';
import * as formats from './index';

it('returns the registered extension for an asset suffix', async () => {
  const ctx = new Context();
  const fiber = ctx.plugin(formats);
  await fiber.await();
  const dispose = ctx.formats.register({
    id: 'fixture',
    version: '1',
    extensions: ['.fixture'],
    createThumbnail: vi.fn(),
    Viewer: () => null,
  });

  expect(ctx.formats.find('.fixture')?.id).toBe('fixture');
  dispose();
  expect(ctx.formats.find('.fixture')).toBeUndefined();
  await fiber.dispose();
});
