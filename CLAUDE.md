# Claude Code Instructions

@AGENTS.md

`AGENTS.md` is the single source of truth. The import above loads both its universal
and derivation-required sections. When deriving a product, follow
`.claude/skills/adapt-template/SKILL.md` to update the derivation-required section
without duplicating instructions here.

Claude Code only: skills (`.claude/skills/`) and rules (`.claude/rules/`) are
auto-discovered; the on-demand index in `AGENTS.md` exists for agents without
auto-discovery (e.g. Codex).
