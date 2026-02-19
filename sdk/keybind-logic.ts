import { view } from "./keybinds.js";

// detailToggle defines the default key that SHOULD open/close the detail panel.
export function detailToggle(data: string): boolean {
  return view(data);
}

// detailScroll maps detail-only scroll keys to direction deltas.
export function detailScroll(data: string): number {
  if (data === "J") {
    return 1;
  }
  if (data === "K") {
    return -1;
  }
  return 0;
}
