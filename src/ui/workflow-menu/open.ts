import fs from "node:fs";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { create } from "../../../sdk/template.js";
import { createAction } from "../../../sdk/action.js";
import { createDetail } from "../../../sdk/detail.js";
import { createList, type Col } from "../../../sdk/list.js";
import { detailScroll, detailToggle } from "../../../sdk/keybind-logic.js";
import { down, enter, esc, slash, up, back, text } from "../../../sdk/keybinds.js";
import { renderDetail } from "../../../sdk/detail-frame.js";
import { WORKFLOW_CREATE_PROMPT, appendWorkflowAgentsPrompt, refineWorkflowPrompt } from "../../prompts/index.js";
import {
  deleteWorkflow,
  discoverWorkflows,
  injectWorkflowUse,
  promoteWorkflow,
  stripFrontmatter,
} from "../../core/workflow.js";
import type { WorkflowAction, WorkflowDefinition, WorkflowPick } from "../../types/index.js";

type ListItem = {
  key: string;
  name: string;
  description: string;
  workflow: WorkflowDefinition | null;
};

type ActionItem = {
  name: WorkflowAction;
  description: string;
};

function listRows(workflows: WorkflowDefinition[]): ListItem[] {
  return [
    {
      key: "__create__",
      name: "create",
      description: "Create a workflow from this session",
      workflow: null,
    },
    ...workflows.map((workflow) => ({
      key: workflow.name,
      name: workflow.name,
      description: workflow.description,
      workflow,
    })),
  ];
}

function actionRows(): ActionItem[] {
  return [
    { name: "use", description: "Inject workflow for model usage" },
    { name: "refine", description: "Refine workflow content" },
    { name: "append-to-agents", description: "Append workflow in AGENTS.md" },
    { name: "promote-to-skill", description: "Move workflow to ./.pi/skills" },
    { name: "delete", description: "Delete workflow" },
  ];
}

