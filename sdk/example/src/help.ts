import { row, type Slot } from "../..";

export function createHelpSource() {
	return {
		slot(): Slot {
			return {
				title: "Help",
				content: [
					row(""),
					row("  ↑↓ / j,k    move selection"),
					row("  /           search (top menus)"),
					row("  Enter       open actions"),
					row("  Tab         cycle top menus"),
					row("  ?           open about"),
					row("  Shift+H     open help"),
				],
				shortcuts: "",
				active: [],
				tier: "nested",
				tab: false,
			};
		},
	};
}
