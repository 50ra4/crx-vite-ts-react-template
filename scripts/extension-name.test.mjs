// @vitest-environment node

import {
  TEMPLATE_EXTENSION_DISPLAY_NAME,
  createExtensionNames,
  validateExtensionDisplayName,
} from './extension-name.mjs';

test('creates production and development names from the display name', () => {
  expect(createExtensionNames('Readable Product Name')).toEqual({
    build: 'Readable Product Name',
    serve: '[DEV] Readable Product Name',
  });
});

test('accepts a manifest name that matches a custom display name', () => {
  expect(
    validateExtensionDisplayName({
      displayName: 'Readable Product Name',
      manifestName: 'Readable Product Name',
    }),
  ).toEqual({ errors: [], warnings: [] });
});

test.each([undefined, '', '   '])(
  'rejects an invalid package display name: %s',
  (displayName) => {
    expect(
      validateExtensionDisplayName({
        displayName,
        manifestName: 'Readable Product Name',
      }).errors,
    ).toEqual(['package.json displayName must be a non-empty string.']);
  },
);

test('rejects a manifest name that differs from the package display name', () => {
  expect(
    validateExtensionDisplayName({
      displayName: 'Readable Product Name',
      manifestName: 'package-name',
    }).errors,
  ).toEqual([
    'name must equal package.json displayName "Readable Product Name"; received "package-name".',
  ]);
});

test('warns when the display name is still the template default', () => {
  expect(
    validateExtensionDisplayName({
      displayName: TEMPLATE_EXTENSION_DISPLAY_NAME,
      manifestName: TEMPLATE_EXTENSION_DISPLAY_NAME,
    }),
  ).toEqual({
    errors: [],
    warnings: [
      'package.json displayName is still the template default "CRX Vite TS React Template"; set the product display name before release.',
    ],
  });
});
