import path from "node:path";

import type { WorkflowDefinition } from "../../types/index.js";

function buildAvailableWorkflowsXml(workflows: WorkflowDefinition[], cwd: string): string {
  if (!workflows.length) return "<available_workflows></available_workflows>";
  return [
    "<available_workflows>",
    ...workflows.flatMap((workflow) => {
      const relative = path.relative(cwd, workflow.location) || workflow.location;
      return [
        "  <workflow>",
        `    <name>${workflow.name}</name>`,
        `    <description>${workflow.description}</description>`,
        `    <location>${relative}</location>`,
        "  </workflow>",
      ];
    }),
    "</available_workflows>",
  ].join("\n");
}

export function formatWorkflowsForPrompt(workflows: WorkflowDefinition[], cwd: string): string {
  if (!workflows.length) return "";
  return [
    "\n\n<workflows>",
    "The following workflows are reusable SOP-style procedures for established tasks.",
    "You MUST use the read tool to load a workflow file when the task matches its description.",
    "You SHOULD treat workflows as agent-owned procedures and refine them when execution reveals gaps or failures.",
    "Workflow files are located under <workflows_root>./.pi/workflows/</workflows_root>.",
    "You MAY list this directory to discover available workflow files.",
    "</workflows>",
    "",
    buildAvailableWorkflowsXml(workflows, cwd),
  ].join("\n");
}
