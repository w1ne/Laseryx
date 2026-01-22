import { Operation, Layer } from "./model";

export function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
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
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
