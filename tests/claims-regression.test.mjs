import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import extension from "../dist/index.js";
import { bundledSkillPrompt } from "../dist/src/core/bundled-skill.js";
import { skillActionRows, workflowActionRows } from "../dist/src/ui/workflow-menu/view.js";

function mockPi() {
  const handlers = new Map();
  const commands = new Map();
  const tools = new Map();
  const sentMessages = [];

  return {
    handlers,
    commands,
    tools,
    sentMessages,
    on(name, handler) {
      const list = handlers.get(name) ?? [];
      list.push(handler);
      handlers.set(name, list);
    },
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
    registerCommand(name, definition) {
      commands.set(name, definition);
    },
    sendUserMessage(message) {
      sentMessages.push(message);
    },
  };
}

function makeCtx(cwd, branchEntries = []) {
  return {
    cwd,
    hasUI: false,
    ui: {
      notify() {},
      async confirm() {
        return false;
      },
      custom() {
        throw new Error("UI not available in claims regression test");
      },
    },
    sessionManager: {
      getBranch() {
        return branchEntries;
      },
    },
  };
}

async function setupNestedRepo(prefix = "pi-workflows-claims-test-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(root, "app", "feature"), { recursive: true });
  await fs.writeFile(path.join(root, "AGENTS.md"), "# root\nroot rule\n");
  await fs.writeFile(path.join(root, "app", "AGENTS.md"), "# app\napp rule\n");
  await fs.writeFile(path.join(root, "app", "feature", "AGENTS.md"), "# feature\nfeature rule\n");
  await fs.writeFile(path.join(root, "app", "feature", "file.ts"), "export const ok = true;\n");
  return root;
}