function listCols(): Col<ListItem>[] {
  return [
    { show: true, width: 28, tone: "normal", align: "left", pick: (item) => item.name },
    { show: true, width: 44, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

function actionCols(): Col<ActionItem>[] {
  return [
    { show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.name },
    { show: true, width: 52, tone: "dim", align: "left", pick: (item) => item.description },
  ];
}

function detailBody(workflow: WorkflowDefinition): string[] {
  try {
    const content = fs.readFileSync(workflow.location, "utf-8");
    const body = stripFrontmatter(content).trim();
    if (!body) return ["_No workflow body yet._"];
    return body.split(/\r?\n/);
  } catch {
    return ["_Unable to read workflow file._"];
  }
}

function detailView(workflow: WorkflowDefinition) {
  return createDetail({
    title: workflow.name,
    meta: [workflow.description, workflow.location],
    body: detailBody(workflow),
  });
}

function createPick(ctx: ExtensionCommandContext, workflows: WorkflowDefinition[]): Promise<WorkflowPick> {
  const rows = listRows(workflows);
  const acts = actionRows();
  const list = createList<ListItem>({
    title: `Workflows (${workflows.length})`,
    items: rows,
    shortcuts: "ctrl+x more options • / search • j/k select • enter confirm • esc close",
    tier: "top",
    tab: false,
    search: true,
    prompt: true,
    page: 9,
    find: (item, query) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
    intent: (item) => ({ type: "action", name: `pick:${item.key}` }),
    cols: listCols(),
  });

  const action = createAction<ActionItem>(
    {
      title: "Workflow actions",
      items: acts,
      shortcuts: "j/k select • v toggle preview • J/K scroll preview • enter confirm • esc back",
      page: 9,
      find: (item, query) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query),
      intent: (item) => ({ type: "action", name: item.name }),
      cols: actionCols(),
    },
    "nested",
  );

  return ctx.ui.custom<WorkflowPick>((tui, theme, _keys, done) => {
    const skin = {
      fg: (color: string, value: string) => theme.fg(color as never, value),
    };
    const state = {
      screen: "list" as "list" | "actions",
      prev: "list" as "list" | "actions",
      query: "",
      search: false,
      detail: undefined as ReturnType<typeof createDetail> | undefined,
    };

    const selected = (): ListItem | null => {
      const intent = list.enter();
      if (!intent || intent.type !== "action") return null;
      if (!intent.name.startsWith("pick:")) return null;
      const key = intent.name.slice(5);
      const value = rows.find((item) => item.key === key);
      return value ?? null;
    };

    const refreshDetail = (): void => {
      const item = selected();
      if (!item || !item.workflow) {
        state.detail = undefined;
        return;
      }
      state.detail = detailView(item.workflow);
    };

    return {
      render: (width: number) => {
        const slot = state.screen === "list" ? list.slot() : action.slot();
        const base = create(slot, skin).render(width);
        if (!state.detail || state.screen !== "actions") return base;
        const top = renderDetail(state.detail.slot(), width, base.length, skin);
        return [...top, "", ...base];
      },
      invalidate: () => {},
      handleInput: (data: string) => {
        if (state.search) {
          if (esc(data)) {
            state.search = false;
            state.query = "";
            list.set("");
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
            list.set(state.query);
            tui.requestRender();
            return;
          }
          if (text(data)) {
            state.query += data;
            list.set(state.query);
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

        if (esc(data)) {
          if (state.screen === "actions") {
            state.screen = "list";
            state.detail = undefined;
            tui.requestRender();
            return;
          }
          done({ type: "cancel" });
          return;
        }

        if (state.screen === "list" && slash(data)) {
          state.search = true;
          state.query = "";
          list.set("");
          tui.requestRender();
          return;
        }

        if (state.screen === "list") {
          if (down(data)) {
            list.down();
            tui.requestRender();
            return;
          }
          if (up(data)) {
            list.up();
            tui.requestRender();
            return;
          }
          if (enter(data)) {
            const item = selected();
            if (!item) {
              done({ type: "cancel" });
              return;
            }
            if (!item.workflow) {
              done({ type: "create" });
              return;
            }
            state.prev = "list";
            state.screen = "actions";
            state.detail = detailView(item.workflow);
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
          action.down();
          refreshDetail();
          tui.requestRender();
          return;
        }

        if (up(data)) {
          action.up();
          refreshDetail();
          tui.requestRender();
          return;
        }

        if (enter(data)) {
          const chosen = selected();
          if (!chosen || !chosen.workflow) {
            done({ type: "cancel" });
            return;
          }
          const intent = action.enter();
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
          done({ type: "action", action: intent.name, workflow: chosen.workflow });
        }
      },
    };
  });
}

export async function openWorkflowsMenu(pi: ExtensionAPI, ctx: ExtensionCommandContext): Promise<void> {
  while (true) {
    const discovery = await discoverWorkflows(ctx.cwd);
    const picked = await createPick(ctx, discovery.workflows);
    if (picked.type === "cancel") return;
    if (picked.type === "create") {
      const extra = await ctx.ui.input("Create workflow", "What should this workflow document?");
      const suffix = extra && extra.trim() ? `\n\n<user_instructions>\n${extra.trim()}\n</user_instructions>` : "";
      pi.sendUserMessage(`${WORKFLOW_CREATE_PROMPT}${suffix}`);
      return;
    }
    if (picked.action === "use") {
      const extra = (await ctx.ui.input("Use workflow", "Optional instructions")) ?? "";
      await injectWorkflowUse(pi, picked.workflow, extra);
      return;
    }
    if (picked.action === "refine") return pi.sendUserMessage(refineWorkflowPrompt(picked.workflow));
    if (picked.action === "append-to-agents") return pi.sendUserMessage(appendWorkflowAgentsPrompt(picked.workflow));
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
    const confirmed = await ctx.ui.confirm("Delete workflow", `Delete workflow '${picked.workflow.name}'?`);
    if (!confirmed) continue;
    await deleteWorkflow(picked.workflow);
    ctx.ui.notify(`Workflow '${picked.workflow.name}' deleted`, "info");
  }
}
