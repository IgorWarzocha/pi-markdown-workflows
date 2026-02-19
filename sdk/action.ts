import { createList, type Col, type List } from "./list";
import type { Intent } from "./intent";

// Flow config controls how many columns a list-style action view SHOULD render.
type Flow = {
	columns: number;
};

type Tier = "top" | "nested";

// Action opts define item data, column projections, and enter/view routing.
type Opts<T> = {
	title: string;
	items: T[];
	shortcuts: string;
	page: number;
	find: (item: T, query: string) => boolean;
	intent: (item: T) => Intent | undefined;
	view?: (item: T) => Intent | undefined;
	cols: Col<T>[];
	flow?: Flow;
};

// createAction adapts action semantics onto the shared list primitive engine.
export function createAction<T>(opts: Opts<T>, tier: Tier): List {
	return createList<T>({
		title: opts.title,
		items: opts.items,
		shortcuts: opts.shortcuts,
		tier,
		tab: tier === "top",
		search: false,
		prompt: false,
		page: opts.page,
		find: opts.find,
		intent: opts.intent,
		view: opts.view,
		cols: opts.cols,
		flow: opts.flow,
	});
}
