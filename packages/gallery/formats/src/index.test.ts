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
    extensions: ['.PNG'],
    createThumbnail: vi.fn(),
    Viewer: () => null,
  });

  expect(ctx.formats.find('.png')?.id).toBe('fixture');
  expect(() => ctx.formats.register({
    id: 'conflict',
    version: '1',
    extensions: ['.png'],
    createThumbnail: vi.fn(),
    Viewer: () => null,
  })).toThrow('format extension already registered for suffix: .png');
  dispose();
  expect(ctx.formats.find('.png')).toBeUndefined();
  await fiber.dispose();
});
