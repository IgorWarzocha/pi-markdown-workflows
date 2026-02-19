import type { Intent } from "../..";
import { createList, type Col } from "../..";

type Item = {
	name: string;
	desc: string;
	owner?: string;
	state?: string;
	prio?: string;
	count?: string;
};

const items: Item[] = [
	{ name: "Plan migration", desc: "Map extension API changes", count: "2/5", owner: "core", state: "open", prio: "p1" },
	{ name: "Refine footer", desc: "Normalize shortcut ordering", count: "1/3", owner: "ui", state: "open", prio: "p2" },
	{ name: "Add intent hooks", desc: "Route row actions via dispatcher", owner: "sdk", state: "todo", prio: "p1" },
	{ name: "Test nested flows", desc: "Back/close semantics parity", count: "3/3", owner: "qa", state: "done", prio: "p3" },
	{ name: "Theme pass", desc: "Audit dim contrast and accent", owner: "ui", state: "todo", prio: "p2" },
	{ name: "Publish blueprint", desc: "Write plugin author guide", count: "0/2", owner: "docs", state: "open", prio: "p2" },
	{ name: "Model tabs", desc: "Tab gating by primitive", count: "1/2", owner: "sdk", state: "open", prio: "p1" },
	{ name: "Render stress", desc: "Column fit at narrow width", owner: "qa", state: "todo", prio: "p3" },
	{ name: "Action matrix", desc: "Grid demo for top menus", owner: "core", state: "todo", prio: "p2" },
	{ name: "Prompt policy", desc: "Search/prompt behavior mapping", owner: "sdk", state: "open", prio: "p1" },
	{ name: "Theme polish", desc: "Dim and accent pass", owner: "ui", state: "todo", prio: "p3" },
	{ name: "Routing pass", desc: "Intent jump consistency", owner: "sdk", state: "open", prio: "p2" },
	{ name: "Registry map", desc: "Primitive registry audit", owner: "core", state: "open", prio: "p1" },
	{ name: "Selector model", desc: "Selection movement edge cases", owner: "qa", state: "todo", prio: "p2" },
	{ name: "Footer grammar", desc: "Shortcut wording pass", owner: "docs", state: "open", prio: "p3" },
	{ name: "Screen flow", desc: "Cycle order sanity check", owner: "sdk", state: "todo", prio: "p1" },
	{ name: "Action routes", desc: "Map action intents cleanly", owner: "core", state: "open", prio: "p2" },
	{ name: "Link strategy", desc: "Future external link handling", owner: "sdk", state: "todo", prio: "p3" },
	{ name: "Perf sweep", desc: "Render cache behavior", owner: "qa", state: "open", prio: "p2" },
	{ name: "Theme sync", desc: "Invalidate on theme change", owner: "ui", state: "todo", prio: "p1" },
	{ name: "Narrow mode", desc: "Column collapse behavior", owner: "ui", state: "open", prio: "p2" },
	{ name: "Wide mode", desc: "Spacing consistency check", owner: "qa", state: "todo", prio: "p3" },
	{ name: "Key review", desc: "Secret key path checks", owner: "sdk", state: "open", prio: "p1" },
	{ name: "Final polish", desc: "Pre-hand-off cleanup", owner: "core", state: "todo", prio: "p2" },
];

function find(item: Item, query: string): boolean {
	if (item.name.toLowerCase().includes(query)) return true;
	if (item.desc.toLowerCase().includes(query)) return true;
	if (item.owner && item.owner.toLowerCase().includes(query)) return true;
	if (item.state && item.state.toLowerCase().includes(query)) return true;
	if (item.prio && item.prio.toLowerCase().includes(query)) return true;
	return false;
}

export function createVariantCompactSource() {
	const cols: Col<Item>[] = [
		{ show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.name },
	];
	return createList<Item>({
		title: "Variant: compact two-column",
		items,
		shortcuts: "ctrl+x more options • j/k select • tab switch lists",
		tier: "top",
		tab: true,
		search: false,
		prompt: false,
		page: 7,
		find,
		intent: (_item): Intent => ({ type: "screen", screen: "actions-nested" }),
		cols,
		flow: { columns: 2 },
	});
}

export function createVariantTriSource() {
	const cols: Col<Item>[] = [
		{ show: true, width: 14, tone: "normal", align: "left", pick: (item) => item.name },
	];
	return createList<Item>({
		title: "Variant: tri main columns",
		items,
		shortcuts: "ctrl+x more options • j/k select • tab switch lists",
		tier: "top",
		tab: true,
		search: false,
		prompt: false,
		page: 7,
		find,
		intent: (_item): Intent => ({ type: "screen", screen: "actions-nested" }),
		cols,
		flow: { columns: 3 },
	});
}
