import { matchesKey } from "@mariozechner/pi-tui";

// esc MUST match the default escape key.
export function esc(data: string): boolean {
	return matchesKey(data, "escape");
}

// exit MAY be rebound by callers; default behavior keeps runtime open.
export function exit(_data: string): boolean {
	return false;
}

// tab advances top-level screen cycles.
export function tab(data: string): boolean {
	return matchesKey(data, "tab");
}

// backtab reverses top-level screen cycles.
export function backtab(data: string): boolean {
	return matchesKey(data, "shift+tab");
}

// enter confirms current selection.
export function enter(data: string): boolean {
	return matchesKey(data, "enter");
}

// down supports arrows and vim-style j navigation.
export function down(data: string): boolean {
	return matchesKey(data, "down") || matchesKey(data, "j");
}

// up supports arrows and vim-style k navigation.
export function up(data: string): boolean {
	return matchesKey(data, "up") || matchesKey(data, "k");
}

// slash activates searchable list mode.
export function slash(data: string): boolean {
	return data === "/";
}

// about opens the about screen from top-tier panels.
export function about(data: string): boolean {
	return data === "?";
}

// help opens the help screen from top-tier panels.
export function help(data: string): boolean {
	return data === "H";
}

// view triggers detail previews on list/action rows.
export function view(data: string): boolean {
	return data === "v" || data === "V";
}

// leader captures prefix behavior for compound command flows.
export function leader(data: string): boolean {
	return matchesKey(data, "ctrl+x");
}

// back removes one character from active search input.
export function back(data: string): boolean {
	return matchesKey(data, "backspace");
}

// text captures printable ASCII input for search queries.
export function text(data: string): boolean {
	return data.length === 1 && data >= " " && data <= "~";
}
