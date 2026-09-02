import { expect, it } from 'vitest';

it('provides ResizeObserver to browser-facing tests', () => {
  expect(() => new ResizeObserver(() => {})).not.toThrow();
});
