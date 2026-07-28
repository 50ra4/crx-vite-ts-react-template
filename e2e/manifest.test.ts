// @vitest-environment node

import { createExtensionId, patchManifest } from './manifest';

const E2E_HOST_PERMISSION = 'https://example.com/*';

describe('patchManifest', () => {
  test('applies explicit removals and replacements', () => {
    expect(
      patchManifest(
        {
          action: {},
          background: {},
        },
        {
          remove: ['background'],
          set: {
            host_permissions: [E2E_HOST_PERMISSION],
          },
        },
      ),
    ).toEqual({
      action: {},
      host_permissions: [E2E_HOST_PERMISSION],
    });
  });

  test('rejects a non-object manifest', () => {
    expect(() => patchManifest([])).toThrow(
      'Built extension manifest must be an object.',
    );
  });

  test('rejects a missing removal target', () => {
    expect(() =>
      patchManifest(
        {
          background: {},
        },
        {
          remove: ['options_ui'],
        },
      ),
    ).toThrow('Manifest has no top-level field "options_ui" to remove.');
  });

  test('rejects duplicate removal targets', () => {
    expect(() =>
      patchManifest(
        {
          background: {},
        },
        {
          remove: ['background', 'background'],
        },
      ),
    ).toThrow(
      'Manifest field "background" is listed more than once in remove.',
    );
  });

  test('rejects fields configured by both remove and set', () => {
    expect(() =>
      patchManifest(
        {
          background: {},
        },
        {
          remove: ['background'],
          set: {
            background: {
              service_worker: 'replacement.js',
            },
          },
        },
      ),
    ).toThrow(
      'Manifest field "background" cannot be configured by both remove and set.',
    );
  });

  test.each([
    {
      patch: {
        remove: ['key'],
      },
    },
    {
      patch: {
        set: {
          key: 'another-key',
        },
      },
    },
  ])('rejects configuring the fixture-owned extension key', ({ patch }) => {
    expect(() =>
      patchManifest(
        {
          key: 'fixture-key',
          name: 'extension',
        },
        patch,
      ),
    ).toThrow('Manifest field "key" is reserved by the E2E fixture.');
  });
});

describe('createExtensionId', () => {
  test('derives the Chrome extension ID from a manifest public key', () => {
    expect(createExtensionId('dGVzdC1rZXk=')).toBe(
      'gckpihaehgepkpiokicpmgbmojmemdja',
    );
  });
});
