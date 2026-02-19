---
name: Replicate todo gui behavior 1:1
description: Reproduce pi-masterplan todo selector/action UX, layout anchoring, and key behavior in another extension command.
---

## Prerequisites
- You MUST read these files first:
  - `/home/igorw/Work/pi/pi-extensions-complete/pi-masterplan/src/app/command/ui.ts`
  - `/home/igorw/Work/pi/pi-extensions-complete/pi-masterplan/src/ui/tui/selector.ts`
  - `/home/igorw/Work/pi/pi-extensions-complete/pi-masterplan/src/ui/tui/selector-view.ts`
  - `/home/igorw/Work/pi/pi-extensions-complete/pi-masterplan/src/ui/tui/action-menu.ts`
- You MUST identify the target extension command entry where `ctx.ui.custom(...)` is invoked.
- You MUST preserve existing command semantics while aligning visual and interaction behavior.

## Steps
1. Implement a single persistent custom TUI session
- You MUST run list and action states inside one `ctx.ui.custom(...)` lifecycle.
- You MUST NOT open separate custom dialogs for list and action transitions.
- Observable outcome: opening, navigating, and returning between list/actions does not cause terminal whitespace jumps.

2. Replicate selector layout structure exactly
- You MUST use this vertical structure in list mode:
  - top `DynamicBorder`
  - `Spacer(1)`
  - header `Text`
  - `Spacer(1)`
  - search `Input`
  - `Spacer(1)`
  - list container
  - `Spacer(1)`
  - hint/footer `Text`
  - `Spacer(1)`
  - bottom `DynamicBorder`
- You MUST hide the search input row in action mode; it MUST NOT render as a stale `>` prompt above detail preview.
- Observable outcome: selector is anchored and occupies stable height like todo UI.

3. Reserve list rows exactly
- You MUST set list-visible rows to 9 for selector-style views.
- You MUST pad missing rows with blank braille rows (`"⠀"`) until 9 rows are rendered.
- You SHOULD center scroll window behavior around selection (as in selector-view list slicing).
- Observable outcome: short lists still render fixed-height panel without collapsing.

4. Mirror key behavior and hints
- You MUST support: `/` search, `j/k` navigation, arrow-key navigation, Enter confirm, Esc cancel/back.
- You MUST support leader mode via `Ctrl+X` and `matchesKey(data, Key.ctrl("x"))`.
- You MUST support preview scrolling in action mode via `J/K` (Shift+j / Shift+k).
- You MAY keep `w/s` as compatibility aliases, but hints SHOULD prioritize `J/K`.
- You SHOULD render normal and leader hint text in the same design language as todo UI.
- Observable outcome: key interactions match todo muscle memory.

5. Replicate action-menu style
- You MUST render action menu with:
  - accent title
  - fixed visible row count
  - padded blank rows
  - top/bottom borders
- You MUST NOT duplicate footer hints across nested and outer panels.
- Observable outcome: action list visual density and spacing match todo action menu.

6. Match preview height scaling behavior
- You MUST size detail preview height relative to terminal rows (target approximately 40% of terminal height) instead of hard-coding a small fixed window.
- You MUST preserve a safe minimum height.
- Observable outcome: preview displays more content before scrolling, consistent with todo detail behavior.

7. Keep flow semantics for workflow creation/use
- Create action MUST ask user what to document, then send the workflow-capture instruction block plus optional `<user_instructions>`.
- Use action MUST inject workflow body and optional user instructions.
- Observable outcome: create/use actions trigger model prompts with expected payload structure.

8. Validate behavior
- You MUST verify:
  - no layout jump between selector and actions
  - reserved list space remains stable with 0, 1, and many items
  - leader shortcuts execute in both selector and action modes
  - Esc behavior returns/cancels correctly
- Observable outcome: manual test notes confirm 1:1 parity on layout, keying, and transitions.

## Essential reference snippets
- Selector shell pattern:
  - `addChild(new DynamicBorder(...)); Spacer; header; Spacer; Input; Spacer; list; Spacer; hint; Spacer; DynamicBorder`
- Row reservation pattern:
  - `const LIST_ROWS = 9;`
  - `for (let index = lines.length; index < LIST_ROWS; index += 1) addChild(new Text("⠀", 0, 0));`
- Leader key pattern:
  - `if (data === "\u0018" || matchesKey(data, Key.ctrl("x"))) ...`

## Expected outcome
- Target command is visually and behaviorally aligned with todo selector/action UX at a 1:1 interaction level.
- UI remains anchored without added whitespace artifacts during mode transitions.
- Workflow create/use flows are prompt-driven and deterministic.
