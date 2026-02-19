import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import {
  Container,
  Input,
  Key,
  SelectList,
  Spacer,
  Text,
  getEditorKeybindings,
  matchesKey,
  type SelectItem,
} from "@mariozechner/pi-tui";
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

type WorkflowAction = "use" | "refine" | "append-to-agents" | "promote-to-skill" | "delete";
type WorkflowPick =
  | { type: "cancel" }
  | { type: "create" }
  | { type: "action"; action: WorkflowAction; workflow: WorkflowDefinition };

class WorkflowMenuComponent extends Container {
  private tui: { requestRender: () => void };
  private theme: Theme;
  private workflows: WorkflowDefinition[];
  private header: Text;
  private hint: Text;
  private list: Container;
  private search: Input;
  private select: SelectList;
  private mode: "workflows" | "actions";
  private current: WorkflowDefinition | null;
  private done: (value: WorkflowPick) => void;
  private searchActive: boolean;
  private leaderActive: boolean;
  private leaderTimer: ReturnType<typeof setTimeout> | null;
  private selected: string;

  constructor(
    tui: { requestRender: () => void },
    theme: Theme,
    workflows: WorkflowDefinition[],
    done: (value: WorkflowPick) => void,
  ) {
    super();
    this.tui = tui;
    this.theme = theme;
    this.workflows = workflows;
    this.mode = "workflows";
    this.current = null;
    this.done = done;
    this.searchActive = false;
    this.leaderActive = false;
    this.leaderTimer = null;
    this.selected = "__create__";
    this.header = new Text("", 1, 0);
    this.hint = new Text("", 1, 0);
    this.list = new Container();
    this.search = new Input();
    this.search.setValue("");
    this.search.focused = false;
    this.select = new SelectList([], 9, {
      selectedPrefix: (text) => this.theme.fg("accent", text),
      selectedText: (text) => this.theme.fg("accent", text),
      description: (text) => this.theme.fg("muted", text),
      scrollInfo: (text) => this.theme.fg("dim", text),
      noMatch: (text) => this.theme.fg("warning", text),
    });
    this.addChild(new DynamicBorder((text: string) => this.theme.fg("accent", text)));
    this.addChild(new Spacer(1));
    this.addChild(this.header);
    this.addChild(new Spacer(1));
    this.addChild(this.search);
    this.addChild(new Spacer(1));
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.addChild(this.hint);
    this.addChild(new Spacer(1));
    this.addChild(new DynamicBorder((text: string) => this.theme.fg("accent", text)));
    this.redraw();
  }

  private clearLeader(): void {
    if (this.leaderTimer) clearTimeout(this.leaderTimer);
    this.leaderTimer = null;
    this.leaderActive = false;
    this.redraw();
  }

  private startLeader(): void {
    if (this.leaderActive) {
      this.clearLeader();
      return;
    }
    this.leaderActive = true;
    if (this.leaderTimer) clearTimeout(this.leaderTimer);
    this.leaderTimer = setTimeout(() => this.clearLeader(), 2000);
    this.redraw();
  }

  private startSearch(): void {
    if (this.mode !== "workflows") return;
    this.searchActive = true;
    this.search.focused = true;
    this.redraw();
  }

