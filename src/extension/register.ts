import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerWorkflowsCreateTool } from "../tools/workflows-create.js";
import { registerBeforeAgentStart } from "../hooks/before-agent-start.js";
import { registerWorkflowsCommand } from "../commands/workflows.js";
import { registerSubdirContextAutoload } from "../core/subdir.js";

export function registerExtension(pi: ExtensionAPI): void {
  registerSubdirContextAutoload(pi);
  registerWorkflowsCreateTool(pi);
  registerBeforeAgentStart(pi);
  registerWorkflowsCommand(pi);
}
