import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));

export const verifyReleaseVersion = ({ tag, version }) => {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('package.json version must be a non-empty string.');
  }

  const expectedTag = `v${version}`;
  if (tag !== expectedTag) {
    throw new Error(
      `Release tag must match package.json version: expected ${expectedTag}, received ${JSON.stringify(tag)}.`,
    );
  }

  return expectedTag;
};

const verifyCurrentPackage = async () => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const tag = process.argv[2];
  const verifiedTag = verifyReleaseVersion({
    tag,
    version: packageJson.version,
  });
  console.log(`Release version verified: ${verifiedTag}`);
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) await verifyCurrentPackage();
