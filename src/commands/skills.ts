import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { discoverSkillsSync } from "../core/skill.js";
import { openSkillsMenu } from "../ui/workflow-menu.js";

export function registerSkillsCommand(pi: ExtensionAPI): void {
  pi.registerCommand("skills", {
    description: "Open skills GUI and choose a skill to use.",
    getArgumentCompletions: (argumentPrefix: string) => {
      const skills = discoverSkillsSync(process.cwd());
      const prefix = argumentPrefix.trim().toLowerCase();
      const filtered = prefix
        ? skills.filter(
            (skill) =>
              skill.name.toLowerCase().includes(prefix) ||
              skill.description.toLowerCase().includes(prefix),
          )
        : skills;
      if (!filtered.length) return null;
      return filtered.map((skill) => ({
        value: skill.name,
        label: skill.name,
        description: skill.description,
      }));
    },
    handler: async (_args, ctx) => {
      await openSkillsMenu(pi, ctx);
    },
  });
}
