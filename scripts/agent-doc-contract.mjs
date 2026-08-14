import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export const UNIVERSAL_BEGIN = '<!-- AGENTS:UNIVERSAL:BEGIN -->';
export const UNIVERSAL_END = '<!-- AGENTS:UNIVERSAL:END -->';
export const DERIVATION_BEGIN = '<!-- AGENTS:DERIVATION-REQUIRED:BEGIN -->';
export const DERIVATION_END = '<!-- AGENTS:DERIVATION-REQUIRED:END -->';

const METADATA_BEGIN = '<!-- AGENTS:DERIVATION-METADATA:BEGIN -->';
const METADATA_END = '<!-- AGENTS:DERIVATION-METADATA:END -->';
const UNIVERSAL_CONTRACT_SHA256 =
  '7d635887805d369d092a4bebacc2b836cd42901b40108bc956eacb83d35c2ff7';
const SKILL_UNIVERSAL_ANCHOR = '<!-- AGENTS-CONTRACT:UNIVERSAL:PRESERVE -->';
const SKILL_DERIVATION_ANCHOR =
  '<!-- AGENTS-CONTRACT:DERIVATION:SYNCHRONIZE -->';
const CLAUDE_SINGLE_SOURCE_ANCHOR = '<!-- AGENTS-CONTRACT:SINGLE-SOURCE -->';
const ROOT_PATH_EXTENSION =
  /^(?:[^./][^/]*|\.[^./][^/]*)\.(?:html|json|md|mjs|svg|ts|tsx|yaml|yml)$/u;
const ROOT_DOTFILES = new Set(['.nvmrc']);
const ROOT_IGNORED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.next',
  '.nuxt',
  '.serverless',
  'coverage',
  'dist',
  'extension',
  'logs',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const ROOT_IGNORED_FILES = new Set(['.env', '.env.test', 'extension.zip']);
const ROOT_IGNORED_FILE_PATTERNS = [/\.log$/u, /\.pid$/u, /\.tgz$/u];

export const collectRepositoryEntries = (root) => {
  const entries = [];

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const isRootEntry = directory === root;
      if (
        isRootEntry &&
        entry.isDirectory() &&
        ROOT_IGNORED_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }

      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        if (
          isRootEntry &&
          (ROOT_IGNORED_FILES.has(entry.name) ||
            ROOT_IGNORED_FILE_PATTERNS.some((pattern) =>
              pattern.test(entry.name),
            ))
        ) {
          continue;
        }
        entries.push(relative(root, absolutePath).replaceAll('\\', '/'));
      }
    }
  };

  visit(root);
  return entries.toSorted();
};

const countOccurrences = (text, value) => text.split(value).length - 1;

const extractSection = (text, begin, end, label, errors) => {
  const beginCount = countOccurrences(text, begin);
  const endCount = countOccurrences(text, end);

  if (beginCount !== 1 || endCount !== 1) {
    errors.push(`${label} markers must each appear exactly once.`);
    return null;
  }

  const beginIndex = text.indexOf(begin);
  const endIndex = text.indexOf(end);

  if (beginIndex >= endIndex) {
    errors.push(`${label} markers are out of order.`);
    return null;
  }

  return text.slice(beginIndex + begin.length, endIndex).trim();
};

const pathExists = (path, repositoryEntries) => {
  const normalized = path.replace(/\/$/u, '');

  return (
    repositoryEntries.includes(normalized) ||
    repositoryEntries.some((entry) => entry.startsWith(`${normalized}/`))
  );
};

const directoryExists = (path, repositoryEntries) => {
  const normalized = path.replace(/\/$/u, '');

  return repositoryEntries.some((entry) => entry.startsWith(`${normalized}/`));
};

