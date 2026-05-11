import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import extension from "../dist/index.js";

const DETAILS_KEY = "subdirContextAutoload";

function mockPi() {
  const handlers = new Map();
  const sentMessages = [];
  return {
    handlers,
    sentMessages,
    on(name, handler) {
      handlers.set(name, handler);
    },
    registerTool() {},
    registerCommand() {},
    sendUserMessage() {},
    sendMessage(message) {
      sentMessages.push(message);
    },
  };
}

function persistedFiles(details) {
  const value = details?.[DETAILS_KEY]?.files;
  return Array.isArray(value) ? value : [];
}

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflows-tool-test-"));
  const cwd = path.join(root, "repo");
  await fs.mkdir(path.join(cwd, "a", "b", "c"), { recursive: true });
  await fs.writeFile(path.join(cwd, "AGENTS.md"), "ROOT");
  await fs.writeFile(path.join(cwd, "a", "AGENTS.md"), "A");
  await fs.writeFile(path.join(cwd, "a", "b", "AGENTS.md"), "B");
  await fs.writeFile(path.join(cwd, "a", "b", "c", "file.ts"), "export const x = 1;\n");

  const branchEntries = [];
  const pi = mockPi();
  extension(pi);

  const ctx = {
    cwd,
    hasUI: false,
    sessionManager: {
      getBranch() {
        return branchEntries;
      },
    },
  };

  const sessionStart = pi.handlers.get("session_start");
  const toolResult = pi.handlers.get("tool_result");
  const contextHook = pi.handlers.get("context");
  assert.ok(sessionStart, "session_start handler must exist");
  assert.ok(toolResult, "tool_result handler must exist");
  assert.ok(contextHook, "context handler must exist");

  sessionStart({}, ctx);

  const readEvent = {
    toolName: "read",
    isError: false,
    input: { path: path.join(cwd, "a", "b", "c", "file.ts") },
    content: [{ type: "text", text: "FILE" }],
    details: {},
  };

  const firstRead = await toolResult(readEvent, ctx);
  assert.ok(firstRead, "first read should persist discovered AGENTS context in details");
  assert.equal(firstRead.content, undefined, "read output should remain unchanged (silent injection)");
  assert.equal(persistedFiles(firstRead.details).length, 2, "should persist two nested AGENTS files");

  branchEntries.push({
    type: "message",
    message: { role: "toolResult", details: firstRead.details },
  });

  const firstContext = await contextHook({ messages: [] }, ctx);
  assert.ok(firstContext, "context hook should inject hidden AGENTS context message");
  assert.equal(firstContext.messages.length, 1);
  assert.equal(firstContext.messages[0].role, "custom");
  assert.equal(firstContext.messages[0].display, false);
  assert.match(firstContext.messages[0].content, /a\/AGENTS\.md/);
  assert.match(firstContext.messages[0].content, /a\/b\/AGENTS\.md/);

  branchEntries.length = 0;
  const emptyBranchContext = await contextHook({ messages: [] }, ctx);
  assert.equal(
    emptyBranchContext,
    undefined,
    "context hook should not inject stale AGENTS context when active branch has none",
  );

  branchEntries.push({
    type: "message",
    message: { role: "toolResult", details: firstRead.details },
  });
  sessionStart({}, ctx);
  const resumedContext = await contextHook({ messages: [] }, ctx);
  assert.ok(resumedContext, "context should be available immediately after resume/session start");
  assert.match(resumedContext.messages[0].content, /a\/AGENTS\.md/);
  assert.match(resumedContext.messages[0].content, /a\/b\/AGENTS\.md/);

  const secondRead = await toolResult(readEvent, ctx);
  assert.equal(secondRead, undefined, "second read should not emit duplicate persisted updates");

  for (let index = 0; index < 7; index += 1) {
    await toolResult(
      {
        toolName: "bash",
        isError: false,
        input: { command: "ls ." },
        content: [{ type: "text", text: "listing" }],
        details: {},
      },
      ctx,
    );
  }

  const tenthQualifyingAction = await toolResult(
    {
      toolName: "bash",
      isError: false,
      input: { command: "ls ./a/b/c" },
      content: [{ type: "text", text: "listing" }],
      details: {},
    },
    ctx,
  );

  assert.equal(tenthQualifyingAction, undefined, "cadence refresh should stay silent when context is unchanged");

  await fs.writeFile(path.join(cwd, "a", "b", "c", "AGENTS.md"), "C");

  const freshNestedViaBash = await toolResult(
    {
      toolName: "bash",
      isError: false,
      input: { command: "ls ./a/b/c" },
      content: [{ type: "text", text: "listing" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaBash, "fresh nested AGENTS should persist update details");
  assert.equal(persistedFiles(freshNestedViaBash.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaBash.details)[0].path, "a/b/c/AGENTS.md");

  await fs.mkdir(path.join(cwd, "a", "d"), { recursive: true });
  await fs.writeFile(path.join(cwd, "a", "d", "AGENTS.md"), "D");

  const freshNestedViaExecCommand = await toolResult(
    {
      toolName: "exec_command",
      isError: false,
      input: { cmd: "ls ./a/d" },
      content: [{ type: "text", text: "listing" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaExecCommand, "exec_command with cmd should persist nested AGENTS updates");
  assert.equal(persistedFiles(freshNestedViaExecCommand.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaExecCommand.details)[0].path, "a/d/AGENTS.md");

  await fs.mkdir(path.join(cwd, "a", "e"), { recursive: true });
  await fs.writeFile(path.join(cwd, "a", "e", "AGENTS.md"), "E");
  await fs.writeFile(path.join(cwd, "a", "e", "file.ts"), "export const e = 1;\n");

  const freshNestedViaCat = await toolResult(
    {
      toolName: "exec_command",
      isError: false,
      input: { cmd: "cat ./a/e/file.ts" },
      content: [{ type: "text", text: "file" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaCat, "cat through exec_command should persist nested AGENTS updates");
  assert.equal(persistedFiles(freshNestedViaCat.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaCat.details)[0].path, "a/e/AGENTS.md");

  await fs.mkdir(path.join(cwd, "a", "f"), { recursive: true });
  await fs.writeFile(path.join(cwd, "a", "f", "AGENTS.md"), "F");
  await fs.writeFile(path.join(cwd, "a", "f", "file.ts"), "export const f = 1;\n");

  const freshNestedViaSed = await toolResult(
    {
      toolName: "exec_command",
      isError: false,
      input: { cmd: "sed -n '1,5p' ./a/f/file.ts" },
      content: [{ type: "text", text: "file" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaSed, "sed through exec_command should persist nested AGENTS updates");
  assert.equal(persistedFiles(freshNestedViaSed.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaSed.details)[0].path, "a/f/AGENTS.md");

  await fs.mkdir(path.join(cwd, "a", "chained"), { recursive: true });
  await fs.writeFile(path.join(cwd, "a", "chained", "AGENTS.md"), "CHAINED");
  await fs.writeFile(path.join(cwd, "a", "chained", "file.ts"), "export const chained = 1;\n");

  const freshNestedViaChainedCommand = await toolResult(
    {
      toolName: "exec_command",
      isError: false,
      input: { cmd: "mkdir -p ./scratch && echo ok && sed -n '1,5p' ./a/chained/file.ts" },
      content: [{ type: "text", text: "file" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaChainedCommand, "chained exec_command should inspect later read commands");
  assert.equal(persistedFiles(freshNestedViaChainedCommand.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaChainedCommand.details)[0].path, "a/chained/AGENTS.md");

  await fs.mkdir(path.join(cwd, "a", "g"), { recursive: true });
  await fs.writeFile(path.join(cwd, "a", "g", "AGENTS.md"), "G");

  const freshNestedViaLsTool = await toolResult(
    {
      toolName: "ls",
      isError: false,
      input: { path: "./a/g" },
      content: [{ type: "text", text: "listing" }],
      details: {},
    },
    ctx,
  );

  assert.ok(freshNestedViaLsTool, "ls tool should persist nested AGENTS updates");
  assert.equal(persistedFiles(freshNestedViaLsTool.details).length, 1);
  assert.equal(persistedFiles(freshNestedViaLsTool.details)[0].path, "a/g/AGENTS.md");

  branchEntries.push({
    type: "message",
    message: { role: "toolResult", details: freshNestedViaBash.details },
  });

  const refreshedContext = await contextHook({ messages: [] }, ctx);
  assert.ok(refreshedContext, "context hook should include newly discovered nested AGENTS");
  assert.ok(
    refreshedContext.messages.some((message) =>
      typeof message.content === "string" ? message.content.includes("a/b/c/AGENTS.md") : false,
    ),
  );

  await fs.rm(root, { recursive: true, force: true });
  console.log("subdir-context test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
