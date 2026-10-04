// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getPngText, setPngText } from './png-metadata.mjs';

const png = await readFile(
  fileURLToPath(new URL('../public/logo/icon16.png', import.meta.url)),
);

test('adds text metadata without modifying the input PNG', () => {
  const original = Buffer.from(png);

  const updated = setPngText(png, 'SVG-SHA256', 'first-hash');

  expect(getPngText(updated, 'SVG-SHA256')).toBe('first-hash');
  expect(png).toEqual(original);
});

test('replaces text metadata with the same keyword', () => {
  const initial = setPngText(png, 'SVG-SHA256', 'first-hash');

  const updated = setPngText(initial, 'SVG-SHA256', 'second-hash');

  expect(getPngText(updated, 'SVG-SHA256')).toBe('second-hash');
});
