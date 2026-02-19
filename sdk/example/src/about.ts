import { row, type Slot } from "../..";

export function createAboutSource() {
	return {
		slot(): Slot {
			return {
				title: "About UI Primitives",
				content: [
					row(""),
					row("  This preview shows fixed-height command surfaces."),
					row("  Header and footer are standardized across variants."),
					row("  Inner content is injected via imported primitives."),
					row(""),
					{ cells: [{ text: "  g", tone: "normal" }, { text: "  github", tone: "dim" }] },
				],
				shortcuts: "g github",
				active: [],
				tier: "nested",
				tab: false,
			};
		},
	};
}
