import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getAgentDir, loadSkills, type Skill } from "@earendil-works/pi-coding-agent";

import type { SkillDefinition } from "../../types/index.js";
import { parseSkillFrontmatter, PRIMARY_SKILL_FILE, PRIMARY_SKILLS_PROJECT_DIR } from "./path.js";

type SkillSource = {
  root: string;
  type: "dir" | "file";
  rootMarkdown: boolean;
  canDelete: boolean;
};

function isSkillFilePath(value: string): boolean {
  return path.basename(value).toLowerCase() === PRIMARY_SKILL_FILE.toLowerCase();
}

function isMarkdownFilePath(value: string): boolean {
  return path.extname(value).toLowerCase() === ".md";
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

function configuredSkillPaths(cwd: string, agentDir: string): string[] {
  const projectSettings = path.join(cwd, ".pi", "settings.json");
  const globalSettings = path.join(agentDir, "settings.json");
  return [
    ...readSettingsSkills(projectSettings, path.join(cwd, ".pi")),
    ...readSettingsSkills(globalSettings, agentDir),
  ];
}

function skillSource(
  root: string,
  type: "dir" | "file",
  rootMarkdown: boolean,
  canDelete: boolean,
): SkillSource {
  return { root, type, rootMarkdown, canDelete };
}

function sources(
  cwd: string,
  agentDir = path.join(os.homedir(), ".pi", "agent"),
  includeConfigured = true,
): SkillSource[] {
  const list: SkillSource[] = [];
  list.push(skillSource(path.join(cwd, ...PRIMARY_SKILLS_PROJECT_DIR), "dir", true, true));
  list.push(skillSource(path.join(agentDir, "skills"), "dir", true, true));
  list.push(skillSource(path.join(os.homedir(), ".agents", "skills"), "dir", false, true));
  for (const dir of collectAncestorAgentsSkillDirs(cwd)) {
    list.push(skillSource(dir, "dir", false, true));
  }
  const extra = includeConfigured ? configuredSkillPaths(cwd, agentDir) : [];
  for (const item of extra) {
    const normalized = path.normalize(item);
    if (isSkillFilePath(normalized)) {
      list.push(skillSource(normalized, "file", true, false));
      continue;
    }
    if (isMarkdownFilePath(normalized)) {
      list.push(skillSource(normalized, "file", true, false));
      continue;
    }
    list.push(skillSource(normalized, "dir", true, false));
  }
  return list;
}

function findGitRepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function collectAncestorAgentsSkillDirs(startDir: string): string[] {
  const dirs: string[] = [];
  const gitRoot = findGitRepoRoot(startDir);
  let dir = path.resolve(startDir);
  while (true) {
    dirs.push(path.join(dir, ".agents", "skills"));
    if (gitRoot && dir === gitRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

function collectDirSkillFiles(root: string, includeRootMarkdown: boolean, current = root): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name !== PRIMARY_SKILL_FILE) continue;
    const full = path.join(current, entry.name);
    if (entry.isFile()) return [full];
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(current, entry.name);
    if (current === root && includeRootMarkdown && entry.isFile() && isMarkdownFilePath(entry.name)) {
      files.push(full);
      continue;
    }
    if (entry.isDirectory()) files.push(...collectDirSkillFiles(root, false, full));
  }
  return files;
}

function readSkill(file: string, canDelete: boolean): SkillDefinition | null {
  if (!isMarkdownFilePath(file)) return null;
  try {
    const content = fs.readFileSync(file, "utf-8");
    const meta = parseSkillFrontmatter(content);
    if (!meta) return null;
    return { name: meta.name, description: meta.description, location: file, canDelete };
  } catch {
    return null;
  }
}

function canDeleteLoadedSkill(skill: Skill): boolean {
  return skill.sourceInfo.source === "local" && skill.sourceInfo.origin === "top-level";
}

function toSkillDefinition(skill: Skill): SkillDefinition {
  return {
    name: skill.name,
    description: skill.description,
    location: skill.filePath,
    sourceInfo: skill.sourceInfo,
    canDelete: canDeleteLoadedSkill(skill),
  };
}

export async function discoverSkills(
  cwd: string,
): Promise<{ skills: SkillDefinition[]; checkedDirs: string[] }> {
  const checkedDirs: string[] = [];
  const skills = discoverSkillsSync(cwd, checkedDirs);
  return { skills, checkedDirs };
}

function realPathKey(value: string): string {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function mergeLegacySkills(
  strictSkills: SkillDefinition[],
  fallbackSkills: SkillDefinition[],
): SkillDefinition[] {
  const knownLocations = new Set(strictSkills.map((skill) => path.resolve(skill.location)));
  const knownRealLocations = new Set(strictSkills.map((skill) => realPathKey(skill.location)));
  const knownNames = new Set(strictSkills.map((skill) => skill.name));
  return fallbackSkills.filter(
    (skill) =>
      !knownNames.has(skill.name) &&
      !knownLocations.has(path.resolve(skill.location)) &&
      !knownRealLocations.has(realPathKey(skill.location)),
  );
}

export function discoverSkillsSync(cwd: string, checkedDirs?: string[]): SkillDefinition[] {
  const agentDir = getAgentDir();
  try {
    const projectSkillPaths = [
      path.join(cwd, ...PRIMARY_SKILLS_PROJECT_DIR),
      ...collectAncestorAgentsSkillDirs(cwd),
      ...readSettingsSkills(path.join(cwd, ".pi", "settings.json"), path.join(cwd, ".pi")),
    ];
    const userSkillPaths = [
      path.join(agentDir, "skills"),
      path.join(os.homedir(), ".agents", "skills"),
      ...readSettingsSkills(path.join(agentDir, "settings.json"), agentDir),
    ];
    const skillPaths = [...projectSkillPaths, ...userSkillPaths];
    const result = loadSkills({
      cwd,
      agentDir,
      skillPaths,
      includeDefaults: false,
    });
    for (const skill of result.skills) checkedDirs?.push(skill.baseDir);
    const strictSkills = result.skills.map(toSkillDefinition);
    const legacySkills = mergeLegacySkills(strictSkills, discoverFallbackSkills(cwd, agentDir, undefined, false));
    for (const skill of legacySkills) checkedDirs?.push(path.dirname(skill.location));
    return [...strictSkills, ...legacySkills];
  } catch {
    // Fall back to the lightweight local scanner below when Pi's loader cannot be used.
  }

  return discoverFallbackSkills(cwd, agentDir, checkedDirs);
}

function discoverFallbackSkills(
  cwd: string,
  agentDir: string,
  checkedDirs?: string[],
  includeConfigured = true,
): SkillDefinition[] {
  const list = sources(cwd, agentDir, includeConfigured);
  const output: SkillDefinition[] = [];
  const seen = new Set<string>();
  for (const source of list) {
    checkedDirs?.push(source.root);
    const files =
      source.type === "file" ? [source.root] : collectDirSkillFiles(source.root, source.rootMarkdown);
    for (const file of files) {
      const skill = readSkill(file, source.canDelete);
      if (!skill) continue;
      const key = `${skill.name}::${realPathKey(skill.location)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(skill);
    }
  }
  return output;
}
