export type TextContent = { type: "text"; text: string };

export type WorkflowDefinition = {
  name: string;
  description: string;
  location: string;
};

export type WorkflowCreateInput = {
  name: string;
  description: string;
  body: string;
};

export type WorkflowAction = "use" | "refine" | "append-to-agents" | "promote-to-skill" | "delete";

export type WorkflowPick =
  | { type: "cancel" }
  | { type: "create" }
  | { type: "action"; action: WorkflowAction; workflow: WorkflowDefinition };