async function run() {
  const createdRoots = [];

  try {
    {
      const pi = mockPi();
      extension(pi);

      assert.ok(pi.commands.has("skills"), "skills command must be registered");
      assert.ok(pi.commands.has("workflows"), "workflows command must be registered");
      assert.ok(pi.commands.has("learn"), "learn command must be registered");
      assert.ok(pi.tools.has("workflows_create"), "workflows_create tool must be registered");

      for (const name of ["before_agent_start", "session_start", "session_tree", "tool_result"]) {
        assert.ok((pi.handlers.get(name) ?? []).length > 0, `${name} handler must exist`);
      }
    }

    {
      const pi = mockPi();
      extension(pi);

      await pi.commands.get("learn").handler("capture the weird build cache fix", makeCtx(process.cwd()));
      const message = pi.sentMessages.at(-1);
      assert.ok(message.includes("workflows_create"), "/learn should mention workflows_create");
      assert.ok(message.includes("AGENTS.md"), "/learn should mention AGENTS.md");
      assert.ok(
        message.includes("capture the weird build cache fix"),
        "/learn should include the user guidance",
      );
    }

    assert.deepEqual(
      workflowActionRows().map((row) => row.name),
      ["use", "refine", "append-to-agents", "promote-to-skill", "delete"],
      "/workflows actions should match documented capabilities",
    );
    assert.deepEqual(
      skillActionRows().map((row) => row.name),
      ["use", "refine", "delete"],
      "/skills actions should match documented capabilities",
    );

    {
      const pi = mockPi();
      extension(pi);
      const repo = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflows-create-test-"));
      createdRoots.push(repo);

      const tool = pi.tools.get("workflows_create");
      const result = await tool.execute(
        "tool-1",
        {
          name: "Build Release",
          description: "Release the project safely",
          body: "# Steps\n\n1. Test\n2. Ship\n",
        },
        undefined,
        undefined,
        makeCtx(repo),
      );

      const workflowPath = path.join(repo, ".pi", "workflows", "build-release", "SKILL.md");
      const workflowContent = await fs.readFile(workflowPath, "utf-8");

      assert.ok(result.content[0].text.includes(workflowPath));
      assert.ok(workflowContent.includes('name: "Build Release"'));
      assert.ok(workflowContent.includes('description: "Release the project safely"'));
      assert.ok(workflowContent.includes("# Steps"));
    }

    {
      const pi = mockPi();
      extension(pi);
      const repo = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflows-before-agent-test-"));
      createdRoots.push(repo);
      const workflowPath = path.join(repo, ".pi", "workflows", "build-release", "SKILL.md");
      await fs.mkdir(path.dirname(workflowPath), { recursive: true });
      await fs.writeFile(
        workflowPath,
        [
          "---",
          'name: "Build Release"',
          'description: "Release the project safely"',
          "---",
          "",
          "# Steps",
        ].join("\n"),
      );

      const result = await pi.handlers.get("before_agent_start")[0]({ systemPrompt: "BASE" }, makeCtx(repo));
      assert.ok(result.systemPrompt.includes("<workflows>"));
      assert.ok(result.systemPrompt.includes("Build Release"));
      assert.ok(result.systemPrompt.includes("./.pi/workflows/"));
    }

    {
      const prompt = await bundledSkillPrompt("skill-creator");
      assert.ok(prompt.includes('<bundled_skill name="skill-creator"'));
      assert.ok(prompt.includes("# Skill Creator"));
      assert.ok(prompt.includes("build or improve reusable skills"));
    }

    {
      const pi = mockPi();
      extension(pi);
      const repo = await setupNestedRepo();
      createdRoots.push(repo);
      const ctx = makeCtx(repo);
      for (const handler of pi.handlers.get("session_start") ?? []) {
        await handler({}, ctx);
      }

      const result = await pi.handlers.get("tool_result")[0](
        {
          toolName: "read",
          isError: false,
          input: { path: "app/feature/file.ts" },
          content: [{ type: "text", text: "export const ok = true;\n" }],
          details: undefined,
        },
        ctx,
      );

      assert.ok(result, "read should append nested AGENTS context");
      assert.deepEqual(
        result.details.subdirContextAutoload.files.map((file) => file.path),
        ["app/AGENTS.md", "app/feature/AGENTS.md"],
      );
      const appended = result.content.at(-1).text;
      assert.match(appended, /<subdirectory_agents_context>/);
      assert.match(appended, /path="app\/AGENTS\.md"/);
      assert.match(appended, /path="app\/feature\/AGENTS\.md"/);
      assert.doesNotMatch(appended, /path="AGENTS\.md"/);
    }

    {
      const pi = mockPi();
      extension(pi);
      const repo = await setupNestedRepo();
      createdRoots.push(repo);
      const ctx = makeCtx(repo);
      for (const handler of pi.handlers.get("session_start") ?? []) {
        await handler({}, ctx);
      }

      const result = await pi.handlers.get("tool_result")[0](
        {
          toolName: "bash",
          isError: false,
          input: { command: "rg ok app/feature/file.ts" },
          content: [{ type: "text", text: "app/feature/file.ts:1:export const ok = true;" }],
          details: undefined,
        },
        ctx,
      );

      assert.ok(result, "bash discovery command should append nested AGENTS context");
      assert.deepEqual(
        result.details.subdirContextAutoload.files.map((file) => file.path),
        ["app/AGENTS.md", "app/feature/AGENTS.md"],
      );
    }

    {
      const pi = mockPi();
      extension(pi);
      const repo = await setupNestedRepo();
      createdRoots.push(repo);
      const branchEntries = [
        {
          type: "message",
          message: {
            content: [{ type: "text", text: "previous\n<subdirectory_agents_context>\nseen\n</subdirectory_agents_context>" }],
            details: {
              subdirContextAutoload: {
                files: [
                  { path: "app/AGENTS.md", content: "# app\napp rule\n" },
                  { path: "app/feature/AGENTS.md", content: "# feature\nfeature rule\n" },
                ],
              },
            },
          },
        },
      ];
      const ctx = makeCtx(repo, branchEntries);
      for (const handler of pi.handlers.get("session_start") ?? []) {
        await handler({}, ctx);
      }

      const result = await pi.handlers.get("tool_result")[0](
        {
          toolName: "read",
          isError: false,
          input: { path: "app/feature/file.ts" },
          content: [{ type: "text", text: "export const ok = true;\n" }],
          details: undefined,
        },
        ctx,
      );

      assert.equal(result, undefined, "branch state should suppress duplicate nested AGENTS context");
    }

    {
      const source = await fs.readFile(path.join(process.cwd(), "dist", "src", "core", "subdir.js"), "utf-8");
      assert.ok(source.includes('subcommand === "ls-files" || subcommand === "grep"'));
      assert.ok(!source.includes('return names.has(command) || command === "git"'));
    }
  } finally {
    await Promise.all(createdRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
  }

  console.log("claims-regression test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
