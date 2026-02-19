import { Container, Input, SelectList, Text } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

import type { WorkflowDefinition, WorkflowPick } from "../../types/index.js";
import type { WorkflowActionPanel, WorkflowDetailPanel } from "../workflow-panels.js";
import { handleInput } from "./input.js";
import { redraw } from "./ui.js";

export class WorkflowMenuComponent extends Container {
  tui: { requestRender: () => void };
  theme: Theme;
  workflows: WorkflowDefinition[];
  header: Text;
  hint: Text;
  hintWrap: Container;
  list: Container;
  searchWrap: Container;
  search: Input;
  select: SelectList;
  mode: "workflows" | "actions";
  current: WorkflowDefinition | null;
  action: WorkflowActionPanel | null;
  detail: WorkflowDetailPanel | null;
  preview: boolean;
  done: (value: WorkflowPick) => void;
  cwd: string;
  searchActive: boolean;
  leaderActive: boolean;
  leaderTimer: ReturnType<typeof setTimeout> | null;
  selected: string;

  constructor(
    tui: { requestRender: () => void },
    theme: Theme,
    workflows: WorkflowDefinition[],
    cwd: string,
    done: (value: WorkflowPick) => void,
  ) {
    super();
    this.tui = tui;
    this.theme = theme;
    this.workflows = workflows;
    this.mode = "workflows";
    this.current = null;
    this.action = null;
    this.detail = null;
    this.done = done;
    this.cwd = cwd;
    this.searchActive = false;
    this.preview = true;
    this.leaderActive = false;
    this.leaderTimer = null;
    this.selected = "__create__";
    this.header = new Text("", 1, 0);
    this.hint = new Text("", 1, 0);
    this.hintWrap = new Container();
    this.list = new Container();
    this.searchWrap = new Container();
    this.search = new Input();
    this.search.setValue("");
    this.search.focused = false;
    this.select = new SelectList([], 9, {
      selectedPrefix: (text) => this.theme.fg("accent", text),
      selectedText: (text) => this.theme.fg("accent", text),
      description: (text) => this.theme.fg("muted", text),
      scrollInfo: (text) => this.theme.fg("dim", text),
      noMatch: (text) => this.theme.fg("warning", text),
    });
    redraw(this);
  }

  handleInput(data: string): void {
    handleInput(this, data);
  }
}
