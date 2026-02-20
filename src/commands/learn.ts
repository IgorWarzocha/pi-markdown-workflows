import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { learnPrompt } from "../prompts/index.js";

export function registerLearnCommand(pi: ExtensionAPI): void {
  pi.registerCommand("learn", {
    description: "Capture concise session findings into the most appropriate AGENTS.md.",
    handler: async (args, _ctx) => {
      pi.sendUserMessage(learnPrompt(args));
    },
  });
}
