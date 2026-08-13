// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import {
  DERIVATION_BEGIN,
  DERIVATION_END,
  validateAgentDocContract,
} from './agent-doc-contract.mjs';

const readRepositoryFile = (path) => readFileSync(path, 'utf8');

const repositoryEntries = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter((path) => path && existsSync(path));

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

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Universal section content differs from the canonical contract.',
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

test('rejects surface metadata that no longer matches the entrypoint tree', () => {
  const agents = validInput.agents.replace('"background", ', '');

  expect(validateAgentDocContract({ ...validInput, agents })).toContain(
    'Surface metadata must match src/entrypoints/: expected background, content, options, popup; received content, options, popup.',
  );
});

test('rejects stale surface prose after that surface is removed', () => {
  const agents = validInput.agents
    .replace('"background", ', '')
    .replace('    "src/entrypoints/background/background.ts",\n', '');
  const entriesWithoutBackground = validInput.repositoryEntries.filter(
    (path) => !path.startsWith('src/entrypoints/background/'),
  );

  expect(
    validateAgentDocContract({
      ...validInput,
      agents,
      repositoryEntries: entriesWithoutBackground,
    }),
  ).toContain('Derivation-required prose mentions removed surface: background');
});

test('rejects an instruction path after its target is deleted', () => {
  const repositoryEntries = validInput.repositoryEntries.filter(
    (path) => path !== '.claude/rules/testing.md',
  );

  expect(
    validateAgentDocContract({ ...validInput, repositoryEntries }),
  ).toContain('Referenced path does not exist: .claude/rules/testing.md');
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
