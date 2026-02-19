import type { WorkflowDefinition } from "../../types/index.js";

export const PRIMARY_WORKFLOWS_DIR = [".pi", "workflows"];
export const PRIMARY_WORKFLOW_FILE = "SKILL.md";

export function normalizeAtPrefix(inputPath: string): string {
  return inputPath.startsWith("@") ? inputPath.slice(1) : inputPath;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function stripFrontmatter(body: string): string {
  const match = body.match(/^---\n[\s\S]+?\n---\s*\n?/);
  return match ? body.slice(match[0].length) : body;
}

export function parseWorkflowFrontmatter(
  content: string,
): Omit<WorkflowDefinition, "location"> | null {
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
