import { describe, expect, it } from "vitest";
import type { SharedProjectPayload } from "./shareCapsule";
import { decodeSharedProjectHash, encodeSharedProject, hasSharedProjectHash, sharedProjectUrl } from "./shareCapsule";

const payload = (): SharedProjectPayload => ({
  version: 1,
  document: { version: 1, units: "mm", layers: [{ id: "cut", name: "Cut", visible: true, locked: false, operationId: "cut" }], objects: [{ kind: "shape", id: "r", layerId: "cut", transform: { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 }, shape: { type: "rect", width: 20, height: 10 } }] },
  camSettings: { operations: [{ id: "cut", name: "Cut", mode: "line", speed: 900, power: 80, passes: 2 }] }
});

describe("shared project capsule", () => {
  it("deterministically round-trips document and CAM state", () => {
    const first = encodeSharedProject(payload());
    expect(first).toMatch(/^#share=v1\.[0-9a-f]{8}\./);
    expect(encodeSharedProject(payload())).toBe(first);
    expect(decodeSharedProjectHash(first)).toEqual({ ok: true, payload: payload() });
    expect(sharedProjectUrl(payload(), { origin: "https://laseryx.com", pathname: "/editor" })).toBe(`https://laseryx.com/editor${first}`);
  });

  it("rejects raster projects", () => {
    const value = payload();
    value.document.objects = [{ kind: "image", id: "img", layerId: "cut", transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, width: 20, height: 10, src: "blob:x" }];
    expect(() => encodeSharedProject(value)).toThrow("Raster images cannot be included in a share link.");
  });

  it.each(["#share=v2.00000000.eA", "#share=v1.00000000.not_base64!", `#share=${"a".repeat(65_537)}`])("rejects malformed or unsupported hash %s", (hash) => {
    expect(decodeSharedProjectHash(hash)).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects corruption without exposing a payload", () => {
    const encoded = encodeSharedProject(payload()).replace(/v1\.[0-9a-f]{8}/, "v1.deadbeef");
    expect(decodeSharedProjectHash(encoded)).toEqual({ ok: false, error: "Shared project link is damaged." });
  });

  it("rejects malformed nested geometry and CAM settings", () => {
    const malformedObject = payload() as unknown as { document: { objects: unknown[] } };
    malformedObject.document.objects = [null];
    expect(() => encodeSharedProject(malformedObject as never)).toThrow("invalid document");
    const malformedCam = payload(); malformedCam.camSettings.operations[0].speed = -1;
    expect(() => encodeSharedProject(malformedCam)).toThrow("invalid cutting settings");
  });

  it("detects an actual share parameter only", () => {
    expect(hasSharedProjectHash("#share=value")).toBe(true);
    expect(hasSharedProjectHash("#note=share=value")).toBe(false);
  });
});
