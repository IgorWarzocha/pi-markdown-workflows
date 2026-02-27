import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SkillDefinition } from "../../types/index.js";
import { parseSkillFrontmatter, PRIMARY_SKILL_FILE, PRIMARY_SKILLS_PROJECT_DIR } from "./path.js";

type SkillSource = { root: string; type: "dir" | "file" };

function isSkillFilePath(value: string): boolean {
  return path.basename(value).toLowerCase() === PRIMARY_SKILL_FILE.toLowerCase();
}

function resolvePaths(values: string[], base: string): string[] {
  const items: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const expanded = value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
    const absolute = path.isAbsolute(expanded) ? expanded : path.resolve(base, expanded);
    items.push(path.normalize(absolute));
  }
  return items;
}

function readSettingsSkills(settingsPath: string, base: string): string[] {
  try {
    const content = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(content) as { skills?: unknown };
    if (!Array.isArray(parsed.skills)) return [];
    const values = parsed.skills.filter((item): item is string => typeof item === "string");
    return resolvePaths(values, base);
  } catch {
    return [];
  }
}

function sources(cwd: string): SkillSource[] {
  const list: SkillSource[] = [];
  list.push({ root: path.join(cwd, ...PRIMARY_SKILLS_PROJECT_DIR), type: "dir" });
  list.push({ root: path.join(os.homedir(), ".pi", "agent", "skills"), type: "dir" });
  const projectSettings = path.join(cwd, ".pi", "settings.json");
  const globalSettings = path.join(os.homedir(), ".pi", "agent", "settings.json");
  const extra = [
    ...readSettingsSkills(projectSettings, path.join(cwd, ".pi")),
    ...readSettingsSkills(globalSettings, path.join(os.homedir(), ".pi", "agent")),
  ];
  for (const item of extra) {
    const normalized = path.normalize(item);
    if (isSkillFilePath(normalized)) {
      list.push({ root: normalized, type: "file" });
      continue;
    }
    if (normalized.toLowerCase().endsWith(".md")) continue;
    list.push({ root: normalized, type: "dir" });
  }
  return list;
}

function collectDirSkillFiles(root: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && isSkillFilePath(entry.name)) {
      files.push(full);
      continue;
    }
    if (entry.isDirectory()) files.push(...collectDirSkillFiles(full));
  }
  return files;
}

function readSkill(file: string): SkillDefinition | null {
  if (!isSkillFilePath(file)) return null;
  try {
    const content = fs.readFileSync(file, "utf-8");
    const meta = parseSkillFrontmatter(content);
    if (!meta) return null;
    return { name: meta.name, description: meta.description, location: file };
  } catch {
    return null;
  }
}

export async function discoverSkills(
  cwd: string,
): Promise<{ skills: SkillDefinition[]; checkedDirs: string[] }> {
  const checkedDirs: string[] = [];
  const skills = discoverSkillsSync(cwd, checkedDirs);
  return { skills, checkedDirs };
}

export function discoverSkillsSync(cwd: string, checkedDirs?: string[]): SkillDefinition[] {
  const list = sources(cwd);
  const output: SkillDefinition[] = [];
  const seen = new Set<string>();
  for (const source of list) {
    checkedDirs?.push(source.root);
    const files = source.type === "file" ? [source.root] : collectDirSkillFiles(source.root);
    for (const file of files) {
      const skill = readSkill(file);
      if (!skill) continue;
      const key = `${skill.name}::${path.normalize(skill.location)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(skill);
    }
  }
  return output;
}
