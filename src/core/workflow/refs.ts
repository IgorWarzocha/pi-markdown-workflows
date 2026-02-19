import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import type { WorkflowDefinition } from "../../types/index.js";

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
