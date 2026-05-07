import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args";

describe("parseCliArgs", () => {
  it("parses generate with output path", () => {
    expect(parseCliArgs(["generate", "--input", "job.json", "--gcode-out", "/tmp/job.gcode"])).toEqual({
      ok: true,
      command: "generate",
      inputPath: "job.json",
      gcodeOut: "/tmp/job.gcode",
      includeGcode: false
    });
  });

  it("parses include-gcode", () => {
    expect(parseCliArgs(["generate", "--input", "job.json", "--gcode-out", "/tmp/job.gcode", "--include-gcode"])).toEqual({
      ok: true,
      command: "generate",
      inputPath: "job.json",
      gcodeOut: "/tmp/job.gcode",
      includeGcode: true
    });
  });

  it("rejects unknown commands", () => {
    expect(parseCliArgs(["delete", "--input", "job.json"])).toEqual({
      ok: false,
      message: "Unknown command: delete"
    });
  });

  it("requires input", () => {
    expect(parseCliArgs(["inspect"])).toEqual({
      ok: false,
      message: "Missing --input"
    });
  });
});
