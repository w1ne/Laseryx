import { CamSettings, Operation, PolylinePath } from "./model";

export function generateRasterToolpath(
    imageData: ImageData,
    settings: CamSettings,
    op: Operation,
    bbox: { x: number; y: number; w: number; h: number }
): PolylinePath[] {
    const { width, height, data } = imageData;
    const paths: PolylinePath[] = [];

    // Simple scanline approach:
    // Iterate rows. For each row, find runs of dark pixels.
    // Generate G1 moves for dark runs.

    // Logical pixel size in mm (assume image is stretched to fit bbox)
    // This is a simplification. Ideally we respect DPI. 
    // For this MVP, we map image pixels directly to physical space within the bbox.
    const pixelW = bbox.w / width;
    const pixelH = bbox.h / height;

    // Threshold (fixed for now, could be in settings)
    const threshold = 127;

    // Direction flip for bidirectional scanning
    let ltr = true;

    for (let y = 0; y < height; y++) {
        const rowY = bbox.y + y * pixelH; // top-down? Canvas is top-down. 
        // Usually laser origin is bottom-left, so we might need to flip if image is drawn that way.
        // Let's assume standard image coordinates (0,0 at top-left) map to bbox.y + 0 ...

        // However, G-code usually wants bottom-up? 
        // Let's stick to the visual bbox provided.

        let activeRunStart: number | null = null;

        const scanRow = (processRun: (start: number, end: number) => void) => {
            const startX = ltr ? 0 : width - 1;
            const endX = ltr ? width : -1;
            const step = ltr ? 1 : -1;

            for (let x = startX; x !== endX; x += step) {
                // RGBA
                const offset = (y * width + x) * 4;
                const r = data[offset];
                const g = data[offset + 1];
                const b = data[offset + 2];
                const a = data[offset + 3];

                // Simple luminance
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                // If opaque enough and dark enough
                const isDark = a > 10 && lum < threshold;

                if (isDark) {
                    if (activeRunStart === null) {
                        activeRunStart = x;
                    }
                } else {
                    if (activeRunStart !== null) {
                        processRun(activeRunStart, x - step);
                        activeRunStart = null;
                    }
                }
            }
            // Finish run at end of row
            if (activeRunStart !== null) {
                processRun(activeRunStart, endX - step);
            }
        };

        scanRow((startPx, endPx) => {
            // Map pixels to mm
            const x1 = bbox.x + (startPx + (ltr ? 0 : 1)) * pixelW;
            const x2 = bbox.x + (endPx + (ltr ? 1 : 0)) * pixelW;

            paths.push({
                closed: false,
                points: [
                    { x: x1, y: rowY },
                    { x: x2, y: rowY }
                ]
            });
        });

        ltr = !ltr; // Bidirectional
    }

    return paths;
}
