import type { Intent } from "../..";
import { createAction } from "../..";
import type { Col } from "../..";

type Item = {
	name: string;
	desc: string;
	target: string;
};

const items: Item[] = [
	{ name: "show-todo", desc: "Open parsed todo detail view", target: "todo" },
	{ name: "show-skill", desc: "Open parsed skill detail view", target: "skill" },
];

const cols: Col<Item>[] = [
	{ show: true, width: 18, tone: "normal", align: "left", pick: (item) => item.name },
	{ show: true, width: 28, tone: "dim", align: "left", pick: (item) => item.desc },
];

export function createActionDetailSource() {
	return createAction<Item>(
		{
			title: "Actions: detail targets demo",
			items,
			shortcuts: "ctrl+x more options • j/k scroll • v details",
			page: 7,
			find: (item, query) => item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query),
			intent: (_item): Intent | undefined => undefined,
			view: (item): Intent => ({ type: "detail", key: item.target }),
			cols,
		},
		"top",
	);
}
