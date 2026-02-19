import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import extension from "../dist/index.js";

function mockPi() {
  const handlers = new Map();
  return {
    handlers,
    on(name, handler) {
      handlers.set(name, handler);
    },
    registerTool() {},
    registerCommand() {},
    sendUserMessage() {},
  };
}

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflows-tool-test-"));
  const cwd = path.join(root, "repo");
  await fs.mkdir(path.join(cwd, "a", "b", "c"), { recursive: true });
  await fs.writeFile(path.join(cwd, "AGENTS.md"), "ROOT");
  await fs.writeFile(path.join(cwd, "a", "AGENTS.md"), "A");
  await fs.writeFile(path.join(cwd, "a", "b", "AGENTS.md"), "B");
  await fs.writeFile(path.join(cwd, "a", "b", "c", "file.ts"), "export const x = 1;\n");

  const pi = mockPi();
  extension(pi);

  const ctx = { cwd, hasUI: false };
  const sessionStart = pi.handlers.get("session_start");
  const toolResult = pi.handlers.get("tool_result");
  assert.ok(sessionStart, "session_start handler must exist");
  assert.ok(toolResult, "tool_result handler must exist");

  sessionStart({}, ctx);

  const readEvent = {
    toolName: "read",
    isError: false,
    input: { path: path.join(cwd, "a", "b", "c", "file.ts") },
    content: [{ type: "text", text: "FILE" }],
    details: {},
  };

  const firstRead = await toolResult(readEvent, ctx);
  assert.ok(firstRead, "first read should inject nested AGENTS files");
  assert.equal(firstRead.content.length, 3);
  assert.match(firstRead.content[1].text, /a\/AGENTS.md/);
  assert.match(firstRead.content[2].text, /a\/b\/AGENTS.md/);

  const secondRead = await toolResult(readEvent, ctx);
  assert.equal(secondRead, undefined, "second read should not re-inject before cadence trigger");

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

  assert.ok(tenthQualifyingAction, "10th qualifying action should trigger cadence reinjection");
  assert.ok(
    tenthQualifyingAction.content.some((item) =>
      typeof item.text === "string" ? item.text.includes("a/AGENTS.md") : false,
    ),
  );

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

  assert.ok(freshNestedViaBash, "fresh nested AGENTS.md should inject immediately via bash discovery");
  assert.ok(
    freshNestedViaBash.content.some((item) =>
      typeof item.text === "string" ? item.text.includes("a/b/c/AGENTS.md") : false,
    ),
  );

  await fs.rm(root, { recursive: true, force: true });
  console.log("subdir-context test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
