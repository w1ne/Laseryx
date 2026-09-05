// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createComponentInstanceFromPreset } from "../core/enclosure/workspace";
import { getDb } from "./db";
import { componentPresetRepo } from "./componentPresetRepo";

describe("componentPresetRepo", () => {
  beforeEach(async () => { const db = await getDb(); await db.clear("componentPresets"); });
  it("creates, lists, updates, and deletes reusable presets using copies", async () => {
    const source = { id: "hole", name: "Hole", kind: "circle" as const, dimensions: { diameter: 8 } };
    await componentPresetRepo.create(source);
    source.dimensions.diameter = 99;
    expect(await componentPresetRepo.list()).toEqual([{ id: "hole", name: "Hole", kind: "circle", dimensions: { diameter: 8 } }]);
    await componentPresetRepo.update({ id: "hole", name: "Mounting hole", kind: "circle", dimensions: { diameter: 6 } });
    expect((await componentPresetRepo.list())[0].name).toBe("Mounting hole");
    await componentPresetRepo.delete("hole");
    expect(await componentPresetRepo.list()).toEqual([]);
  });
  it("deleting a preset cannot mutate a project instance snapshot", async () => {
    const preset = { id: "hole", name: "Hole", kind: "circle" as const, dimensions: { diameter: 8 } };
    await componentPresetRepo.create(preset);
    const instance = createComponentInstanceFromPreset(preset, "placed");
    await componentPresetRepo.delete("hole");
    expect(instance.dimensions).toEqual({ diameter: 8 });
  });
  it("does not create a missing preset during update", async () => {
    const missing = { id: "missing", name: "Missing", kind: "circle" as const, dimensions: { diameter: 4 } };
    await expect(componentPresetRepo.update(missing)).rejects.toThrow("Unknown component preset");
    expect(await componentPresetRepo.list()).toEqual([]);
  });
  it("cannot resurrect a preset when delete races update", async () => {
    const preset = { id: "race", name: "Original", kind: "circle" as const, dimensions: { diameter: 4 } };
    await componentPresetRepo.create(preset);
    await Promise.all([componentPresetRepo.update({ ...preset, name: "Updated" }), componentPresetRepo.delete(preset.id)]);
    expect(await componentPresetRepo.list()).toEqual([]);
  });
});
