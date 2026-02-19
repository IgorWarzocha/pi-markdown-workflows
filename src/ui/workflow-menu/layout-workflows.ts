import { Text } from "@mariozechner/pi-tui";

import type { WorkflowMenuComponent } from "./component.js";
import { buildSelect, workflowItems } from "./items.js";

export function layoutWorkflows(
  menu: WorkflowMenuComponent,
  onConfirm: (value: string) => void,
  onCancel: () => void,
  onLayout: () => void,
): void {
  const list = workflowItems(menu);
  menu.select = buildSelect(menu, list);
  menu.select.onSelectionChange = (item) => {
    menu.selected = item.value;
  };
  menu.select.onSelect = (item) => onConfirm(item.value);
  menu.select.onCancel = onCancel;
  menu.select.setFilter(menu.search.getValue());
  menu.list.clear();
  menu.action = null;
  menu.detail = null;
  menu.list.addChild(menu.select);
  for (let index = list.length; index < 9; index += 1) menu.list.addChild(new Text("⠀", 0, 0));
  onLayout();
  menu.tui.requestRender();
}
