import { gzipSync, Gunzip, strFromU8, strToU8 } from "fflate";
import type { CamSettings, Document } from "../core/model";
import { sanitizeEnclosureWorkspace } from "../core/enclosure/workspace";

const MAX_ENCODED = 65_536;
const MAX_DECODED = 1_000_000;

export type SharedProjectPayload = { version: 1; document: Document; camSettings: CamSettings };
export type SharedProjectDecodeResult = { ok: true; payload: SharedProjectPayload } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === "string";
const transform = (value: unknown) => isRecord(value) && ["a", "b", "c", "d", "e", "f"].every((key) => finite(value[key]));
const point = (value: unknown) => isRecord(value) && finite(value.x) && finite(value.y);

function validObject(value: unknown): boolean {
  if (!isRecord(value) || !text(value.id) || !text(value.layerId) || !transform(value.transform)) return false;
  if (value.kind === "shape") return isRecord(value.shape) && value.shape.type === "rect" && finite(value.shape.width) && value.shape.width > 0 && finite(value.shape.height) && value.shape.height > 0;
  if (value.kind === "path") return typeof value.closed === "boolean" && Array.isArray(value.points) && value.points.length <= 100_000 && value.points.every(point);
  if (value.kind === "macro") return text(value.defId) && Number.isInteger(value.defVersion) && isRecord(value.params) && Object.values(value.params).every((item) => text(item) || typeof item === "boolean" || finite(item));
  return false;
}

function validSketch(value: unknown, layerIds: Set<string>): boolean {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.points) || !isRecord(value.entities) || !isRecord(value.constraints) || !isRecord(value.parameters)) return false;
  const points = new Set(Object.keys(value.points)), entities = new Set(Object.keys(value.entities)), parameters = new Set(Object.keys(value.parameters));
  if (points.size > 10_000 || entities.size > 10_000 || Object.keys(value.constraints).length > 20_000 || parameters.size > 1_000) return false;
  if (!Object.entries(value.points).every(([id, item]) => isRecord(item) && item.id === id && finite(item.x) && finite(item.y))) return false;
  if (!Object.entries(value.entities).every(([id, item]) => isRecord(item) && item.id === id && (item.layerId === undefined || (text(item.layerId) && layerIds.has(item.layerId))) && (item.kind === "line" ? text(item.p1) && points.has(item.p1) && text(item.p2) && points.has(item.p2) : item.kind === "circle" && text(item.center) && points.has(item.center) && finite(item.r) && item.r > 0))) return false;
  if (!Object.entries(value.parameters).every(([id, item]) => isRecord(item) && item.id === id && text(item.name) && finite(item.value))) return false;
  const pointFields = new Set(["pointId", "a", "b"]), entityFields = new Set(["lineId", "lineA", "lineB", "circleId", "circleA", "circleB"]);
  const types = new Set(["fix", "coincident", "horizontal", "vertical", "parallel", "perpendicular", "equalLength", "equalRadius", "pointOnLine", "pointOnCircle", "midpoint", "concentric", "distance", "pointLineDistance", "length", "diameter", "radius"]);
  const required: Record<string, string[]> = { fix: ["pointId"], coincident: ["a", "b"], horizontal: ["lineId"], vertical: ["lineId"], parallel: ["lineA", "lineB"], perpendicular: ["lineA", "lineB"], equalLength: ["lineA", "lineB"], equalRadius: ["circleA", "circleB"], pointOnLine: ["pointId", "lineId"], pointOnCircle: ["pointId", "circleId"], midpoint: ["pointId", "lineId"], concentric: ["circleA", "circleB"], distance: ["a", "b", "value"], pointLineDistance: ["pointId", "lineId", "value"], length: ["lineId", "value"], diameter: ["circleId", "value"], radius: ["circleId", "value"] };
  return Object.entries(value.constraints).every(([id, item]) => {
    if (!isRecord(item) || item.id !== id || !text(item.type) || !types.has(item.type)) return false;
    if (!required[item.type].every((key) => item[key] !== undefined)) return false;
    for (const [key, field] of Object.entries(item)) {
      if (pointFields.has(key) && (!text(field) || !points.has(field))) return false;
      if (entityFields.has(key) && (!text(field) || !entities.has(field))) return false;
    }
    if (item.value !== undefined && (!isRecord(item.value) || (item.value.kind === "literal" ? !finite(item.value.value) : item.value.kind !== "param" || !text(item.value.paramId) || !parameters.has(item.value.paramId)))) return false;
    return item.offsetMm === undefined || finite(item.offsetMm);
  });
}

