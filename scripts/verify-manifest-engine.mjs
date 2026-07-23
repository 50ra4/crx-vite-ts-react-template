import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { validateExtensionDisplayName } from './extension-name.mjs';
import { createManifestVersion } from './manifest-version.mjs';

const REQUIRED_CSP = "script-src 'self'; object-src 'self';";

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const verifyManifest = async ({
  manifest,
  packageJson,
  expectedManifest,
  extensionDirectory,
}) => {
  const errors = [];
  const warnings = [];
  const references = [];

  const report = (condition, message) => {
    if (!condition) errors.push(message);
  };

  const readStrings = (value, field) => {
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === 'string')
    ) {
      errors.push(`${field} must be an array of strings.`);
      return undefined;
    }
    return value;
  };

  const expectSet = (value, expected, field) => {
    const values = readStrings(value ?? [], field);
    const wanted = readStrings(expected, `expectedManifest.${field}`);
    if (values === undefined || wanted === undefined) return;

    const actual = values.toSorted();
    const sortedExpected = wanted.toSorted();
    report(
      JSON.stringify(actual) === JSON.stringify(sortedExpected),
      `${field} must equal ${JSON.stringify(sortedExpected)}; received ${JSON.stringify(actual)}.`,
    );
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

  if (!isRecord(manifest)) {
    return {
      errors: ['manifest must be an object.'],
      warnings,
    };
  }

  if (!isRecord(packageJson) || typeof packageJson.version !== 'string') {
    return {
      errors: ['package.json version must be a string.'],
      warnings,
    };
  }

  if (!isRecord(expectedManifest)) {
    return {
      errors: ['expectedManifest must be an object.'],
      warnings,
    };
  }

  const expectedManifestVersion = createManifestVersion(packageJson.version);
  const extensionDisplayNameValidation = validateExtensionDisplayName({
    displayName: packageJson.displayName,
    manifestName: manifest.name,
  });
  errors.push(...extensionDisplayNameValidation.errors);
  warnings.push(...extensionDisplayNameValidation.warnings);

  report(
    manifest.version === expectedManifestVersion.version,
    `version must equal ${JSON.stringify(expectedManifestVersion.version)}; received ${JSON.stringify(manifest.version)}.`,
  );
  report(
    manifest.version_name === expectedManifestVersion.version_name,
    `version_name must equal ${JSON.stringify(expectedManifestVersion.version_name)}; received ${JSON.stringify(manifest.version_name)}.`,
  );
  report(
    manifest.manifest_version === 3,
    `manifest_version must be 3; received ${JSON.stringify(manifest.manifest_version)}.`,
  );

  for (const field of [
    'permissions',
    'host_permissions',
    'optional_permissions',
    'optional_host_permissions',
  ]) {
    expectSet(manifest[field], expectedManifest[field], field);
  }

  report(
    manifest.externally_connectable === undefined,
    'externally_connectable must not be declared.',
  );
  const csp = manifest.content_security_policy?.extension_pages;
  report(
    csp === REQUIRED_CSP,
    `content_security_policy.extension_pages must equal ${JSON.stringify(REQUIRED_CSP)}; received ${JSON.stringify(csp)}.`,
  );

  if (manifest.icons !== undefined) addIconReferences(manifest.icons, 'icons');
  if (manifest.action?.default_icon !== undefined) {
    addIconReferences(manifest.action.default_icon, 'action.default_icon');
  }

  const expectedSurfaces = expectedManifest.surfaces;
  if (!isRecord(expectedSurfaces)) {
    errors.push('expectedManifest.surfaces must be an object.');
  } else {
    for (const surface of ['action', 'options_ui', 'background']) {
      const expected = expectedSurfaces[surface];
      if (typeof expected !== 'boolean') {
        errors.push(`expectedManifest.surfaces.${surface} must be a boolean.`);
        continue;
      }

      if (!expected) {
        report(
          manifest[surface] === undefined,
          `${surface} must not be declared.`,
        );
        continue;
      }

      report(isRecord(manifest[surface]), `${surface} must be declared.`);
      if (!isRecord(manifest[surface])) continue;

      const referenceFields = {
        action: 'default_popup',
        options_ui: 'page',
        background: 'service_worker',
      };
      const referenceField = referenceFields[surface];
      addReference(
        manifest[surface][referenceField],
        `${surface}.${referenceField}`,
      );
    }
  }

  const expectedContentScripts = expectedManifest.content_scripts;
  if (!Array.isArray(expectedContentScripts)) {
    errors.push('expectedManifest.content_scripts must be an array.');
  }
  report(
    Array.isArray(manifest.content_scripts ?? []),
    'content_scripts must be an array.',
  );
  const contentScripts = Array.isArray(manifest.content_scripts)
    ? manifest.content_scripts
    : [];
  const contentScriptExpectations = Array.isArray(expectedContentScripts)
    ? expectedContentScripts
    : [];
  report(
    contentScripts.length === contentScriptExpectations.length,
    `content_scripts must contain exactly ${contentScriptExpectations.length} entries; received ${contentScripts.length}.`,
  );

  contentScripts.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`content_scripts.${index} must be an object.`);
      return;
    }

    const expectation = contentScriptExpectations[index];
    if (!isRecord(expectation)) {
      errors.push(
        `expectedManifest.content_scripts.${index} must be an object.`,
      );
    } else {
      expectSet(
        entry.matches,
        expectation.matches,
        `content_scripts.${index}.matches`,
      );
      report(
        (entry.run_at ?? 'document_idle') === expectation.run_at,
        `content_scripts.${index}.run_at must equal ${JSON.stringify(expectation.run_at)}; received ${JSON.stringify(entry.run_at ?? 'document_idle')}.`,
      );
    }

    for (const field of ['js', 'css']) {
      if (entry[field] === undefined) continue;
      const paths =
        readStrings(entry[field], `content_scripts.${index}.${field}`) ?? [];
      paths.forEach((path, pathIndex) =>
        addReference(path, `content_scripts.${index}.${field}.${pathIndex}`),
      );
    }
  });

  const expectedWebAccessibleResources =
    expectedManifest.web_accessible_resources;
  if (!Array.isArray(expectedWebAccessibleResources)) {
    errors.push('expectedManifest.web_accessible_resources must be an array.');
  }
  report(
    Array.isArray(manifest.web_accessible_resources ?? []),
    'web_accessible_resources must be an array.',
  );
  const webAccessibleResources = Array.isArray(
    manifest.web_accessible_resources,
  )
    ? manifest.web_accessible_resources
    : [];
  const webAccessibleResourceExpectations = Array.isArray(
    expectedWebAccessibleResources,
  )
    ? expectedWebAccessibleResources
    : [];
  report(
    webAccessibleResources.length === webAccessibleResourceExpectations.length,
    `web_accessible_resources must contain exactly ${webAccessibleResourceExpectations.length} entries; received ${webAccessibleResources.length}.`,
  );

  webAccessibleResources.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`web_accessible_resources.${index} must be an object.`);
      return;
    }

    const expectation = webAccessibleResourceExpectations[index];
    if (!isRecord(expectation)) {
      errors.push(
        `expectedManifest.web_accessible_resources.${index} must be an object.`,
      );
      return;
    }

    expectSet(
      entry.matches,
      expectation.matches,
      `web_accessible_resources.${index}.matches`,
    );
    expectSet(
      entry.extension_ids,
      expectation.extension_ids,
      `web_accessible_resources.${index}.extension_ids`,
    );
    report(
      entry.use_dynamic_url === expectation.use_dynamic_url,
      `web_accessible_resources.${index}.use_dynamic_url must equal ${JSON.stringify(expectation.use_dynamic_url)}; received ${JSON.stringify(entry.use_dynamic_url)}.`,
    );

    const field = `web_accessible_resources.${index}.resources`;
    const resources = readStrings(entry.resources, field) ?? [];
    report(resources.length > 0, `${field} must not be empty.`);

    const resourceExpectation = expectation.resources;
    if (!isRecord(resourceExpectation)) {
      errors.push(
        `expectedManifest.web_accessible_resources.${index}.resources must be an object.`,
      );
      return;
    }
    const required =
      readStrings(
        resourceExpectation.required,
        `expectedManifest.web_accessible_resources.${index}.resources.required`,
      ) ?? [];
    const allowedPatterns = resourceExpectation.allowedPatterns;
    if (
      !Array.isArray(allowedPatterns) ||
      !allowedPatterns.every((pattern) => pattern instanceof RegExp)
    ) {
      errors.push(
        `expectedManifest.web_accessible_resources.${index}.resources.allowedPatterns must be an array of regular expressions.`,
      );
      return;
    }

    for (const requiredPath of required) {
      const count = resources.filter((path) => path === requiredPath).length;
      report(
        count === 1,
        `${field} must contain ${requiredPath} exactly once; received ${count}.`,
      );
    }

    resources.forEach((path, pathIndex) => {
      const resourceField = `${field}.${pathIndex}`;
      const allowed =
        required.includes(path) ||
        allowedPatterns.some((pattern) => {
          pattern.lastIndex = 0;
          return pattern.test(path);
        });
      report(
        allowed,
        `${resourceField} is not allowed by expectedManifest: ${path}`,
      );
      addReference(path, resourceField);
    });
  });

  const verifyReference = async ({ field, value }) => {
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
      return `${field} must stay within the extension directory: ${value}`;
    }

    try {
      const file = await stat(absolutePath);
      return file.isFile()
        ? undefined
        : `${field} does not reference a file: ${value}`;
    } catch {
      return `${field} references a missing file: ${value}`;
    }
  };

  const referenceErrors = await Promise.all(references.map(verifyReference));
  errors.push(...referenceErrors.filter(Boolean));

  return { errors, warnings };
};
