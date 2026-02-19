// Intent is the runtime contract primitives MUST return for enter/view actions.
export type Intent =
	| { type: "screen"; screen: "list" | "list2" | "variant-compact" | "variant-tri" | "actions" | "actions-nested" | "actions-wide" | "actions-detail" | "about" | "help" }
	| { type: "detail"; key: string }
	| { type: "action"; name: string }
	| { type: "link"; url: string };
