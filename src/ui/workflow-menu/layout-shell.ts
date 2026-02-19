import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Spacer } from "@mariozechner/pi-tui";

import type { WorkflowMenuComponent } from "./component.js";

export function layoutShell(menu: WorkflowMenuComponent): void {
  menu.clear();
  menu.addChild(new DynamicBorder((text: string) => menu.theme.fg("accent", text)));
  menu.addChild(new Spacer(1));
  menu.addChild(menu.header);
  menu.addChild(new Spacer(1));
  menu.addChild(menu.searchWrap);
  menu.addChild(new Spacer(1));
  menu.addChild(menu.list);
  menu.addChild(new Spacer(1));
  menu.addChild(menu.hintWrap);
  menu.addChild(new Spacer(1));
  menu.addChild(new DynamicBorder((text: string) => menu.theme.fg("accent", text)));
}
