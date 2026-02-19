import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import { Container, Input, SelectList, Spacer, Text, type SelectItem } from "@mariozechner/pi-tui";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type TextContent = { type: "text"; text: string };
type WorkflowDefinition = { name: string; description: string; location: string };

type WorkflowCreateInput = {
  name: string;
  description: string;
  body: string;
};

const PRIMARY_WORKFLOWS_DIR = [".pi", "workflows"];
const PRIMARY_WORKFLOW_FILE = "SKILL.md";

function normalizeAtPrefix(inputPath: string): string {
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

function stripFrontmatter(body: string): string {
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

async function discoverWorkflows(
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
        // Ignore unreadable workflow files
      }
    }
  }

  return { workflows, checkedDirs };
}

function discoverWorkflowsSync(cwd: string): WorkflowDefinition[] {
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
      // Ignore unreadable files for completions
    }
  }
  return workflows;
}

async function createWorkflow(cwd: string, input: WorkflowCreateInput): Promise<WorkflowDefinition> {
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

async function injectWorkflowUse(pi: ExtensionAPI, workflow: WorkflowDefinition, extra: string): Promise<void> {
  const content = await fs.promises.readFile(workflow.location, "utf-8");
  const body = stripFrontmatter(content).trim();
  const suffix = extra.trim() ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>` : "";
  pi.sendUserMessage(`${body}${suffix}`.trim());
}

function refineWorkflowPrompt(workflow: WorkflowDefinition): string {
  return [
    "<workflow_refine_request>",
    `<name>${workflow.name}</name>`,
    `<location>${workflow.location}</location>`,
    "<requirements>",
    "You MUST refine this workflow to strict quality standards.",
    "You MUST use RFC 2119 keywords correctly and consistently.",
    "You MUST improve structure clarity with deterministic ordered execution and verification criteria.",
    "You SHOULD use concise XML structure where this improves unambiguous execution guidance.",
    "You MUST assess whether the workflow is functional end-to-end and fix identified issues safely.",
    "You MUST preserve intent while improving reliability.",
    "</requirements>",
    "</workflow_refine_request>",
  ].join("\n");
}

function appendWorkflowAgentsPrompt(workflow: WorkflowDefinition): string {
  return [
    "<workflow_append_agents_request>",
    `<name>${workflow.name}</name>`,
    `<location>${workflow.location}</location>`,
    "<requirements>",
    "You MUST locate the most specific applicable AGENTS.md for this workflow scope.",
    "You MUST verify whether this workflow is already listed before any edits.",
    "You MUST keep edits minimal and idempotent.",
    "You MUST include the exact heading line before entries:",
    "When operating in this directory you MUST consider loading these workflows:",
    "</requirements>",
    "</workflow_append_agents_request>",
  ].join("\n");
}

async function promoteWorkflow(cwd: string, workflow: WorkflowDefinition): Promise<string> {
  const slug = slugify(workflow.name) || "workflow";
  const skillDir = path.join(cwd, ".pi", "skills", slug);
  const target = path.join(skillDir, PRIMARY_WORKFLOW_FILE);
  await fs.promises.mkdir(skillDir, { recursive: true });
  const content = await fs.promises.readFile(workflow.location, "utf-8");
  await fs.promises.writeFile(target, content, "utf-8");
  await fs.promises.rm(path.dirname(workflow.location), { recursive: true, force: true });
  return target;
}

async function deleteWorkflow(workflow: WorkflowDefinition): Promise<void> {
  await fs.promises.rm(path.dirname(workflow.location), { recursive: true, force: true });
}

class WorkflowSelectorComponent extends Container {
  private select: SelectList;

  constructor(
    theme: Theme,
    workflows: WorkflowDefinition[],
    onSelect: (value: string) => void,
    onCancel: () => void,
  ) {
    super();
    const items: SelectItem[] = [
      { value: "__create__", label: "Create new workflow...", description: "Create a workflow manually" },
      ...workflows.map((workflow) => ({
        value: workflow.name,
        label: workflow.name,
        description: workflow.description,
      })),
    ];
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.fg("accent", theme.bold(`Workflows (${workflows.length})`)), 1, 0));
    this.addChild(new Spacer(1));
    const search = new Input();
    search.setValue("");
    search.focused = false;
    this.addChild(search);
    this.addChild(new Spacer(1));
    this.select = new SelectList(items, 9, {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    this.select.onSelect = (item) => onSelect(item.value);
    this.select.onCancel = onCancel;
    this.addChild(this.select);
    for (let index = items.length; index < 9; index += 1) {
      this.addChild(new Text("⠀", 0, 0));
    }
    this.addChild(new Spacer(1));
    this.addChild(
      new Text(
        theme.fg(
          "dim",
          "Press / to search • ↑↓ or j/k select • Enter select • Esc close",
        ),
        1,
        0,
      ),
    );
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
  }

  handleInput(data: string): void {
    if (data === "j") {
      this.select.handleInput("\u001b[B");
      return;
    }
    if (data === "k") {
      this.select.handleInput("\u001b[A");
      return;
    }
    this.select.handleInput(data);
  }
}

async function pickWorkflow(ctx: ExtensionCommandContext, workflows: WorkflowDefinition[]): Promise<string | null> {
  return ctx.ui.custom<string | null>((_tui, theme, _keybindings, done) => {
    return new WorkflowSelectorComponent(theme, workflows, (value) => done(value), () => done(null));
  });
}

class WorkflowActionComponent extends Container {
  private select: SelectList;

  constructor(theme: Theme, workflow: WorkflowDefinition, onSelect: (value: string) => void, onCancel: () => void) {
    super();
    const items: SelectItem[] = [
      { value: "use", label: "use", description: "Inject workflow body and optional user instructions" },
      { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality mission" },
      { value: "append-to-agents", label: "append-to-agents", description: "Append workflow to AGENTS.md safely" },
      { value: "promote-to-skill", label: "promote-to-skill", description: "Move workflow into ./.pi/skills" },
      { value: "delete", label: "delete", description: "Delete workflow" },
      { value: "back", label: "back", description: "Return to workflows list" },
    ];
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
    this.addChild(new Text(theme.fg("accent", theme.bold(`Actions for \"${workflow.name}\"`)), 1, 0));
    this.select = new SelectList(items, 10, {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    this.select.onSelect = (item) => onSelect(item.value);
    this.select.onCancel = onCancel;
    this.addChild(this.select);
    for (let index = items.length; index < 10; index += 1) {
      this.addChild(new Text("⠀", 0, 0));
    }
    this.addChild(new Text(theme.fg("dim", "Enter select • Esc back • ↑/↓ or j/k navigate"), 1, 0));
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
  }

  handleInput(data: string): void {
    if (data === "j") {
      this.select.handleInput("\u001b[B");
      return;
    }
    if (data === "k") {
      this.select.handleInput("\u001b[A");
      return;
    }
    this.select.handleInput(data);
  }
}

async function pickWorkflowAction(
  ctx: ExtensionCommandContext,
  workflow: WorkflowDefinition,
): Promise<string | null> {
  return ctx.ui.custom<string | null>((_tui, theme, _keybindings, done) => {
    return new WorkflowActionComponent(theme, workflow, (value) => done(value), () => done(null));
  });
}

async function createWorkflowFromUi(ctx: ExtensionCommandContext): Promise<void> {
  const name = await ctx.ui.input("Create workflow", "Workflow name");
  if (!name || !name.trim()) return;
  const description = await ctx.ui.input("Create workflow", "Workflow description");
  if (!description || !description.trim()) return;
  const body = await ctx.ui.editor(
    "Create workflow",
    "## Prerequisites\n\n## Steps\n1. \n\n## Expected outcome\n\n## Recovery\n",
  );
  if (!body || !body.trim()) return;
  const workflow = await createWorkflow(ctx.cwd, {
    name: name.trim(),
    description: description.trim(),
    body: body.trim(),
  });
  ctx.ui.notify(`Workflow created at ${workflow.location}`, "info");
}

async function openWorkflowActions(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  workflow: WorkflowDefinition,
): Promise<"refresh" | "back" | "done"> {
  const action = await pickWorkflowAction(ctx, workflow);
  if (!action || action === "back") return "back";
  if (action === "use") {
    const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
    await injectWorkflowUse(pi, workflow, extra);
    return "done";
  }
  if (action === "refine") {
    pi.sendUserMessage(refineWorkflowPrompt(workflow));
    return "done";
  }
  if (action === "append-to-agents") {
    pi.sendUserMessage(appendWorkflowAgentsPrompt(workflow));
    return "done";
  }
  if (action === "promote-to-skill") {
    const confirmed = await ctx.ui.confirm(
      "Promote workflow",
      `Promote ${workflow.name} to ./.pi/skills and remove it from workflows?`,
    );
    if (!confirmed) return "back";
    const target = await promoteWorkflow(ctx.cwd, workflow);
    ctx.ui.notify(`Workflow promoted to ${target}`, "info");
    return "refresh";
  }
  const confirmed = await ctx.ui.confirm("Delete workflow", `Delete workflow '${workflow.name}'?`);
  if (!confirmed) return "back";
  await deleteWorkflow(workflow);
  ctx.ui.notify(`Workflow '${workflow.name}' deleted`, "info");
  return "refresh";
}

async function openWorkflowsMenu(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  while (true) {
    const discovery = await discoverWorkflows(ctx.cwd);
    const selected = await pickWorkflow(ctx, discovery.workflows);
    if (!selected) return;
    if (selected === "__create__") {
      await createWorkflowFromUi(ctx);
      continue;
    }
    const workflow = discovery.workflows.find((item) => item.name === selected);
    if (!workflow) {
      ctx.ui.notify("Workflow not found after refresh", "error");
      continue;
    }
    const result = await openWorkflowActions(pi, ctx, workflow);
    if (result === "refresh") continue;
    if (result === "done") return;
  }
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

function formatWorkflowsForPrompt(workflows: WorkflowDefinition[], cwd: string): string {
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

function resolvePath(targetPath: string, baseDir: string): string {
  const cleaned = normalizeAtPrefix(targetPath);
  const absolute = path.isAbsolute(cleaned)
    ? path.normalize(cleaned)
    : path.resolve(baseDir, cleaned);
  try {
    return fs.realpathSync.native?.(absolute) ?? fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function isInsideRoot(rootDir: string, targetPath: string): boolean {
  if (!rootDir) return false;
  const relative = path.relative(rootDir, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isDiscoveryBashCommand(value: string): boolean {
  const lower = value.trim().toLowerCase();
  if (!lower) return false;
  const command = lower.split(/\s+/)[0] ?? "";
  const names = new Set(["ls", "find", "rg", "grep", "fd", "tree", "git"]);
  if (command !== "git") return names.has(command);
  const parts = lower.split(/\s+/);
  const subcommand = parts[1] ?? "";
  return subcommand === "ls-files" || subcommand === "grep";
}

function bashTargets(value: string, base: string): string[] {
  const parts = value
    .split(/\s+/)
    .map((item) => item.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean);
  if (!parts.length) return [base];
  const paths: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    const item = parts[index];
    if (!item) continue;
    if (item.startsWith("-")) continue;
    if (item === "|" || item === "&&" || item === ";") continue;
    if (item.includes("=")) continue;
    if (item === ".") {
      paths.push(base);
      continue;
    }
    if (item.startsWith("/")) {
      paths.push(resolvePath(item, base));
      continue;
    }
    if (item.startsWith("./") || item.startsWith("../") || item.includes("/")) {
      paths.push(resolvePath(item, base));
    }
  }
  if (!paths.length) return [base];
  return paths;
}

function registerSubdirContextAutoload(pi: ExtensionAPI): void {
  const loadedAgents = new Set<string>();
  let currentCwd = "";
  let cwdAgentsPath = "";
  let homeDir = "";
  let readCount = 0;

  function resetSession(cwd: string): void {
    currentCwd = resolvePath(cwd, process.cwd());
    cwdAgentsPath = path.join(currentCwd, "AGENTS.md");
    homeDir = resolvePath(os.homedir(), process.cwd());
    readCount = 0;
    loadedAgents.clear();
    loadedAgents.add(cwdAgentsPath);
  }

  function findAgentsFiles(filePath: string, rootDir: string): string[] {
    if (!rootDir) return [];
    const agentsFiles: string[] = [];
    let dir = path.dirname(filePath);
    while (isInsideRoot(rootDir, dir)) {
      const candidate = path.join(dir, "AGENTS.md");
      if (candidate !== cwdAgentsPath && fs.existsSync(candidate)) agentsFiles.push(candidate);
      if (dir === rootDir) break;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return agentsFiles.reverse();
  }

  const handleSessionChange = (_event: unknown, ctx: ExtensionContext): void => {
    resetSession(ctx.cwd);
  };

  pi.on("session_start", handleSessionChange);
  pi.on("session_switch", handleSessionChange);

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) return undefined;
    const isRead = event.toolName === "read";
    const isBash = event.toolName === "bash";
    if (!isRead && !isBash) return undefined;
    const pathInput = event.input.path as string | undefined;
    const bashInput = event.input.command as string | undefined;
    const isDiscoveryBash = isBash && typeof bashInput === "string" && isDiscoveryBashCommand(bashInput);
    if (!isRead && !isDiscoveryBash) return undefined;
    if (!currentCwd) resetSession(ctx.cwd);

    readCount += 1;

    const targets = isRead
      ? pathInput
        ? [resolvePath(pathInput, currentCwd)]
        : []
      : bashInput
        ? bashTargets(bashInput, currentCwd)
        : [];
    if (!targets.length) return undefined;

    const paths = new Set<string>();
    for (const target of targets) {
      const searchRoot = isInsideRoot(currentCwd, target)
        ? currentCwd
        : isInsideRoot(homeDir, target)
          ? homeDir
          : "";
      if (!searchRoot) continue;
      if (path.basename(target) === "AGENTS.md") {
        loadedAgents.add(path.normalize(target));
        continue;
      }
      const probe =
        fs.existsSync(target) && fs.statSync(target).isDirectory()
          ? path.join(target, "__probe__")
          : target;
      const files = findAgentsFiles(probe, searchRoot);
      for (const file of files) paths.add(file);
    }

    const agentFiles = [...paths];
    if (!agentFiles.length) return undefined;
    const hasFresh = agentFiles.some((agentsPath) => !loadedAgents.has(agentsPath));
    const shouldRefresh = readCount % 10 === 0;
    if (!hasFresh && !shouldRefresh) return undefined;

    const additions: TextContent[] = [];

    for (const agentsPath of agentFiles) {
      try {
        const content = await fs.promises.readFile(agentsPath, "utf-8");
        loadedAgents.add(agentsPath);
        additions.push({
          type: "text",
          text: `Loaded subdirectory context from ${agentsPath}\n\n${content}`,
        });
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(`Failed to load ${agentsPath}: ${String(error)}`, "warning");
      }
    }

    if (!additions.length) return undefined;
    const baseContent = event.content ?? [];
    return { content: [...baseContent, ...additions], details: event.details };
  });
}

export default function piWorkflowsToolExtension(pi: ExtensionAPI): void {
  registerSubdirContextAutoload(pi);

  pi.registerTool({
    name: "workflows_create",
    label: "Create Workflow",
    description:
      "Create or update a repeatable workflow skill at ./.pi/workflows/<name>/SKILL.md. Required parameters: name, description, body. The tool writes frontmatter automatically (name + description), so body MUST NOT include frontmatter. Use this when capturing a confirmed repeatable process; body SHOULD include prerequisites, ordered steps, and expected outcomes. RFC 2119 / RFC 8174 keyword semantics apply (MUST, SHOULD, MAY).",
    parameters: Type.Object({
      name: Type.String({
        description: "Workflow name (used for frontmatter name and directory slug)",
      }),
      description: Type.String({ description: "Short summary for frontmatter description" }),
      body: Type.String({ description: "Markdown workflow content only (no frontmatter)" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const input = params as WorkflowCreateInput;
      const workflow = await createWorkflow(ctx.cwd, input);
      return {
        content: [{ type: "text", text: `Workflow created at ${workflow.location}` }],
        details: { name: input.name, path: workflow.location },
      };
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const discovery = await discoverWorkflows(ctx.cwd);
    const suffix = formatWorkflowsForPrompt(discovery.workflows, ctx.cwd);
    return suffix ? { systemPrompt: `${event.systemPrompt}${suffix}` } : undefined;
  });

  pi.registerCommand("workflows", {
    description:
      "Open workflows GUI and choose: create workflow, use, refine, append-to-agents, promote-to-skill, delete.",
    getArgumentCompletions: (argumentPrefix: string) => {
      const workflows = discoverWorkflowsSync(process.cwd());
      const prefix = argumentPrefix.trim().toLowerCase();
      const filtered = prefix
        ? workflows.filter(
            (workflow) =>
              workflow.name.toLowerCase().includes(prefix) ||
              workflow.description.toLowerCase().includes(prefix),
          )
        : workflows;
      if (!filtered.length) return null;
      return filtered.map((workflow) => ({
        value: workflow.name,
        label: workflow.name,
        description: workflow.description,
      }));
    },
    handler: async (_args, ctx) => {
      await openWorkflowsMenu(pi, ctx);
    },
  });
}
