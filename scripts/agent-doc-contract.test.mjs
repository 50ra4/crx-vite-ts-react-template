// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const UNIVERSAL_BEGIN = '<!-- AGENTS:UNIVERSAL:BEGIN -->';
const UNIVERSAL_END = '<!-- AGENTS:UNIVERSAL:END -->';
const DERIVATION_BEGIN = '<!-- AGENTS:DERIVATION-REQUIRED:BEGIN -->';
const DERIVATION_END = '<!-- AGENTS:DERIVATION-REQUIRED:END -->';

const readRepositoryFile = (path) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const countOccurrences = (text, value) => text.split(value).length - 1;

const extractSection = (text, begin, end) => {
  const beginIndex = text.indexOf(begin);
  const endIndex = text.indexOf(end);

  return text.slice(beginIndex + begin.length, endIndex).trim();
};

test('AGENTS.md has one ordered, non-empty pair of each contract boundary', () => {
  const agents = readRepositoryFile('AGENTS.md');
  const markers = [
    UNIVERSAL_BEGIN,
    UNIVERSAL_END,
    DERIVATION_BEGIN,
    DERIVATION_END,
  ];

  expect(markers.map((marker) => countOccurrences(agents, marker))).toEqual([
    1, 1, 1, 1,
  ]);
  expect(markers.map((marker) => agents.indexOf(marker))).toEqual(
    markers.map((marker) => agents.indexOf(marker)).toSorted((a, b) => a - b),
  );
  expect(extractSection(agents, UNIVERSAL_BEGIN, UNIVERSAL_END)).not.toBe('');
  expect(extractSection(agents, DERIVATION_BEGIN, DERIVATION_END)).not.toBe('');
});

test('the derivation-required section points agents to adapt-template', () => {
  const agents = readRepositoryFile('AGENTS.md');
  const derivationSection = extractSection(
    agents,
    DERIVATION_BEGIN,
    DERIVATION_END,
  );

  expect(derivationSection).toContain('.claude/skills/adapt-template/SKILL.md');
});

test('adapt-template preserves the universal boundary and updates the derivation boundary', () => {
  const skill = readRepositoryFile('.claude/skills/adapt-template/SKILL.md');

  expect(skill).toContain(UNIVERSAL_BEGIN);
  expect(skill).toContain(UNIVERSAL_END);
  expect(skill).toContain(DERIVATION_BEGIN);
  expect(skill).toContain(DERIVATION_END);
  expect(skill).toMatch(
    /universal section[^.]+(?:preserve|do not (?:edit|rewrite))/i,
  );
  expect(skill).toMatch(
    /derivation-required section[^.]+(?:update|rewrite|delete)/i,
  );
});

test('CLAUDE.md imports AGENTS.md exactly once', () => {
  const claude = readRepositoryFile('CLAUDE.md');
  const imports = claude.match(/^@AGENTS\.md\s*$/gmu) ?? [];

  expect(imports).toHaveLength(1);
});
