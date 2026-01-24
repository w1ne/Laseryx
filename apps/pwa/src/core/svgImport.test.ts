// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { parseSvg } from "./svgImport";
import { Point } from "./model";

declare const global: any;

// Minimal mock for SVG geometry since JSDOM doesn't support getPointAtLength
// This only needs to support the commands we generate in svgImport.ts (M, L, H, V)
beforeAll(() => {
    // Polyfill SVGPathElement if missing (JSDOM might not expose it globally or at all)
    if (typeof (global as any).SVGPathElement === 'undefined') {
        (global as any).SVGPathElement = class SVGPathElement {
            getAttribute(name: string) { return ""; } // Mock for generic usage
        };
    }

    if (!(global as any).SVGPathElement.prototype.getTotalLength) {
        (global as any).SVGPathElement.prototype.getTotalLength = function () {
            const d = this.getAttribute("d") || "";
            return calculatePathLength(d);
        };
    }

    if (!(global as any).SVGPathElement.prototype.getPointAtLength) {
        (global as any).SVGPathElement.prototype.getPointAtLength = function (len: number) {
            const d = this.getAttribute("d") || "";
            return calculatePointAtLength(d, len);
        };
    }

    // Also need to support document.createElementNS for the test to work since svgImport uses it
    if (!(global as any).document) {
        (global as any).document = {
            createElementNS: (ns: any, tag: any) => {
                if (tag === 'path') return new (global as any).SVGPathElement();
                return {};
            }
        }
    } else {
        // If document exists (JSDOM), patch createElementNS if needed
        const orig = document.createElementNS;
        document.createElementNS = (ns: any, tag: any) => {
            if (tag === 'path') {
                const el = orig.call(document, ns, tag);
                // Ensure it has methods if JSDOM didn't add them to the instance
                if (!el.getTotalLength) {
                    el.getTotalLength = (global as any).SVGPathElement.prototype.getTotalLength;
                    el.getPointAtLength = (global as any).SVGPathElement.prototype.getPointAtLength;
                }
                return el;
            }
            return orig.call(document, ns, tag);
        }
    }
});

function calculatePathLength(d: string): number {
    // Simplified parser for M x y h w ...
    // We assume the strict format we produce in svgImport
    const segments = parseSegments(d);
    let len = 0;
    let curr = { x: 0, y: 0 };

    for (const seg of segments) {
        // Logic to add length
        if (seg.cmd === 'M') {
            curr = { x: seg.args[0], y: seg.args[1] };
        } else {
            const next = getNextPoint(curr, seg);
            len += Math.hypot(next.x - curr.x, next.y - curr.y);
            curr = next;
        }
    }
    return len;
}

function calculatePointAtLength(d: string, targetLen: number): Point {
    const segments = parseSegments(d);
    let curr = { x: 0, y: 0 };
    let traversed = 0;

    for (const seg of segments) {
        if (seg.cmd === 'M') {
            curr = { x: seg.args[0], y: seg.args[1] };
        } else {
            const next = getNextPoint(curr, seg);
            const dist = Math.hypot(next.x - curr.x, next.y - curr.y);

            if (traversed + dist >= targetLen) {
                // Interpolate
                const t = (targetLen - traversed) / dist;
                return {
                    x: curr.x + (next.x - curr.x) * t,
                    y: curr.y + (next.y - curr.y) * t
                };
            }

            traversed += dist;
            curr = next;
        }
    }
    return curr;
}

type Segment = { cmd: string, args: number[] };

function parseSegments(d: string): Segment[] {
    const tokens = d.replace(/[a-zA-Z]/g, ' $& ').trim().split(/[\s,]+/);
    const segs: Segment[] = [];
    let i = 0;
    while (i < tokens.length) {
        const cmd = tokens[i++];
        const args: number[] = [];
        // Consuming args based on command is hard without logic.
        // But our generate logic is simple:
        // M x y
        // h w
        // v h
        // L x y
        // A ... (not supported in this mock yet, but we test rect/line)
        if (cmd === 'M' || cmd === 'L') { args.push(parseFloat(tokens[i++]), parseFloat(tokens[i++])); }
        else if (cmd === 'h' || cmd === 'v') { args.push(parseFloat(tokens[i++])); }
        else if (cmd.toLowerCase() === 'z') { /* no args */ }

        segs.push({ cmd, args });
    }
    return segs;
}

function getNextPoint(curr: Point, seg: Segment): Point {
    if (seg.cmd === 'L') return { x: seg.args[0], y: seg.args[1] };
    if (seg.cmd === 'h') return { x: curr.x + seg.args[0], y: curr.y };
    if (seg.cmd === 'v') return { x: curr.x, y: curr.y + seg.args[0] };
    if (seg.cmd.toLowerCase() === 'z') return curr; // technically closes loop
    return curr;
}

describe("parseSvg", () => {
    it("should handle null SVG string", () => {
        // @ts-expect-error Testing invalid input
        expect(() => parseSvg(null)).toThrow();
    });

    it("should handle invalid SVG string", () => {
        // @ts-expect-error Testing invalid input
        expect(() => parseSvg("not an svg")).toThrow();
    });

    it("should handle SVG without shapes", () => {
        const result = parseSvg("<svg></svg>");
        expect(result).toEqual([]);
    });

    it("parses a simple rectangle", () => {
        const svg = `<svg><rect x="10" y="10" width="100" height="50" /></svg>`;
        const objs = parseSvg(svg);

        expect(objs).toHaveLength(1);
        const path = objs[0];
        expect(path.kind).toBe("path");

        if (path.kind === "path") {
            expect(path.closed).toBe(true);
            // Verify points
            // Should start at 10,10, transform to 110,10, 110,60, 10,60
            // We just check bbox broadly
            const xs = path.points.map(p => p.x);
            const ys = path.points.map(p => p.y);
            expect(Math.min(...xs)).toBeCloseTo(10, 0);
            expect(Math.max(...xs)).toBeCloseTo(110, 0);
            expect(Math.min(...ys)).toBeCloseTo(10, 0);
            expect(Math.max(...ys)).toBeCloseTo(60, 0);
        }
    });

    it("handles transforms (translate)", () => {
        const svg = `<svg><g transform="translate(10, 20)"><line x1="0" y1="0" x2="10" y2="0" /></g></svg>`;
        const objs = parseSvg(svg);
        expect(objs).toHaveLength(1);
        const path = objs[0];
        // The transform should be baked into the objects 'transform' property
        // parseSvg sets transform property.
        // The point data is LOCAL to the shape?
        // Let's check logic in svgImport.ts.
        // traverse passes 'combinedTransform' down.
        // elementToPathObj sets 'transform: transform' (which is combined).
        // And 'getPointAtLength' returns points in the element's coordinate system (local).
        // So for <line x1=0 ...>, points are (0,0) -> (10,0).
        // And transform is {e:10, f:20}.

        if (path.kind === "path") {
            expect(path.transform.e).toBe(10);
            expect(path.transform.f).toBe(20);

            const first = path.points[0];
            expect(first.x).toBeCloseTo(0);
            expect(first.y).toBeCloseTo(0);
        }
    });
});
