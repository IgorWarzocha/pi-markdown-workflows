import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { normalizeAtPrefix } from "./workflow.js";

const SUBDIR_CONTEXT_DETAILS_KEY = "subdirContextAutoload";
const SUBDIR_CONTEXT_MARKER = "<subdirectory_agents_context>";
const RECENT_TOOL_RESULT_DEDUPE_MS = 10_000;

type PersistedContextFile = { path: string; content: string };

type PersistedContextDetails = {
  files: PersistedContextFile[];
};

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

function shellCommandParts(value: string): string[] {
  return value
    .replaceAll("&&", " ; ")
    .replaceAll("||", " ; ")
    .replaceAll("|", " ; ")
    .replaceAll(";", " ; ")
    .split(/\s+/)
    .map((item) => item.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean);
}

function isDiscoveryCommandAt(parts: string[], index: number): boolean {
  const command = parts[index]?.toLowerCase() ?? "";
  const names = new Set([
    "ls",
    "find",
    "rg",
    "grep",
    "fd",
    "tree",
    "cat",
    "sed",
    "head",
    "tail",
    "nl",
    "wc",
    "stat",
    "file",
    "du",
    "git",
  ]);
  if (command !== "git") return names.has(command);
  const subcommand = parts[index + 1]?.toLowerCase() ?? "";
  return subcommand === "ls-files" || subcommand === "grep";
}

function isDiscoveryShellCommand(value: string): boolean {
  const parts = shellCommandParts(value);
  for (let index = 0; index < parts.length; index += 1) {
    if (isDiscoveryCommandAt(parts, index)) return true;
  }
  return false;
}

