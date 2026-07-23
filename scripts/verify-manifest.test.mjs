// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { verifyManifest } from './verify-manifest-engine.mjs';

const REQUIRED_CSP = "script-src 'self'; object-src 'self';";
const CONCRETE_JS_ASSET = /^assets\/[^*?[\]{}]+\.js$/u;

let extensionDirectory;

beforeEach(async () => {
  extensionDirectory = await mkdtemp(join(tmpdir(), 'verify-manifest-'));
});

afterEach(async () => {
  await rm(extensionDirectory, { force: true, recursive: true });
});

const createFiles = async (paths) => {
  await Promise.all(
    paths.map(async (path) => {
      const outputPath = join(extensionDirectory, path);
      await mkdir(join(outputPath, '..'), { recursive: true });
      await writeFile(outputPath, '');
    }),
  );
};

const createManifest = (overrides = {}) => ({
  version: '1.0.0',
  manifest_version: 3,
  name: 'Test Extension',
  content_security_policy: {
    extension_pages: REQUIRED_CSP,
  },
  ...overrides,
});

const createExpectedManifest = (overrides = {}) => ({
  permissions: [],
  host_permissions: [],
  optional_permissions: [],
  optional_host_permissions: [],
  surfaces: {
    action: {
      present: false,
      default_popup: false,
    },
    options_ui: false,
    background: false,
  },
  content_scripts: [],
  web_accessible_resources: [],
  ...overrides,
});

const verify = async (manifest, expectedManifest) =>
  verifyManifest({
    manifest,
    packageJson: {
      displayName: 'Test Extension',
      version: '1.0.0',
    },
    expectedManifest,
    extensionDirectory,
  });

test('validates a content-script-only product from its expectation object', async () => {
  await createFiles(['assets/content-loader.js', 'assets/content.js']);
  const matches = ['https://github.com/*'];
  const manifest = createManifest({
    content_scripts: [
      {
        js: ['assets/content-loader.js'],
        matches,
        run_at: 'document_idle',
      },
    ],
    web_accessible_resources: [
      {
        matches,
        resources: ['assets/content.js'],
        use_dynamic_url: false,
      },
    ],
  });
  const expectedManifest = createExpectedManifest({
    content_scripts: [{ matches, run_at: 'document_idle' }],
    web_accessible_resources: [
      {
        matches,
        extension_ids: [],
        use_dynamic_url: false,
        resources: {
          required: [],
          allowedPatterns: [CONCRETE_JS_ASSET],
        },
      },
    ],
  });

  await expect(verify(manifest, expectedManifest)).resolves.toEqual({
    errors: [],
    warnings: [],
  });
});

test('validates a content-script and background product from its expectation object', async () => {
  await createFiles([
    'service-worker-loader.js',
    'assets/content-loader.js',
    'assets/content.js',
    'panel.html',
  ]);
  const matches = ['https://github.com/*'];
  const manifest = createManifest({
    permissions: ['storage'],
    background: {
      service_worker: 'service-worker-loader.js',
      type: 'module',
    },
    content_scripts: [
      {
        js: ['assets/content-loader.js'],
        matches,
      },
    ],
    web_accessible_resources: [
      {
        matches,
        resources: ['assets/content.js', 'panel.html'],
        use_dynamic_url: false,
      },
    ],
  });
  const expectedManifest = createExpectedManifest({
    permissions: ['storage'],
    surfaces: {
      action: {
        present: false,
        default_popup: false,
      },
      options_ui: false,
      background: true,
    },
    content_scripts: [{ matches, run_at: 'document_idle' }],
    web_accessible_resources: [
      {
        matches,
        extension_ids: [],
        use_dynamic_url: false,
        resources: {
          required: ['panel.html'],
          allowedPatterns: [CONCRETE_JS_ASSET],
        },
      },
    ],
  });

  await expect(verify(manifest, expectedManifest)).resolves.toEqual({
    errors: [],
    warnings: [],
  });
});

test('validates a popup-and-options-only product from its expectation object', async () => {
  await createFiles(['popup.html', 'options.html']);
  const manifest = createManifest({
    permissions: ['activeTab', 'scripting', 'storage'],
    action: {
      default_popup: 'popup.html',
    },
    options_ui: {
      open_in_tab: true,
      page: 'options.html',
    },
  });
  const expectedManifest = createExpectedManifest({
    permissions: ['activeTab', 'scripting', 'storage'],
    surfaces: {
      action: {
        present: true,
        default_popup: true,
      },
      options_ui: true,
      background: false,
    },
  });

  await expect(verify(manifest, expectedManifest)).resolves.toEqual({
    errors: [],
    warnings: [],
  });
});

test('validates an action surface without a default popup', async () => {
  const manifest = createManifest({
    action: {},
  });
  const expectedManifest = createExpectedManifest({
    surfaces: {
      action: {
        present: true,
        default_popup: false,
      },
      options_ui: false,
      background: false,
    },
  });

  await expect(verify(manifest, expectedManifest)).resolves.toEqual({
    errors: [],
    warnings: [],
  });
});

test('does not allow the expectation object to relax the CSP invariant', async () => {
  const relaxedCsp = "script-src *; object-src 'self';";
  const manifest = createManifest({
    content_security_policy: {
      extension_pages: relaxedCsp,
    },
  });
  const expectedManifest = createExpectedManifest({
    content_security_policy: {
      extension_pages: relaxedCsp,
    },
  });

  const { errors } = await verify(manifest, expectedManifest);

  expect(errors).toContain(
    `content_security_policy.extension_pages must equal ${JSON.stringify(REQUIRED_CSP)}; received ${JSON.stringify(relaxedCsp)}.`,
  );
});

test('does not allow the expectation object to permit externally_connectable', async () => {
  const externallyConnectable = {
    matches: ['https://example.com/*'],
  };
  const manifest = createManifest({
    externally_connectable: externallyConnectable,
  });
  const expectedManifest = createExpectedManifest({
    externally_connectable: externallyConnectable,
  });

  const { errors } = await verify(manifest, expectedManifest);

  expect(errors).toContain('externally_connectable must not be declared.');
});

test('rejects a declared surface whose built artifact is missing', async () => {
  const manifest = createManifest({
    action: {
      default_popup: 'popup.html',
    },
  });
  const expectedManifest = createExpectedManifest({
    surfaces: {
      action: {
        present: true,
        default_popup: true,
      },
      options_ui: false,
      background: false,
    },
  });

  const { errors } = await verify(manifest, expectedManifest);

  expect(errors).toContain(
    'action.default_popup references a missing file: popup.html',
  );
});
