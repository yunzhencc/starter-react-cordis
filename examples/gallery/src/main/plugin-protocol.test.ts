import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createPluginProtocolHandler } from './plugin-protocol';

it('serves only declared plugin resources with a restrictive CSP', async () => {
  const handler = createPluginProtocolHandler({
    resolveResource: async (_id, resource) => resource === 'viewer/psd.html' ? import.meta.filename : undefined,
  });
  const response = await handler(new Request('gallery-plugin://com.example.psd/viewer/psd.html'));

  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Security-Policy')).toContain('connect-src \'none\'');
  expect(await response.text()).toBe(await readFile(import.meta.filename, 'utf8'));
  await expect(handler(new Request('gallery-plugin://com.example.psd/manifest.json'))).resolves.toMatchObject({ status: 404 });
});

it('provides a host-owned runner without granting manifest access', async () => {
  const handler = createPluginProtocolHandler({ resolveResource: async () => undefined });

  const response = await handler(new Request('gallery-plugin://com.example.psd/__host/thumbnail-runner.html'));

  expect(response.status).toBe(200);
  await expect(response.text()).resolves.toContain('gallery-plugin:thumbnail-runner');
});
