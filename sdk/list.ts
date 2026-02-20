import type { Intent } from "./intent.js";
import type { Line, Slot, Tier, Tone } from "./template.js";
import { row } from "./template.js";

type Align = "left" | "right";

type Flow = {
  columns: number;
};

// Col defines how one projected field SHOULD render in table-like lists.
export type Col<T> = {
  show: boolean;
  width: number;
  tone: Tone;
  align: Align;
  pick: (item: T) => string;
};

// Opts controls list rendering, search, and enter/view routing.
type Opts<T> = {
  title: string;
  items: T[];
  shortcuts: string;
  tier: Tier;
  tab: boolean;
  search: boolean;
  prompt: boolean;
  page: number;
  find: (item: T, query: string) => boolean;
  intent: (item: T) => Intent | undefined;
  view?: (item: T) => Intent | undefined;
  cols: Col<T>[];
  flow?: Flow;
};

type State = { sel: number; top: number; query: string };

// List is the concrete primitive implementation returned by createList.
export type List = {
  up: () => void;
  down: () => void;
  set: (query: string) => void;
  query: () => string;
  search: () => boolean;
  enter: () => Intent | undefined;
  hasView: () => boolean;
  view: () => Intent | undefined;
  slot: () => Slot;
};

// clamp keeps selection and scroll values within legal bounds.
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// pad applies fixed-width alignment for projected column values.
function pad(value: string, width: number, align: Align): string {
  const text = value.length > width ? value.slice(0, Math.max(0, width)) : value;
  const size = Math.max(0, width - text.length);
  if (align === "right") return " ".repeat(size) + text;
  return text + " ".repeat(size);
}

// view returns filtered items for the active query.
function view<T>(opts: Opts<T>, query: string): T[] {
  if (!query) return opts.items;
  const low = query.toLowerCase();
  return opts.items.filter((item) => opts.find(item, low));
}

// line renders one row in classic single-column scrolling mode.
function line<T>(item: T, mark: string, cols: Col<T>[]): Line {
  const show = cols.filter((col) => col.show);
  const cells: { text: string; tone: Tone }[] = [{ text: mark, tone: "normal" }];
  for (let i = 0; i < show.length; i++) {
    const col = show[i]!;
    cells.push({ text: pad(col.pick(item), col.width, col.align), tone: col.tone });
    if (i < show.length - 1) cells.push({ text: "  ", tone: "normal" as const });
  }
  return { cells };
}

// flowline renders one visible row across N flow columns.
function flowline<T>(
  list: T[],
  state: State,
  top: number,
  rowi: number,
  rows: number,
  cols: number,
  col: Col<T>,
): Line {
  const cells: { text: string; tone: Tone }[] = [];
  const gap = "    ";
  for (let c = 0; c < cols; c++) {
    const idx = top + c * rows + rowi;
    if (idx >= list.length) {
      cells.push({ text: pad("", col.width + 2, "left" as Align), tone: "normal" as const });
      if (c < cols - 1) {
        cells.push({ text: gap, tone: "normal" as const });
      }
      continue;
    }
    const item = list[idx]!;
    const mark = idx === state.sel ? "› " : "  ";
    const text = mark + pad(col.pick(item), col.width, "left");
    cells.push({ text, tone: idx === state.sel ? ("accent" as const) : col.tone });
    if (c < cols - 1) {
      cells.push({ text: gap, tone: "normal" as const });
    }
  }
  return { cells };
}

// createList builds a reusable selectable list primitive with optional flow columns.
export function createList<T>(opts: Opts<T>): List {
  const state: State = { sel: 0, top: 0, query: "" };

  const pagesize = (): number => {
    if (!opts.flow) return opts.page;
    return opts.page * opts.flow.columns;
  };

  const reset = (): void => {
    const rows = view(opts, state.query);
    const max = Math.max(0, rows.length - 1);
    state.sel = clamp(state.sel, 0, max);
    if (!opts.flow) {
      state.top = clamp(state.top, 0, Math.max(0, max - opts.page + 1));
      return;
    }
    const size = pagesize();
    if (size <= 0) {
      state.top = 0;
      return;
    }
    const page = Math.floor(state.sel / size);
    state.top = page * size;
  };

  const move = (step: number): void => {
    const rows = view(opts, state.query);
    const max = Math.max(0, rows.length - 1);
    if (rows.length === 0) return;
    const next = state.sel + step < 0 ? max : state.sel + step > max ? 0 : state.sel + step;
    if (next === state.sel) return;
    state.sel = next;
    if (!opts.flow) {
      if (state.sel < state.top) return void (state.top = state.sel);
      if (state.sel >= state.top + opts.page) state.top = state.sel - opts.page + 1;
      return;
    }
    const size = pagesize();
    if (size <= 0) {
      state.top = 0;
      return;
    }
    if (state.sel < state.top || state.sel >= state.top + size) {
      state.top = Math.floor(state.sel / size) * size;
    }
  };

  return {
    up: () => move(-1),
    down: () => move(1),
    set: (query: string) => {
      state.query = query;
      state.sel = 0;
      state.top = 0;
      reset();
    },
    query: () => state.query,
    search: () => opts.search,
    enter: () => {
      const rows = view(opts, state.query);
      if (rows.length === 0) return undefined;
      return opts.intent(rows[state.sel]!);
    },
    hasView: () => opts.view !== undefined,
    view: () => {
      if (!opts.view) return undefined;
      const rows = view(opts, state.query);
      if (rows.length === 0) return undefined;
      return opts.view(rows[state.sel]!);
    },
    slot: () => {
      const rows: Line[] = opts.prompt ? [row("> "), row("")] : [];
      const list = view(opts, state.query);
      if (!opts.flow) {
        for (let i = 0; i < opts.page; i++) {
          const idx = state.top + i;
          if (idx >= list.length) {
            rows.push(row(""));
            continue;
          }
          rows.push(line(list[idx]!, idx === state.sel ? "› " : "  ", opts.cols));
        }
        const base = opts.prompt ? 2 : 0;
        return {
          title: state.query ? opts.title + " (search: " + state.query + ")" : opts.title,
          content: rows,
          shortcuts: opts.shortcuts,
          active: list.length === 0 ? [] : [base + (state.sel - state.top)],
          tier: opts.tier,
          tab: opts.tab,
        };
      }
      const col = opts.cols.find((item) => item.show);
      if (!col) {
        throw new Error("Flow layout requires at least one visible column.");
      }
      for (let i = 0; i < opts.page; i++) {
        rows.push(flowline(list, state, state.top, i, opts.page, opts.flow.columns, col));
      }
      return {
        title: state.query ? opts.title + " (search: " + state.query + ")" : opts.title,
        content: rows,
        shortcuts: opts.shortcuts,
        active: [],
        tier: opts.tier,
        tab: opts.tab,
      };
    },
  };
}
