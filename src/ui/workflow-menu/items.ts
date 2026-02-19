import { SelectList, type SelectItem } from "@mariozechner/pi-tui";

import type { WorkflowMenuComponent } from "./component.js";

export function workflowItems(menu: WorkflowMenuComponent): SelectItem[] {
  return [
    { value: "__create__", label: "Create new workflow...", description: "Create a workflow manually" },
    ...menu.workflows.map((workflow) => ({
      value: workflow.name,
      label: workflow.name,
      description: workflow.description,
    })),
  ];
}

export function actionItems(): SelectItem[] {
  return [
    { value: "use", label: "use", description: "Inject workflow body and user instructions" },
    { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality" },
    { value: "append-to-agents", label: "append-to-agents", description: "Append workflow to AGENTS.md safely" },
    { value: "promote-to-skill", label: "promote-to-skill", description: "Move workflow into ./.pi/skills" },
    { value: "delete", label: "delete", description: "Delete workflow" },
  ];
}

export function buildSelect(menu: WorkflowMenuComponent, list: SelectItem[]): SelectList {
  return new SelectList(list, 9, {
    selectedPrefix: (text) => menu.theme.fg("accent", text),
    selectedText: (text) => menu.theme.fg("accent", text),
    description: (text) => menu.theme.fg("muted", text),
    scrollInfo: (text) => menu.theme.fg("dim", text),
    noMatch: (text) => menu.theme.fg("warning", text),
  });
}