function validDocument(value: Record<string, unknown>): boolean {
  if (value.version !== 1 || value.units !== "mm" || !Array.isArray(value.layers) || !Array.isArray(value.objects) || value.layers.length > 1_000 || value.objects.length > 100_000) return false;
  const layers = value.layers;
  if (!layers.every((layer) => isRecord(layer) && text(layer.id) && text(layer.name) && typeof layer.visible === "boolean" && typeof layer.locked === "boolean" && (layer.operationId === undefined || text(layer.operationId)))) return false;
  const layerIds = new Set(layers.map((layer) => (layer as Record<string, unknown>).id as string));
  if (layerIds.size !== layers.length || !value.objects.every(validObject) || !value.objects.every((object) => layerIds.has((object as Record<string, unknown>).layerId as string))) return false;
  const objectIds = value.objects.map((object) => (object as Record<string, unknown>).id as string);
  if (new Set(objectIds).size !== objectIds.length) return false;
  if (value.groups !== undefined && (!Array.isArray(value.groups) || !value.groups.every((group) => isRecord(group) && text(group.id) && text(group.name) && Array.isArray(group.memberIds) && group.memberIds.every((id) => text(id) && objectIds.includes(id))))) return false;
  return value.sketch === undefined || value.sketch === null || validSketch(value.sketch, layerIds);
}

function validCam(value: Record<string, unknown>, document: Record<string, unknown>): boolean {
  if (!Array.isArray(value.operations) || value.operations.length > 1_000) return false;
  const operations = value.operations;
  if (!operations.every((operation) => isRecord(operation) && text(operation.id) && text(operation.name) && (operation.mode === "line" || operation.mode === "fill") && finite(operation.speed) && operation.speed > 0 && finite(operation.power) && operation.power >= 0 && operation.power <= 100 && Number.isInteger(operation.passes) && (operation.passes as number) > 0 && (operation.lineInterval === undefined || finite(operation.lineInterval) && operation.lineInterval > 0) && (operation.angle === undefined || finite(operation.angle)) && (operation.order === undefined || ["insideOut", "shortestTravel", "topDown"].includes(operation.order as string)))) return false;
  if (value.optimizePaths !== undefined && typeof value.optimizePaths !== "boolean") return false;
  if (value.global !== undefined && (!isRecord(value.global) || (value.global.curveToleranceMm !== undefined && (!finite(value.global.curveToleranceMm) || value.global.curveToleranceMm <= 0)))) return false;
  const ids = operations.map((operation) => (operation as Record<string, unknown>).id as string);
  if (new Set(ids).size !== ids.length) return false;
  return (document.layers as unknown[]).every((layer) => !isRecord(layer) || layer.operationId === undefined || ids.includes(layer.operationId as string));
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 4096) binary += String.fromCharCode(...bytes.subarray(offset, offset + 4096));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validatePayload(value: unknown): SharedProjectPayload {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.document) || !isRecord(value.camSettings)) throw new Error("Shared project has an invalid format.");
  const document = value.document;
  if (Array.isArray(document.objects) && document.objects.some((object) => isRecord(object) && object.kind === "image")) throw new Error("Raster images cannot be included in a share link.");
  if (!validDocument(document)) throw new Error("Shared project contains an invalid document.");
  if (!validCam(value.camSettings, document)) throw new Error("Shared project contains invalid cutting settings.");
  const sourceDocument = document as unknown as Document;
  const cloned: SharedProjectPayload = { version: 1, document: structuredClone({ version: sourceDocument.version, units: sourceDocument.units, layers: sourceDocument.layers, objects: sourceDocument.objects, ...(sourceDocument.sketch !== undefined ? { sketch: sourceDocument.sketch } : {}), ...(sourceDocument.groups !== undefined ? { groups: sourceDocument.groups } : {}), ...(sourceDocument.enclosureWorkspace !== undefined ? { enclosureWorkspace: sourceDocument.enclosureWorkspace } : {}) }), camSettings: structuredClone({ operations: (value.camSettings as unknown as CamSettings).operations, ...((value.camSettings as unknown as CamSettings).optimizePaths !== undefined ? { optimizePaths: (value.camSettings as unknown as CamSettings).optimizePaths } : {}), ...((value.camSettings as unknown as CamSettings).global !== undefined ? { global: (value.camSettings as unknown as CamSettings).global } : {}) }) };
  if ("enclosureWorkspace" in cloned.document && cloned.document.enclosureWorkspace !== undefined) {
    const workspace = sanitizeEnclosureWorkspace(cloned.document.enclosureWorkspace);
    if (!workspace) throw new Error("Shared project contains invalid enclosure data.");
    cloned.document.enclosureWorkspace = workspace;
  }
  return cloned;
}

