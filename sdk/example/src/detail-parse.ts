import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Out = {
	title: string;
	meta: string[];
	body: string[];
};

const here = dirname(fileURLToPath(import.meta.url));

function file(path: string): string {
	const full = resolve(here, path);
	const text = readFileSync(full, "utf8");
	if (!text) {
		throw new Error("Detail source is empty: " + full);
	}
	return text;
}

function split(text: string): { head: string; body: string } {
	if (!text.startsWith("---\n")) {
		throw new Error("Detail source missing frontmatter start.");
	}
	const end = text.indexOf("\n---\n", 4);
	if (end < 0) {
		throw new Error("Detail source missing frontmatter end.");
	}
	return {
		head: text.slice(4, end),
		body: text.slice(end + 5),
	};
}

function pick(head: string, key: string): string {
	const rows = head.split("\n");
	const out: string[] = [];
	let hit = false;
	for (const row of rows) {
		if (!hit && row.startsWith(key + ":")) {
			hit = true;
			out.push(row.slice(key.length + 1).trim());
			continue;
		}
		if (!hit) {
			continue;
		}
		if (!row.startsWith("  ")) {
			break;
		}
		out.push(row.trim());
	}
	if (out.length === 0) {
		throw new Error("Frontmatter key missing: " + key);
	}
	return out.join(" ").replace(/\s+/g, " ").trim();
}

function tags(head: string): string[] {
	const rows = head.split("\n");
	const out: string[] = [];
	let hit = false;
	for (const row of rows) {
		if (!hit && row.trim() === "tags:") {
			hit = true;
			continue;
		}
		if (!hit) {
			continue;
		}
		if (!row.startsWith("  - ")) {
			break;
		}
		out.push(row.slice(4).trim());
	}
	return out;
}

function lines(text: string): string[] {
	return text.replace(/\r/g, "").split("\n");
}

export function todo(path: string): Out {
	const raw = file(path);
	const part = split(raw);
	const title = pick(part.head, "title");
	const status = pick(part.head, "status");
	const list = tags(part.head);
	const meta = ["status: " + status, list.length > 0 ? "tags: " + list.join(", ") : "tags: none"];
	return { title, meta, body: lines(part.body) };
}

export function skill(path: string): Out {
	const raw = file(path);
	const part = split(raw);
	const name = pick(part.head, "name");
	const desc = pick(part.head, "description");
	const meta = ["name: " + name, "description: " + desc];
	return { title: "Skill: " + name, meta, body: lines(part.body) };
}
