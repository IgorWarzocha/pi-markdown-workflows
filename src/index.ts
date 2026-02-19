import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
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

const WORKFLOW_COMMAND_INSTRUCTIONS = `
<summary>
Document this session as a reusable workflow and enforce usage guidance via AGENTS.md.
</summary>

<objective>
Capture what worked into a repeatable procedure using workflows_create, then make future agents in this scope aware of it via AGENTS.md.
</objective>

<instructions>
1. Discovery: You SHOULD inspect <available_workflows> first and read existing workflow files to avoid duplicates.
2. Authoring: You MUST use workflows_create to create or update a workflow in ./.pi/workflows/<name>/SKILL.md.
3. Content quality: You SHOULD include prerequisites, ordered steps, expected outcomes, and any failure recovery notes.
4. Scope: You SHOULD update the most specific AGENTS.md in the directory hierarchy where the work occurred (do not update repository root unless the workflow is truly global).
5. Rule format: You MUST add this exact line before listing workflow names:
   "When operating in this directory you MUST consider loading these workflows:"
</instructions>

<rules>
- MUST persist reusable process knowledge via workflows_create.
- MUST use the exact required AGENTS.md phrasing.
- MUST keep AGENTS.md edits minimal and targeted.
- MAY refine an existing workflow instead of creating a duplicate.
</rules>
`;

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

  const registeredWorkflowCommands = new Set<string>();

  const sendWorkflowMessage = async (workflow: WorkflowDefinition, args: string): Promise<void> => {
    const content = await fs.promises.readFile(workflow.location, "utf-8");
    const body = stripFrontmatter(content).trim();
    const baseDir = path.dirname(workflow.location);
    const workflowBlock = `<workflow name="${workflow.name}" location="${workflow.location}">\nReferences are relative to ${baseDir}.\n\n${body}\n</workflow>`;
    const suffix = args.trim() ? `\n\n${args.trim()}` : "";
    pi.sendUserMessage(`${workflowBlock}${suffix}`);
  };

  const registerWorkflowSlashCommands = async (cwd: string): Promise<void> => {
    const discovery = await discoverWorkflows(cwd);
    for (const workflow of discovery.workflows) {
      const commandName = `workflow:${workflow.name}`;
      if (registeredWorkflowCommands.has(commandName)) continue;
      registeredWorkflowCommands.add(commandName);
      pi.registerCommand(commandName, {
        description: workflow.description,
        handler: async (args) => {
          await sendWorkflowMessage(workflow, args);
        },
      });
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    await registerWorkflowSlashCommands(ctx.cwd);
  });

  pi.on("session_switch", async (_event, ctx) => {
    await registerWorkflowSlashCommands(ctx.cwd);
  });

  pi.on("resources_discover", async (_event, ctx) => {
    await registerWorkflowSlashCommands(ctx.cwd);
  });

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
      const slug = slugify(input.name) || "workflow";
      const workflowDir = path.join(ctx.cwd, ...PRIMARY_WORKFLOWS_DIR, slug);
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

      return {
        content: [{ type: "text", text: `Workflow created at ${workflowPath}` }],
        details: { name: input.name, path: workflowPath },
      };
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const discovery = await discoverWorkflows(ctx.cwd);
    const suffix = formatWorkflowsForPrompt(discovery.workflows, ctx.cwd);
    return suffix ? { systemPrompt: `${event.systemPrompt}${suffix}` } : undefined;
  });

  pi.registerCommand("workflow", {
    description:
      "Use '/workflow <name>' to inject a workflow; use '/workflow' to capture the current session as a reusable workflow.",
    getArgumentCompletions: (argumentPrefix: string) => {
      const workflows = discoverWorkflowsSync(process.cwd());
      const prefix = argumentPrefix.trim().toLowerCase();
      const filtered = prefix
        ? workflows.filter(
            (w) =>
              w.name.toLowerCase().includes(prefix) || w.description.toLowerCase().includes(prefix),
          )
        : workflows;
      if (!filtered.length) return null;
      return filtered.map((workflow) => ({
        value: workflow.name,
        label: workflow.name,
        description: workflow.description,
      }));
    },
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      if (!trimmed) {
        pi.sendUserMessage(WORKFLOW_COMMAND_INSTRUCTIONS);
        return;
      }

      const workflows = discoverWorkflowsSync(ctx.cwd);
      const exact = workflows.find((w) => w.name === trimmed);
      if (exact) {
        await sendWorkflowMessage(exact, "");
        return;
      }

      const fuzzy = workflows.find((w) => w.name.toLowerCase().includes(trimmed.toLowerCase()));
      if (fuzzy) {
        await sendWorkflowMessage(fuzzy, "");
        return;
      }

      const available = workflows.map((w) => w.name).join(", ") || "none";
      throw new Error(`Workflow '${trimmed}' not found. Available workflows: ${available}`);
    },
  });
}
