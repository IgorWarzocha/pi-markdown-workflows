import { spawn } from "node:child_process";
import fs from "node:fs";

import { createDetail } from "../../../sdk/detail.js";
import { createList, type Col } from "../../../sdk/list.js";
import { row } from "../../../sdk/template.js";
import { stripFrontmatter } from "../../core/workflow.js";
import type {
  SkillAction,
  SkillDefinition,
  WorkflowAction,
  WorkflowDefinition,
} from "../../types/index.js";

export type Tab = "workflows" | "skills";

export type WorkflowListItem = {
  key: string;
  name: string;
  description: string;
  workflow: WorkflowDefinition | null;
};

export type SkillListItem = {
  key: string;
  name: string;
  description: string;
  skill: SkillDefinition | null;
};

export type WorkflowActionItem = {
  name: WorkflowAction;
  label: string;
  description: string;
};

export type SkillActionItem = {
  name: SkillAction;
  description: string;
};

export function workflowRows(workflows: WorkflowDefinition[]): WorkflowListItem[] {
  return [
    {
      key: "__create__",
      name: "create",
      description: "Create a workflow from this session",
      workflow: null,
    },
    ...workflows.map((workflow) => ({
      key: workflow.location,
      name: workflow.name,
      description: workflow.description,
      workflow,
    })),
  ];
}

export function skillRows(skills: SkillDefinition[]): SkillListItem[] {
  return [
    {
      key: "__create__",
      name: "create",
      description: "Create a reusable skill",
      skill: null,
    },
    ...skills.map((skill) => ({
      key: skill.location,
      name: skill.name,
      description: skill.description,
      skill,
    })),
  ];
}

export function workflowActionRows(): WorkflowActionItem[] {
  return [
    { name: "use", label: "use", description: "Inject workflow for model usage" },
    { name: "refine", label: "refine", description: "Refine workflow content" },
    {
      name: "append-to-agents",
      label: "...agents.md",
      description: "Append workflow reference to the closest relevant AGENTS.md",
    },
    {
      name: "promote-to-skill",
      label: "promote-to-skill",
      description: "Move workflow to ~/.pi/agent/skills",
    },
    { name: "delete", label: "delete", description: "Delete workflow" },
  ];
}

export function skillActionRows(): SkillActionItem[] {
  return [
    { name: "use", description: "Inject skill for model usage" },
    { name: "refine", description: "Refine skill content" },
    { name: "delete", description: "Delete skill" },
  ];
}

export function listCols<T extends { name: string; description: string }>(): Col<T>[] {
  return [
    { show: true, width: 28, tone: "normal", align: "left", pick: (item) => item.name },
    { show: true, width: 44, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

export function workflowActionCols(): Col<WorkflowActionItem>[] {
  return [
    { show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.label },
    { show: true, width: 52, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

export function skillActionCols(): Col<SkillActionItem>[] {
  return [
    { show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.name },
    { show: true, width: 52, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

function detailBody(location: string): string[] {
  try {
    const content = fs.readFileSync(location, "utf-8");
    const body = stripFrontmatter(content).trim();
    if (!body) return ["_No body yet._"];
    return body.split(/\r?\n/);
  } catch {
    return ["_Unable to read file._"];
  }
}

export function detailView(name: string, description: string, location: string) {
  return createDetail({
    title: name,
    meta: [description, location],
    body: detailBody(location),
  });
}

export function helpView() {
  return createDetail({
    title: "Workflows and skills help",
    meta: ["Use one UI for repo workflows and global skills"],
    body: [
      "- Workflows: repository SOPs. Agents can document them as they work, and they can be appended to AGENTS.md.",
      "- Skills: broader reusable capabilities. Prefer keeping them global under ~/.pi/agent/skills.",
      "- Learn: use /learn to capture concise session findings into the right AGENTS.md scope.",
      "- To reduce command clutter, open /settings and set 'skill commands' to false.",
      "- Use Tab / Shift+Tab to switch Workflows and Skills tabs.",
      "- Use v to toggle detail preview and J/K to scroll preview.",
      "- Use Esc to back out of actions, close preview, or close the menu.",
    ],
  });
}

function launch(command: string, args: string[]): void {
  const item = spawn(command, args, { detached: true, stdio: "ignore" });
  item.on("error", () => undefined);
  item.unref();
}

export function openRepository(): void {
  const url = "https://github.com/IgorWarzocha/pi-markdown-workflows";
  if (process.platform === "darwin") return launch("open", [url]);
  if (process.platform === "win32") return launch("cmd", ["/c", "start", "", url]);
  return launch("xdg-open", [url]);
}

export function aboutView() {
  return {
    slot: () => ({
      title: "About Pi Markdown Workflows",
      content: [
        row("  Practical memory for Pi: workflows + skills + learn."),
        row("  Workflows are repo playbooks. Skills are your broader toolbelt."),
        row("  Less command clutter, more reusable outcomes."),
        row(""),
        row("  - Howaboua & Pi", "dim"),
        row("  https://github.com/IgorWarzocha/pi-markdown-workflows", "dim"),
      ],
      shortcuts: "g github",
      active: [],
      tier: "nested" as const,
      tab: false,
    }),
    up: () => {},
    down: () => {},
    search: () => false,
    set: (_value: string) => {},
    enter: () => undefined,
    hasView: () => false,
    view: () => undefined,
  };
}

export function createFinder<T extends { key: string }>(
  list: ReturnType<typeof createList<T>>,
  values: T[],
  prefix: string,
): () => T | null {
  return () => {
    const intent = list.enter();
    if (!intent || intent.type !== "action") return null;
    const key = intent.name.startsWith(prefix) ? intent.name.slice(prefix.length) : "";
    if (!key) return null;
    const value = values.find((item) => item.key === key);
    return value ?? null;
  };
}
