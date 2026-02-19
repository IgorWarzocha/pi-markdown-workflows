import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { discoverWorkflowsSync } from "../core/workflow.js";
import { openWorkflowsMenu } from "../ui/workflow-menu.js";

export function registerWorkflowsCommand(pi: ExtensionAPI): void {
  pi.registerCommand("workflows", {
    description:
      "Open workflows GUI and choose: create workflow, use, refine, append-to-agents, promote-to-skill, delete.",
    getArgumentCompletions: (argumentPrefix: string) => {
      const workflows = discoverWorkflowsSync(process.cwd());
      const prefix = argumentPrefix.trim().toLowerCase();
      const filtered = prefix
        ? workflows.filter(
            (workflow) =>
              workflow.name.toLowerCase().includes(prefix) ||
              workflow.description.toLowerCase().includes(prefix),
          )
        : workflows;
      if (!filtered.length) return null;
      return filtered.map((workflow) => ({
        value: workflow.name,
        label: workflow.name,
        description: workflow.description,
      }));
    },
    handler: async (_args, ctx) => {
      await openWorkflowsMenu(pi, ctx);
    },
  });
}
