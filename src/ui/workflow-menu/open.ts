import { spawn } from "node:child_process";
import fs from "node:fs";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { create, row } from "../../../sdk/template.js";
import { createAction } from "../../../sdk/action.js";
import { createDetail } from "../../../sdk/detail.js";
import { createList, type Col } from "../../../sdk/list.js";
import { detailScroll, detailToggle } from "../../../sdk/keybind-logic.js";
import {
  about,
  back,
  backtab,
  down,
  enter,
  esc,
  help,
  slash,
  tab,
  text,
  up,
} from "../../../sdk/keybinds.js";
import { renderDetail } from "../../../sdk/detail-frame.js";
import { deleteSkill, discoverSkills, injectSkillUse } from "../../core/skill.js";
import {
  SKILL_CREATE_PROMPT,
  WORKFLOW_CREATE_PROMPT,
  appendWorkflowAgentsPrompt,
  refineSkillPrompt,
  refineWorkflowPrompt,
} from "../../prompts/index.js";
import {
  deleteWorkflow,
  discoverWorkflows,
  injectWorkflowUse,
  promoteWorkflow,
  stripFrontmatter,
} from "../../core/workflow.js";
import type {
  SkillAction,
  SkillDefinition,
  WorkflowAction,
  WorkflowDefinition,
  WorkflowPick,
} from "../../types/index.js";

type Tab = "workflows" | "skills";

type WorkflowListItem = {
  key: string;
  name: string;
  description: string;
  workflow: WorkflowDefinition | null;
};

type SkillListItem = {
  key: string;
  name: string;
  description: string;
  skill: SkillDefinition | null;
};

type WorkflowActionItem = {
  name: WorkflowAction;
  label: string;
  description: string;
};

type SkillActionItem = {
  name: SkillAction;
  description: string;
};

