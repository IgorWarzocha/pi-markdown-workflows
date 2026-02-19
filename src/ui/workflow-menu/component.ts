import { DynamicBorder, type Theme } from "@mariozechner/pi-coding-agent";
import {
  Container,
  Input,
  Key,
  SelectList,
  Spacer,
  Text,
  getEditorKeybindings,
  matchesKey,
  type SelectItem,
} from "@mariozechner/pi-tui";

import { workflowRefs } from "../../core/workflow.js";
import type { WorkflowDefinition, WorkflowPick } from "../../types/index.js";
import { WorkflowActionPanel, WorkflowDetailPanel } from "../workflow-panels.js";

export class WorkflowMenuComponent extends Container {
  private tui: { requestRender: () => void };
  private theme: Theme;
  private workflows: WorkflowDefinition[];
  private header: Text;
  private hint: Text;
  private hintWrap: Container;
  private list: Container;
  private searchWrap: Container;
  private search: Input;
  private select: SelectList;
  private mode: "workflows" | "actions";
  private current: WorkflowDefinition | null;
  private action: WorkflowActionPanel | null;
  private detail: WorkflowDetailPanel | null;
  private preview: boolean;
  private done: (value: WorkflowPick) => void;
  private cwd: string;
  private searchActive: boolean;
  private leaderActive: boolean;
  private leaderTimer: ReturnType<typeof setTimeout> | null;
  private selected: string;

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
    this.redraw();
  }

  private clearLeader(): void {
    if (this.leaderTimer) clearTimeout(this.leaderTimer);
    this.leaderTimer = null;
    this.leaderActive = false;
    if (this.mode === "actions" && this.action) {
      this.action.setFooter(
        "Enter confirm • Esc close • v toggle preview • J/K scroll preview • Ctrl+X more options",
      );
    }
    this.redraw();
  }

  private startLeader(): void {
    if (this.leaderActive) return this.clearLeader();
    this.leaderActive = true;
    if (this.mode === "actions" && this.action) {
      this.action.setFooter(
        "More options: u use • r refine • a append • p promote • d delete",
        "warning",
      );
    }
    if (this.leaderTimer) clearTimeout(this.leaderTimer);
    this.leaderTimer = setTimeout(() => this.clearLeader(), 2000);
    this.redraw();
  }

  private startSearch(): void {
    if (this.mode !== "workflows") return;
    this.searchActive = true;
    this.search.focused = true;
    this.redraw();
  }

  private redraw(): void {
    const title =
      this.mode === "workflows"
        ? this.theme.fg("accent", this.theme.bold(`Workflows (${this.workflows.length})`))
        : "";
    this.header.setText(title);
    if (this.leaderActive) {
      this.hint.setText(
        this.theme.fg(
          "warning",
          this.mode === "workflows"
            ? "More options: c create • w open actions"
            : "More options: u use • r refine • a append • p promote • d delete",
        ),
      );
    }
    if (!this.leaderActive) {
      this.hint.setText(
        this.mode === "workflows"
          ? this.theme.fg(
              "dim",
              "Press / to search • ↑↓ or j/k select • Enter view • Ctrl+X more options • Esc close",
            )
          : this.theme.fg(
              "dim",
              "Enter confirm • Esc close • ↑↓ or j/k navigate • v toggle preview • J/K scroll preview • Ctrl+X more options",
            ),
      );
    }
    this.search.focused = this.searchActive;
    if (this.mode === "actions") this.search.setValue("");
    this.searchWrap.clear();
    this.hintWrap.clear();
    if (this.mode === "workflows") {
      this.searchWrap.addChild(this.search);
      this.hintWrap.addChild(this.hint);
    }
    const items: SelectItem[] =
      this.mode === "workflows"
        ? [
            { value: "__create__", label: "Create new workflow...", description: "Create a workflow manually" },
            ...this.workflows.map((workflow) => ({
              value: workflow.name,
              label: workflow.name,
              description: workflow.description,
            })),
          ]
        : [
            { value: "use", label: "use", description: "Inject workflow body and user instructions" },
            { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality" },
            { value: "append-to-agents", label: "append-to-agents", description: "Append workflow to AGENTS.md safely" },
            { value: "promote-to-skill", label: "promote-to-skill", description: "Move workflow into ./.pi/skills" },
            { value: "delete", label: "delete", description: "Delete workflow" },
          ];
    this.select = new SelectList(items, 9, {
      selectedPrefix: (text) => this.theme.fg("accent", text),
      selectedText: (text) => this.theme.fg("accent", text),
      description: (text) => this.theme.fg("muted", text),
      scrollInfo: (text) => this.theme.fg("dim", text),
      noMatch: (text) => this.theme.fg("warning", text),
    });
    this.select.onSelectionChange = (item) => {
      this.selected = item.value;
    };
    this.select.onSelect = (item) => this.confirm(item.value);
    this.select.onCancel = () => this.cancel();
    if (this.mode === "workflows") this.select.setFilter(this.search.getValue());
    this.list.clear();
    this.action = null;
    this.detail = null;
    if (this.mode === "actions" && this.current) {
      const refs = workflowRefs(this.cwd, this.current);
      this.detail = new WorkflowDetailPanel(this.theme, {
        name: this.current.name,
        description: this.current.description,
        references: refs,
        location: this.current.location,
      });
      this.action = new WorkflowActionPanel(this.theme, this.current.name, (value) => this.confirm(value), () => this.cancel());
      if (this.leaderActive) this.action.setFooter("More options: u use • r refine • a append • p promote • d delete", "warning");
      if (this.preview) this.list.addChild(this.detail);
      this.list.addChild(this.action);
      this.layout();
      this.tui.requestRender();
      return;
    }
    this.list.addChild(this.select);
    for (let index = items.length; index < 9; index += 1) this.list.addChild(new Text("⠀", 0, 0));
    this.layout();
    this.tui.requestRender();
  }

  private layout(): void {
    this.clear();
    this.addChild(new DynamicBorder((text: string) => this.theme.fg("accent", text)));
    this.addChild(new Spacer(1));
    this.addChild(this.header);
    this.addChild(new Spacer(1));
    this.addChild(this.searchWrap);
    this.addChild(new Spacer(1));
    this.addChild(this.list);
    if (this.mode === "workflows") {
      this.addChild(new Spacer(1));
      this.addChild(this.hintWrap);
      this.addChild(new Spacer(1));
    }
    this.addChild(new DynamicBorder((text: string) => this.theme.fg("accent", text)));
  }

  private leaderRun(data: string): boolean {
    if (this.mode === "workflows") {
      if (data === "c" || data === "C") return this.done({ type: "create" }), this.clearLeader(), true;
      if (data === "w" || data === "W") return this.confirm(this.selected), this.clearLeader(), true;
      this.clearLeader();
      return false;
    }
    if (data === "u" || data === "U") return this.confirm("use"), this.clearLeader(), true;
    if (data === "r" || data === "R") return this.confirm("refine"), this.clearLeader(), true;
    if (data === "a" || data === "A") return this.confirm("append-to-agents"), this.clearLeader(), true;
    if (data === "p" || data === "P") return this.confirm("promote-to-skill"), this.clearLeader(), true;
    if (data === "d" || data === "D") return this.confirm("delete"), this.clearLeader(), true;
    this.clearLeader();
    return false;
  }

  private confirm(value: string): void {
    if (this.mode === "workflows") {
      if (value === "__create__") return this.done({ type: "create" });
      const workflow = this.workflows.find((item) => item.name === value);
      if (!workflow) return this.done({ type: "cancel" });
      this.current = workflow;
      this.mode = "actions";
      this.preview = true;
      this.searchActive = false;
      this.search.focused = false;
      this.redraw();
      return;
    }
    const workflow = this.current;
    if (!workflow) return this.done({ type: "cancel" });
    if (
      value !== "use" &&
      value !== "refine" &&
      value !== "append-to-agents" &&
      value !== "promote-to-skill" &&
      value !== "delete"
    ) return this.done({ type: "cancel" });
    this.done({ type: "action", action: value, workflow });
  }

  private cancel(): void {
    if (this.searchActive) {
      this.searchActive = false;
      this.search.focused = false;
      this.search.setValue("");
      this.redraw();
      return;
    }
    if (this.mode === "actions") {
      this.mode = "workflows";
      this.current = null;
      this.redraw();
      return;
    }
    this.done({ type: "cancel" });
  }

  handleInput(data: string): void {
    if (this.searchActive) {
      const key = getEditorKeybindings();
      if (key.matches(data, "selectConfirm")) return (this.searchActive = false), (this.search.focused = false), this.redraw();
      if (key.matches(data, "selectCancel")) return (this.searchActive = false), (this.search.focused = false), this.search.setValue(""), this.redraw();
      if (key.matches(data, "selectUp") || key.matches(data, "selectDown")) return;
      this.search.handleInput(data);
      this.redraw();
      return;
    }
    if (data === "\u0018" || matchesKey(data, Key.ctrl("x"))) return this.startLeader();
    if (this.leaderActive && this.leaderRun(data)) return;
    if (data === "/") return this.startSearch();
    if (data === "j") {
      if (this.mode === "actions" && this.action) return this.action.handleInput("\u001b[B");
      return this.select.handleInput("\u001b[B");
    }
    if (data === "k") {
      if (this.mode === "actions" && this.action) return this.action.handleInput("\u001b[A");
      return this.select.handleInput("\u001b[A");
    }
    if (this.mode === "actions" && (data === "v" || data === "V")) return (this.preview = !this.preview), this.redraw();
    if (this.mode === "actions" && this.detail && (data === "w" || data === "W" || data === "J")) return this.detail.scrollBy(-1), this.tui.requestRender();
    if (this.mode === "actions" && this.detail && (data === "s" || data === "S" || data === "K")) return this.detail.scrollBy(1), this.tui.requestRender();
    if (this.mode === "actions" && this.action) return this.action.handleInput(data);
    this.select.handleInput(data);
  }
}
