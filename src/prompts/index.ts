import type { WorkflowDefinition } from "../types/index.js";

export const WORKFLOW_CREATE_PROMPT = [
  "<summary>",
  "Document this session as a reusable workflow and enforce usage guidance via AGENTS.md.",
  "</summary>",
  "",
  "<objective>",
  "Capture what worked into a repeatable procedure using workflows_create, then make future agents in this scope aware of it via AGENTS.md.",
  "</objective>",
  "",
  "<instructions>",
  "1. Discovery: You SHOULD inspect <available_workflows> first and read existing workflow files to avoid duplicates.",
  "2. Authoring: You MUST use workflows_create to create or update a workflow in ./.pi/workflows/<name>/SKILL.md.",
  "3. Content quality: You SHOULD include prerequisites, ordered steps, expected outcomes, and any failure recovery notes.",
  "4. Scope: You SHOULD update the most specific AGENTS.md in the directory hierarchy where the work occurred (do not update repository root unless the workflow is truly global).",
  "5. Rule format: You MUST add this exact line before listing workflow names:",
  "   \"When operating in this directory you MUST consider loading these workflows:\"",
  "</instructions>",
  "",
  "<rules>",
  "- MUST persist reusable process knowledge via workflows_create.",
  "- MUST use the exact required AGENTS.md phrasing.",
  "- MUST keep AGENTS.md edits minimal and targeted.",
  "- MAY refine an existing workflow instead of creating a duplicate.",
  "</rules>",
].join("\n");

export function refineWorkflowPrompt(workflow: WorkflowDefinition): string {
  return [
    "<workflow_refine_request>",
    `<name>${workflow.name}</name>`,
    `<location>${workflow.location}</location>`,
    "<requirements>",
    "You MUST refine this workflow to strict quality standards.",
    "You MUST use RFC 2119 keywords correctly and consistently.",
    "You MUST improve structure clarity with deterministic ordered execution and verification criteria.",
    "You SHOULD use concise XML structure where this improves unambiguous execution guidance.",
    "You MUST assess whether the workflow is functional end-to-end and fix identified issues safely.",
    "You MUST preserve intent while improving reliability.",
    "</requirements>",
    "</workflow_refine_request>",
  ].join("\n");
}

export function appendWorkflowAgentsPrompt(workflow: WorkflowDefinition): string {
  return [
    "<workflow_append_agents_request>",
    `<name>${workflow.name}</name>`,
    `<location>${workflow.location}</location>`,
    "<requirements>",
    "You MUST locate the most specific applicable AGENTS.md for this workflow scope.",
    "You MUST verify whether this workflow is already listed before any edits.",
    "You MUST keep edits minimal and idempotent.",
    "You MUST include the exact heading line before entries:",
    "When operating in this directory you MUST consider loading these workflows:",
    "</requirements>",
    "</workflow_append_agents_request>",
  ].join("\n");
}
