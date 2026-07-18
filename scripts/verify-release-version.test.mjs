// @vitest-environment node

import { verifyReleaseVersion } from './verify-release-version.mjs';

test.each([
  ['1.2.3', 'v1.2.3'],
  ['1.2.3-rc.1', 'v1.2.3-rc.1'],
])('accepts an exact v-prefixed tag for %s', (version, tag) => {
  expect(verifyReleaseVersion({ tag, version })).toBe(tag);
});

test('rejects a tag that differs from package.json', () => {
  expect(() =>
    verifyReleaseVersion({ tag: 'v1.2.4', version: '1.2.3' }),
  ).toThrow('expected v1.2.3');
});
