import fs from "node:fs";
import path from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { stripFrontmatter } from "../workflow/path.js";
import type { SkillDefinition } from "../../types/index.js";

export async function injectSkillUse(
  pi: ExtensionAPI,
  skill: SkillDefinition,
  extra: string,
): Promise<void> {
  const content = await fs.promises.readFile(skill.location, "utf-8");
  const body = stripFrontmatter(content).trim();
  const suffix = extra.trim()
    ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>`
    : "";
  pi.sendUserMessage(`${body}${suffix}`.trim());
}

export async function deleteSkill(skill: SkillDefinition): Promise<void> {
  const file = path.basename(skill.location).toLowerCase() === "skill.md";
  if (!file) {
    await fs.promises.rm(skill.location, { force: true });
    return;
  }
  await fs.promises.rm(path.dirname(skill.location), { recursive: true, force: true });
}
