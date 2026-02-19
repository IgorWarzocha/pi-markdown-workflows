import type { Intent } from "../..";
import { createAction } from "../..";
import type { Col, List } from "../..";

type Item = {
	name: string;
	desc: string;
	count?: string;
};

type Opts = {
	description: boolean;
	counters: boolean;
};

const items: Item[] = [
	{ name: "work", desc: "Work on todo" },
	{ name: "review-item", desc: "Review selected todo", count: "1/3" },
	{ name: "edit-checklist", desc: "Edit checklist with AI" },
	{ name: "refine", desc: "Refine todo scope", count: "2/5" },
	{ name: "complete", desc: "Mark todo as completed" },
	{ name: "abandon", desc: "Mark todo as abandoned" },
	{ name: "attach-links", desc: "Attach existing items" },
	{ name: "validate-links", desc: "Validate link graph", count: "4/4" },
	{ name: "audit", desc: "Audit coherence with AI" },
	{ name: "assign", desc: "Assign to this session" },
	{ name: "split", desc: "Split into child tasks" },
	{ name: "merge", desc: "Merge with related item" },
	{ name: "reorder", desc: "Adjust todo priority" },
	{ name: "plan", desc: "Generate execution plan" },
	{ name: "flag", desc: "Mark as blocked" },
	{ name: "unflag", desc: "Clear blocked flag" },
	{ name: "handoff", desc: "Delegate to subagent" },
	{ name: "history", desc: "Show change history" },
	{ name: "note", desc: "Add reviewer note" },
	{ name: "archive", desc: "Archive and hide" },
];

function cols(opts: Opts): Col<Item>[] {
	return [
		{ show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.name },
		{ show: opts.description, width: 28, tone: "dim", align: "left", pick: (item) => item.desc },
		{ show: opts.counters, width: 6, tone: "dim", align: "right", pick: (item) => (item.count ? "(" + item.count + ")" : "") },
	];
}

function make(tier: "top" | "nested", opts: Opts): List {
	return createAction<Item>(
		{
			title: "Actions for \"Consolidate workflow UX into a single /workflows command with GUI selection\"",
			items,
			shortcuts: "ctrl+x more options • j/k scroll",
			page: 7,
			find: (item, query) => item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query),
			intent: (item): Intent => ({ type: "action", name: item.name }),
			cols: cols(opts),
		},
		tier,
	);
}

export function createActionSource(opts: Opts = { description: true, counters: false }) {
	return {
		top: make("top", opts),
		nested: make("nested", opts),
	};
}
