import { IDENTITY_TRANSFORM, composeTransforms } from "./geom";
import { Obj, PathObj, Point, Transform } from "./model";
import { randomId } from "./util";

/**
 * Basic SVG Parser using DOMParser and browser SVG APIs.
 * Flattens groups and transforms.
 * Converts basic shapes to Generic Path objects.
 */
export function parseSvg(svgContent: string): Obj[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgRoot = doc.documentElement;

    // Check for parse errors
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
        throw new Error("Failed to parse SVG");
    }

    const objects: Obj[] = [];

    // Recursive traversal
    function traverse(element: Element, currentTransform: Transform) {
        // Hidden?
        if (element instanceof SVGGraphicsElement) {
            const style = window.getComputedStyle(element);
            if (style.display === "none" || style.visibility === "hidden") {
                return;
            }
        }

        // Get element transform
        let localTransform = IDENTITY_TRANSFORM;
        // Check transform on any element that has it
        if (element.hasAttribute("transform")) {
            const transformAttr = element.getAttribute("transform");
            if (transformAttr) {
                localTransform = parseTransformAttribute(transformAttr);
            }
        }

        const combinedTransform = composeTransforms(localTransform, currentTransform);

        if (element.tagName === "g" || element.tagName === "svg") {
            for (const child of Array.from(element.children)) {
                traverse(child, combinedTransform);
            }
        } else if (isShape(element)) {
            const pathObj = elementToPathObj(element as SVGGeometryElement, combinedTransform);
            if (pathObj) {
                objects.push(pathObj);
            }
        }
    }

    traverse(svgRoot, IDENTITY_TRANSFORM);

    return objects;
}

function isShape(element: Element): boolean {
    return ["rect", "circle", "ellipse", "line", "polyline", "polygon", "path"].includes(element.tagName);
}

function elementToPathObj(element: SVGGeometryElement, transform: Transform): PathObj | null {
    // Convert basic shapes to path data explicitly if needed, but getPointAtLength works on all GeometryElements
    // IF the browser supports it for detached elements.
    // Chrome/Firefox usually do.

    // However, `getPointAtLength` might need the element to be <path>.
    // Ideally we convert everything to <path> d="..." first.

    let d = "";
    if (element.tagName === "path") {
        d = element.getAttribute("d") || "";
    } else {
        // Naive conversion or rely on browser?
        // Browser doesn't automatically give 'd' for <rect>.
        // We must manually convert primitives to path data or use a library.
        // Let's implement basic conversion for Rectangle/Circle/Line since they are common.
        d = convertToPathData(element);
    }

    if (!d) return null;

    // We need to sample the path.
    // We can create a PROXY path element with this D.
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", d);

    const totalLength = pathEl.getTotalLength();
    const points: Point[] = [];
    // Sampling resolution. 0.5mm? Or just a fixed number of segments per unit?
    // Let's try adaptive or fixed spacing. 
    // For 'KISS', fixed spacing of ~1mm is fine for MVP.
    // Or simply detailed sampling.
    const step = 0.5; // 0.5 unit (mm)
    for (let i = 0; i <= totalLength; i += step) {
        const pt = pathEl.getPointAtLength(i);
        points.push({ x: pt.x, y: pt.y });
    }
    // Ensure last point
    const last = pathEl.getPointAtLength(totalLength);
    if (totalLength > 0 && (points.length === 0 || distance(points[points.length - 1], last) > 0.001)) {
        points.push({ x: last.x, y: last.y });
    }

    // Apply baked transform
    // Note: we applied the transform hierarchy to the points via `transform` object property in PathObj?
    // User asked for "bake them into points OR object transform".
    // Since we have a `transform` property on `PathObj`, let's use it!
    // BUT we are flattening groups.
    // So the `PathObj.transform` should be the `combinedTransform` we calculated.
    // Wait, if we use `PathObj.transform`, we don't need to transform points here.
    // We just return the local points of the shape, and attach the combined matrix.

    // However, simple shapes (rect) might have their own x/y.
    // `getPointAtLength` returns points in the element's coordinate system (before its own 'transform' attribute if on path).
    // But we manually moved 'transform' attribute to `combinedTransform`.
    // So `d` should be purely geometry.

    return {
        kind: "path",
        id: randomId(),
        layerId: "layer-1", // Default layer
        transform: transform,
        points: points,
        closed: isClosed(element, d)
    };
}