function workflowRows(workflows: WorkflowDefinition[]): WorkflowListItem[] {
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

function skillRows(skills: SkillDefinition[]): SkillListItem[] {
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

function workflowActionRows(): WorkflowActionItem[] {
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

function skillActionRows(): SkillActionItem[] {
  return [
    { name: "use", description: "Inject skill for model usage" },
    { name: "refine", description: "Refine skill content" },
    { name: "delete", description: "Delete skill" },
  ];
}

function listCols<T extends { name: string; description: string }>(): Col<T>[] {
  return [
    { show: true, width: 28, tone: "normal", align: "left", pick: (item) => item.name },
    { show: true, width: 44, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

function workflowActionCols(): Col<WorkflowActionItem>[] {
  return [
    { show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.label },
    { show: true, width: 52, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

function skillActionCols(): Col<SkillActionItem>[] {
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

function detailView(name: string, description: string, location: string) {
  return createDetail({
    title: name,
    meta: [description, location],
    body: detailBody(location),
  });
}

function helpView() {
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

function openRepository(): void {
  const url = "https://github.com/IgorWarzocha/pi-markdown-workflows";
  if (process.platform === "darwin") {
    const item = spawn("open", [url], { detached: true, stdio: "ignore" });
    item.unref();
    return;
  }
  if (process.platform === "win32") {
    const item = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" });
    item.unref();
    return;
  }
  const item = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  item.unref();
}

function aboutView() {
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

function createPick(
  ctx: ExtensionCommandContext,
  workflows: WorkflowDefinition[],
  skills: SkillDefinition[],
  initial: Tab,
): Promise<WorkflowPick> {
  const workflowItems = workflowRows(workflows);
  const skillItems = skillRows(skills);
  const workflowList = createList<WorkflowListItem>({
    title: `Workflows (${workflows.length})`,
    items: workflowItems,
    shortcuts: "tab switch • / search • j/k select • v details • enter confirm",
    tier: "top",
    tab: true,
    search: true,
    prompt: true,
    page: 9,
    find: (item, query) =>
      item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
    intent: (item) => ({ type: "action", name: `workflow:${item.key}` }),
    cols: listCols<WorkflowListItem>(),
  });
  const skillList = createList<SkillListItem>({
    title: `Skills (${skills.length})`,
    items: skillItems,
    shortcuts: "tab switch • / search • j/k select • v details • enter confirm",
    tier: "top",
    tab: true,
    search: true,
    prompt: true,
    page: 9,
    find: (item, query) =>
      item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
    intent: (item) => ({ type: "action", name: `skill:${item.key}` }),
    cols: listCols<SkillListItem>(),
  });

  const workflowActions = createAction<WorkflowActionItem>(
    {
      title: "Workflow actions",
      items: workflowActionRows(),
      shortcuts: "j/k select • v toggle preview • J/K scroll preview • enter confirm",
      page: 9,
      find: (item, query) =>
        item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
      intent: (item) => ({ type: "action", name: item.name }),
      cols: workflowActionCols(),
    },
    "nested",
  );

  const skillActions = createAction<SkillActionItem>(
    {
      title: "Skill actions",
      items: skillActionRows(),
      shortcuts: "j/k select • v toggle preview • J/K scroll preview • enter confirm",
      page: 9,
      find: (item, query) =>
        item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
      intent: (item) => ({ type: "action", name: item.name }),
      cols: skillActionCols(),
    },
    "nested",
  );

  return ctx.ui.custom<WorkflowPick>((tui, theme, _keys, done) => {
    const skin = {
      fg: (color: string, value: string) => theme.fg(color as never, value),
    };
    const state = {
      tab: initial,
      screen: "list" as "list" | "actions" | "help" | "about",
      search: false,
      query: "",
      detail: undefined as ReturnType<typeof createDetail> | undefined,
      selectedWorkflow: undefined as WorkflowDefinition | undefined,
      selectedSkill: undefined as SkillDefinition | undefined,
    };

    const list = () => (state.tab === "workflows" ? workflowList : skillList);

    const pickWorkflow = (): WorkflowListItem | null => {
      const intent = workflowList.enter();
      if (!intent || intent.type !== "action") return null;
      const key = intent.name.startsWith("workflow:") ? intent.name.slice(9) : "";
      if (!key) return null;
      const value = workflowItems.find((item) => item.key === key);
      return value ?? null;
    };

    const pickSkill = (): SkillListItem | null => {
      const intent = skillList.enter();
      if (!intent || intent.type !== "action") return null;
      const key = intent.name.startsWith("skill:") ? intent.name.slice(6) : "";
      if (!key) return null;
      const value = skillItems.find((item) => item.key === key);
      return value ?? null;
    };

    const refreshDetail = (): void => {
      if (state.tab === "workflows") {
        const picked = pickWorkflow();
        if (!picked || !picked.workflow) {
          state.detail = undefined;
          state.selectedWorkflow = undefined;
          return;
        }
        state.selectedWorkflow = picked.workflow;
        state.detail = detailView(
          picked.workflow.name,
          picked.workflow.description,
          picked.workflow.location,
        );
        return;
      }
      const picked = pickSkill();
      if (!picked || !picked.skill) {
        state.detail = undefined;
        state.selectedSkill = undefined;
        return;
      }
      state.selectedSkill = picked.skill;
      state.detail = detailView(picked.skill.name, picked.skill.description, picked.skill.location);
    };

    const changeTab = (next: Tab): void => {
      if (state.tab === next) return;
      state.tab = next;
      state.screen = "list";
      state.search = false;
      state.query = "";
      state.detail = undefined;
      workflowList.set("");
      skillList.set("");
    };

    return {
      render: (width: number) => {
        const slot =
          state.screen === "help"
            ? helpView().slot()
            : state.screen === "about"
              ? aboutView().slot()
              : state.screen === "list"
                ? list().slot()
                : state.tab === "workflows"
                  ? workflowActions.slot()
                  : skillActions.slot();
        const base = create(slot, skin).render(width);
        if (!state.detail) return base;
        const top = renderDetail(state.detail.slot(), width, base.length, skin);
        return [...top, "", ...base];
      },
      invalidate: () => {},
      handleInput: (data: string) => {
        if (state.search) {
          if (esc(data)) {
            state.search = false;
            state.query = "";
            list().set("");
            tui.requestRender();
            return;
          }
          if (enter(data)) {
            state.search = false;
            tui.requestRender();
            return;
          }
          if (back(data)) {
            state.query = state.query.slice(0, -1);
            list().set(state.query);
            tui.requestRender();
            return;
          }
          if (text(data)) {
            state.query += data;
            list().set(state.query);
            tui.requestRender();
          }
          return;
        }

        const step = detailScroll(data);
        if (state.detail && step !== 0) {
          if (step > 0) state.detail.down();
          if (step < 0) state.detail.up();
          tui.requestRender();
          return;
        }

        if (state.screen === "about" && (data === "g" || data === "G")) {
          openRepository();
          ctx.ui.notify("Opened repository in browser", "info");
          return;
        }

        if (esc(data)) {
          if (state.screen === "help" || state.screen === "about") {
            state.screen = "list";
            state.detail = undefined;
            tui.requestRender();
            return;
          }
          if (state.screen === "actions") {
            state.screen = "list";
            state.detail = undefined;
            tui.requestRender();
            return;
          }
          if (state.detail) {
            state.detail = undefined;
            tui.requestRender();
            return;
          }
          done({ type: "cancel" });
          return;
        }

        if (state.screen === "list" && tab(data)) {
          changeTab(state.tab === "workflows" ? "skills" : "workflows");
          tui.requestRender();
          return;
        }

        if (state.screen === "list" && backtab(data)) {
          changeTab(state.tab === "workflows" ? "skills" : "workflows");
          tui.requestRender();
          return;
        }

        if (state.screen === "list" && help(data)) {
          state.screen = "help";
          state.search = false;
          state.query = "";
          state.detail = undefined;
          tui.requestRender();
          return;
        }

        if (state.screen === "list" && about(data)) {
          state.screen = "about";
          state.search = false;
          state.query = "";
          state.detail = undefined;
          tui.requestRender();
          return;
        }

        if (state.screen === "list" && slash(data)) {
          state.search = true;
          state.query = "";
          list().set("");
          tui.requestRender();
          return;
        }

        if (state.screen === "help" || state.screen === "about") {
          return;
        }

        if (state.screen === "list") {
          if (detailToggle(data)) {
            if (state.detail) {
              state.detail = undefined;
              tui.requestRender();
              return;
            }
            refreshDetail();
            tui.requestRender();
            return;
          }
          if (down(data)) {
            list().down();
            if (state.detail) refreshDetail();
            tui.requestRender();
            return;
          }
          if (up(data)) {
            list().up();
            if (state.detail) refreshDetail();
            tui.requestRender();
            return;
          }
          if (enter(data)) {
            if (state.tab === "workflows") {
              const picked = pickWorkflow();
              if (!picked) {
                done({ type: "cancel" });
                return;
              }
              if (!picked.workflow) {
                done({ type: "create-workflow" });
                return;
              }
              state.selectedWorkflow = picked.workflow;
              state.screen = "actions";
              state.detail = detailView(
                picked.workflow.name,
                picked.workflow.description,
                picked.workflow.location,
              );
              tui.requestRender();
              return;
            }
            const picked = pickSkill();
            if (!picked) {
              done({ type: "cancel" });
              return;
            }
            if (!picked.skill) {
              done({ type: "create-skill" });
              return;
            }
            state.selectedSkill = picked.skill;
            state.screen = "actions";
            state.detail = detailView(
              picked.skill.name,
              picked.skill.description,
              picked.skill.location,
            );
            tui.requestRender();
          }
          return;
        }

        if (detailToggle(data)) {
          if (state.detail) {
            state.detail = undefined;
            tui.requestRender();
            return;
          }
          refreshDetail();
          tui.requestRender();
          return;
        }

        if (down(data)) {
          if (state.tab === "workflows") workflowActions.down();
          if (state.tab === "skills") skillActions.down();
          tui.requestRender();
          return;
        }

        if (up(data)) {
          if (state.tab === "workflows") workflowActions.up();
          if (state.tab === "skills") skillActions.up();
          tui.requestRender();
          return;
        }

        if (enter(data)) {
          if (state.tab === "workflows") {
            const selected = state.selectedWorkflow;
            if (!selected) {
              done({ type: "cancel" });
              return;
            }
            const intent = workflowActions.enter();
            if (!intent || intent.type !== "action") {
              done({ type: "cancel" });
              return;
            }
            if (
              intent.name !== "use" &&
              intent.name !== "refine" &&
              intent.name !== "append-to-agents" &&
              intent.name !== "promote-to-skill" &&
              intent.name !== "delete"
            ) {
              done({ type: "cancel" });
              return;
            }
            done({ type: "workflow", action: intent.name, workflow: selected });
            return;
          }

          const selected = state.selectedSkill;
          if (!selected) {
            done({ type: "cancel" });
            return;
          }
          const intent = skillActions.enter();
          if (!intent || intent.type !== "action") {
            done({ type: "cancel" });
            return;
          }
          if (intent.name !== "use" && intent.name !== "refine" && intent.name !== "delete") {
            done({ type: "cancel" });
            return;
          }
          done({ type: "skill", action: intent.name, skill: selected });
        }
      },
    };
  });
}

async function openMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  initial: Tab,
): Promise<void> {
  while (true) {
    const workflowDiscovery = await discoverWorkflows(ctx.cwd);
    const skillDiscovery = await discoverSkills(ctx.cwd);
    const picked = await createPick(
      ctx,
      workflowDiscovery.workflows,
      skillDiscovery.skills,
      initial,
    );
    if (picked.type === "cancel") return;
    if (picked.type === "create-workflow") {
      const extra = await ctx.ui.input("Create workflow", "What should this workflow document?");
      const suffix =
        extra && extra.trim()
          ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>`
          : "";
      pi.sendUserMessage(`${WORKFLOW_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.type === "create-skill") {
      const extra = await ctx.ui.input("Create skill", "What should this skill enable?");
      const suffix =
        extra && extra.trim()
          ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>`
          : "";
      pi.sendUserMessage(`${SKILL_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.type === "skill") {
      if (picked.action === "use") {
        const extra = (await ctx.ui.input("Use skill", "Optional instructions")) ?? "";
        await injectSkillUse(pi, picked.skill, extra);
        return;
      }
      if (picked.action === "refine") {
        pi.sendUserMessage(refineSkillPrompt(picked.skill));
        return;
      }
      const confirmed = await ctx.ui.confirm(
        "Delete skill",
        `Delete skill '${picked.skill.name}'?`,
      );
      if (!confirmed) continue;
      await deleteSkill(picked.skill);
      ctx.ui.notify(`Skill '${picked.skill.name}' deleted`, "info");
      continue;
    }
    if (picked.action === "use") {
      const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
      await injectWorkflowUse(pi, picked.workflow, extra);
      return;
    }
    if (picked.action === "refine")
      return pi.sendUserMessage(refineWorkflowPrompt(picked.workflow));
    if (picked.action === "append-to-agents")
      return pi.sendUserMessage(appendWorkflowAgentsPrompt(picked.workflow));
    if (picked.action === "promote-to-skill") {
      const confirmed = await ctx.ui.confirm(
        "Promote workflow",
        `Promote ${picked.workflow.name} to ~/.pi/agent/skills and remove it from workflows?`,
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

export async function openWorkflowsMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  await openMenu(pi, ctx, "workflows");
}

export async function openSkillsMenu(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): Promise<void> {
  await openMenu(pi, ctx, "skills");
}
