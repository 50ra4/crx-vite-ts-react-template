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
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

import { verifyIcons } from './verify-icons.mjs';

const ICON_FILENAMES = [
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'icon16-dev.png',
  'icon48-dev.png',
  'icon128-dev.png',
];
const fixtureIconDirectory = fileURLToPath(
  new URL('../public/logo/', import.meta.url),
);

let repositoryDirectory;
let fixtureIcons;

const createPngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);

  let crc = 0xffffffff;
  for (const byte of Buffer.concat([typeBuffer, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
};

const recompressPng = (png) => {
  const chunks = [];
  const idatData = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({
      data,
      raw: png.subarray(offset, offset + length + 12),
      type,
    });
    if (type === 'IDAT') idatData.push(data);
    offset += length + 12;
  }

  const recompressed = deflateSync(inflateSync(Buffer.concat(idatData)), {
    level: 0,
  });
  let wroteIdat = false;
  return Buffer.concat([
    png.subarray(0, 8),
    ...chunks.flatMap((chunk) => {
      if (chunk.type !== 'IDAT') return [chunk.raw];
      if (wroteIdat) return [];
      wroteIdat = true;
      return [createPngChunk('IDAT', recompressed)];
    }),
  ]);
};

const writeIcons = async (directory, overrides = {}) => {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    ICON_FILENAMES.map((filename) =>
      writeFile(
        join(directory, filename),
        overrides[filename] ?? fixtureIcons[filename],
      ),
    ),
  );
};

beforeAll(async () => {
  fixtureIcons = Object.fromEntries(
    await Promise.all(
      ICON_FILENAMES.map(async (filename) => [
        filename,
        await readFile(join(fixtureIconDirectory, filename)),
      ]),
    ),
  );
});

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

test('accepts matching pixels when PNG compression differs', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory, {
      'icon16.png': recompressPng(fixtureIcons['icon16.png']),
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).resolves.toBe(
    undefined,
  );
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
      'icon16.png': fixtureIcons['icon16-dev.png'],
      'icon48-dev.png': fixtureIcons['icon48.png'],
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
