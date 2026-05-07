import { describe, expect, it, vi } from "vitest";
import { automationCapabilities } from "../capabilities";
import type { AutomationProtocolResponse } from "../protocol/types";
import { callMcpTool, listMcpTools, type BrowserCommandPoster } from "./tools";

const okResponse: AutomationProtocolResponse = {
  protocolVersion: 1,
  requestId: "req-1",
  ok: true,
  command: "project.list",
  data: { projects: [] },
  warnings: [],
  errors: []
};

function createPoster(): BrowserCommandPoster {
  return vi.fn(async () => okResponse);
}

describe("mcp tools", () => {
  it("lists deterministic tool definitions", () => {
    expect(listMcpTools().map((tool) => tool.name)).toEqual([
      "laseryx_status",
      "laseryx_bridge_status",
      "laseryx_capabilities",
      "laseryx_browser_run",
      "laseryx_project_new",
      "laseryx_project_list",
      "laseryx_project_open",
      "laseryx_project_save",
      "laseryx_project_summary",
      "laseryx_project_export_json",
      "laseryx_project_import_json",
      "laseryx_project_delete",
      "laseryx_document_add_rect",
      "laseryx_document_list_objects",
      "laseryx_document_update_transform",
      "laseryx_document_delete_object",
      "laseryx_cam_set_operation",
      "laseryx_generate"
    ]);
  });

  it("returns automation capabilities without requiring a browser command", async () => {
    const poster = createPoster();
    const result = await callMcpTool("laseryx_capabilities", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const parsed = JSON.parse(result.content[0].text);

    expect(poster).not.toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(parsed.ok).toBe(true);
    expect(parsed.capabilities.map((capability: { command: string }) => capability.command)).toEqual(
      automationCapabilities().map((capability) => capability.command)
    );
  });

  it("reports MCP bridge configuration without requiring a browser command", async () => {
    const poster = createPoster();
    const result = await callMcpTool("laseryx_status", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).not.toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual({
      ok: true,
      bridgeUrl: "http://127.0.0.1:17321",
      tokenConfigured: true
    });
  });

  it("reports live bridge status through the configured status reader", async () => {
    const postStatus = vi.fn(async () => ({
      ok: true,
      attached: true,
      state: "idle",
      pendingCount: 0,
      inFlightCount: 0,
      waiterCount: 1,
      uptimeMs: 10,
      lastBrowserPollAt: 123,
      lastBrowserResponseAt: 120
    }));

    const result = await callMcpTool("laseryx_bridge_status", {}, {
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      postBrowserCommand: createPoster(),
      postBridgeStatus: postStatus
    });

    expect(postStatus).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev");
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({
      summary: {
        ok: true,
        attached: true,
        state: "idle",
        pendingCount: 0,
        inFlightCount: 0,
        waiterCount: 1,
        uptimeMs: 10,
        lastBrowserPollAt: 123,
        lastBrowserResponseAt: 120
      }
    });
  });

  it("maps project list to the browser protocol", async () => {
    const poster = createPoster();
    const result = await callMcpTool("laseryx_project_list", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev", "project.list", {});
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual(okResponse);
  });

  it("maps typed tool arguments to automation args", async () => {
    const poster = createPoster();
    await callMcpTool("laseryx_document_add_rect", {
      object: "rect-1",
      layer: "layer-1",
      x: 10,
      y: 20,
      width: 30,
      height: 40
    }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev", "document.addRect", {
      object: "rect-1",
      layer: "layer-1",
      x: 10,
      y: 20,
      width: 30,
      height: 40
    });
  });

  it("maps project lifecycle typed tools to automation commands", async () => {
    const poster = createPoster();
    const job = { document: { version: 1, units: "mm", layers: [], objects: [] }, camSettings: { operations: [] }, machineProfile: { id: "default" } };

    await callMcpTool("laseryx_project_new", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_project_summary", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_project_export_json", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_project_import_json", { job }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_project_delete", { id: "project-1" }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenNthCalledWith(1, "http://127.0.0.1:17321", "dev", "project.new", {});
    expect(poster).toHaveBeenNthCalledWith(2, "http://127.0.0.1:17321", "dev", "project.summary", {});
    expect(poster).toHaveBeenNthCalledWith(3, "http://127.0.0.1:17321", "dev", "project.exportJson", {});
    expect(poster).toHaveBeenNthCalledWith(4, "http://127.0.0.1:17321", "dev", "project.importJson", { job });
    expect(poster).toHaveBeenNthCalledWith(5, "http://127.0.0.1:17321", "dev", "project.delete", { id: "project-1" });
  });

  it("rejects malformed project imports at the MCP boundary", async () => {
    const poster = createPoster();

    const missing = await callMcpTool("laseryx_project_import_json", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const malformed = await callMcpTool("laseryx_project_import_json", { job: [] }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toContain("job must be a project JSON object");
    expect(malformed.isError).toBe(true);
    expect(malformed.content[0].text).toContain("job must be a project JSON object");
    expect(poster).not.toHaveBeenCalled();
  });

  it("adds a compact summary content block for generation responses", async () => {
    const poster = vi.fn(async () => ({
      protocolVersion: 1,
      requestId: "req-generate",
      ok: true,
      command: "generate" as const,
      data: {
        summary: {
          document: { objectCount: 2 },
          cam: { operationCount: 1 },
          machine: { id: "default-machine" }
        },
        preview: { bbox: { minX: 1, minY: 2, maxX: 10, maxY: 20 } },
        stats: { estTimeS: 12.5, travelMm: 4, markMm: 16, segments: 3 },
        gcode: "G0 X0 Y0"
      },
      warnings: [],
      errors: []
    }));

    const result = await callMcpTool("laseryx_generate", { includeGcode: true }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const summary = JSON.parse(result.content[1].text);

    expect(result.structuredContent).toEqual(summary);
    expect(summary).toEqual({
      summary: {
        command: "generate",
        ok: true,
        objectCount: 2,
        operationCount: 1,
        bbox: { minX: 1, minY: 2, maxX: 10, maxY: 20 },
        estTimeS: 12.5,
        gcodeIncluded: true
      }
    });
  });

  it("maps includeGcode false to an explicit gcode suppression request", async () => {
    const poster = createPoster();

    await callMcpTool("laseryx_generate", { includeGcode: false }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev", "generate", {
      includeGcode: false,
      gcodePath: null
    });
  });

  it("adds compact summaries for project, object list, and CAM responses", async () => {
    const poster = vi.fn(async (_bridgeUrl, _token, command) => ({
      protocolVersion: 1,
      requestId: "req-summary",
      ok: true,
      command,
      data: command === "document.listObjects"
        ? { objects: [{ id: "rect-1", kind: "shape", layerId: "layer-1" }], selectedObjectId: "rect-1" }
          : command === "cam.setOperation"
            ? { operation: { id: "op-1", speed: 1400, power: 62, passes: 2 } }
            : command === "project.summary"
              ? { jobSummary: { document: { objectCount: 1, layerCount: 1 }, cam: { operationCount: 1 }, machine: { id: "default" } } }
              : { project: { id: "project-1", name: "Project 1", summary: { objectCount: 1, operationCount: 1 } } },
      warnings: [],
      errors: []
    }));

    const list = await callMcpTool("laseryx_document_list_objects", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const cam = await callMcpTool("laseryx_cam_set_operation", { operation: "op-1", speed: 1400 }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const summaryResult = await callMcpTool("laseryx_project_summary", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const save = await callMcpTool("laseryx_project_save", { id: "project-1", name: "Project 1" }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(JSON.parse(list.content[1].text)).toEqual({
      summary: {
        command: "document.listObjects",
        ok: true,
        objectCount: 1,
        objects: [{ id: "rect-1", kind: "shape", layerId: "layer-1" }],
        selectedObjectId: "rect-1"
      }
    });
    expect(JSON.parse(cam.content[1].text)).toEqual({
      summary: {
        command: "cam.setOperation",
        ok: true,
        operation: { id: "op-1", speed: 1400, power: 62, passes: 2 }
      }
    });
    expect(JSON.parse(summaryResult.content[1].text)).toEqual({
      summary: {
        command: "project.summary",
        ok: true,
        jobSummary: {
          document: { objectCount: 1, layerCount: 1 },
          cam: { operationCount: 1 },
          machine: { id: "default" }
        }
      }
    });
    expect(JSON.parse(save.content[1].text)).toEqual({
      summary: {
        command: "project.save",
        ok: true,
        project: { id: "project-1", name: "Project 1", summary: { objectCount: 1, operationCount: 1 } }
      }
    });
  });

  it("maps document typed tools to automation commands", async () => {
    const poster = createPoster();

    await callMcpTool("laseryx_document_list_objects", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_document_update_transform", {
      object: "rect-1",
      x: 5,
      y: 7,
      rotation: 15
    }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_document_delete_object", { object: "rect-1", dryRun: true }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenNthCalledWith(1, "http://127.0.0.1:17321", "dev", "document.listObjects", {});
    expect(poster).toHaveBeenNthCalledWith(2, "http://127.0.0.1:17321", "dev", "document.updateObjectTransform", {
      object: "rect-1",
      x: 5,
      y: 7,
      rotation: 15
    });
    expect(poster).toHaveBeenNthCalledWith(3, "http://127.0.0.1:17321", "dev", "document.deleteObject", { object: "rect-1", dryRun: true });
  });

  it("maps CAM typed tools to automation commands", async () => {
    const poster = createPoster();

    await callMcpTool("laseryx_cam_set_operation", {
      operation: "op-1",
      speed: 1600,
      power: 55,
      passes: 2
    }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenNthCalledWith(1, "http://127.0.0.1:17321", "dev", "cam.setOperation", {
      operation: "op-1",
      speed: 1600,
      power: 55,
      passes: 2
    });
  });

  it("supports a generic browser command escape hatch", async () => {
    const poster = createPoster();
    await callMcpTool("laseryx_browser_run", {
      command: "ui.setActiveTab",
      args: { tab: "machine" }
    }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenCalledWith("http://127.0.0.1:17321", "dev", "ui.setActiveTab", { tab: "machine" });
  });

  it("returns MCP tool errors for unknown tools and rejected browser commands", async () => {
    const poster = vi.fn(async () => ({
      ...okResponse,
      ok: false,
      command: "project.open",
      errors: [{ code: "NOT_FOUND", severity: "error" as const, message: "Project not found" }]
    }));

    const unknown = await callMcpTool("missing_tool", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    const rejected = await callMcpTool("laseryx_project_open", { id: "missing" }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toContain("Unknown MCP tool");
    expect(rejected.isError).toBe(true);
    expect(JSON.parse(rejected.content[0].text).errors[0].code).toBe("NOT_FOUND");
  });
});