const extractCodeSpans = (text) =>
  [...text.matchAll(/`([^`\n]+)`/gu)].map((match) => match[1].trim());

const isLiteralRepositoryPath = (value, repositoryEntries) => {
  if (
    /\s/u.test(value) ||
    value.includes('*') ||
    value.includes('<') ||
    value.includes('>') ||
    value.includes('{') ||
    value.includes('}') ||
    value.startsWith('@') ||
    value.includes('://') ||
    value.startsWith('extension/') ||
    value === 'extension.zip'
  ) {
    return false;
  }

  return (
    value.includes('/') ||
    repositoryEntries.includes(value) ||
    ROOT_DOTFILES.has(value) ||
    ROOT_PATH_EXTENSION.test(value)
  );
};

const validateNpmCommand = (command, packageJson, errors) => {
  if (command === 'npm ci' || command.startsWith('npm install ')) return;

  const runMatch = command.match(/^npm run ([^\s]+)/u);
  const directMatch = command.match(/^npm (test|start|stop|restart)(?:\s|$)/u);
  const script = runMatch?.[1] ?? directMatch?.[1];

  if (script && !Object.hasOwn(packageJson.scripts ?? {}, script)) {
    errors.push(`Referenced npm script does not exist: ${script}`);
  }
};

const parseMetadata = (derivation, errors) => {
  const metadataSection = extractSection(
    derivation,
    METADATA_BEGIN,
    METADATA_END,
    'Derivation metadata',
    errors,
  );

  if (metadataSection === null) return null;

  const match = metadataSection.match(/^```json\s*([\s\S]*?)\s*```$/u);
  if (!match) {
    errors.push('Derivation metadata must be a fenced JSON object.');
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    errors.push(`Derivation metadata is invalid JSON: ${error.message}`);
    return null;
  }
};

const validateStringArray = (metadata, key, errors) => {
  const value = metadata?.[key];

  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    errors.push(`Derivation metadata ${key} must be an array of strings.`);
    return [];
  }

  return [...new Set(value)].toSorted();
};

const validateRoot = (
  metadata,
  key,
  label,
  errors,
  { nullable = false } = {},
) => {
  const value = metadata?.[key];

  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(
      `Derivation metadata ${key} must be ${nullable ? 'a repository path or null' : 'a repository path'}.`,
    );
    return null;
  }

  if (value.endsWith('/')) {
    errors.push(`Derivation metadata ${key} must not end with a slash.`);
  }

  return { label, path: value.replace(/\/$/u, '') };
};

const listDirectories = (repositoryEntries, root) =>
  [
    ...new Set(
      repositoryEntries
        .filter((entry) => entry.startsWith(`${root}/`))
        .map((entry) => entry.slice(root.length + 1))
        .filter((entry) => entry.includes('/'))
        .map((entry) => entry.split('/')[0]),
    ),
  ].toSorted();

const formatList = (items) => items.join(', ');

export const validateAgentDocContract = ({
  agents,
  claude,
  packageJson,
  repositoryEntries,
  skill,
}) => {
  const errors = [];
  const universal = extractSection(
    agents,
    UNIVERSAL_BEGIN,
    UNIVERSAL_END,
    'Universal section',
    errors,
  );
  const derivation = extractSection(
    agents,
    DERIVATION_BEGIN,
    DERIVATION_END,
    'Derivation-required section',
    errors,
  );

  const markerOffsets = [
    agents.indexOf(UNIVERSAL_BEGIN),
    agents.indexOf(UNIVERSAL_END),
    agents.indexOf(DERIVATION_BEGIN),
    agents.indexOf(DERIVATION_END),
  ];
  if (
    markerOffsets.every((offset) => offset >= 0) &&
    markerOffsets.some(
      (offset, index) => index > 0 && offset <= markerOffsets[index - 1],
    )
  ) {
    errors.push(
      'Universal and derivation-required sections must be ordered and non-overlapping.',
    );
  }

  if (universal === '') errors.push('Universal section must not be empty.');
  if (derivation === '') {
    errors.push('Derivation-required section must not be empty.');
  }

  if (universal !== null && universal !== '') {
    const hash = createHash('sha256').update(universal).digest('hex');
    if (hash !== UNIVERSAL_CONTRACT_SHA256) {
      errors.push(
        `Universal section content differs from the canonical contract: expected SHA-256 ${UNIVERSAL_CONTRACT_SHA256}; received ${hash}. Hash the trimmed text between the universal markers after an intentional contract update.`,
      );
    }
  }

  if (derivation !== null && derivation !== '') {
    const metadata = parseMetadata(derivation, errors);

    if (metadata) {
      const entrypointRoot = validateRoot(
        metadata,
        'entrypointRoot',
        'Entrypoint',
        errors,
      );
      const sharedRoot = validateRoot(
        metadata,
        'sharedRoot',
        'Shared',
        errors,
        { nullable: true },
      );

      for (const root of [entrypointRoot, sharedRoot].filter(Boolean)) {
        if (!pathExists(root.path, repositoryEntries)) {
          errors.push(`${root.label} root does not exist: ${root.path}`);
        } else if (!directoryExists(root.path, repositoryEntries)) {
          errors.push(
            `${root.label} root is not a repository directory: ${root.path}`,
          );
        }
      }

      const surfaces = validateStringArray(metadata, 'surfaces', errors);
      const expectedSurfaces = entrypointRoot
        ? listDirectories(repositoryEntries, entrypointRoot.path)
        : [];
      if (formatList(surfaces) !== formatList(expectedSurfaces)) {
        errors.push(
          `Surface metadata must match ${entrypointRoot?.path ?? 'the configured entrypoint root'}/: expected ${formatList(expectedSurfaces)}; received ${formatList(surfaces)}.`,
        );
      }

      const sharedLayers = validateStringArray(
        metadata,
        'sharedLayers',
        errors,
      );
      const expectedSharedLayers = sharedRoot
        ? listDirectories(repositoryEntries, sharedRoot.path)
        : [];
      if (formatList(sharedLayers) !== formatList(expectedSharedLayers)) {
        errors.push(
          `Shared-layer metadata must match ${sharedRoot?.path ?? 'the configured shared root'}/: expected ${formatList(expectedSharedLayers)}; received ${formatList(sharedLayers)}.`,
        );
      }

      const metadataKeys = Object.keys(metadata).toSorted();
      if (
        formatList(metadataKeys) !==
        'entrypointRoot, sharedLayers, sharedRoot, surfaces'
      ) {
        errors.push(
          'Derivation metadata must contain only entrypointRoot, sharedRoot, surfaces, and sharedLayers.',
        );
      }
    }

    if (
      skill != null &&
      !derivation.includes('.claude/skills/adapt-template/SKILL.md')
    ) {
      errors.push(
        'Derivation-required section must reference .claude/skills/adapt-template/SKILL.md.',
      );
    }

    const codeSpans = extractCodeSpans(derivation);
    for (const path of codeSpans.filter((value) =>
      isLiteralRepositoryPath(value, repositoryEntries),
    )) {
      if (!pathExists(path, repositoryEntries)) {
        errors.push(`Referenced path does not exist: ${path}`);
      }
    }
    for (const command of codeSpans.filter((value) =>
      value.startsWith('npm '),
    )) {
      validateNpmCommand(command, packageJson, errors);
    }
  }

  if (skill != null) {
    if (countOccurrences(skill, SKILL_UNIVERSAL_ANCHOR) !== 1) {
      errors.push(
        'adapt-template must declare the universal preservation contract.',
      );
    }
    if (countOccurrences(skill, SKILL_DERIVATION_ANCHOR) !== 1) {
      errors.push(
        'adapt-template must declare the derivation synchronization contract.',
      );
    }
  }

  const imports = claude.match(/^@AGENTS\.md\s*$/gmu) ?? [];
  if (imports.length !== 1) {
    errors.push('CLAUDE.md must import AGENTS.md exactly once.');
  }
  if (countOccurrences(claude, CLAUDE_SINGLE_SOURCE_ANCHOR) !== 1) {
    errors.push(
      'CLAUDE.md must declare AGENTS.md as its single source of truth.',
    );
  }

  return [...new Set(errors)];
};
