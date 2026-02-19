import { createDetail } from "../..";
import { skill } from "./detail-parse";

export function createSkillDetailSource() {
	const data = skill("./skill-frontend-design.md");
	return createDetail({
		title: data.title,
		meta: data.meta,
		body: data.body,
		shortcuts: "j/k scroll",
	});
}
