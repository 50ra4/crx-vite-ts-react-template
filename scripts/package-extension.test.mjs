// @vitest-environment node

import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { strFromU8, unzipSync } from 'fflate';

import { createExtensionArchive } from './package-extension.mjs';

let temporaryDirectory;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'extension-package-'));
});

afterEach(async () => {
  await rm(temporaryDirectory, { force: true, recursive: true });
});

test('archives sorted distributable contents without Vite-copied icons', async () => {
  const sourceDirectory = join(temporaryDirectory, 'extension');
  await mkdir(join(sourceDirectory, 'assets'), { recursive: true });
  await mkdir(join(sourceDirectory, 'logo'));
  await mkdir(join(sourceDirectory, 'public', 'logo'), { recursive: true });
  await writeFile(
    join(sourceDirectory, 'manifest.json'),
    '{"version":"1.0.0"}',
  );
  await writeFile(join(sourceDirectory, 'assets', 'app.js'), 'console.log(1);');
  await writeFile(join(sourceDirectory, 'logo', 'icon16.png'), 'production');
  await writeFile(
    join(sourceDirectory, 'logo', 'icon16-dev.png'),
    'development',
  );
  await writeFile(
    join(sourceDirectory, 'public', 'logo', 'icon16.png'),
    'manifest production',
  );

  const outputPath = join(temporaryDirectory, 'extension.zip');
  await createExtensionArchive({ sourceDirectory, outputPath });

  const files = unzipSync(await readFile(outputPath));
  expect(Object.keys(files)).toEqual([
    'assets/app.js',
    'manifest.json',
    'public/logo/icon16.png',
  ]);
  expect(strFromU8(files['manifest.json'])).toBe('{"version":"1.0.0"}');
});

test('creates byte-identical archives when source mtimes change', async () => {
  const sourceDirectory = join(temporaryDirectory, 'extension');
  await mkdir(sourceDirectory);
  const manifestPath = join(sourceDirectory, 'manifest.json');
  await writeFile(manifestPath, '{"version":"1.0.0"}');

  const firstArchive = join(temporaryDirectory, 'first.zip');
  const secondArchive = join(temporaryDirectory, 'second.zip');
  await createExtensionArchive({
    sourceDirectory,
    outputPath: firstArchive,
  });
  await utimes(manifestPath, new Date(), new Date());
  await createExtensionArchive({
    sourceDirectory,
    outputPath: secondArchive,
  });

  const digest = async (path) =>
    createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  expect(await digest(secondArchive)).toBe(await digest(firstArchive));
});
