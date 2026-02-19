import type { Intent } from "./intent.js";
import type { Slot } from "./template.js";

// Primitive is the minimal interaction surface every SDK screen MUST implement.
export type Primitive = {
	slot: () => Slot;
	up: () => void;
	down: () => void;
	search: () => boolean;
	set: (query: string) => void;
	enter: () => Intent | undefined;
	hasView: () => boolean;
	view: () => Intent | undefined;
};

// staticPrimitive wraps readonly slots so they can participate in the same runtime.
export function staticPrimitive(slot: () => Slot): Primitive {
	return {
		slot,
		up: () => {},
		down: () => {},
		search: () => false,
		set: (_query: string) => {},
		enter: () => undefined,
		hasView: () => false,
		view: () => undefined,
	};
}
