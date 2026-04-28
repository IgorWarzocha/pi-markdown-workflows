import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function writeSkill(file, name, description) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    ["---", `name: ${name}`, `description: ${description}`, "---", "", `# ${name}`, ""].join(
      "\n",
    ),
  );
}

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pi-workflows-skill-test-"));
  const oldHome = process.env.HOME;
  const oldAgentDir = process.env.PI_CODING_AGENT_DIR;

  try {
    const home = path.join(root, "home");
    const agentDir = path.join(root, "agent");
    const cwd = path.join(root, "repo");
    process.env.HOME = home;
    process.env.PI_CODING_AGENT_DIR = agentDir;

    await fs.mkdir(path.join(cwd, ".pi"), { recursive: true });
    await fs.mkdir(agentDir, { recursive: true });

    await writeSkill(
      path.join(cwd, ".pi", "configured", "project-configured", "SKILL.md"),
      "project-configured",
      "Project configured skill",
    );
    await writeSkill(
      path.join(agentDir, "configured", "global-configured", "SKILL.md"),
      "global-configured",
      "Global configured skill",
    );
    await writeSkill(
      path.join(home, ".agents", "skills", "agents-global", "SKILL.md"),
      "agents-global",
      "Global .agents skill",
    );
    await writeSkill(
      path.join(cwd, ".pi", "skills", "collision", "SKILL.md"),
      "collision",
      "Project collision winner",
    );
    await writeSkill(
      path.join(agentDir, "skills", "collision", "SKILL.md"),
      "collision",
      "Global collision loser",
    );

    await fs.writeFile(
      path.join(cwd, ".pi", "settings.json"),
      JSON.stringify({ skills: ["./configured"] }),
    );
    await fs.writeFile(
      path.join(agentDir, "settings.json"),
      JSON.stringify({ skills: ["./configured"] }),
    );

    const { discoverSkills, discoverSkillsSync } = await import("../dist/src/core/skill/discover.js");
    const skills = discoverSkillsSync(cwd);
    const names = skills.map((skill) => skill.name).sort();

    assert.ok(names.includes("project-configured"), "sync discovery includes .pi/settings skills");
    assert.ok(names.includes("global-configured"), "sync discovery includes agent settings skills");
    assert.ok(names.includes("agents-global"), "sync discovery includes ~/.agents/skills");
    assert.equal(
      skills.find((skill) => skill.name === "collision")?.description,
      "Project collision winner",
      "sync discovery keeps project skill before same-named global skill",
    );
    assert.equal(
      skills.filter((skill) => skill.name === "collision").length,
      1,
      "sync discovery does not re-add shadowed fallback skills with duplicate names",
    );

    const { deleteSkill } = await import("../dist/src/core/skill/ops.js");
    await assert.rejects(
      () =>
        deleteSkill({
          name: "package-skill",
          description: "Package skill",
          location: path.join(root, "package-skill", "SKILL.md"),
          canDelete: false,
        }),
      /Cannot delete package-managed or non-local skill/,
    );

    const { createWorkflow, discoverWorkflowsSync } = await import(
      "../dist/src/core/workflow/index.js"
    );
    await createWorkflow(cwd, {
      name: 'Quote "and" slash \\ workflow',
      description: 'Description with "quotes" and slash \\',
      body: "## Steps\n\n- Do it",
    });
    const workflows = discoverWorkflowsSync(cwd);
    assert.equal(
      workflows.find((workflow) => workflow.name.includes("Quote"))?.description,
      'Description with "quotes" and slash \\',
      "workflow frontmatter round-trips escaped quoted values",
    );

    const asyncDiscovery = await discoverSkills(cwd);
    assert.equal(
      asyncDiscovery.skills.find((skill) => skill.name === "collision")?.description,
      "Project collision winner",
      "async discovery keeps project skill before same-named global skill",
    );
    assert.equal(
      asyncDiscovery.skills.filter((skill) => skill.name === "collision").length,
      1,
      "async discovery does not re-add shadowed fallback skills with duplicate names",
    );
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = oldAgentDir;
    await fs.rm(root, { recursive: true, force: true });
  }

  console.log("skill-discovery test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
