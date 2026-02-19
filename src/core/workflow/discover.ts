import fs from "node:fs";
import path from "node:path";

import type { WorkflowDefinition } from "../../types/index.js";
import { parseWorkflowFrontmatter, PRIMARY_WORKFLOW_FILE, PRIMARY_WORKFLOWS_DIR } from "./path.js";

export async function discoverWorkflows(
  cwd: string,
): Promise<{ workflows: WorkflowDefinition[]; checkedDirs: string[] }> {
  const candidates = [{ root: path.join(cwd, ...PRIMARY_WORKFLOWS_DIR), file: PRIMARY_WORKFLOW_FILE }] as const;
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
