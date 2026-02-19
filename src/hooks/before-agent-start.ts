import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { discoverWorkflows, formatWorkflowsForPrompt } from "../core/workflow.js";

export function registerBeforeAgentStart(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event, ctx) => {
    const discovery = await discoverWorkflows(ctx.cwd);
    const suffix = formatWorkflowsForPrompt(discovery.workflows, ctx.cwd);
    return suffix ? { systemPrompt: `${event.systemPrompt}${suffix}` } : undefined;
  });
}
