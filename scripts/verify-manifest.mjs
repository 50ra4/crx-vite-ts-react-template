import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expectedManifest } from './expected-manifest.config.mjs';
import { verifyManifest } from './verify-manifest-engine.mjs';

const extensionDirectory = fileURLToPath(
  new URL('../extension/', import.meta.url),
);
const manifestPath = resolve(extensionDirectory, 'manifest.json');
const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));

let manifest;
let packageJson;
try {
  [manifest, packageJson] = await Promise.all([
    readFile(manifestPath, 'utf8').then(JSON.parse),
    readFile(packagePath, 'utf8').then(JSON.parse),
  ]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Manifest verification failed:\n- ${message}`);
  process.exit(1);
}

const { errors, warnings } = await verifyManifest({
  manifest,
  packageJson,
  expectedManifest,
  extensionDirectory,
});

if (warnings.length > 0) {
  console.warn(
    `Manifest verification warnings:\n${warnings.map((warning) => `- ${warning}`).join('\n')}`,
  );
}

if (errors.length > 0) {
  console.error(
    `Manifest verification failed:\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
  process.exit(1);
}

console.log('Manifest verification passed.');