function shellTargets(value: string, base: string): string[] {
  const parts = shellCommandParts(value);
  if (!parts.length) return [base];
  const paths: string[] = [];
  let scanningDiscoveryCommand = false;
  for (let index = 0; index < parts.length; index += 1) {
    const item = parts[index];
    if (!item) continue;
    if (item === ";") {
      scanningDiscoveryCommand = false;
      continue;
    }
    if (isDiscoveryCommandAt(parts, index)) {
      scanningDiscoveryCommand = true;
      if (item.toLowerCase() === "git") index += 1;
      continue;
    }
    if (!scanningDiscoveryCommand) continue;
    if (item.startsWith("-")) continue;
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

function parsePersistedContextDetails(details: unknown): PersistedContextDetails | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = (details as Record<string, unknown>)[SUBDIR_CONTEXT_DETAILS_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const files = (value as Record<string, unknown>).files;
  if (!Array.isArray(files)) return null;
  const parsed = files
    .filter((item): item is PersistedContextFile => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const pathValue = (item as Record<string, unknown>).path;
      const contentValue = (item as Record<string, unknown>).content;
      return typeof pathValue === "string" && typeof contentValue === "string";
    })
    .map((item) => ({ path: item.path, content: item.content }));
  if (!parsed.length) return null;
  return { files: parsed };
}

function mergePersistedContextDetails(
  baseDetails: unknown,
  injected: PersistedContextDetails,
): Record<string, unknown> {
  if (baseDetails && typeof baseDetails === "object" && !Array.isArray(baseDetails)) {
    return {
      ...(baseDetails as Record<string, unknown>),
      [SUBDIR_CONTEXT_DETAILS_KEY]: injected,
    };
  }
  return { [SUBDIR_CONTEXT_DETAILS_KEY]: injected };
}

function contentHasSubdirContext(content: unknown): boolean {
  if (typeof content === "string") return content.includes(SUBDIR_CONTEXT_MARKER);
  if (!Array.isArray(content)) return false;
  return content.some((item) => {
    if (typeof item === "string") return item.includes(SUBDIR_CONTEXT_MARKER);
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const text = (item as Record<string, unknown>).text;
    return typeof text === "string" && text.includes(SUBDIR_CONTEXT_MARKER);
  });
}

export function registerSubdirContextAutoload(pi: ExtensionAPI): void {
  const loadedAgents = new Set<string>();
  const loadedAgentsContent = new Map<string, string>();
  const recentToolResultContent = new Map<string, { content: string; timestamp: number }>();
  let currentCwd = "";
  let cwdAgentsPath = "";
  let homeDir = "";
  let readCount = 0;

  function relativePath(absolutePath: string): string {
    const relative = currentCwd ? path.relative(currentCwd, absolutePath) : absolutePath;
    return (relative || absolutePath).replaceAll("\\", "/");
  }

  function resetSession(cwd: string): void {
    currentCwd = resolvePath(cwd, process.cwd());
    cwdAgentsPath = path.join(currentCwd, "AGENTS.md");
    homeDir = resolvePath(os.homedir(), process.cwd());
    readCount = 0;
    loadedAgents.clear();
    loadedAgentsContent.clear();
    recentToolResultContent.clear();
    loadedAgents.add(cwdAgentsPath);
  }

  function ensureSession(cwd: string): void {
    if (!currentCwd) resetSession(cwd);
  }

  function collectBranchContext(ctx: ExtensionContext): Map<string, string> {
    ensureSession(ctx.cwd);
    const out = new Map<string, string>();
    const branchEntries = ctx.sessionManager.getBranch();
    for (const entry of branchEntries) {
      if (!entry || typeof entry !== "object" || entry.type !== "message") continue;
      const message = (entry as { message?: unknown }).message;
      if (!message || typeof message !== "object" || Array.isArray(message)) continue;
      const details = (message as { details?: unknown }).details;
      const persisted = parsePersistedContextDetails(details);
      if (!persisted) continue;
      if (!contentHasSubdirContext((message as { content?: unknown }).content)) continue;
      for (const file of persisted.files) {
        const absolute = resolvePath(file.path, currentCwd);
        if (path.basename(absolute) !== "AGENTS.md" || absolute === cwdAgentsPath) continue;
        out.set(absolute, file.content);
      }
    }
    return out;
  }

  function syncRuntimeFromBranch(branchContext: Map<string, string>): void {
    loadedAgents.clear();
    loadedAgents.add(cwdAgentsPath);
    loadedAgentsContent.clear();
    for (const [agentsPath, content] of branchContext.entries()) {
      loadedAgents.add(agentsPath);
      loadedAgentsContent.set(agentsPath, content);
    }
  }

  function recentlyEmittedContent(agentsPath: string): string | undefined {
    const now = Date.now();
    for (const [key, value] of recentToolResultContent.entries()) {
      if (now - value.timestamp > RECENT_TOOL_RESULT_DEDUPE_MS) {
        recentToolResultContent.delete(key);
      }
    }
    return recentToolResultContent.get(agentsPath)?.content;
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

  function buildToolResultContextBlock(files: PersistedContextFile[]): string | null {
    if (!files.length) return null;
    const body = files
      .map((file) => {
        return `<agents_file path="${file.path}">\n${file.content}\n</agents_file>`;
      })
      .join("\n\n");
    return [
      "<subdirectory_agents_context>",
      "Automatically loaded AGENTS.md context relevant to this tool result.",
      body,
      "</subdirectory_agents_context>",
    ].join("\n");
  }

  const handleSessionChange = (_event: unknown, ctx: ExtensionContext): void => {
    resetSession(ctx.cwd);
  };

  pi.on("session_start", handleSessionChange);
  pi.on("session_tree", handleSessionChange);

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) return undefined;
    const isRead = event.toolName === "read";
    const isPathDiscoveryTool = ["grep", "find", "ls"].includes(event.toolName);
    const shellInput =
      typeof event.input.command === "string"
        ? event.input.command
        : typeof event.input.cmd === "string"
          ? event.input.cmd
          : undefined;
    const isShell =
      event.toolName === "bash" ||
      event.toolName === "exec" ||
      event.toolName === "exec_command" ||
      event.toolName === "shell";
    if (!isRead && !isShell && !isPathDiscoveryTool) return undefined;
    const pathInput = event.input.path as string | undefined;
    const isDiscoveryShell =
      isShell && typeof shellInput === "string" && isDiscoveryShellCommand(shellInput);
    if (!isRead && !isPathDiscoveryTool && !isDiscoveryShell) return undefined;

    ensureSession(ctx.cwd);
    const branchContext = collectBranchContext(ctx);
    syncRuntimeFromBranch(branchContext);

    readCount += 1;

    const targets =
      isRead || isPathDiscoveryTool
        ? pathInput
          ? [resolvePath(pathInput, currentCwd)]
          : [currentCwd]
        : shellInput
          ? shellTargets(shellInput, currentCwd)
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

    const loadedNow: string[] = [];
    const persistedFiles: PersistedContextFile[] = [];

    for (const agentsPath of agentFiles) {
      try {
        const content = await fs.promises.readFile(agentsPath, "utf-8");
        const wasLoaded = loadedAgents.has(agentsPath);
        loadedAgents.add(agentsPath);
        const branchContent = branchContext.get(agentsPath);
        const knownContent = branchContent ?? recentlyEmittedContent(agentsPath);
        if (knownContent !== content) {
          persistedFiles.push({ path: relativePath(agentsPath), content });
        }
        loadedAgentsContent.set(agentsPath, content);
        recentToolResultContent.set(agentsPath, { content, timestamp: Date.now() });
        if (!wasLoaded) loadedNow.push(relativePath(agentsPath));
      } catch (error) {
        if (ctx.hasUI) ctx.ui.notify(`Failed to load ${agentsPath}: ${String(error)}`, "warning");
      }
    }

    if (loadedNow.length && ctx.hasUI) {
      const label =
        loadedNow.length === 1
          ? `Loaded AGENTS.md context: ${loadedNow[0]}`
          : `Loaded AGENTS.md context (${loadedNow.length} files)`;
      ctx.ui.notify(label, "info");
    }

    if (!persistedFiles.length) return undefined;
    const details = mergePersistedContextDetails(event.details, { files: persistedFiles });
    const contextBlock = buildToolResultContextBlock(persistedFiles);
    if (!contextBlock) return { details };
    const content = [...event.content, { type: "text" as const, text: contextBlock }];
    return { content, details };
  });
}
