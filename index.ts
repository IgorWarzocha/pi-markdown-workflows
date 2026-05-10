import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerExtension } from "./src/extension/register.js";

export default function piWorkflowsToolExtension(pi: ExtensionAPI): void {
  registerExtension(pi);
}
