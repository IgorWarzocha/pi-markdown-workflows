import type { Intent } from "../..";
import { createAction } from "../..";
import type { Col } from "../..";

type Item = {
	name: string;
	desc: string;
};

const items: Item[] = [
	{ name: "work", desc: "Work on todo" },
	{ name: "review-item", desc: "Review selected todo" },
	{ name: "edit-checklist", desc: "Edit checklist with AI" },
	{ name: "refine", desc: "Refine todo scope" },
	{ name: "complete", desc: "Mark todo as completed" },
	{ name: "abandon", desc: "Mark todo as abandoned" },
	{ name: "attach-links", desc: "Attach existing items" },
	{ name: "validate-links", desc: "Validate link graph" },
	{ name: "audit", desc: "Audit coherence with AI" },
	{ name: "assign", desc: "Assign to this session" },
	{ name: "split", desc: "Split into child tasks" },
	{ name: "merge", desc: "Merge with related item" },
	{ name: "reorder", desc: "Adjust todo priority" },
	{ name: "plan", desc: "Generate execution plan" },
];

const cols: Col<Item>[] = [
	{ show: true, width: 20, tone: "normal", align: "left", pick: (item) => item.name },
];

export function createActionWideSource() {
	return createAction<Item>(
		{
			title: "Actions: two-column flow demo",
			items,
			shortcuts: "ctrl+x more options • j/k scroll",
			page: 7,
			find: (item, query) => item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query),
			intent: (item): Intent => ({ type: "action", name: item.name }),
			cols,
			flow: { columns: 2 },
		},
		"top",
	);
}
