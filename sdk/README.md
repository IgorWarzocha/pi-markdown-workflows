# Pi Extensions Design SDK (Core)

Reusable TUI primitives for Pi extensions.

## What this SDK provides

- Fixed-height panel template (`template.ts`)
- Selectable list primitive with optional multi-column flow (`list.ts`)
- Action primitive built on list (`action.ts`)
- Detail primitive with optional injected block (`detail.ts`)
- Attached detail frame renderer (2x top panel, centered title bar) (`detail-frame.ts`)
- Shared runtime loop for key handling + routing (`app.ts`)
- Key matchers (`keybinds.ts`) and detail key behavior mapping (`keybind-logic.ts`)
- Primitive and intent contracts (`primitive.ts`, `intent.ts`)

## Minimal usage

1. Build screen sources in your extension `src/` using SDK primitives.
2. Build a screen registry (`Record<Screen, Primitive>`).
3. Build a detail registry (`Record<string, Primitive>`).
4. Define tab cycle order (`Screen[]`).
5. Call `runApp(ctx, { registry, details, cycle, initial, about, help })` from your command handler.

## Contracts

- Every interactive view MUST implement `Primitive`.
- `enter()` and `view()` SHOULD return `Intent` values for routing.
- Detail previews SHOULD be opened via `Intent { type: "detail", key }`.
- Unknown detail keys MUST throw descriptive errors.

## File roles

- `template.ts`: canonical bottom panel renderer.
- `detail-frame.ts`: top attached detail renderer.
- `app.ts`: runtime state loop and input routing.
- `list.ts`: row/flow list behavior, search, wraparound.
- `action.ts`: action list preset.
- `detail.ts`: scrollable read view with optional `block` section.
