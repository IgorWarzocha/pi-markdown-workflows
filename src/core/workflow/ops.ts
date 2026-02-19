import fs from "node:fs";
import path from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { WorkflowCreateInput, WorkflowDefinition } from "../../types/index.js";
import { PRIMARY_WORKFLOW_FILE, PRIMARY_WORKFLOWS_DIR, slugify, stripFrontmatter } from "./path.js";

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
