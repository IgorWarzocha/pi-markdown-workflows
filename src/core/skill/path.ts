import type { SkillDefinition } from "../../types/index.js";

export const PRIMARY_SKILLS_PROJECT_DIR = [".pi", "skills"];
export const PRIMARY_SKILL_FILE = "SKILL.md";

export function parseSkillFrontmatter(content: string): Omit<SkillDefinition, "location"> | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatterMatch) return null;
  const frontmatter = frontmatterMatch[1] ?? "";
  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  const descriptionMatch = frontmatter.match(/description:\s*(.+)/);
  const name = nameMatch?.[1]?.trim();
  const description = descriptionMatch?.[1]?.trim();
  if (!name || !description) return null;
  return { name, description };
}
