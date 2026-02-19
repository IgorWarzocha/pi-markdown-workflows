import type { Intent } from "../..";
import { createList, type Col } from "../..";

type Item = {
	name: string;
	desc: string;
	count?: string;
};

const items: Item[] = [
	{ name: "Design compact chooser", desc: "Create dense slash-command list layout", count: "2/5" },
	{ name: "Tune title clipping", desc: "Improve narrow-terminal resilience" },
	{ name: "Compare muted contrast", desc: "Validate dim text readability", count: "3/3" },
	{ name: "Audit spacing rhythm", desc: "Align header-body-footer cadence" },
	{ name: "Prototype dense mode", desc: "Single-line rows for speed", count: "1/4" },
	{ name: "Prototype roomy mode", desc: "Expanded rows for scanning" },
	{ name: "Validate tab behavior", desc: "Check per-primitive tab policy", count: "2/2" },
	{ name: "Test accent highlight", desc: "Ensure selection color consistency" },
	{ name: "Check empty rendering", desc: "Keep frame stable without items", count: "1/1" },
	{ name: "Preview grouped sections", desc: "Try hierarchical commands" },
	{ name: "Verify j/k parity", desc: "Confirm expected keyboard flow", count: "5/5" },
	{ name: "Measure footer width", desc: "Watch wrapping at 80 columns" },
	{ name: "Create action-heavy sample", desc: "Stress long descriptions", count: "2/3" },
	{ name: "Create status-heavy sample", desc: "Show tags and progress" },
	{ name: "Review border consistency", desc: "Match screenshot framing", count: "3/4" },
	{ name: "Prepare mixed-content mock", desc: "Blend list and menu patterns" },
	{ name: "Stress clipping", desc: "Test huge terminal widths", count: "1/2" },
	{ name: "Confirm footer anchor", desc: "Keep hints pinned to bottom" },
	{ name: "Evaluate title offset", desc: "Left gutter spacing pass", count: "2/2" },
	{ name: "Finalize integration", desc: "Ready primitive handoff" },
];

const cols: Col<Item>[] = [
	{ show: true, width: 28, tone: "normal", align: "left", pick: (item) => item.name },
	{ show: true, width: 30, tone: "dim", align: "left", pick: (item) => item.desc },
	{ show: true, width: 6, tone: "dim", align: "right", pick: (item) => (item.count ? "(" + item.count + ")" : "") },
];

export function createList2Source() {
	return createList<Item>({
		title: "Research/Planned (20)",
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
