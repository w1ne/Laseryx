import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateGcode } from "../../src/core/gcode";
import type { CamSettings, Document, GcodeDialect, MachineProfile } from "../../src/core/model";

type Fixture = {
  document: Document;
  cam: CamSettings;
  machine: MachineProfile;
  dialect: GcodeDialect;
};

const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const expectedDir = fileURLToPath(new URL("./expected", import.meta.url));

function loadFixture(name: string): Fixture {
  const raw = readFileSync(join(fixturesDir, name), "utf-8");
  return JSON.parse(raw) as Fixture;
}

function loadExpected(name: string): string {
  return readFileSync(join(expectedDir, name.replace(/\.json$/, ".gcode")), "utf-8");
}

describe("golden gcode", () => {
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const fixtureFile of fixtureFiles) {
    it(fixtureFile, () => {
      const fixture = loadFixture(fixtureFile);
      const result = generateGcode(
        fixture.document,
        fixture.cam,
        fixture.machine,
        fixture.dialect
      );
      const expected = loadExpected(fixtureFile).trimEnd();

      expect(result.gcode.trimEnd()).toBe(expected);
    });
  }
});
