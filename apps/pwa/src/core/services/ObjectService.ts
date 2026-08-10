import { AppState } from "../state/types";
import { Action } from "../state/actions";
import { ShapeObj, Obj, ImageObj, MacroObj, PathObj } from "../model";
import {
    defaultParamsForDef,
    getMacroDef,
    nextCascadeTransform,
    revalidateMacroParams
} from "../macros";
import { roundMm } from "../util";
import { nextAutoName } from "../objectLabels";

function lineLayer(state: AppState, dispatch: React.Dispatch<Action>) {
    return ObjectService.findOrCreateLayer(state, dispatch, "line", "Layer");
}

export const ObjectService = {
    addRectangle: (state: AppState, dispatch: React.Dispatch<Action>, opts?: { construction?: boolean }) => {
        const layerId = lineLayer(state, dispatch);
        const t = nextCascadeTransform(state.document, state.machineProfile?.bedMm);
        const newObj: ShapeObj = {
            id: `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            kind: "shape",
            shape: { type: "rect", width: 40, height: 30 },
            transform: { a: 1, b: 0, c: 0, d: 1, e: t.e, f: t.f },
            layerId,
            name: nextAutoName(state.document, "Rect"),
            ...(opts?.construction ? { construction: true } : {})
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    /** Place rectangle by two-corner box (Fusion-style drag). */
    addRectangleBox: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        box: { x: number; y: number; w: number; h: number }
    ) => {
        const layerId = lineLayer(state, dispatch);
        const x = roundMm(Math.min(box.x, box.x + box.w));
        const y = roundMm(Math.min(box.y, box.y + box.h));
        const w = roundMm(Math.max(0.5, Math.abs(box.w)));
        const h = roundMm(Math.max(0.5, Math.abs(box.h)));
        const newObj: ShapeObj = {
            id: `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            kind: "shape",
            shape: { type: "rect", width: w, height: h },
            transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
            layerId,
            name: nextAutoName(state.document, "Rect")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    addLine: (state: AppState, dispatch: React.Dispatch<Action>, opts?: { construction?: boolean; lengthMm?: number }) => {
        const layerId = lineLayer(state, dispatch);
        const len = roundMm(opts?.lengthMm ?? 50);
        const transform = nextCascadeTransform(state.document, state.machineProfile?.bedMm);
        const newObj: PathObj = {
            kind: "path",
            id: `path-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            closed: false,
            transform,
            points: [
                { x: 0, y: 0 },
                { x: len, y: 0 }
            ],
            name: nextAutoName(state.document, "Line"),
            ...(opts?.construction ? { construction: true } : {})
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    /** Place line from p1 to p2 in world mm. */
    addLineSegment: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        p1: { x: number; y: number },
        p2: { x: number; y: number }
    ) => {
        const layerId = lineLayer(state, dispatch);
        const x1 = roundMm(p1.x);
        const y1 = roundMm(p1.y);
        const x2 = roundMm(p2.x);
        const y2 = roundMm(p2.y);
        const newObj: PathObj = {
            kind: "path",
            id: `path-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            closed: false,
            transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
            points: [
                { x: x1, y: y1 },
                { x: x2, y: y2 }
            ],
            name: nextAutoName(state.document, "Line")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    addMacro: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        defId: string,
        partialParams?: Record<string, unknown>
    ): MacroObj | null => {
        const def = getMacroDef(defId);
        if (!def) {
            console.error(`Unknown macro defId: ${defId}`);
            return null;
        }

        const layerId = lineLayer(state, dispatch);
        const params = revalidateMacroParams(defId, defaultParamsForDef(def), partialParams ?? {}) ??
            defaultParamsForDef(def);
        const transform = nextCascadeTransform(state.document, state.machineProfile?.bedMm);

        const typeWord =
            def.id === "mount-hole" || def.id === "button"
                ? "Circle"
                : def.id === "slot"
                  ? "Slot"
                  : def.id === "round-rect"
                    ? "Round"
                    : def.name || "Macro";
        const newObj: MacroObj = {
            kind: "macro",
            id: `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            transform,
            defId: def.id,
            defVersion: def.defVersion,
            params,
            name: nextAutoName(state.document, typeWord)
        };

        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    addCircleCentered: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        center: { x: number; y: number },
        diameterMm: number
    ): MacroObj | null => {
        const def = getMacroDef("mount-hole");
        if (!def) return null;
        const layerId = lineLayer(state, dispatch);
        const d = roundMm(Math.max(0.5, diameterMm));
        const newObj: MacroObj = {
            kind: "macro",
            id: `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            transform: {
                a: 1,
                b: 0,
                c: 0,
                d: 1,
                e: roundMm(center.x),
                f: roundMm(center.y)
            },
            defId: def.id,
            defVersion: def.defVersion,
            params: { diameterMm: d },
            name: nextAutoName(state.document, "Circle")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    addSlotBox: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        box: { x: number; y: number; w: number; h: number }
    ): MacroObj | null => {
        const def = getMacroDef("slot");
        if (!def) return null;
        const layerId = lineLayer(state, dispatch);
        const x = roundMm(Math.min(box.x, box.x + box.w));
        const y = roundMm(Math.min(box.y, box.y + box.h));
        const absW = Math.abs(box.w);
        const absH = Math.abs(box.h);
        // Slot is always drawn along the longer drag axis as length
        const lengthMm = roundMm(Math.max(1, Math.max(absW, absH)));
        const widthMm = roundMm(Math.max(0.5, Math.min(absW, absH)));
        const newObj: MacroObj = {
            kind: "macro",
            id: `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
            defId: def.id,
            defVersion: def.defVersion,
            params: { lengthMm, widthMm },
            name: nextAutoName(state.document, "Slot")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    addRoundRectBox: (
        state: AppState,
        dispatch: React.Dispatch<Action>,
        box: { x: number; y: number; w: number; h: number }
    ): MacroObj | null => {
        const def = getMacroDef("round-rect");
        if (!def) return null;
        const layerId = lineLayer(state, dispatch);
        const x = roundMm(Math.min(box.x, box.x + box.w));
        const y = roundMm(Math.min(box.y, box.y + box.h));
        const w = roundMm(Math.max(0.5, Math.abs(box.w)));
        const h = roundMm(Math.max(0.5, Math.abs(box.h)));
        const rad = roundMm(Math.min(4, w / 4, h / 4));
        const newObj: MacroObj = {
            kind: "macro",
            id: `macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            layerId,
            transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
            defId: def.id,
            defVersion: def.defVersion,
            params: { widthMm: w, heightMm: h, radiusMm: rad },
            name: nextAutoName(state.document, "Round")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: newObj.id });
        return newObj;
    },

    updateMacroParams: (
        dispatch: React.Dispatch<Action>,
        object: MacroObj,
        partial: Record<string, unknown>
    ) => {
        const next = revalidateMacroParams(object.defId, object.params, partial);
        if (!next) return;
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: object.id, changes: { params: next } }
        });
    },

    updateObjectLayer: (dispatch: React.Dispatch<Action>, objectId: string, layerId: string) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes: { layerId } }
        });
    },

    updateObject: (
        dispatch: React.Dispatch<Action>,
        objectId: string,
        changes: Partial<Obj>,
        options?: { skipHistory?: boolean }
    ) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes },
            skipHistory: options?.skipHistory
        });
    },

    commitHistory: (dispatch: React.Dispatch<Action>) => {
        dispatch({ type: "COMMIT_HISTORY" });
    },

    setConstruction: (dispatch: React.Dispatch<Action>, objectId: string, construction: boolean) => {
        dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: objectId, changes: { construction } as Partial<Obj> }
        });
    },

    deleteObject: (dispatch: React.Dispatch<Action>, objectId: string) => {
        // Prefer GroupService.deleteObjects from UI (handles sketch + groups).
        // Keep simple path for free objects without confirm dialogs.
        dispatch({ type: "DELETE_OBJECT", payload: objectId });
    },

    addObjects: (dispatch: React.Dispatch<Action>, state: AppState, objects: Obj[]) => {
        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "line", "Vector Layer");
        objects.forEach(obj => {
            dispatch({ type: "ADD_OBJECT", payload: { ...obj, layerId } });
        });
        if (objects.length > 0) {
            dispatch({ type: "SELECT_OBJECT", payload: objects[0].id });
        }
    },

    addImage: (dispatch: React.Dispatch<Action>, state: AppState, src: string, width: number, height: number) => {
        const layerId = ObjectService.findOrCreateLayer(state, dispatch, "fill", "Image Layer");
        const uniqueId = `img-${Date.now()}`;
        const newObj: ImageObj = {
            kind: "image",
            id: uniqueId,
            layerId: layerId,
            transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 10 },
            width: roundMm(width),
            height: roundMm(height),
            src,
            name: nextAutoName(state.document, "Image")
        };
        dispatch({ type: "ADD_OBJECT", payload: newObj });
        dispatch({ type: "SELECT_OBJECT", payload: uniqueId });
    },

    findOrCreateLayer: (state: AppState, dispatch: React.Dispatch<Action>, mode: "line" | "fill", namePrefix: string): string => {
        for (const layer of state.document.layers) {
            const op = state.camSettings.operations.find(o => o.id === layer.operationId);
            if (op && op.mode === mode) {
                return layer.id;
            }
        }

        const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLayerId = `layer-${uniqueSuffix}`;
        const newOpId = `op-${uniqueSuffix}`;

        const newLayer = {
            id: newLayerId,
            name: `${namePrefix} ${state.document.layers.length + 1}`,
            visible: true,
            locked: false,
            operationId: newOpId
        };

        const newOp = {
            id: newOpId,
            name: mode === "line" ? "Cut" : "Raster",
            mode: mode,
            speed: 1000,
            power: 50,
            passes: 1,
            order: "insideOut" as const
        };

        dispatch({ type: "ADD_LAYER", payload: newLayer });
        dispatch({ type: "ADD_OPERATION", payload: newOp });

        return newLayerId;
    }
};
