import fs from "node:fs";
import { DynamicBorder, getMarkdownTheme, type Theme } from "@mariozechner/pi-coding-agent";
import {
  Container,
  Markdown,
  SelectList,
  Text,
  truncateToWidth,
  visibleWidth,
  type SelectItem,
} from "@mariozechner/pi-tui";

export type WorkflowPanelInput = {
  name: string;
  description: string;
  references: string[];
  location: string;
};

function stripFrontmatter(body: string): string {
  const match = body.match(/^---\n[\s\S]+?\n---\s*\n?/);
  if (!match) return body;
  return body.slice(match[0].length);
}

export class WorkflowDetailPanel extends Container {
  private theme: Theme;
  private input: WorkflowPanelInput;
  private markdown: Markdown;
  private scrollOffset: number;
  private viewHeight: number;
  private totalLines: number;

  constructor(theme: Theme, input: WorkflowPanelInput) {
    super();
    this.theme = theme;
    this.input = input;
    this.scrollOffset = 0;
    this.viewHeight = 0;
    this.totalLines = 0;
    this.markdown = new Markdown(this.markdownText(), 1, 0, getMarkdownTheme());
  }

  private markdownText(): string {
    let content = "";
    try {
      content = fs.readFileSync(this.input.location, "utf-8");
    } catch {
      return "_Unable to read workflow file._";
    }
    const body = stripFrontmatter(content).trim();
    if (body) return body;
    return "_No workflow body yet._";
  }

  private wrap(value: string, width: number): string[] {
    if (width <= 1) return [value];
    const words = value.split(/\s+/).filter((item) => item.length > 0);
    if (!words.length) return [""];
    const lines: string[] = [];
    let line = "";
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      const next = line ? `${line} ${word}` : word;
      if (visibleWidth(next) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = word;
    }
    if (line) lines.push(line);
    return lines;
  }

  private title(width: number): string {
    const text = ` ${this.input.name} `;
    const textWidth = visibleWidth(text);
    const left = Math.max(0, Math.floor((width - textWidth) / 2));
    const right = Math.max(0, width - textWidth - left);
    return (
      this.theme.fg("borderMuted", "─".repeat(left)) +
      this.theme.fg("accent", text) +
      this.theme.fg("borderMuted", "─".repeat(right))
    );
  }

  scrollBy(delta: number): void {
    const maxScroll = Math.max(0, this.totalLines - this.viewHeight);
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, maxScroll));
  }

  override invalidate(): void {
    this.markdown = new Markdown(this.markdownText(), 1, 0, getMarkdownTheme());
  }

  override render(width: number): string[] {
    const inner = Math.max(20, width - 2);
    const markdownLines = this.markdown.render(inner);
    const refs: string[] = [];
    refs.push(this.theme.fg("accent", `Related AGENTS.md (${this.input.references.length})`));
    if (!this.input.references.length) {
      refs.push(this.theme.fg("dim", "No AGENTS.md files matched name + path."));
    }
    for (const ref of this.input.references.slice(0, 5)) {
      const lines = this.wrap(`- ${ref}`, inner);
      for (const line of lines) refs.push(this.theme.fg("muted", line));
    }
    if (this.input.references.length > 5) {
      refs.push(this.theme.fg("dim", `... +${this.input.references.length - 5} more`));
    }
    const head: string[] = [];
    head.push(this.title(inner));
    head.push(this.theme.fg("muted", "workflow"));
    head.push(this.theme.fg("muted", this.input.location));
    head.push("");
    const body = [...refs, "", ...markdownLines];
    const border = 2;
    const fixed = head.length + border;
    const target = Math.max(8, Math.floor(((process.stdout.rows as number | undefined) || 24) * 0.4));
    const contentHeight = Math.max(4, target - fixed);
    this.totalLines = body.length;
    this.viewHeight = contentHeight;
    const maxScroll = Math.max(0, this.totalLines - this.viewHeight);
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScroll));
    const shown = body.slice(this.scrollOffset, this.scrollOffset + this.viewHeight);
    const lines = [...head, ...shown];
    while (lines.length < head.length + this.viewHeight) lines.push("");
    const top = this.theme.fg("borderMuted", `┌${"─".repeat(inner)}┐`);
    const bottom = this.theme.fg("borderMuted", `└${"─".repeat(inner)}┘`);
    const framed = lines.map((line) => {
      const cut = truncateToWidth(line, inner);
      const pad = Math.max(0, inner - visibleWidth(cut));
      return this.theme.fg("borderMuted", "│") + cut + " ".repeat(pad) + this.theme.fg("borderMuted", "│");
    });
    return [top, ...framed, bottom].map((line) => truncateToWidth(line, width));
  }
}

export class WorkflowActionPanel extends Container {
  private list: SelectList;

  constructor(theme: Theme, title: string, onSelect: (value: string) => void, onCancel: () => void) {
    super();
    const items: SelectItem[] = [
      { value: "use", label: "use", description: "Inject workflow body and user instructions" },
      { value: "refine", label: "refine", description: "Refine workflow with XML + RFC quality" },
      {
        value: "append-to-agents",
        label: "append-to-agents",
        description: "Append workflow to AGENTS.md safely",
      },
      {
        value: "promote-to-skill",
        label: "promote-to-skill",
        description: "Move workflow into ./.pi/skills",
      },
      { value: "delete", label: "delete", description: "Delete workflow" },
    ];
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
    this.addChild(new Text(theme.fg("accent", theme.bold(`Actions for \"${title}\"`)), 1, 0));
    this.list = new SelectList(items, 10, {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });
    this.list.onSelect = (item) => onSelect(item.value);
    this.list.onCancel = onCancel;
    this.addChild(this.list);
    for (let index = items.length; index < 10; index += 1) {
      this.addChild(new Text("⠀", 0, 0));
    }
    this.addChild(new Text(theme.fg("dim", "Enter confirm • Esc close • v toggle preview • J/K scroll preview • Ctrl+X more options"), 1, 0));
    this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
  }

  handleInput(data: string): void {
    this.list.handleInput(data);
  }
}
