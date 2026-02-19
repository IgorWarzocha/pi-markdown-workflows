import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { runApp, type Ctx, type Primitive, staticPrimitive } from "..";
import { createAboutSource } from "./src/about";
import { createActionSource } from "./src/action";
import { createActionDetailSource } from "./src/action-detail";
import { createActionWideSource } from "./src/action-wide";
import { createHelpSource } from "./src/help";
import { createSkillDetailSource } from "./src/detail-skill";
import { createTodoDetailSource } from "./src/detail-todo";
import { createList2Source } from "./src/list2";
import { createListSource } from "./src/list";
import { createVariantCompactSource, createVariantTriSource } from "./src/variants";

type Screen = "list" | "list2" | "variant-compact" | "variant-tri" | "actions" | "actions-wide" | "actions-detail" | "actions-nested" | "about" | "help";
type Registry = Record<Screen, Primitive>;

function createRegistry(): Registry {
	const action = createActionSource({ description: true, counters: false });
	return {
		list: createListSource(),
		list2: createList2Source(),
		"variant-compact": createVariantCompactSource(),
		"variant-tri": createVariantTriSource(),
		actions: action.top,
		"actions-wide": createActionWideSource(),
		"actions-detail": createActionDetailSource(),
		"actions-nested": action.nested,
		about: staticPrimitive(() => createAboutSource().slot()),
		help: staticPrimitive(() => createHelpSource().slot()),
	};
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("ui", {
		description: "Show static primitives preview",
		handler: async (_args: string, ctx: Ctx) => {
			if (!ctx.hasUI) {
				throw new Error("UI preview requires interactive mode.");
			}
			const registry = createRegistry();
			const details: Record<string, Primitive> = {
				todo: createTodoDetailSource(),
				skill: createSkillDetailSource(),
			};
			const cycle: Screen[] = ["list", "list2", "variant-compact", "variant-tri", "actions", "actions-wide", "actions-detail"];
			await runApp<Screen>(ctx, {
				registry,
				details,
				cycle,
				initial: "list",
				about: "about",
				help: "help",
			});
		},
	});
}
