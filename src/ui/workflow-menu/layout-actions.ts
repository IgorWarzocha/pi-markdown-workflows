import { workflowRefs } from "../../core/workflow.js";
import { WorkflowActionPanel, WorkflowDetailPanel } from "../workflow-panels.js";
import type { WorkflowMenuComponent } from "./component.js";

export function layoutActions(
  menu: WorkflowMenuComponent,
  onConfirm: (value: string) => void,
  onCancel: () => void,
  onLayout: () => void,
): void {
  if (!menu.current) return;
  const refs = workflowRefs(menu.cwd, menu.current);
  menu.list.clear();
  menu.detail = new WorkflowDetailPanel(menu.theme, {
    name: menu.current.name,
    description: menu.current.description,
    references: refs,
    location: menu.current.location,
  });
  menu.action = new WorkflowActionPanel(menu.theme, menu.current.name, (value) => onConfirm(value), onCancel);
  if (menu.leaderActive) menu.action.setFooter("More options: u use • r refine • a append • p promote • d delete", "warning");
  if (menu.preview) menu.list.addChild(menu.detail);
  menu.list.addChild(menu.action);
  onLayout();
  menu.tui.requestRender();
}
