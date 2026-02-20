# pi-markdown-workflows

> Why download crappy skills when you can make god tier skills yourself?

Pi extension for building, refining, and using **workflows** (repo SOPs) and **skills** (global capabilities) from one unified GUI.

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/a9124b44-eb29-4159-83fa-27df40c8825a" />

## Key features

### Unified GUI for workflows and skills
A single interface powers both `/workflows` and `/skills`.

- Tab between both views with `Tab` / `Shift+Tab`
- Search, preview details, and run actions from the same UX model
- Keep command surface clean while still supporting advanced actions

### Three user commands
This extension exposes three user-facing commands:

- `/workflows` — workflow list and actions
- `/skills` — skill list and actions
- `/learn [optional guidance]` — capture concise session findings into the most appropriate `AGENTS.md`

### Skill and workflow creation + refinement
Creation and refinement are first-class flows in the UI.

- Workflows: create, use, refine, append-to-agents, promote-to-skill, delete
- Skills: create, use, refine, delete
- Refinement prompts enforce strong structure, RFC language semantics, and actionable quality criteria

### Agent tool for automatic workflow documentation
Agents can document reusable process knowledge while they work via:

- `workflows_create`

The tool writes workflow files to:

- `./.pi/workflows/<slug>/SKILL.md`

This makes workflow capture deterministic and reusable across future sessions.

### Nested AGENTS.md context autoload with periodic refresh
The extension auto-loads nested `AGENTS.md` files when relevant files/paths are accessed.

- triggers on `read`
- also triggers for discovery/listing `bash` commands (`ls`, `find`, `rg`, `grep`, `fd`, `tree`, `git ls-files`, `git grep`)
- loads full nested chain (excluding cwd root `AGENTS.md` reinjection)
- periodic refresh cadence: every **10** qualifying operations

## Workflows vs skills

- **Workflows**: repository SOPs that evolve with project conventions
- **Skills**: broader reusable capabilities, usually global

Recommended global skills location:

- `~/.pi/agent/skills/`

## Install (Git only)

```bash
pi install git+https://github.com/IgorWarzocha/pi-markdown-workflows.git
```

For local development:

```bash
pi -e /absolute/path/to/pi-markdown-workflows/index.ts
```

## Recommended setting to reduce clutter

If `/skill:<name>` commands clutter your command palette, disable skill command registration and use `/skills` instead:

`/settings` => `skill commands: false`

## Repository

- https://github.com/IgorWarzocha/pi-markdown-workflows

Markdown Is All You Need™