function boundedGunzip(compressed: Uint8Array): Uint8Array {
  if (compressed.length < 4) throw new Error("Shared project link is malformed.");
  const expected = compressed[compressed.length - 4] | compressed[compressed.length - 3] << 8 | compressed[compressed.length - 2] << 16 | compressed[compressed.length - 1] << 24;
  if ((expected >>> 0) > MAX_DECODED) throw new Error("Shared project is too large.");
  const chunks: Uint8Array[] = []; let total = 0;
  const gunzip = new Gunzip((chunk) => { total += chunk.length; if (total > MAX_DECODED) throw new Error("Shared project is too large."); chunks.push(chunk); });
  for (let offset = 0; offset < compressed.length; offset += 512) gunzip.push(compressed.subarray(offset, offset + 512), offset + 512 >= compressed.length);
  const output = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

export function hasSharedProjectHash(hash: string): boolean {
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash).has("share");
}

export function encodeSharedProject(payload: SharedProjectPayload): string {
  const checked = validatePayload(payload);
  const json = strToU8(JSON.stringify(checked));
  if (json.length > MAX_DECODED) throw new Error("Project is too large for a share link.");
  const compressed = gzipSync(json, { level: 9, mtime: 0 });
  const hash = `#share=v1.${crc32(compressed).toString(16).padStart(8, "0")}.${base64UrlEncode(compressed)}`;
  if (hash.length > MAX_ENCODED) throw new Error("Project is too large for a share link.");
  return hash;
}

export function decodeSharedProjectHash(hash: string): SharedProjectDecodeResult {
  try {
    const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
    if (normalized.length > MAX_ENCODED) throw new Error("Shared project link is too large.");
    const capsule = new URLSearchParams(normalized).get("share");
    if (!capsule) throw new Error("No shared project found.");
    const [version, checksum, encoded, ...rest] = capsule.split(".");
    if (version !== "v1") throw new Error("This shared project requires a newer Laserix version.");
    if (!/^[0-9a-f]{8}$/.test(checksum) || !encoded || rest.length) throw new Error("Shared project link is malformed.");
    const compressed = base64UrlDecode(encoded);
    if (crc32(compressed).toString(16).padStart(8, "0") !== checksum) throw new Error("Shared project link is damaged.");
    const bytes = boundedGunzip(compressed);
    return { ok: true, payload: validatePayload(JSON.parse(strFromU8(bytes))) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Shared project link is invalid." };
  }
}

export function sharedProjectUrl(payload: SharedProjectPayload, location: Pick<Location, "origin" | "pathname">): string {
  return `${location.origin}${location.pathname}${encodeSharedProject(payload)}`;
}
