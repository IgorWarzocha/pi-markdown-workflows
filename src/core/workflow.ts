import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { WorkflowCreateInput, WorkflowDefinition } from "../types/index.js";

const PRIMARY_WORKFLOWS_DIR = [".pi", "workflows"];
const PRIMARY_WORKFLOW_FILE = "SKILL.md";

export function normalizeAtPrefix(inputPath: string): string {
  return inputPath.startsWith("@") ? inputPath.slice(1) : inputPath;
}

function slugify(value: string): string {
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

function parseWorkflowFrontmatter(content: string): Omit<WorkflowDefinition, "location"> | null {
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

export async function discoverWorkflows(
  cwd: string,
): Promise<{ workflows: WorkflowDefinition[]; checkedDirs: string[] }> {
  const candidates = [
    { root: path.join(cwd, ...PRIMARY_WORKFLOWS_DIR), file: PRIMARY_WORKFLOW_FILE },
  ] as const;
  const workflows: WorkflowDefinition[] = [];
  const checkedDirs: string[] = [];
  const seenNames = new Set<string>();
  for (const candidate of candidates) {
    checkedDirs.push(candidate.root);
    let topEntries: fs.Dirent[];
    try {
      topEntries = await fs.promises.readdir(candidate.root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of topEntries) {
      if (!entry.isDirectory()) continue;
      const workflowPath = path.join(candidate.root, entry.name, candidate.file);
      try {
        const content = await fs.promises.readFile(workflowPath, "utf-8");
        const metadata = parseWorkflowFrontmatter(content);
        if (!metadata) continue;
        if (seenNames.has(metadata.name)) continue;
        seenNames.add(metadata.name);
        workflows.push({ ...metadata, location: workflowPath });
      } catch {
        continue;
      }
    }
  }
  return { workflows, checkedDirs };
}

export function discoverWorkflowsSync(cwd: string): WorkflowDefinition[] {
  const workflowsRoot = path.join(cwd, ...PRIMARY_WORKFLOWS_DIR);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(workflowsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const workflows: WorkflowDefinition[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const workflowPath = path.join(workflowsRoot, entry.name, PRIMARY_WORKFLOW_FILE);
    try {
      const content = fs.readFileSync(workflowPath, "utf-8");
      const metadata = parseWorkflowFrontmatter(content);
      if (!metadata) continue;
      workflows.push({ ...metadata, location: workflowPath });
    } catch {
      continue;
    }
  }
  return workflows;
}

export async function createWorkflow(cwd: string, input: WorkflowCreateInput): Promise<WorkflowDefinition> {
  const slug = slugify(input.name) || "workflow";
  const workflowDir = path.join(cwd, ...PRIMARY_WORKFLOWS_DIR, slug);
  const workflowPath = path.join(workflowDir, PRIMARY_WORKFLOW_FILE);
  const content = [
    "---",
    `name: ${input.name}`,
    `description: ${input.description}`,
    "---",
    "",
    stripFrontmatter(input.body).trim(),
    "",
  ].join("\n");
  await fs.promises.mkdir(workflowDir, { recursive: true });
  await fs.promises.writeFile(workflowPath, content, "utf-8");
  return { name: input.name, description: input.description, location: workflowPath };
}

export async function injectWorkflowUse(pi: ExtensionAPI, workflow: WorkflowDefinition, extra: string): Promise<void> {
  const content = await fs.promises.readFile(workflow.location, "utf-8");
  const body = stripFrontmatter(content).trim();
  const suffix = extra.trim() ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>` : "";
  pi.sendUserMessage(`${body}${suffix}`.trim());
}

export async function promoteWorkflow(cwd: string, workflow: WorkflowDefinition): Promise<string> {
  const slug = slugify(workflow.name) || "workflow";
  const skillDir = path.join(cwd, ".pi", "skills", slug);
  const target = path.join(skillDir, PRIMARY_WORKFLOW_FILE);
  await fs.promises.mkdir(skillDir, { recursive: true });
  const content = await fs.promises.readFile(workflow.location, "utf-8");
  await fs.promises.writeFile(target, content, "utf-8");
  await fs.promises.rm(path.dirname(workflow.location), { recursive: true, force: true });
  return target;
}

export async function deleteWorkflow(workflow: WorkflowDefinition): Promise<void> {
  await fs.promises.rm(path.dirname(workflow.location), { recursive: true, force: true });
}

export function workflowRefs(cwd: string, workflow: WorkflowDefinition): string[] {
  let filesRaw = "";
  try {
    filesRaw = execFileSync("rg", ["--files", "-g", "**/AGENTS.md"], { cwd, encoding: "utf-8" });
  } catch {
    return [];
  }
  const files = filesRaw
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => path.join(cwd, value));
  const rel = path.relative(cwd, workflow.location).replaceAll("\\", "/");
  const tokens = [workflow.location, rel, `./${rel}`];
  const out: string[] = [];
  for (const file of files) {
    let content = "";
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const hasName = content.includes(workflow.name);
    const hasPath = tokens.some((token) => content.includes(token));
    if (!hasName || !hasPath) continue;
    out.push(path.relative(cwd, file).replaceAll("\\", "/"));
  }
  return out;
}

function buildAvailableWorkflowsXml(workflows: WorkflowDefinition[], cwd: string): string {
  if (!workflows.length) return "<available_workflows></available_workflows>";
  return [
    "<available_workflows>",
    ...workflows.flatMap((workflow) => {
      const relative = path.relative(cwd, workflow.location) || workflow.location;
      return [
        "  <workflow>",
        `    <name>${workflow.name}</name>`,
        `    <description>${workflow.description}</description>`,
        `    <location>${relative}</location>`,
        "  </workflow>",
      ];
    }),
    "</available_workflows>",
  ].join("\n");
}

export function formatWorkflowsForPrompt(workflows: WorkflowDefinition[], cwd: string): string {
  if (!workflows.length) return "";
  return [
    "\n\n<workflows>",
    "The following workflows are reusable SOP-style procedures for established tasks.",
    "You MUST use the read tool to load a workflow file when the task matches its description.",
    "Workflow files are located under <workflows_root>./.pi/workflows/</workflows_root>.",
    "You MAY list this directory to discover available workflow files.",
    "</workflows>",
    "",
    buildAvailableWorkflowsXml(workflows, cwd),
  ].join("\n");
}
