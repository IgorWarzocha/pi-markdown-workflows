import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { createWorkflow } from "../core/workflow.js";
import type { WorkflowCreateInput } from "../types/index.js";

export function registerWorkflowsCreateTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "workflows_create",
    label: "Create Workflow",
    description:
      "Create or update a repeatable workflow skill at ./.pi/workflows/<name>/SKILL.md. Required parameters: name, description, body. The tool writes frontmatter automatically (name + description), so body MUST NOT include frontmatter. Use this when capturing a confirmed repeatable process; body SHOULD include prerequisites, ordered steps, and expected outcomes. RFC 2119 / RFC 8174 keyword semantics apply (MUST, SHOULD, MAY).",
    parameters: Type.Object({
      name: Type.String({
        description: "Workflow name (used for frontmatter name and directory slug)",
      }),
      description: Type.String({ description: "Short summary for frontmatter description" }),
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
