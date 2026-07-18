// @vitest-environment node

import { createManifestVersion } from './manifest-version.mjs';

test.each([
  ['1.2.3', { version: '1.2.3' }],
  ['1.2.3-rc.1', { version: '1.2.3', version_name: '1.2.3-rc.1' }],
  ['1.2.3+build.4', { version: '1.2.3', version_name: '1.2.3+build.4' }],
])('maps package version %s to Chrome manifest fields', (version, expected) => {
  expect(createManifestVersion(version)).toEqual(expected);
});
