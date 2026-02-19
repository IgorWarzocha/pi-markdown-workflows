import { Text } from "@mariozechner/pi-tui";

import type { WorkflowMenuComponent } from "./component.js";
import { layoutShell } from "./layout-shell.js";
import { layoutWorkflows } from "./layout-workflows.js";
import { layoutActions } from "./layout-actions.js";

export function clearLeader(menu: WorkflowMenuComponent): void {
  if (menu.leaderTimer) clearTimeout(menu.leaderTimer);
  menu.leaderTimer = null;
  menu.leaderActive = false;
  redraw(menu);
}

export function startLeader(menu: WorkflowMenuComponent): void {
  if (menu.leaderActive) return clearLeader(menu);
  menu.leaderActive = true;
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
  const title =
    menu.mode === "workflows"
      ? menu.theme.fg("accent", menu.theme.bold(`Workflows (${menu.workflows.length})`))
      : "⠀";
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
  }
  if (menu.mode === "actions") {
    menu.searchWrap.addChild(new Text("⠀", 1, 0));
  }
  menu.hintWrap.addChild(menu.hint);
  if (menu.mode === "actions" && menu.current) {
    layoutActions(menu, (value) => confirm(menu, value), () => cancel(menu), () => layout(menu));
    return;
  }
  layoutWorkflows(menu, (value) => confirm(menu, value), () => cancel(menu), () => layout(menu));
}

export function layout(menu: WorkflowMenuComponent): void {
  layoutShell(menu);
}
