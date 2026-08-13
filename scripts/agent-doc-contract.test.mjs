// @vitest-environment node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DERIVATION_BEGIN,
  DERIVATION_END,
  collectRepositoryEntries,
  validateAgentDocContract,
} from './agent-doc-contract.mjs';

const readRepositoryFile = (path) => readFileSync(path, 'utf8');

const repositoryEntries = collectRepositoryEntries(process.cwd());

const validInput = {
  agents: readRepositoryFile('AGENTS.md'),
  claude: readRepositoryFile('CLAUDE.md'),
  packageJson: JSON.parse(readRepositoryFile('package.json')),
  repositoryEntries,
  skill: readRepositoryFile('.claude/skills/adapt-template/SKILL.md'),
};

const replaceSection = (text, begin, end, replacement) => {
  const before = text.slice(0, text.indexOf(begin) + begin.length);
  const after = text.slice(text.indexOf(end));

  return `${before}\n\n${replacement}\n\n${after}`;
};

test('accepts the repository agent-document contract', () => {
  expect(validateAgentDocContract(validInput)).toEqual([]);
});

test('rejects changes to the canonical universal section', () => {
  const agents = validInput.agents.replace(
    /(?<=<!-- AGENTS:UNIVERSAL:BEGIN -->)[\s\S]*?(?=<!-- AGENTS:UNIVERSAL:END -->)/u,
    '\n\nx\n\n',
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /^Universal section content differs from the canonical contract: expected SHA-256 [a-f0-9]{64}; received [a-f0-9]{64}\./u,
      ),
    ]),
  );
});

test('requires the derivation section to reference adapt-template', () => {
  const agents = validInput.agents.replaceAll(
    '.claude/skills/adapt-template/SKILL.md',
    '.claude/skills/release/SKILL.md',
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Derivation-required section must reference .claude/skills/adapt-template/SKILL.md.',
  );
});

test('rejects a stale path in the derivation-required section', () => {
  const agents = validInput.agents.replace(
    DERIVATION_END,
    'See `.claude/rules/deleted.md`.\n\n' + DERIVATION_END,
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Referenced path does not exist: .claude/rules/deleted.md',
  );
});

test('rejects a stale root-document path', () => {
  const agents = validInput.agents.replace(
    DERIVATION_END,
    'See `deleted.md`.\n\n' + DERIVATION_END,
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Referenced path does not exist: deleted.md',
  );
});

test('rejects an npm command that package.json does not provide', () => {
  const agents = validInput.agents.replace(
    DERIVATION_END,
    'Run `npm run deleted-script`.\n\n' + DERIVATION_END,
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Referenced npm script does not exist: deleted-script',
  );
});

test('does not interpret an npm command containing a path as a file path', () => {
  const agents = validInput.agents.replace(
    DERIVATION_END,
    'Run `npm test -- --run scripts/agent-doc-contract.test.mjs`.\n\n' +
      DERIVATION_END,
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toEqual([]);
});

test('rejects surface metadata that no longer matches the entrypoint tree', () => {
  const agents = validInput.agents.replace('"background", ', '');

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Surface metadata must match src/entrypoints/: expected background, content, options, popup; received content, options, popup.',
  );
});

test('rejects metadata keys that duplicate prose validation', () => {
  const agents = validInput.agents.replace(
    '"sharedLayers": ["messaging", "storage", "testing"]',
    '"sharedLayers": ["messaging", "storage", "testing"], "paths": ["AGENTS.md"]',
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Derivation metadata must contain only surfaces and sharedLayers.',
  );
});

test('rejects an instruction path after its target is deleted', () => {
  const repositoryEntries = validInput.repositoryEntries.filter(
    (path) => path !== '.claude/rules/testing.md',
  );

  expect(
    validateAgentDocContract({ ...validInput, repositoryEntries }),
  ).toContain('Referenced path does not exist: .claude/rules/testing.md');
});

test('allows ordinary prose that uses removed surface or layer words', () => {
  const universalBlock = validInput.agents.slice(
    validInput.agents.indexOf('<!-- AGENTS:UNIVERSAL:BEGIN -->'),
    validInput.agents.indexOf('<!-- AGENTS:UNIVERSAL:END -->') +
      '<!-- AGENTS:UNIVERSAL:END -->'.length,
  );
  const derivation = `<!-- AGENTS:DERIVATION-REQUIRED:BEGIN -->

<!-- AGENTS:DERIVATION-METADATA:BEGIN -->

\`\`\`json
{"surfaces":["content"],"sharedLayers":[]}
\`\`\`

<!-- AGENTS:DERIVATION-METADATA:END -->

Follow \`.claude/skills/adapt-template/SKILL.md\`.
CLI options are defined in \`vite.config.ts\`.
The extension keeps no persistent storage. Unit testing stays in the fast lane.

<!-- AGENTS:DERIVATION-REQUIRED:END -->`;

  expect(
    validateAgentDocContract({
      ...validInput,
      agents: `${universalBlock}\n\n${derivation}\n`,
      repositoryEntries: [
        '.claude/skills/adapt-template/SKILL.md',
        'src/entrypoints/content/product.ts',
        'vite.config.ts',
      ],
    }),
  ).toEqual([]);
});

test('collects repository entries without requiring a git repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'agent-doc-contract-'));
  try {
    mkdirSync(join(root, 'src', 'entrypoints', 'content'), { recursive: true });
    writeFileSync(join(root, 'AGENTS.md'), 'contract');
    writeFileSync(join(root, 'src', 'entrypoints', 'content', 'index.ts'), '');

    expect(collectRepositoryEntries(root)).toEqual([
      'AGENTS.md',
      'src/entrypoints/content/index.ts',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects empty or malformed boundary sections', () => {
  const agents = replaceSection(
    validInput.agents,
    DERIVATION_BEGIN,
    DERIVATION_END,
    '',
  );

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Derivation-required section must not be empty.',
  );
});

test('rejects overlapping or reordered top-level sections', () => {
  const universalBlock = validInput.agents.slice(
    validInput.agents.indexOf('<!-- AGENTS:UNIVERSAL:BEGIN -->'),
    validInput.agents.indexOf('<!-- AGENTS:UNIVERSAL:END -->') +
      '<!-- AGENTS:UNIVERSAL:END -->'.length,
  );
  const derivationBlock = validInput.agents.slice(
    validInput.agents.indexOf(DERIVATION_BEGIN),
    validInput.agents.indexOf(DERIVATION_END) + DERIVATION_END.length,
  );

  expect(
    validateAgentDocContract({
      ...validInput,
      agents: `${derivationBlock}\n\n${universalBlock}\n`,
    }),
  ).toContain(
    'Universal and derivation-required sections must be ordered and non-overlapping.',
  );
});

test('rejects shared-layer metadata that no longer matches src/lib', () => {
  const agents = validInput.agents.replace('"messaging", ', '');

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Shared-layer metadata must match src/lib/: expected messaging, storage, testing; received storage, testing.',
  );
});

test('requires machine-readable skill and CLAUDE contract anchors', () => {
  const skill = validInput.skill.replace(
    '<!-- AGENTS-CONTRACT:DERIVATION:SYNCHRONIZE -->',
    '',
  );
  const claude = validInput.claude.replace(
    '<!-- AGENTS-CONTRACT:SINGLE-SOURCE -->',
    '',
  );

  expect(validateAgentDocContract({ ...validInput, skill })).toContain(
    'adapt-template must declare the derivation synchronization contract.',
  );
  expect(validateAgentDocContract({ ...validInput, claude })).toContain(
    'CLAUDE.md must declare AGENTS.md as its single source of truth.',
  );
});
