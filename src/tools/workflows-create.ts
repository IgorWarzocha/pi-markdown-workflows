import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import Type from "typebox";

import { createWorkflow } from "../core/workflow.js";
import type { WorkflowCreateInput } from "../types/index.js";

export function registerWorkflowsCreateTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "workflows_create",
    label: "Create Workflow",
    description: "Create or update a repo-local workflow.",
    promptSnippet: "Create or update repo-local workflow SOP files.",
    promptGuidelines: [
      "workflows_create: Use only after confirming a repeatable workflow, SOP, or project procedure should be documented.",
      "workflows_create: Prefer updating an existing workflow over creating a duplicate.",
      "workflows_create: Write reusable process knowledge, not one-off task notes.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description: "Workflow title.",
      }),
      description: Type.String({
        description: "One-line workflow summary.",
      }),
      body: Type.String({ description: "Markdown body only; no frontmatter." }),
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
