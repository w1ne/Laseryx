import { TEMPLATE_LIBRARY } from "./library";
import type { TemplateCategory, TemplateEntry } from "./types";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Filter templates by free-text query and optional category.
 * Matches name, description, category, tags, and id.
 */
export function searchTemplates(
  query: string,
  options?: { category?: TemplateCategory | "all" }
): TemplateEntry[] {
  const q = normalize(query);
  const category = options?.category ?? "all";

  return TEMPLATE_LIBRARY.filter((t) => {
    if (category !== "all" && t.category !== category) {
      return false;
    }
    if (!q) return true;

    const haystack = [
      t.id,
      t.name,
      t.description,
      t.category,
      ...t.tags
    ]
      .join(" ")
      .toLowerCase();

    // All space-separated tokens must match (AND)
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every((token) => haystack.includes(token));
  });
}
