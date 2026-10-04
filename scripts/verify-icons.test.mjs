// @vitest-environment node

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { verifyIcons } from './verify-icons.mjs';

const ICON_FILENAMES = [
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'icon16-dev.png',
  'icon48-dev.png',
  'icon128-dev.png',
];

let repositoryDirectory;

const writeIcons = async (directory, overrides = {}) => {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    ICON_FILENAMES.map((filename) =>
      writeFile(join(directory, filename), overrides[filename] ?? filename),
    ),
  );
};

beforeEach(async () => {
  repositoryDirectory = await mkdtemp(join(tmpdir(), 'verify-icons-test-'));
  await writeIcons(join(repositoryDirectory, 'public', 'logo'));
});

afterEach(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
});

test('accepts generated icons that byte-match the committed icons', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
  });

  await expect(verifyIcons({ render, repositoryDirectory })).resolves.toBe(
    undefined,
  );
  expect(render).toHaveBeenCalledWith({
    outputDirectory: expect.any(String),
    repositoryDirectory,
  });
});

test('reports every drifted icon and the regeneration command', async () => {
  const committedIconDirectory = join(repositoryDirectory, 'public', 'logo');
  const before = await Promise.all(
    ICON_FILENAMES.map((filename) =>
      readFile(join(committedIconDirectory, filename)),
    ),
  );
  let generatedIconDirectory;
  const render = vi.fn(async ({ outputDirectory }) => {
    generatedIconDirectory = outputDirectory;
    await writeIcons(outputDirectory, {
      'icon16.png': 'stale-normal',
      'icon48-dev.png': 'stale-development',
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'Icon PNG drift detected: icon16.png, icon48-dev.png. Run `npm run render:icons` and commit the regenerated files.',
  );
  await expect(stat(generatedIconDirectory)).rejects.toMatchObject({
    code: 'ENOENT',
  });
  await expect(
    Promise.all(
      ICON_FILENAMES.map((filename) =>
        readFile(join(committedIconDirectory, filename)),
      ),
    ),
  ).resolves.toEqual(before);
});

test('reports a missing committed icon as drift', async () => {
  await rm(join(repositoryDirectory, 'public', 'logo', 'icon128.png'));
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'Icon PNG drift detected: icon128.png.',
  );
});
