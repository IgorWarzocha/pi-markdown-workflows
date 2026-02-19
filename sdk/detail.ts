import type { Primitive } from "./primitive.js";
import { row, type Slot } from "./template.js";

// Detail opts accept metadata, optional command block, and markdown-like body rows.
type Opts = {
	title: string;
	meta: string[];
	body: string[];
	block?: string[];
};

const page = 24;

// clamp keeps scroll windows within valid row boundaries.
function clamp(value: number, min: number, max: number): number {
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

// createDetail builds a scrollable nested primitive for read-focused previews.
export function createDetail(opts: Opts): Primitive {
	const head = opts.meta.map((item) => row(item, "dim"));
	const block = opts.block && opts.block.length > 0 ? opts.block.map((item) => row(item, "dim")) : [];
	const rows = [...head, row(""), ...block, ...(block.length > 0 ? [row("")] : []), ...opts.body.map((item) => row(item))];
	const state = { top: 0 };
	const max = Math.max(0, rows.length - page);

	const move = (step: number): void => {
		if (max === 0) {
			state.top = 0;
			return;
		}
		const next = state.top + step;
		if (next < 0) {
			state.top = max;
			return;
		}
		if (next > max) {
			state.top = 0;
			return;
		}
		state.top = clamp(next, 0, max);
	};

	return {
		slot: (): Slot => {
			const start = rows.length === 0 ? 0 : state.top + 1;
			const end = rows.length === 0 ? 0 : Math.min(rows.length, state.top + page);
			const info = row("scroll " + start + "-" + end + "/" + rows.length, "dim");
			return {
				title: opts.title,
				content: [info, ...rows.slice(state.top, state.top + page - 1)],
				shortcuts: "",
				active: [],
				tier: "nested",
				tab: false,
			};
		},
		up: () => move(-1),
		down: () => move(1),
		search: () => false,
		set: (_query: string) => {},
		enter: () => undefined,
		hasView: () => false,
		view: () => undefined,
	};
}
