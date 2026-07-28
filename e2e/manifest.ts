import { createHash } from 'node:crypto';

const E2E_RESERVED_MANIFEST_FIELD = 'key';

export type ManifestPatch = {
  remove?: readonly string[];
  set?: Readonly<Record<string, unknown>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const patchManifest = (
  manifest: unknown,
  patch: ManifestPatch = {},
): Record<string, unknown> => {
  if (!isRecord(manifest)) {
    throw new Error('Built extension manifest must be an object.');
  }

  const removeFields = patch.remove ?? [];
  const setFields = new Set(Object.keys(patch.set ?? {}));
  if (
    removeFields.includes(E2E_RESERVED_MANIFEST_FIELD) ||
    setFields.has(E2E_RESERVED_MANIFEST_FIELD)
  ) {
    throw new Error(
      `Manifest field "${E2E_RESERVED_MANIFEST_FIELD}" is reserved by the E2E fixture.`,
    );
  }

  const patchedManifest = { ...manifest };
  const removedFields = new Set<string>();
  for (const field of removeFields) {
    if (removedFields.has(field)) {
      throw new Error(
        `Manifest field "${field}" is listed more than once in remove.`,
      );
    }
    if (setFields.has(field)) {
      throw new Error(
        `Manifest field "${field}" cannot be configured by both remove and set.`,
      );
    }
    if (!Object.hasOwn(patchedManifest, field)) {
      throw new Error(`Manifest has no top-level field "${field}" to remove.`);
    }

    removedFields.add(field);
    delete patchedManifest[field];
  }

  return {
    ...patchedManifest,
    ...patch.set,
  };
};

// Chrome hashes the public key, takes the first 16 bytes, then maps each hex
// digit 0-f to a-p to form the 32-character extension ID.
export const createExtensionId = (manifestKey: string): string => {
  const hashPrefix = createHash('sha256')
    .update(Buffer.from(manifestKey, 'base64'))
    .digest('hex')
    .slice(0, 32);

  return hashPrefix.replace(/[0-9a-f]/gu, (digit) =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(digit, 16)),
  );
};
