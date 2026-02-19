# @pi-extensions-dev/pi-workflows-tool

Pi extension version of the workflows plugin, with embedded subdirectory context loading.

## Features

- `workflows_create` tool: create workflows
- `/workflow` command: turns session outcomes into reusable workflow docs
- Injects `<available_workflows>` on every new agent run (`before_agent_start`)
- Embedded `pi-subdir-context` behavior (autoload nested `AGENTS.md` files on `read`)

## Workflow paths

- `./.pi/workflows/<slug>/SKILL.md`

## Install

```bash
pi install npm:@pi-extensions-dev/pi-workflows-tool
```

For local development:

```bash
pi -e /absolute/path/to/pi-workflows-tool/src/index.ts
```
