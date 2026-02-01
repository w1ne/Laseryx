import { PolylinePath } from "./model";

/**
 * Generates scanline toolpaths for a set of closed polylines.
 * Uses the even-odd rule for filling, supporting nested holes.
 * 
 * Uses a mid-point sampling approach (offsetting scanlines by half an interval)
 * to avoid vertex singularities and ensure robust intersection calculation.
 * 
 * @param polylines The closed polylines to fill.
 * @param interval The distance between scanlines in mm.
 * @param angle The angle of the scanlines in degrees.
 */
export function vectorFill(polylines: PolylinePath[], interval: number, angle: number): PolylinePath[] {
    const closedPolys = polylines.filter(p => p.closed && p.points.length >= 3);
    if (closedPolys.length === 0) {
        return [];
    }

    // 1. Setup transformation (rotation)
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatedPolys = closedPolys.map(poly =>
        poly.points.map(p => ({
            x: p.x * cos + p.y * sin,
            y: -p.x * sin + p.y * cos
        }))
    );

    // 2. Find global bounds in rotated space
    let minY = rotatedPolys[0][0].y;
    let maxY = rotatedPolys[0][0].y;
    for (const poly of rotatedPolys) {
        for (const p of poly) {
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
    }

    // 3. Generate scanlines
    const resultPaths: PolylinePath[] = [];

    // Offset by half interval to avoid hitting vertices exactly and ensure symmetry
    // We start at the first half-offset that is >= minY
    const firstLine = Math.floor((minY) / interval) * interval + (interval / 2);
    const startY = firstLine < minY ? firstLine + interval : firstLine;

    const EPSILON = 0.00001;

    for (let y = startY; y < maxY - EPSILON; y += interval) {
        const intersections: number[] = [];

        for (const poly of rotatedPolys) {
            for (let i = 0; i < poly.length; i++) {
                const p1 = poly[i];
                const p2 = poly[(i + 1) % poly.length];

                // Since y is at a half-offset, we should almost never hit a vertex exactly.
                // Standard intersection logic:
                if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                    const x = p1.x + (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
                    intersections.push(x);
                }
            }
        }

        // Sort intersections left-to-right
        intersections.sort((a, b) => a - b);

        // Pair intersections (Even-Odd rule)
        for (let i = 0; i < intersections.length - 1; i += 2) {
            const x1 = intersections[i];
            const x2 = intersections[i + 1];

            if (Math.abs(x1 - x2) > EPSILON) {
                // Back-rotate points to original space
                const p1Orig = {
                    x: x1 * cos - y * sin,
                    y: x1 * sin + y * cos
                };
                const p2Orig = {
                    x: x2 * cos - y * sin,
                    y: x2 * sin + y * cos
                };

                resultPaths.push({
                    points: [p1Orig, p2Orig],
                    closed: false
                });
            }
        }
    }

    return resultPaths;
}