  private redraw(): void {
    const title =
      this.mode === "workflows"
        ? this.theme.fg("accent", this.theme.bold(`Workflows (${this.workflows.length})`))
        : this.theme.fg("accent", this.theme.bold(`Actions for \"${this.current?.name ?? ""}\"`));
    this.header.setText(title);
    if (this.leaderActive) {
      this.hint.setText(
        this.theme.fg(
          "warning",
          this.mode === "workflows"
            ? "More options: c create • w open actions"
            : "More options: u use • r refine • a append • p promote • d delete",
        ),
      );
    }
    if (!this.leaderActive) {
      this.hint.setText(
        this.mode === "workflows"
          ? this.theme.fg(
              "dim",
              "Press / to search • ↑↓ or j/k select • Enter view • Ctrl+X more options • Esc close",
            )
          : this.theme.fg("dim", "Enter confirm • Esc back • ↑↓ or j/k navigate • Ctrl+X more options"),
      );
    }
    this.search.focused = this.searchActive;
    const items: SelectItem[] =
      this.mode === "workflows"
        ? [
            {
              value: "__create__",
              label: "Create new workflow...",
              description: "Create a workflow manually",
            },
            ...this.workflows.map((workflow) => ({
              value: workflow.name,
              label: workflow.name,
              description: workflow.description,
            })),
          ]
        : [
            { value: "use", label: "use", description: "Inject workflow body and user instructions" },
            { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality" },
            {
              value: "append-to-agents",
              label: "append-to-agents",
              description: "Append workflow to AGENTS.md safely",
            },
            {
              value: "promote-to-skill",
              label: "promote-to-skill",
              description: "Move workflow into ./.pi/skills",
            },
            { value: "delete", label: "delete", description: "Delete workflow" },
            { value: "back", label: "back", description: "Return to workflows list" },
          ];
    this.select = new SelectList(items, 9, {
      selectedPrefix: (text) => this.theme.fg("accent", text),
      selectedText: (text) => this.theme.fg("accent", text),
      description: (text) => this.theme.fg("muted", text),
      scrollInfo: (text) => this.theme.fg("dim", text),
      noMatch: (text) => this.theme.fg("warning", text),
    });
    this.select.onSelectionChange = (item) => {
      this.selected = item.value;
    };
    this.select.onSelect = (item) => this.confirm(item.value);
    this.select.onCancel = () => this.cancel();
    if (this.mode === "workflows") this.select.setFilter(this.search.getValue());
    this.list.clear();
    this.list.addChild(this.select);
    for (let index = items.length; index < 9; index += 1) {
      this.list.addChild(new Text("⠀", 0, 0));
    }
    this.tui.requestRender();
  }

  private leaderRun(data: string): boolean {
    if (this.mode === "workflows") {
      if (data === "c" || data === "C") {
        this.done({ type: "create" });
        this.clearLeader();
        return true;
      }
      if (data === "w" || data === "W") {
        this.confirm(this.selected);
        this.clearLeader();
        return true;
      }
      this.clearLeader();
      return false;
    }
    if (data === "u" || data === "U") return this.confirm("use"), this.clearLeader(), true;
    if (data === "r" || data === "R") return this.confirm("refine"), this.clearLeader(), true;
    if (data === "a" || data === "A") return this.confirm("append-to-agents"), this.clearLeader(), true;
    if (data === "p" || data === "P") return this.confirm("promote-to-skill"), this.clearLeader(), true;
    if (data === "d" || data === "D") return this.confirm("delete"), this.clearLeader(), true;
    this.clearLeader();
    return false;
  }

  private confirm(value: string): void {
    if (this.mode === "workflows") {
      if (value === "__create__") {
        this.done({ type: "create" });
        return;
      }
      const workflow = this.workflows.find((item) => item.name === value);
      if (!workflow) {
        this.done({ type: "cancel" });
        return;
      }
      this.current = workflow;
      this.mode = "actions";
      this.searchActive = false;
      this.search.focused = false;
      this.redraw();
      return;
    }
    if (value === "back") {
      this.mode = "workflows";
      this.current = null;
      this.redraw();
      return;
    }
    const workflow = this.current;
    if (!workflow) {
      this.done({ type: "cancel" });
      return;
    }
    if (
      value !== "use" &&
      value !== "refine" &&
      value !== "append-to-agents" &&
      value !== "promote-to-skill" &&
      value !== "delete"
    ) {
      this.done({ type: "cancel" });
      return;
    }
    this.done({ type: "action", action: value, workflow });
  }

  private cancel(): void {
    if (this.searchActive) {
      this.searchActive = false;
      this.search.focused = false;
      this.search.setValue("");
      this.redraw();
      return;
    }
    if (this.mode === "actions") {
      this.mode = "workflows";
      this.current = null;
      this.redraw();
      return;
    }
    this.done({ type: "cancel" });
  }

  handleInput(data: string): void {
    if (this.searchActive) {
      const key = getEditorKeybindings();
      if (key.matches(data, "selectConfirm")) {
        this.searchActive = false;
        this.search.focused = false;
        this.redraw();
        return;
      }
      if (key.matches(data, "selectCancel")) {
        this.searchActive = false;
        this.search.focused = false;
        this.search.setValue("");
        this.redraw();
        return;
      }
      if (key.matches(data, "selectUp") || key.matches(data, "selectDown")) return;
      this.search.handleInput(data);
      this.redraw();
      return;
    }
    if (data === "\u0018" || matchesKey(data, Key.ctrl("x"))) {
      this.startLeader();
      return;
    }
    if (this.leaderActive) {
      if (this.leaderRun(data)) return;
    }
    if (data === "/") {
      this.startSearch();
      return;
    }
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

async function pickWorkflow(ctx: ExtensionCommandContext, workflows: WorkflowDefinition[]): Promise<WorkflowPick> {
  return ctx.ui.custom<WorkflowPick>((tui, theme, _keybindings, done) => {
    return new WorkflowMenuComponent(tui, theme, workflows, done);
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

async function openWorkflowsMenu(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  while (true) {
    const discovery = await discoverWorkflows(ctx.cwd);
    const picked = await pickWorkflow(ctx, discovery.workflows);
    if (picked.type === "cancel") return;
    if (picked.type === "create") {
      await createWorkflowFromUi(ctx);
      continue;
    }
    if (picked.action === "use") {
      const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
      await injectWorkflowUse(pi, picked.workflow, extra);
      return;
    }
    if (picked.action === "refine") {
      pi.sendUserMessage(refineWorkflowPrompt(picked.workflow));
      return;
    }
    if (picked.action === "append-to-agents") {
      pi.sendUserMessage(appendWorkflowAgentsPrompt(picked.workflow));
      return;
    }
    if (picked.action === "promote-to-skill") {
      const confirmed = await ctx.ui.confirm(
        "Promote workflow",
        `Promote ${picked.workflow.name} to ./.pi/skills and remove it from workflows?`,
      );
      if (!confirmed) continue;
      const target = await promoteWorkflow(ctx.cwd, picked.workflow);
      ctx.ui.notify(`Workflow promoted to ${target}`, "info");
      continue;
    }
    const confirmed = await ctx.ui.confirm(
      "Delete workflow",
      `Delete workflow '${picked.workflow.name}'?`,
    );
    if (!confirmed) continue;
    await deleteWorkflow(picked.workflow);
    ctx.ui.notify(`Workflow '${picked.workflow.name}' deleted`, "info");
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
