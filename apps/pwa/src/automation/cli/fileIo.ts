import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export function resolveCliPath(path: string): string {
  if (isAbsolute(path)) return path;
  return resolve(process.env.INIT_CWD || process.cwd(), path);
}

export async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(resolveCliPath(path), "utf8");
  return JSON.parse(text);
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(resolveCliPath(path), content, "utf8");
}
