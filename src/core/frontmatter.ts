type ParsedFrontmatter = Record<string, string>;

type NameDescription = { name: string; description: string };

function countIndent(value: string): number {
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (char !== " " && char !== "\t") break;
    index += 1;
  }
  return index;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizePlainText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isBlockScalar(value: string): boolean {
  return /^[>|][+-]?\d*$/.test(value.trim());
}

function readBlockScalar(
  lines: string[],
  start: number,
  parentIndent: number,
): { value: string; nextIndex: number } {
  const captured: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      captured.push("");
      index += 1;
      continue;
    }
    const indent = countIndent(line);
    if (indent <= parentIndent) break;
    captured.push(line);
    index += 1;
  }

  const indents = captured.filter(Boolean).map((line) => countIndent(line));
  const blockIndent = indents.length ? Math.min(...indents) : parentIndent + 1;
  const normalized = captured.map((line) => {
    if (!line) return "";
    return line.slice(Math.min(blockIndent, line.length));
  });

  return { value: normalized.join("\n"), nextIndex: index };
}

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const body = match[1] ?? "";
  const lines = body.split(/\r?\n/);
  const parsed: ParsedFrontmatter = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const keyMatch = line.match(/^([ \t]*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!keyMatch) continue;

    const parentIndent = countIndent(keyMatch[1] ?? "");
    const key = keyMatch[2] ?? "";
    const rawValue = (keyMatch[3] ?? "").trim();

    if (isBlockScalar(rawValue)) {
      const block = readBlockScalar(lines, index + 1, parentIndent);
      parsed[key] = block.value;
      index = block.nextIndex - 1;
      continue;
    }

    parsed[key] = stripQuotes(rawValue);
  }

  return parsed;
}

export function parseNameDescriptionFrontmatter(content: string): NameDescription | null {
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  const name = normalizePlainText(parsed.name ?? "");
  const description = normalizePlainText(parsed.description ?? "");
  if (!name || !description) return null;

  return { name, description };
}
