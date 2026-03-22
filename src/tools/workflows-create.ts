import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createWorkflow } from "../core/workflow.js";
import type { WorkflowCreateInput } from "../types/index.js";

export function registerWorkflowsCreateTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "workflows_create",
    label: "Create Workflow",
    description:
      "Create or update a reusable repo-local workflow at ./.pi/workflows/<slug>/SKILL.md. Use after confirming a repeatable SOP. Inputs: name, description, body. body must be markdown only with no frontmatter; the tool derives the slug from name and writes frontmatter automatically.",
    parameters: Type.Object({
      name: Type.String({
        description: "Workflow title",
      }),
      description: Type.String({
        description: "One-line summary of what the workflow does and when to use it",
      }),
      body: Type.String({ description: "Markdown workflow content only (no frontmatter)" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const input = params as WorkflowCreateInput;
      const workflow = await createWorkflow(ctx.cwd, input);
      return {
        content: [{ type: "text", text: `Workflow created at ${workflow.location}` }],
        details: { name: input.name, path: workflow.location },
      };
    },
  });
}
