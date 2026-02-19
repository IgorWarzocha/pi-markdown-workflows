import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { WORKFLOW_CREATE_PROMPT, appendWorkflowAgentsPrompt, refineWorkflowPrompt } from "../../prompts/index.js";
import {
  deleteWorkflow,
  discoverWorkflows,
  injectWorkflowUse,
  promoteWorkflow,
} from "../../core/workflow.js";
import type { WorkflowDefinition, WorkflowPick } from "../../types/index.js";
import { WorkflowMenuComponent } from "./component.js";

async function pickWorkflow(ctx: ExtensionCommandContext, workflows: WorkflowDefinition[]): Promise<WorkflowPick> {
  return ctx.ui.custom<WorkflowPick>((tui, theme, _keybindings, done) => {
    return new WorkflowMenuComponent(tui, theme, workflows, ctx.cwd, done);
  });
}

export async function openWorkflowsMenu(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  while (true) {
    const discovery = await discoverWorkflows(ctx.cwd);
    const picked = await pickWorkflow(ctx, discovery.workflows);
    if (picked.type === "cancel") return;
    if (picked.type === "create") {
      const extra = await ctx.ui.input("Create workflow", "What should this workflow document?");
      const suffix = extra && extra.trim() ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>` : "";
      pi.sendUserMessage(`${WORKFLOW_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.action === "use") {
      const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
      await injectWorkflowUse(pi, picked.workflow, extra);
      return;
    }
    if (picked.action === "refine") return pi.sendUserMessage(refineWorkflowPrompt(picked.workflow));
    if (picked.action === "append-to-agents") return pi.sendUserMessage(appendWorkflowAgentsPrompt(picked.workflow));
    if (picked.action === "promote-to-skill") {
      const confirmed = await ctx.ui.confirm(
        "Promote workflow",
        `Promote ${picked.workflow.name} to ./.pi/skills and remove it from workflows?`,
      );
      if (!confirmed) continue;
      const target = await promoteWorkflow(ctx.cwd, picked.workflow);
      ctx.ui.notify(`Workflow promoted to ${target}`, "info");
      continue;
    }
    const confirmed = await ctx.ui.confirm("Delete workflow", `Delete workflow '${picked.workflow.name}'?`);
    if (!confirmed) continue;
    await deleteWorkflow(picked.workflow);
    ctx.ui.notify(`Workflow '${picked.workflow.name}' deleted`, "info");
  }
}
