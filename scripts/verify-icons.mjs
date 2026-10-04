import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPngText } from './png-metadata.mjs';
import {
  ICON_FILENAMES,
  ICON_SOURCE_HASH_KEY,
  renderIcons,
} from './render-icons.mjs';

const defaultRepositoryDirectory = fileURLToPath(
  new URL('../', import.meta.url),
);

const readOptionalFile = async (path) => {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

export const verifyIcons = async ({
  render = renderIcons,
  repositoryDirectory = defaultRepositoryDirectory,
} = {}) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'verify-icons-'));
  const generatedIconDirectory = join(temporaryDirectory, 'logo');
  const committedIconDirectory = resolve(repositoryDirectory, 'public', 'logo');

  try {
    await render({
      outputDirectory: generatedIconDirectory,
      repositoryDirectory,
    });

    const driftedIcons = [];
    for (const filename of ICON_FILENAMES) {
      const [committed, generated] = await Promise.all([
        readOptionalFile(join(committedIconDirectory, filename)),
        readOptionalFile(join(generatedIconDirectory, filename)),
      ]);
      if (committed === null || generated === null) {
        driftedIcons.push(filename);
        continue;
      }
      try {
        const committedHash = getPngText(committed, ICON_SOURCE_HASH_KEY);
        const generatedHash = getPngText(generated, ICON_SOURCE_HASH_KEY);
        if (committedHash === null || committedHash !== generatedHash) {
          driftedIcons.push(filename);
        }
      } catch {
        driftedIcons.push(filename);
      }
    }

    if (driftedIcons.length > 0) {
      throw new Error(
        `Icon PNG drift detected: ${driftedIcons.join(', ')}. ` +
          'Run `npm run render:icons` and commit the regenerated files.',
      );
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    await verifyIcons();
    console.log('Icon PNGs match their SVG sources.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
