import { truncateToWidth } from "@mariozechner/pi-tui";

export type Tier = "top" | "nested";
export type Tone = "normal" | "dim" | "accent";
export type Cell = { text: string; tone: Tone };
export type Line = { cells: Cell[] };

// Slot is the render contract that all primitives MUST provide.
export type Slot = {
  title: string;
  content: Line[];
  shortcuts: string;
  active: number[];
  tier: Tier;
  tab: boolean;
};

type Theme = { fg: (color: string, text: string) => string };

const size = 15;

// cut ensures every rendered row stays inside the available width.
function cut(value: string, width: number): string {
  return truncateToWidth(value, Math.max(0, width));
}

// sep renders the standard panel separator line.
function sep(width: number, theme: Theme): string {
  return cut(theme.fg("accent", "─".repeat(Math.max(0, width))), width);
}

// blank renders an empty line with fixed width.
function blank(width: number): string {
  return " ".repeat(Math.max(0, width));
}

// foot appends tier-specific helper hints to the panel footer.
function foot(slot: Slot): string {
  if (slot.tier === "top") {
    if (!slot.shortcuts) return "shift+h help • ? about • esc close";
    return slot.shortcuts + " • shift+h help • ? about • esc close";
  }
  if (!slot.shortcuts) return "esc back";
  return slot.shortcuts + " • esc back";
}

// line maps toned cells to concrete styled text.
function line(line: Line, theme: Theme): string {
  let out = "";
  for (const cell of line.cells) {
    if (cell.tone === "dim") {
      out += theme.fg("dim", cell.text);
      continue;
    }
    if (cell.tone === "accent") {
      out += theme.fg("accent", cell.text);
      continue;
    }
    out += cell.text;
  }
  return out;
}

// row is the default helper for one-cell content lines.
export function row(text: string, tone: Tone = "normal"): Line {
  return { cells: [{ text, tone }] };
}

// create renders the canonical fixed-height panel shell used by lists/actions.
export function create(slot: Slot, theme: Theme) {
  return {
    render(width: number): string[] {
      const out: string[] = [];
      const body = Math.max(0, size - 8);
      const rows = slot.content.slice(0, body);
      out.push(sep(width, theme));
      out.push(blank(width));
      out.push(cut(theme.fg("accent", slot.title), width));
      out.push(blank(width));
      for (let i = 0; i < rows.length; i++) {
        const value = line(rows[i]!, theme);
        out.push(cut(slot.active.includes(i) ? theme.fg("accent", value) : value, width));
      }
      for (const _ of Array(Math.max(0, size - (1 + 1 + 1 + 1 + rows.length + 1 + 1 + 1 + 1))))
        out.push(blank(width));
      out.push(blank(width));
      out.push(cut(" " + theme.fg("dim", foot(slot)), width));
      out.push(blank(width));
      out.push(sep(width, theme));
      return out.slice(0, size);
    },
    invalidate(): void {},
  };
}
