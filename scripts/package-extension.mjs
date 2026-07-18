import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const FILE_ATTRIBUTES = 0o644 << 16;
const DEVELOPMENT_ICON = /^logo\/icon(?:16|48|128)-dev\.png$/u;

const repositoryDirectory = fileURLToPath(new URL('../', import.meta.url));
const extensionDirectory = resolve(repositoryDirectory, 'extension');
const archivePath = resolve(repositoryDirectory, 'extension.zip');

const toArchivePath = (path) => path.split(sep).join('/');

const collectFiles = async (rootDirectory, currentDirectory) => {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );

  const files = [];
  for (const entry of entries) {
    const absolutePath = resolve(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDirectory, absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported extension entry: ${absolutePath}`);
    }

    const archivePath = toArchivePath(relative(rootDirectory, absolutePath));
    if (!DEVELOPMENT_ICON.test(archivePath)) {
      files.push({
        data: await readFile(absolutePath),
        path: archivePath,
      });
    }
  }
  return files;
};

export const createExtensionArchive = async ({
  sourceDirectory,
  outputPath,
}) => {
  const files = await collectFiles(sourceDirectory, sourceDirectory);
  if (files.length === 0) {
    throw new Error(`Extension directory is empty: ${sourceDirectory}`);
  }

  const archiveEntries = Object.fromEntries(
    files.map(({ data, path }) => [
      path,
      [
        data,
        {
          attrs: FILE_ATTRIBUTES,
          mtime: FIXED_MTIME,
          os: 3,
        },
      ],
    ]),
  );
  await writeFile(outputPath, zipSync(archiveEntries, { level: 9 }));

  return files.map(({ path }) => path);
};

const packageExtension = async () => {
  const paths = await createExtensionArchive({
    sourceDirectory: extensionDirectory,
    outputPath: archivePath,
  });
  console.log(`Created extension.zip with ${paths.length} files.`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) await packageExtension();
