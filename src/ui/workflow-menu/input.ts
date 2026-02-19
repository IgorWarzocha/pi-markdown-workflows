import { Key, getEditorKeybindings, matchesKey } from "@mariozechner/pi-tui";

import type { WorkflowMenuComponent } from "./component.js";
import { leaderRun, redraw, startLeader, startSearch } from "./view.js";

export function handleInput(menu: WorkflowMenuComponent, data: string): void {
  if (menu.searchActive) {
    const key = getEditorKeybindings();
    if (key.matches(data, "selectConfirm")) return (menu.searchActive = false), (menu.search.focused = false), redraw(menu);
    if (key.matches(data, "selectCancel")) return (menu.searchActive = false), (menu.search.focused = false), menu.search.setValue(""), redraw(menu);
    if (key.matches(data, "selectUp") || key.matches(data, "selectDown")) return;
    menu.search.handleInput(data);
    redraw(menu);
    return;
  }
  if (data === "\u0018" || matchesKey(data, Key.ctrl("x"))) return startLeader(menu);
  if (menu.leaderActive && leaderRun(menu, data)) return;
  if (data === "/") return startSearch(menu);
  if (data === "j") {
    if (menu.mode === "actions" && menu.action) return menu.action.handleInput("\u001b[B");
    return menu.select.handleInput("\u001b[B");
  }
  if (data === "k") {
    if (menu.mode === "actions" && menu.action) return menu.action.handleInput("\u001b[A");
    return menu.select.handleInput("\u001b[A");
  }
  if (menu.mode === "actions" && (data === "v" || data === "V")) return (menu.preview = !menu.preview), redraw(menu);
  if (menu.mode === "actions" && menu.detail && (data === "w" || data === "W" || data === "J")) return menu.detail.scrollBy(-1), menu.tui.requestRender();
  if (menu.mode === "actions" && menu.detail && (data === "s" || data === "S" || data === "K")) return menu.detail.scrollBy(1), menu.tui.requestRender();
  if (menu.mode === "actions" && menu.action) return menu.action.handleInput(data);
  menu.select.handleInput(data);
}