function convertToPathData(element: Element): string {
    const tag = element.tagName;
    const get = (attr: string) => parseFloat(element.getAttribute(attr) || "0");

    if (tag === "rect") {
        const x = get("x");
        const y = get("y");
        const w = get("width");
        const h = get("height");
        // M x y H x+w V y+h H x Z
        return `M ${x} ${y} h ${w} v ${h} h ${-w} z`;
    }
    if (tag === "circle") {
        const cx = get("cx");
        const cy = get("cy");
        const r = get("r");
        // Two arcs
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    if (tag === "ellipse") {
        const cx = get("cx");
        const cy = get("cy");
        const rx = get("rx");
        const ry = get("ry");
        return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    if (tag === "line") {
        const x1 = get("x1");
        const y1 = get("y1");
        const x2 = get("x2");
        const y2 = get("y2");
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    if (tag === "polyline" || tag === "polygon") {
        const points = element.getAttribute("points") || "";
        // Convert "x,y x,y" to "M x y L x y ..."
        const coords = points.trim().split(/\s+|,/);
        let d = "";
        for (let i = 0; i < coords.length; i += 2) {
            d += (i === 0 ? "M " : "L ") + coords[i] + " " + (coords[i + 1] || "0") + " ";
        }
        if (tag === "polygon") d += "Z";
        return d;
    }
    return "";
}

function isClosed(element: Element, d: string): boolean {
    if (["rect", "circle", "ellipse", "polygon"].includes(element.tagName)) return true;
    return /z$/i.test(d.trim());
}

// Simple manual transform parser for format "matrix(a,b,c,d,e,f)" or "translate(x,y)" etc.
// For MVP, handling just 'matrix' or common ones is nice.
// Or we can create a temporary SVG element, set transform, and ask browser? 
// Not easily for detached string.
// Let's implement a basic regex parser for common transforms.
function parseTransformAttribute(str: string): Transform {
    // Fallback: identity
    // Real implementation requires parsing 'translate', 'rotate', etc.
    // For MVP, assuming Inkscape often exports 'matrix(...)'.
    // We will stick to IDENTITY for complex cases to avoid bugs, 
    // or try to match matrix.

    // Support: matrix(a,b,c,d,e,f)
    const matrixMatch = /matrix\(([^)]+)\)/.exec(str);
    if (matrixMatch) {
        const parts = matrixMatch[1].split(/[,\s]+/).map(parseFloat);
        if (parts.length === 6) {
            return { a: parts[0], b: parts[1], c: parts[2], d: parts[3], e: parts[4], f: parts[5] };
        }
    }

    // Support: translate(x, [y])
    const translateMatch = /translate\(([^)]+)\)/.exec(str);
    if (translateMatch) {
        const parts = translateMatch[1].split(/[,\s]+/).map(parseFloat);
        return { ...IDENTITY_TRANSFORM, e: parts[0], f: parts[1] || 0 };
    }

    // Support: scale(s, [sy])
    const scaleMatch = /scale\(([^)]+)\)/.exec(str);
    if (scaleMatch) {
        const parts = scaleMatch[1].split(/[,\s]+/).map(parseFloat);
        return { ...IDENTITY_TRANSFORM, a: parts[0], d: parts[1] || parts[0] };
    }

    return IDENTITY_TRANSFORM;
}

function distance(p1: { x: number, y: number }, p2: { x: number, y: number }) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}
