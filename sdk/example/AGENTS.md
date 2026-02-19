# Example Agent Rules

This file defines strict rules for `/sdk/example`.

## Purpose

- `/sdk/example` is a frozen reference implementation of the SDK.
- It exists to show canonical usage patterns for list/action/detail/runtime composition.

## Modification Policy

- Files in `/sdk/example` MUST NOT be modified.
- Agents MUST treat `/sdk/example` as read-only reference code.
- If a user asks for changes, agents MUST ask for explicit confirmation to break the frozen-reference rule before editing.

## Usage Policy

- Agents SHOULD use `/sdk/example` to understand expected SDK usage and composition.
- Agents SHOULD ask the user whether they want the example wired to Pi for live preview.
- Agents MUST implement new work outside `/sdk/example` unless explicitly instructed otherwise.
