import type { ComponentPreset } from "../core/components/types";
import { getDb } from "./db";

const copy = <T>(value: T): T => structuredClone(value);

export const componentPresetRepo = {
  async create(preset: ComponentPreset): Promise<ComponentPreset> {
    const db = await getDb();
    if (await db.get("componentPresets", preset.id)) throw new Error(`Component preset already exists: ${preset.id}`);
    const stored = copy(preset);
    await db.add("componentPresets", stored);
    return copy(stored);
  },
  async list(): Promise<ComponentPreset[]> {
    const db = await getDb();
    return (await db.getAll("componentPresets")).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(copy);
  },
  async update(preset: ComponentPreset): Promise<ComponentPreset> {
    const db = await getDb();
    if (!await db.get("componentPresets", preset.id)) throw new Error(`Unknown component preset: ${preset.id}`);
    const stored = copy(preset);
    await db.put("componentPresets", stored);
    return copy(stored);
  },
  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete("componentPresets", id);
  }
};
