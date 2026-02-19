import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import { SelectList, Spacer, Text, type SelectItem } from "@mariozechner/pi-tui";

import { workflowRefs } from "../../core/workflow.js";
import { WorkflowActionPanel, WorkflowDetailPanel } from "../workflow-panels.js";
import type { WorkflowMenuComponent } from "./component.js";

function items(menu: WorkflowMenuComponent): SelectItem[] {
  if (menu.mode === "workflows") {
    return [
      { value: "__create__", label: "Create new workflow...", description: "Create a workflow manually" },
      ...menu.workflows.map((workflow) => ({
        value: workflow.name,
        label: workflow.name,
        description: workflow.description,
      })),
    ];
  }
  return [
    { value: "use", label: "use", description: "Inject workflow body and user instructions" },
    { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality" },
    { value: "append-to-agents", label: "append-to-agents", description: "Append workflow to AGENTS.md safely" },
    { value: "promote-to-skill", label: "promote-to-skill", description: "Move workflow into ./.pi/skills" },
    { value: "delete", label: "delete", description: "Delete workflow" },
  ];
}

export function clearLeader(menu: WorkflowMenuComponent): void {
  if (menu.leaderTimer) clearTimeout(menu.leaderTimer);
  menu.leaderTimer = null;
  menu.leaderActive = false;
  if (menu.mode === "actions" && menu.action) {
    menu.action.setFooter("Enter confirm • Esc close • v toggle preview • J/K scroll preview • Ctrl+X more options");
  }
  redraw(menu);
}

export function startLeader(menu: WorkflowMenuComponent): void {
  if (menu.leaderActive) return clearLeader(menu);
  menu.leaderActive = true;
  if (menu.mode === "actions" && menu.action) {
    menu.action.setFooter("More options: u use • r refine • a append • p promote • d delete", "warning");
  }
  if (menu.leaderTimer) clearTimeout(menu.leaderTimer);
  menu.leaderTimer = setTimeout(() => clearLeader(menu), 2000);
  redraw(menu);
}

export function startSearch(menu: WorkflowMenuComponent): void {
  if (menu.mode !== "workflows") return;
  menu.searchActive = true;
  menu.search.focused = true;
  redraw(menu);
}

export function confirm(menu: WorkflowMenuComponent, value: string): void {
  if (menu.mode === "workflows") {
    if (value === "__create__") return menu.done({ type: "create" });
    const workflow = menu.workflows.find((item) => item.name === value);
    if (!workflow) return menu.done({ type: "cancel" });
    menu.current = workflow;
    menu.mode = "actions";
    menu.preview = true;
    menu.searchActive = false;
    menu.search.focused = false;
    redraw(menu);
    return;
  }
  const workflow = menu.current;
  if (!workflow) return menu.done({ type: "cancel" });
  if (
    value !== "use" &&
    value !== "refine" &&
    value !== "append-to-agents" &&
    value !== "promote-to-skill" &&
    value !== "delete"
  ) return menu.done({ type: "cancel" });
  menu.done({ type: "action", action: value, workflow });
}

export function cancel(menu: WorkflowMenuComponent): void {
  if (menu.searchActive) {
    menu.searchActive = false;
    menu.search.focused = false;
    menu.search.setValue("");
    redraw(menu);
    return;
  }
  if (menu.mode === "actions") {
    menu.mode = "workflows";
    menu.current = null;
    redraw(menu);
    return;
  }
  menu.done({ type: "cancel" });
}

export function leaderRun(menu: WorkflowMenuComponent, data: string): boolean {
  if (menu.mode === "workflows") {
    if (data === "c" || data === "C") return menu.done({ type: "create" }), clearLeader(menu), true;
    if (data === "w" || data === "W") return confirm(menu, menu.selected), clearLeader(menu), true;
    clearLeader(menu);
    return false;
  }
  if (data === "u" || data === "U") return confirm(menu, "use"), clearLeader(menu), true;
  if (data === "r" || data === "R") return confirm(menu, "refine"), clearLeader(menu), true;
  if (data === "a" || data === "A") return confirm(menu, "append-to-agents"), clearLeader(menu), true;
  if (data === "p" || data === "P") return confirm(menu, "promote-to-skill"), clearLeader(menu), true;
  if (data === "d" || data === "D") return confirm(menu, "delete"), clearLeader(menu), true;
  clearLeader(menu);
  return false;
}

export function redraw(menu: WorkflowMenuComponent): void {
  const title = menu.mode === "workflows" ? menu.theme.fg("accent", menu.theme.bold(`Workflows (${menu.workflows.length})`)) : "";
  menu.header.setText(title);
  if (menu.leaderActive) {
    menu.hint.setText(
      menu.theme.fg("warning", menu.mode === "workflows" ? "More options: c create • w open actions" : "More options: u use • r refine • a append • p promote • d delete"),
    );
  }
  if (!menu.leaderActive) {
    menu.hint.setText(
      menu.mode === "workflows"
        ? menu.theme.fg("dim", "Press / to search • ↑↓ or j/k select • Enter view • Ctrl+X more options • Esc close")
        : menu.theme.fg("dim", "Enter confirm • Esc close • ↑↓ or j/k navigate • v toggle preview • J/K scroll preview • Ctrl+X more options"),
    );
  }
  menu.search.focused = menu.searchActive;
  if (menu.mode === "actions") menu.search.setValue("");
  menu.searchWrap.clear();
  menu.hintWrap.clear();
  if (menu.mode === "workflows") {
    menu.searchWrap.addChild(menu.search);
    menu.hintWrap.addChild(menu.hint);
  }
  const list = items(menu);
  menu.select = new SelectList(list, 9, {
    selectedPrefix: (text) => menu.theme.fg("accent", text),
    selectedText: (text) => menu.theme.fg("accent", text),
    description: (text) => menu.theme.fg("muted", text),
    scrollInfo: (text) => menu.theme.fg("dim", text),
    noMatch: (text) => menu.theme.fg("warning", text),
  });
  menu.select.onSelectionChange = (item) => {
    menu.selected = item.value;
  };
  menu.select.onSelect = (item) => confirm(menu, item.value);
  menu.select.onCancel = () => cancel(menu);
  if (menu.mode === "workflows") menu.select.setFilter(menu.search.getValue());
  menu.list.clear();
  menu.action = null;
  menu.detail = null;
  if (menu.mode === "actions" && menu.current) {
    const refs = workflowRefs(menu.cwd, menu.current);
    menu.detail = new WorkflowDetailPanel(menu.theme as Theme, {
      name: menu.current.name,
      description: menu.current.description,
      references: refs,
      location: menu.current.location,
    });
    menu.action = new WorkflowActionPanel(menu.theme as Theme, menu.current.name, (value) => confirm(menu, value), () => cancel(menu));
    if (menu.leaderActive) menu.action.setFooter("More options: u use • r refine • a append • p promote • d delete", "warning");
    if (menu.preview) menu.list.addChild(menu.detail);
    menu.list.addChild(menu.action);
    layout(menu);
    menu.tui.requestRender();
    return;
  }
  menu.list.addChild(menu.select);
  for (let index = list.length; index < 9; index += 1) menu.list.addChild(new Text("⠀", 0, 0));
  layout(menu);
  menu.tui.requestRender();
}

export function layout(menu: WorkflowMenuComponent): void {
  menu.clear();
  menu.addChild(new DynamicBorder((text: string) => menu.theme.fg("accent", text)));
  menu.addChild(new Spacer(1));
  menu.addChild(menu.header);
  menu.addChild(new Spacer(1));
  menu.addChild(menu.searchWrap);
  menu.addChild(new Spacer(1));
  menu.addChild(menu.list);
  if (menu.mode === "workflows") {
    menu.addChild(new Spacer(1));
    menu.addChild(menu.hintWrap);
    menu.addChild(new Spacer(1));
  }
  menu.addChild(new DynamicBorder((text: string) => menu.theme.fg("accent", text)));
}
