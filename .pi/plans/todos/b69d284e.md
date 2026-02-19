---
id: b69d284e
type: todo
title: Assess available_workflows prompt injection visibility, placement, and
  refresh behavior
tags:
  - workflows
  - prompting
  - cache
  - investigation
status: open
created_at: 2026-02-19T13:04:25.283Z
modified_at: 2026-02-19T13:04:25.283Z
assigned_to_session: null
agent_rules: MUST update checklist done booleans during execution, not after
  completion. MUST edit only fields and sections explicitly allowed by the
  active instruction.
worktree:
  enabled: true
  branch: feat/todo-assess-available-workflows-prompt-injection-visibility-placement-and-refresh-behavior
links:
  root_abs: /home/igorw/Work/pi/pi-extensions-complete/pi-workflows-tool
  prds: []
  specs: []
  todos:
    - f78bb86c
    - 1720749b
checklist:
  - id: "1"
    title: Trace before_agent_start handler and document exact systemPrompt
      concatenation logic, including suffix structure and append position
    done: true
  - id: "2"
    title: Instrument or run a reproducible local session to capture agent-start
      prompt evidence showing whether <available_workflows> appears when
      workflows exist
    done: true
  - id: "3"
    title: Create a new workflow during runtime and verify whether subsequent agent
      starts include refreshed <available_workflows> entries without restart
    done: true
  - id: "4"
    title: Evaluate current XML/text structure quality for agent use and document
      concrete weaknesses with observable examples
    done: true
  - id: "5"
    title: Propose implementation updates and acceptance checks that guarantee fresh
      workflow visibility and mitigate prompt caching/staleness issues
    done: true
---

## Goal
Verify whether `<available_workflows>` is actually presented to the agent, evaluate whether the appended system-prompt structure is sufficient, and confirm refresh behavior when workflows are added.

## Questions to answer
- Is `<available_workflows>` reliably appended to the effective system prompt seen by agent runs?
- Where exactly is it appended relative to the base system prompt, and does placement create caching/staleness risk?
- Is prompt content regenerated when new workflow files appear, and on which lifecycle events?

## Related items
- TODO f78bb86c: command consolidation into `/workflows` MAY depend on accurate workflow prompt discovery behavior.
- TODO 1720749b: AGENTS.md loading investigation overlaps event and context-refresh analysis.

## Deliverable
Produce a behavior assessment with code references, identified risks, and recommended changes for deterministic prompt refresh and workflow visibility.
