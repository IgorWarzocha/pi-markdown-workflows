import type { Intent } from "../..";
import { createList, type Col } from "../..";

type Item = {
	name: string;
	desc: string;
	count?: string;
};

const items: Item[] = [
	{ name: "Consolidate workflow UX", desc: "Unify command surface under /workflows", count: "5/5" },
	{ name: "Assess prompt injection", desc: "Check workflow list visibility behavior", count: "5/5" },
	{ name: "Audit AGENTS loading", desc: "Verify nested context flush semantics", count: "5/5" },
	{ name: "Review card spacing", desc: "Align vertical rhythm in list cards" },
	{ name: "Align footer hints", desc: "Match modal ordering and wording", count: "3/4" },
	{ name: "Validate border colors", desc: "Ensure accent lines in all themes" },
	{ name: "Refine action columns", desc: "Keep command and detail readable", count: "2/3" },
	{ name: "Normalize empty state", desc: "Show stable rows when list is empty" },
	{ name: "Add overflow marker", desc: "Expose clipped-row indicator", count: "1/2" },
	{ name: "Prototype grouped sets", desc: "Test sectioned command groups" },
	{ name: "Verify ctrl+x route", desc: "Confirm more-options entrypoint", count: "4/4" },
	{ name: "Stress long titles", desc: "Check truncation at narrow widths" },
	{ name: "Tune separators", desc: "Balance spacing around frame lines" },
	{ name: "Test tab switching", desc: "Cycle all top-level primitives", count: "2/2" },
	{ name: "Add linked mocks", desc: "Model parent-child task relations" },
	{ name: "Confirm j/k parity", desc: "Match arrow and vim movement", count: "1/1" },
	{ name: "Validate enter routing", desc: "Open actions from list row" },
	{ name: "Check escape behavior", desc: "Back and close semantics", count: "2/2" },
	{ name: "Prepare screenshot pass", desc: "Finalize primitive parity" },
	{ name: "Ship baseline", desc: "Lock first design-system version", count: "0/1" },
];

const cols: Col<Item>[] = [
	{ show: true, width: 28, tone: "normal", align: "left", pick: (item) => item.name },
	{ show: true, width: 30, tone: "dim", align: "left", pick: (item) => item.desc },
	{ show: true, width: 6, tone: "dim", align: "right", pick: (item) => (item.count ? "(" + item.count + ")" : "") },
];

export function createListSource() {
	return createList<Item>({
		title: "Done/Deprecated (20)",
		items,
		shortcuts: "ctrl+x more options • / search • j/k select • tab switch lists",
		tier: "top",
		tab: true,
		search: true,
		prompt: true,
		page: 5,
		find: (item, query) => item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query),
		intent: (_item): Intent => ({ type: "screen", screen: "actions-nested" }),
		cols,
	});
}
