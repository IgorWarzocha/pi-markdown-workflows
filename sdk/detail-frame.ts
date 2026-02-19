import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Slot, Tone } from "./template";

type Theme = {
	fg: (color: string, text: string) => string;
};

// pad trims and right-fills strings to a stable printable width.
function pad(line: string, width: number): string {
	const cut = truncateToWidth(line, width);
	return cut + " ".repeat(Math.max(0, width - visibleWidth(cut)));
}

// text renders toned SDK line cells with theme-aware foreground colors.
function text(line: { cells: { text: string; tone: Tone }[] }, theme: Theme): string {
	let out = "";
	for (const cell of line.cells) {
		if (cell.tone === "dim") {
			out += theme.fg("dim", cell.text);
			continue;
		}
		if (cell.tone === "accent") {
			out += theme.fg("accent", cell.text);
			continue;
		}
		out += cell.text;
	}
	return out;
}

// titlebar centers the title and fills both sides with dimmed guide lines.
function titlebar(title: string, inner: number, theme: Theme): string {
	const plain = " " + title + " ";
	const size = Math.max(0, inner - plain.length);
	const left = Math.floor(size / 2);
	const right = Math.max(0, size - left);
	const line = theme.fg("borderMuted", "─".repeat(left));
	const head = theme.fg("accent", plain);
	const tail = theme.fg("borderMuted", "─".repeat(right));
	return pad(line + head + tail, inner);
}

// frame draws the dimmed box shell used for attached detail previews.
function frame(lines: string[], width: number, title: string, theme: Theme): string[] {
	const inner = Math.max(4, width - 4);
	const border = (v: string) => theme.fg("borderMuted", v);
	const top = border("┌" + "─".repeat(inner) + "┐");
	const bottom = border("└" + "─".repeat(inner) + "┘");
	const out = [top, border("│") + titlebar(title, inner, theme) + border("│"), border("│") + " ".repeat(inner) + border("│")];
	for (const line of lines) {
		out.push(border("│") + pad(line, inner) + border("│"));
	}
	out.push(bottom);
	return out;
}

// renderDetail composes a top detail panel at roughly 2x the lower panel height.
export function renderDetail(slot: Slot, width: number, bottom: number, theme: Theme): string[] {
	const body = slot.content.map((line) => text(line, theme));
	const take = Math.max(1, bottom * 2 - 4);
	return frame(body.slice(0, take), width, slot.title, theme);
}
