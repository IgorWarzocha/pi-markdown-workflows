# Changelog

## 0.2.9

- Appended nested `AGENTS.md` context to the triggering tool result instead of reinjecting accumulated hidden context on every model request.
- Preserved existing load notifications while reducing repeated prompt/context bloat from nested `AGENTS.md` files.
- Updated the bundled `skill-creator` guidance so trigger-selection sections belong in frontmatter descriptions, not loaded skill bodies.
- Fixed workflow/skill menu scrolling so the scroll window follows the visible selected row.
- Added this retrospective changelog and included it in the npm package.

## 0.2.8

- Fixed bundled skill discovery when the extension is installed from npm so `/skills` can resolve packaged skills correctly.
- Improved nested `AGENTS.md` discovery for chained shell commands.

## 0.2.4 - 0.2.7

- Improved workflow memory prompts and bundled skill creation.
- Trimmed workflow guideline prefixes in generated prompt text.
- Migrated Pi package imports to the Earendil Works package scope.
- Standardized workflow tool text.
- Published follow-up packaging hotfixes for the skill and workflow UI line.

## 0.2.0 - 0.2.3

- Updated extension compatibility for Pi 0.70.
- Prepared the package for npm publishing.
- Published follow-up compatibility and packaging hotfixes.

## 0.1.0

- Initial public release of `pi-markdown-workflows`.
- Added the workflows GUI, workflow creation/refinement actions, and `/workflow` command surface.
- Added workflow storage at `./.pi/workflows/<slug>/SKILL.md`.
- Added nested `AGENTS.md` autoloading for relevant file/path access.
- Added the unified workflows/skills direction that later became the `/workflows`, `/skills`, and `/learn` command set.
