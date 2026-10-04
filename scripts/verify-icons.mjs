import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeRgbaPng, getPngText } from './png-metadata.mjs';
import {
  ICON_FILENAMES,
  ICON_PROVENANCE_KEY,
  renderIcons,
} from './render-icons.mjs';

const defaultRepositoryDirectory = fileURLToPath(
  new URL('../', import.meta.url),
);
const MAX_MEAN_PREMULTIPLIED_RGBA_ERROR = 0.02;

const readOptionalFile = async (path) => {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const inspectIcon = ({ contents, filename, origin }) => {
  try {
    return {
      image: decodeRgbaPng(contents),
      provenance: getPngText(contents, ICON_PROVENANCE_KEY),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot inspect ${origin} icon ${filename}: ${detail}`, {
      cause: error,
    });
  }
};

const meanPremultipliedRgbaError = (first, second) => {
  let difference = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    const firstAlpha = first[offset + 3] / 255;
    const secondAlpha = second[offset + 3] / 255;
    difference += Math.abs(first[offset + 3] - second[offset + 3]);
    for (let channel = 0; channel < 3; channel += 1) {
      difference += Math.abs(
        first[offset + channel] * firstAlpha -
          second[offset + channel] * secondAlpha,
      );
    }
  }
  return difference / (first.length * 255);
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

    const driftReasons = [];
    for (const filename of ICON_FILENAMES) {
      const [committed, generated] = await Promise.all([
        readOptionalFile(join(committedIconDirectory, filename)),
        readOptionalFile(join(generatedIconDirectory, filename)),
      ]);
      if (committed === null) {
        driftReasons.push(`${filename} (committed file missing)`);
        continue;
      }
      if (generated === null) {
        throw new Error(`Generated icon missing after rendering: ${filename}.`);
      }

      const committedIcon = inspectIcon({
        contents: committed,
        filename,
        origin: 'committed',
      });
      const generatedIcon = inspectIcon({
        contents: generated,
        filename,
        origin: 'generated',
      });
      if (
        committedIcon.provenance === null ||
        committedIcon.provenance !== generatedIcon.provenance
      ) {
        driftReasons.push(`${filename} (provenance mismatch)`);
        continue;
      }
      if (
        committedIcon.image.width !== generatedIcon.image.width ||
        committedIcon.image.height !== generatedIcon.image.height
      ) {
        driftReasons.push(
          `${filename} (dimensions ${committedIcon.image.width}x${committedIcon.image.height} != ` +
            `${generatedIcon.image.width}x${generatedIcon.image.height})`,
        );
        continue;
      }

      const error = meanPremultipliedRgbaError(
        committedIcon.image.pixels,
        generatedIcon.image.pixels,
      );
      if (error > MAX_MEAN_PREMULTIPLIED_RGBA_ERROR) {
        driftReasons.push(
          `${filename} (pixel difference ${(error * 100).toFixed(2)}% > ` +
            `${(MAX_MEAN_PREMULTIPLIED_RGBA_ERROR * 100).toFixed(2)}%)`,
        );
      }
    }

    if (driftReasons.length > 0) {
      throw new Error(
        `Icon PNG drift detected:\n- ${driftReasons.join('\n- ')}\n` +
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
    console.log('Icon PNGs match their SVG sources and renderer.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
