import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { deleteSkill, discoverSkills, injectSkillUse } from "../../core/skill.js";
import {
  deleteWorkflow,
  discoverWorkflows,
  injectWorkflowUse,
  promoteWorkflow,
} from "../../core/workflow.js";
import {
  SKILL_CREATE_PROMPT,
  WORKFLOW_CREATE_PROMPT,
  appendWorkflowAgentsPrompt,
  refineSkillPrompt,
  refineWorkflowPrompt,
} from "../../prompts/index.js";
import { createPick } from "./pick.js";
import type { Tab } from "./view.js";

async function openMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  initial: Tab,
): Promise<void> {
  while (true) {
    const workflowDiscovery = await discoverWorkflows(ctx.cwd);
    const skillDiscovery = await discoverSkills(ctx.cwd);
    const picked = await createPick(
      ctx,
      workflowDiscovery.workflows,
      skillDiscovery.skills,
      initial,
    );
    if (picked.type === "cancel") return;
    if (picked.type === "create-workflow") {
      const extra = await ctx.ui.input("Create workflow", "What should this workflow document?");
      const suffix =
        extra && extra.trim()
          ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>`
          : "";
      pi.sendUserMessage(`${WORKFLOW_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.type === "create-skill") {
      const extra = await ctx.ui.input("Create skill", "What should this skill enable?");
      const suffix =
        extra && extra.trim()
          ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>`
          : "";
      pi.sendUserMessage(`${SKILL_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.type === "skill") {
      if (picked.action === "use") {
        const extra = (await ctx.ui.input("Use skill", "Optional instructions")) ?? "";
        await injectSkillUse(pi, picked.skill, extra);
        return;
      }
      if (picked.action === "refine") {
        pi.sendUserMessage(refineSkillPrompt(picked.skill));
        return;
      }
      const confirmed = await ctx.ui.confirm(
        "Delete skill",
        `Delete skill '${picked.skill.name}'?`,
      );
      if (!confirmed) continue;
      await deleteSkill(picked.skill);
      ctx.ui.notify(`Skill '${picked.skill.name}' deleted`, "info");
      continue;
    }
    if (picked.action === "use") {
      const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
      await injectWorkflowUse(pi, picked.workflow, extra);
      return;
    }
    if (picked.action === "refine")
      return pi.sendUserMessage(refineWorkflowPrompt(picked.workflow));
    if (picked.action === "append-to-agents")
      return pi.sendUserMessage(appendWorkflowAgentsPrompt(picked.workflow));
    if (picked.action === "promote-to-skill") {
      const confirmed = await ctx.ui.confirm(
        "Promote workflow",
        `Promote ${picked.workflow.name} to ~/.pi/agent/skills and remove it from workflows?`,
      );
      if (!confirmed) continue;
      const target = await promoteWorkflow(ctx.cwd, picked.workflow);
      ctx.ui.notify(`Workflow promoted to ${target}`, "info");
      continue;
    }
    const confirmed = await ctx.ui.confirm(
      "Delete workflow",
      `Delete workflow '${picked.workflow.name}'?`,
    );
    if (!confirmed) continue;
    await deleteWorkflow(picked.workflow);
    ctx.ui.notify(`Workflow '${picked.workflow.name}' deleted`, "info");
  }
}

export async function openWorkflowsMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  await openMenu(pi, ctx, "workflows");
}

export async function openSkillsMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  await openMenu(pi, ctx, "skills");
}
