import { describe, expect, it, vi } from "vitest";
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
      "laseryx_browser_run",
      "laseryx_project_new",
      "laseryx_project_list",
      "laseryx_project_open",
      "laseryx_project_save",
      "laseryx_project_export_json",
      "laseryx_document_add_rect",
      "laseryx_document_list_objects",
      "laseryx_document_update_transform",
      "laseryx_document_delete_object",
      "laseryx_cam_set_operation",
      "laseryx_generate"
    ]);
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

    await callMcpTool("laseryx_project_new", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });
    await callMcpTool("laseryx_project_export_json", {}, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenNthCalledWith(1, "http://127.0.0.1:17321", "dev", "project.new", {});
    expect(poster).toHaveBeenNthCalledWith(2, "http://127.0.0.1:17321", "dev", "project.exportJson", {});
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
    await callMcpTool("laseryx_document_delete_object", { object: "rect-1" }, { bridgeUrl: "http://127.0.0.1:17321", token: "dev", postBrowserCommand: poster });

    expect(poster).toHaveBeenNthCalledWith(1, "http://127.0.0.1:17321", "dev", "document.listObjects", {});
    expect(poster).toHaveBeenNthCalledWith(2, "http://127.0.0.1:17321", "dev", "document.updateObjectTransform", {
      object: "rect-1",
      x: 5,
      y: 7,
      rotation: 15
    });
    expect(poster).toHaveBeenNthCalledWith(3, "http://127.0.0.1:17321", "dev", "document.deleteObject", { object: "rect-1" });
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
