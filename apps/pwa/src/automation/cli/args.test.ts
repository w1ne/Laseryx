import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args";

describe("parseCliArgs", () => {
  it("parses generate with output path", () => {
    expect(parseCliArgs(["generate", "--input", "job.json", "--gcode-out", "/tmp/job.gcode"])).toEqual({
      ok: true,
      mode: "file",
      command: "generate",
      inputPath: "job.json",
      gcodeOut: "/tmp/job.gcode",
      includeGcode: false
    });
  });

  it("parses include-gcode", () => {
    expect(parseCliArgs(["generate", "--input", "job.json", "--gcode-out", "/tmp/job.gcode", "--include-gcode"])).toEqual({
      ok: true,
      mode: "file",
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

  it("parses browser serve", () => {
    expect(parseCliArgs(["browser", "serve", "--port", "17321", "--token", "dev"])).toEqual({
      ok: true,
      mode: "browser-serve",
      port: 17321,
      host: "127.0.0.1",
      token: "dev"
    });
  });

  it("parses browser run", () => {
    expect(parseCliArgs([
      "browser",
      "run",
      "inspect",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev"
    ])).toEqual({
      ok: true,
      mode: "browser-run",
      command: "inspect",
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      args: {}
    });
  });

  it("parses browser run command args", () => {
    expect(parseCliArgs([
      "browser",
      "run",
      "cam.setOperation",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev",
      "--operation",
      "op-1",
      "--power",
      "65",
      "--speed",
      "1200"
    ])).toEqual({
      ok: true,
      mode: "browser-run",
      command: "cam.setOperation",
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      args: {
        operation: "op-1",
        power: 65,
        speed: 1200
      }
    });
  });
});
