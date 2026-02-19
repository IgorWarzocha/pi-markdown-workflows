import { detailScroll, detailToggle } from "./keybind-logic.js";
import { about, back, backtab, down, enter, esc, exit, help, leader, slash, tab, text, up } from "./keybinds.js";
import type { Intent } from "./intent.js";
import type { Primitive } from "./primitive.js";
import { renderDetail } from "./detail-frame.js";
import { create } from "./template.js";

export type Theme = {
	fg: (color: string, text: string) => string;
};

type View = {
	render: (width: number) => string[];
	invalidate: () => void;
	handleInput: (data: string) => void;
};

type Ui = {
	custom: <T>(factory: (tui: { requestRender: () => void }, theme: Theme, keys: unknown, done: (result: T) => void) => View) => Promise<T>;
};

// Ctx is the minimal command context needed by the SDK runtime loop.
export type Ctx = {
	hasUI: boolean;
	ui: Ui;
};

// Config describes runtime wiring for screens, detail targets, and cycle order.
type Config<Screen extends string> = {
	registry: Record<Screen, Primitive>;
	details: Record<string, Primitive>;
	cycle: Screen[];
	initial: Screen;
	about: Screen;
	help: Screen;
};

// runApp executes the shared interactive shell loop for primitive-based previews.
export async function runApp<Screen extends string>(ctx: Ctx, cfg: Config<Screen>): Promise<void> {
	const state = {
		screen: cfg.initial,
		prev: cfg.initial,
		query: "",
		search: false,
		lead: false,
		detail: undefined as Primitive | undefined,
	};

	const primitive = (): Primitive => cfg.registry[state.screen];
	const slot = () => primitive().slot();
	const top = () => slot().tier === "top";

	// setScreen resets transient input mode and applies searchable defaults.
	const setScreen = (screen: Screen): void => {
		state.screen = screen;
		state.search = false;
		state.query = "";
		const next = primitive();
		if (!next.search()) {
			return;
		}
		next.set("");
	};

	// apply pushes the current query into active searchable primitives.
	const apply = (): void => {
		const current = primitive();
		if (!current.search()) {
			return;
		}
		current.set(state.query);
	};

	// route translates primitive intents into runtime state transitions.
	const route = (intent: Intent | undefined): void => {
		if (!intent) {
			return;
		}
		if (intent.type === "screen") {
			state.prev = state.screen;
			setScreen(intent.screen as Screen);
			return;
		}
		if (intent.type !== "detail") {
			return;
		}
		const target = cfg.details[intent.key];
		if (!target) {
			throw new Error("Unknown detail key: " + intent.key);
		}
		state.detail = target;
	};

	await ctx.ui.custom<void>((tui, theme, _keys, done) => {
		return {
			// render composes optional top detail preview and the base panel view.
			render: (width: number) => {
				const base = create(slot(), theme).render(width);
				if (!state.detail) {
					return base;
				}
				const topbox = renderDetail(state.detail.slot(), width, base.length, theme);
				return [...topbox, "", ...base];
			},
			invalidate: () => {},
			// handleInput applies search, navigation, view toggle, and enter routing rules.
			handleInput: (data: string) => {
				if (state.search) {
					if (esc(data)) {
						state.search = false;
						state.query = "";
						apply();
						tui.requestRender();
						return;
					}
					if (enter(data)) {
						state.search = false;
						tui.requestRender();
						return;
					}
					if (back(data)) {
						state.query = state.query.slice(0, -1);
						apply();
						tui.requestRender();
						return;
					}
					if (text(data)) {
						state.query += data;
						apply();
						tui.requestRender();
					}
					return;
				}
				if (leader(data)) {
					state.lead = true;
					return;
				}
				if (state.lead) {
					state.lead = false;
				}
				if (exit(data)) {
					done();
					return;
				}
				const step = detailScroll(data);
				if (state.detail && step !== 0) {
					if (step > 0) {
						state.detail.down();
					}
					if (step < 0) {
						state.detail.up();
					}
					tui.requestRender();
					return;
				}
				if (esc(data)) {
					if (slot().tier === "nested") {
						setScreen(state.prev);
						tui.requestRender();
						return;
					}
					done();
					return;
				}
				const current = primitive();
				if (current.search() && slash(data)) {
					state.search = true;
					state.query = "";
					apply();
					tui.requestRender();
					return;
				}
				if (top() && about(data)) {
					state.prev = state.screen;
					setScreen(cfg.about);
					tui.requestRender();
					return;
				}
				if (top() && help(data)) {
					state.prev = state.screen;
					setScreen(cfg.help);
					tui.requestRender();
					return;
				}
				if (tab(data) && slot().tab) {
					const idx = cfg.cycle.indexOf(state.screen);
					const next = idx < 0 ? 0 : (idx + 1) % cfg.cycle.length;
					setScreen(cfg.cycle[next]!);
					tui.requestRender();
					return;
				}
				if (backtab(data) && slot().tab) {
					const idx = cfg.cycle.indexOf(state.screen);
					const prev = idx < 0 ? 0 : (idx - 1 + cfg.cycle.length) % cfg.cycle.length;
					setScreen(cfg.cycle[prev]!);
					tui.requestRender();
					return;
				}
				if (down(data)) {
					current.down();
					tui.requestRender();
					return;
				}
				if (up(data)) {
					current.up();
					tui.requestRender();
					return;
				}
				if (detailToggle(data)) {
					if (state.detail) {
						state.detail = undefined;
						tui.requestRender();
						return;
					}
					if (current.hasView()) {
						route(current.view());
						tui.requestRender();
					}
					return;
				}
				if (enter(data)) {
					route(current.enter());
					tui.requestRender();
				}
			},
		};
	});
}
