import { Operation, Layer } from "./model";

/** Geometry resolution for laser work (mm). 0.1 mm is plenty. */
export const MM_DECIMALS = 1;

/** Round a length/position to laser-friendly mm. */
export function roundMm(value: number, decimals: number = MM_DECIMALS): number {
    if (!Number.isFinite(value)) return 0;
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
}

export function formatMm(value: number, decimals: number = MM_DECIMALS): string {
    return roundMm(value, decimals).toFixed(decimals);
}

/** @deprecated prefer formatMm — kept for call sites expecting 2-digit strings historically */
export function formatNumber(value: number) {
    return formatMm(value);
}

export function updateOperation(
    operations: Operation[],
    opId: string,
    updater: (op: Operation) => Operation
): Operation[] {
    return operations.map((op) => (op.id === opId ? updater(op) : op));
}

export function updateLayer(layers: Layer[], layerId: string, updater: (layer: Layer) => Layer): Layer[] {
    return layers.map((layer) => (layer.id === layerId ? updater(layer) : layer));
}

export function randomId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (http) or older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
