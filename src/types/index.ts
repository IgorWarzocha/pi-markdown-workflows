export type TextContent = { type: "text"; text: string };

export type WorkflowDefinition = {
  name: string;
  description: string;
  location: string;
};

export type SkillDefinition = {
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
export type SkillAction = "use" | "refine" | "delete";

export type WorkflowPick =
  | { type: "cancel" }
  | { type: "create-workflow" }
  | { type: "create-skill" }
  | { type: "workflow"; action: WorkflowAction; workflow: WorkflowDefinition }
  | { type: "skill"; action: SkillAction; skill: SkillDefinition };
