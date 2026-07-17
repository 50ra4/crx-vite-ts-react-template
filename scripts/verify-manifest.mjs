import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_CSP = "script-src 'self'; object-src 'self';";
const EXPECTED_MATCHES = ['https://example.com/*'];
const EXPECTED_PERMISSIONS = ['storage'];
const EXPECTED_HOST_PERMISSIONS = [];
const EXPECTED_WEB_ACCESSIBLE_RESOURCES = [
  /^assets\/jsx-runtime-[A-Za-z0-9_-]+\.js$/u,
  /^assets\/sample\.tsx-[A-Za-z0-9_-]+\.js$/u,
];
const FORBIDDEN_CSP_SOURCE =
  /'unsafe-(?:eval|inline)'|'wasm-unsafe-eval'|(?:https?|data|blob):|\*/u;
const GLOB = /[*?[\]{}]/u;

const extensionDirectory = fileURLToPath(
  new URL('../extension/', import.meta.url),
);
const manifestPath = resolve(extensionDirectory, 'manifest.json');
const errors = [];
const references = [];

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const report = (condition, message) => {
  if (!condition) errors.push(message);
};

const readStrings = (value, field) => {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    errors.push(`${field} must be an array of strings.`);
    return [];
  }
  return value;
};

const expectSet = (value, expected, field) => {
  const actual = readStrings(value ?? [], field).toSorted();
  const wanted = expected.toSorted();
  report(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${field} must equal ${JSON.stringify(wanted)}; received ${JSON.stringify(actual)}.`,
  );
  return actual;
};

const addReference = (value, field) => {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} must reference a non-empty path.`);
    return;
  }
  references.push({ field, value });
};

const addIconReferences = (icons, field) => {
  if (typeof icons === 'string') {
    addReference(icons, field);
  } else if (isRecord(icons)) {
    for (const [size, path] of Object.entries(icons)) {
      addReference(path, `${field}.${size}`);
    }
  } else {
    errors.push(`${field} must be a path or an icon-size map.`);
  }
};

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Manifest verification failed:\n- ${message}`);
  process.exit(1);
}

if (!isRecord(manifest)) {
  console.error('Manifest verification failed:\n- manifest must be an object.');
  process.exit(1);
}

report(
  manifest.manifest_version === 3,
  `manifest_version must be 3; received ${JSON.stringify(manifest.manifest_version)}.`,
);
expectSet(manifest.permissions, EXPECTED_PERMISSIONS, 'permissions');
expectSet(
  manifest.host_permissions,
  EXPECTED_HOST_PERMISSIONS,
  'host_permissions',
);

const csp = manifest.content_security_policy?.extension_pages;
report(
  csp === EXPECTED_CSP,
  `content_security_policy.extension_pages must equal ${JSON.stringify(EXPECTED_CSP)}; received ${JSON.stringify(csp)}.`,
);
report(
  typeof csp !== 'string' || !FORBIDDEN_CSP_SOURCE.test(csp),
  'content_security_policy.extension_pages contains a forbidden source.',
);

if (manifest.icons !== undefined) addIconReferences(manifest.icons, 'icons');
if (manifest.action?.default_icon !== undefined) {
  addIconReferences(manifest.action.default_icon, 'action.default_icon');
}
if (manifest.action?.default_popup !== undefined) {
  addReference(manifest.action.default_popup, 'action.default_popup');
}
if (manifest.options_ui?.page !== undefined) {
  addReference(manifest.options_ui.page, 'options_ui.page');
}
if (manifest.background?.service_worker !== undefined) {
  addReference(manifest.background.service_worker, 'background.service_worker');
}

report(
  Array.isArray(manifest.content_scripts),
  'content_scripts must be an array.',
);
const contentScripts = Array.isArray(manifest.content_scripts)
  ? manifest.content_scripts
  : [];
contentScripts.forEach((entry, index) => {
  if (!isRecord(entry)) {
    errors.push(`content_scripts.${index} must be an object.`);
    return;
  }
  expectSet(
    entry.matches,
    EXPECTED_MATCHES,
    `content_scripts.${index}.matches`,
  );
  for (const field of ['js', 'css']) {
    if (entry[field] === undefined) continue;
    readStrings(entry[field], `content_scripts.${index}.${field}`).forEach(
      (path, pathIndex) =>
        addReference(path, `content_scripts.${index}.${field}.${pathIndex}`),
    );
  }
});

report(
  Array.isArray(manifest.web_accessible_resources),
  'web_accessible_resources must be an array.',
);
const webAccessibleResources = Array.isArray(manifest.web_accessible_resources)
  ? manifest.web_accessible_resources
  : [];
report(
  webAccessibleResources.length === 1,
  `web_accessible_resources must contain 1 entry; received ${webAccessibleResources.length}.`,
);
webAccessibleResources.forEach((entry, index) => {
  if (!isRecord(entry)) {
    errors.push(`web_accessible_resources.${index} must be an object.`);
    return;
  }

  expectSet(
    entry.matches,
    EXPECTED_MATCHES,
    `web_accessible_resources.${index}.matches`,
  );
  const field = `web_accessible_resources.${index}.resources`;
  const resources = readStrings(entry.resources, field);
  report(resources.length > 0, `${field} must not be empty.`);

  for (const expected of EXPECTED_WEB_ACCESSIBLE_RESOURCES) {
    const count = resources.filter((path) => expected.test(path)).length;
    report(
      count === 1,
      `${field} must contain exactly one path matching ${expected}; received ${count}.`,
    );
  }

  resources.forEach((path, pathIndex) => {
    const resourceField = `${field}.${pathIndex}`;
    report(
      !GLOB.test(path),
      `${resourceField} must not contain a glob: ${path}`,
    );
    report(
      EXPECTED_WEB_ACCESSIBLE_RESOURCES.some((expected) => expected.test(path)),
      `${resourceField} is not an allowed generated asset: ${path}`,
    );
    addReference(path, resourceField);
  });
});

for (const { field, value } of references) {
  const absolutePath = resolve(extensionDirectory, value);
  const localPath = relative(extensionDirectory, absolutePath);
  if (
    isAbsolute(value) ||
    /^[a-z][a-z0-9+.-]*:/iu.test(value) ||
    localPath === '..' ||
    localPath.startsWith('../') ||
    localPath.startsWith('..\\') ||
    isAbsolute(localPath)
  ) {
    errors.push(`${field} must stay within the extension directory: ${value}`);
    continue;
  }

  try {
    const file = await stat(absolutePath);
    report(file.isFile(), `${field} does not reference a file: ${value}`);
  } catch {
    errors.push(`${field} references a missing file: ${value}`);
  }
}

if (errors.length > 0) {
  console.error(
    `Manifest verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
  process.exit(1);
}

console.log('Manifest verification passed.');
