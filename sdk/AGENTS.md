# SDK Agent Rules

This file defines development rules for `/sdk`.

## Purpose

- `/sdk` is the stable framework layer used by extension authors and other agents.
- Changes to `/sdk` MUST be minimal, backwards-safe, and explicit.

## Change Authorization

- Agents MUST NOT change `/sdk` unless the user explicitly requests SDK changes.
- If a task can be solved in `sdk/example` (or another extension consumer), agents MUST prefer that path.
- Before changing `/sdk`, agents MUST state why consumer-level changes are insufficient.

## Compatibility

- Public exports from `sdk/index.ts` MUST remain stable.
- Existing behavior MUST remain unchanged unless the user explicitly requests behavior changes.
- Breaking changes MUST be called out before implementation.

## Design Constraints

- `/sdk` MUST stay generic; it MUST NOT hardcode example-specific names, keys, or content.
- Runtime logic and rendering logic SHOULD remain separated.
- Input key matching and key behavior rules SHOULD remain separated.
- Errors MUST fail fast and be descriptive.

## Code Conventions

- TypeScript types MUST be explicit; `any` MUST NOT be used.
- Files MUST remain modular and focused.
- Single-word names SHOULD be preferred unless clarity requires more words.
- Comments SHOULD be concise and present for major blocks/functions.

## Workflow

- Agents SHOULD propose a minimal plan before non-trivial SDK edits.
- Agents SHOULD summarize API impact after SDK edits.
- Agents SHOULD update `sdk/README.md` when public SDK usage changes.
