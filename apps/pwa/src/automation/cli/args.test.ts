import { describe, expect, it } from "vitest";
import { cliAutomationCapabilities } from "../capabilities";
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

  it("accepts every CLI-exposed browser automation capability", () => {
    for (const capability of cliAutomationCapabilities()) {
      expect(parseCliArgs([
        "browser",
        "run",
        capability.command,
        "--bridge",
        "http://127.0.0.1:17321",
        "--token",
        "dev"
      ])).toMatchObject({
        ok: true,
        mode: "browser-run",
        command: capability.command
      });
    }
  });

  it("parses browser status", () => {
    expect(parseCliArgs([
      "browser",
      "status",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev"
    ])).toEqual({
      ok: true,
      mode: "browser-status",
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev"
    });
  });

  it("parses browser attach-url", () => {
    expect(parseCliArgs([
      "browser",
      "attach-url",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev",
      "--app",
      "http://localhost:5173"
    ])).toEqual({
      ok: true,
      mode: "browser-attach-url",
      appUrl: "http://localhost:5173",
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev"
    });
  });

  it("parses browser link", () => {
    expect(parseCliArgs([
      "browser",
      "link",
      "document.addRect",
      "--app",
      "https://laseryx.com/workbench",
      "--title",
      "Linked rectangle",
      "--object",
      "rect-link-1",
      "--layer",
      "layer-1",
      "--width",
      "40",
      "--height",
      "20"
    ])).toEqual({
      ok: true,
      mode: "browser-link",
      appUrl: "https://laseryx.com/workbench",
      title: "Linked rectangle",
      command: "document.addRect",
      args: {
        object: "rect-link-1",
        layer: "layer-1",
        width: 40,
        height: 20
      }
    });
  });

  it("requires bridge URL for browser status and attach-url", () => {
    expect(parseCliArgs(["browser", "status"])).toEqual({
      ok: false,
      message: "Missing --bridge"
    });
    expect(parseCliArgs(["browser", "attach-url"])).toEqual({
      ok: false,
      message: "Missing --bridge"
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

  it("parses browser run document mutation args", () => {
    expect(parseCliArgs([
      "browser",
      "run",
      "document.addRect",
      "--bridge",
      "http://127.0.0.1:17321",
      "--token",
      "dev",
      "--object",
      "rect-agent-1",
      "--layer",
      "layer-1",
      "--x",
      "10",
      "--y",
      "15",
      "--width",
      "40",
      "--height",
      "20"
    ])).toEqual({
      ok: true,
      mode: "browser-run",
      command: "document.addRect",
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      args: {
        object: "rect-agent-1",
        layer: "layer-1",
        x: 10,
        y: 15,
        width: 40,
        height: 20
      }
    });
  });

  it("accepts all document mutation browser commands", () => {
    for (const command of [
      "document.updateObjectTransform",
      "document.setObjectLayer",
      "document.deleteObject"
    ]) {
      expect(parseCliArgs([
        "browser",
        "run",
        command,
        "--bridge",
        "http://127.0.0.1:17321",
        "--token",
        "dev",
        "--object",
        "rect-agent-1"
      ])).toMatchObject({
        ok: true,
        mode: "browser-run",
        command,
        args: { object: "rect-agent-1" }
      });
    }
  });

  it("accepts all project lifecycle browser commands", () => {
    for (const command of [
      "project.new",
      "project.save",
      "project.list",
      "project.open",
      "project.delete",
      "project.summary",
      "project.exportJson",
      "project.importJson"
    ]) {
      expect(parseCliArgs([
        "browser",
        "run",
        command,
        "--bridge",
        "http://127.0.0.1:17321",
        "--token",
        "dev",
        "--id",
        "project-1"
      ])).toMatchObject({
        ok: true,
        mode: "browser-run",
        command
      });
    }
  });
});
