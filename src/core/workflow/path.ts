import type { WorkflowDefinition } from "../../types/index.js";
import { parseNameDescriptionFrontmatter } from "../frontmatter.js";

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
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function stripFrontmatter(body: string): string {
  const match = body.match(/^---\n[\s\S]+?\n---\s*\n?/);
  return match ? body.slice(match[0].length) : body;
}

export function parseWorkflowFrontmatter(
  content: string,
): Omit<WorkflowDefinition, "location"> | null {
  const parsed = parseNameDescriptionFrontmatter(content);
  if (!parsed) return null;
  return parsed;
}
