import { createDetail } from "../..";
import { todo } from "./detail-parse";

export function createTodoDetailSource() {
	const data = todo("./todo-b69d284e.md");
	return createDetail({
		title: data.title,
		meta: data.meta,
		body: data.body,
		shortcuts: "j/k scroll",
	});
}
