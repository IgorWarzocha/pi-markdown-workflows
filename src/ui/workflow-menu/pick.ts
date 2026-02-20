import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

import { createAction } from "../../../sdk/action.js";
import { create } from "../../../sdk/template.js";
import { createList } from "../../../sdk/list.js";
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
import type { SkillDefinition, WorkflowDefinition, WorkflowPick } from "../../types/index.js";
import {
  aboutView,
  createFinder,
  detailView,
  helpView,
  listCols,
  openRepository,
  skillActionCols,
  skillActionRows,
  skillRows,
  workflowActionCols,
  workflowActionRows,
  workflowRows,
  type SkillListItem,
  type Tab,
  type WorkflowListItem,
} from "./view.js";

export function createPick(
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

  const workflowActions = createAction(
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

  const skillActions = createAction(
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
    const skin = { fg: (color: string, value: string) => theme.fg(color as never, value) };
    const state = {
      tab: initial,
      screen: "list" as "list" | "actions" | "help" | "about",
      search: false,
      query: "",
      detail: undefined as ReturnType<typeof detailView> | undefined,
      selectedWorkflow: undefined as WorkflowDefinition | undefined,
      selectedSkill: undefined as SkillDefinition | undefined,
    };

    const list = () => (state.tab === "workflows" ? workflowList : skillList);
    const pickWorkflow = createFinder(workflowList, workflowItems, "workflow:");
    const pickSkill = createFinder(skillList, skillItems, "skill:");

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

    const change = (next: Tab): void => {
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
          change(state.tab === "workflows" ? "skills" : "workflows");
          tui.requestRender();
          return;
        }

        if (state.screen === "list" && backtab(data)) {
          change(state.tab === "workflows" ? "skills" : "workflows");
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

        if (state.screen === "help" || state.screen === "about") return;

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
