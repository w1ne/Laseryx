import React, { useEffect, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { ImageObj, MacroObj } from "../../core/model";
import { getMacroDef } from "../../core/macros/catalog";
import type { MacroParamSpec } from "../../core/macros/types";

export function PropertiesPanel() {
    const { state, dispatch } = useStore();
    const { document, selectedObjectId } = state;
    const selectedObject = document.objects.find(o => o.id === selectedObjectId);

    if (!selectedObject) {
        return (
            <div className="panel">
                <div className="panel__header"><h2>Properties</h2></div>
                <div className="panel__body">
                    <div className="panel__note" style={{ color: "#666", padding: "12px" }}>Select an object to edit its properties.</div>
                </div>
            </div>
        );
    }

    const f = (n?: number) => n !== undefined ? Number(n.toFixed(2)) : "";

    return (
        <div className="panel">
            <div className="panel__header"><h2>Properties</h2></div>
            <div className="panel__body">
                <div className="form">
                    <div className="form__row">
                        <label className="form-label">X <input type="number" className="form-input" value={f(selectedObject.transform.e)} onChange={e => {
                            const v = e.target.valueAsNumber;
                            if (!isNaN(v)) ObjectService.updateObject(dispatch, selectedObject.id, { transform: { ...selectedObject.transform, e: v } });
                        }} /></label>
                        <label className="form-label">Y <input type="number" className="form-input" value={f(selectedObject.transform.f)} onChange={e => {
                            const v = e.target.valueAsNumber;
                            if (!isNaN(v)) ObjectService.updateObject(dispatch, selectedObject.id, { transform: { ...selectedObject.transform, f: v } });
                        }} /></label>
                    </div>

                    <div className="form__group">
                        <label className="form-label">Layer
                            <select className="form-input" value={selectedObject.layerId} onChange={e => {
                                ObjectService.updateObjectLayer(dispatch, selectedObject.id, e.target.value);
                            }}>
                                {document.layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </label>
                    </div>

                    {(selectedObject.kind === "shape" || selectedObject.kind === "image") && (
                        <div className="form__row">
                            <label className="form-label">W <input type="number" className="form-input" value={f(selectedObject.kind === "shape" ? selectedObject.shape?.width : (selectedObject as ImageObj).width)} onChange={e => {
                                const v = e.target.valueAsNumber;
                                if (!isNaN(v)) {
                                    if (selectedObject.kind === "shape") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { shape: { ...selectedObject.shape, width: v } });
                                    } else if (selectedObject.kind === "image") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { width: v });
                                    }
                                }
                            }} /></label>
                            <label className="form-label">H <input type="number" className="form-input" value={f(selectedObject.kind === "shape" ? selectedObject.shape?.height : (selectedObject as ImageObj).height)} onChange={e => {
                                const v = e.target.valueAsNumber;
                                if (!isNaN(v)) {
                                    if (selectedObject.kind === "shape") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { shape: { ...selectedObject.shape, height: v } });
                                    } else if (selectedObject.kind === "image") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { height: v });
                                    }
                                }
                            }} /></label>
                        </div>
                    )}

                    {selectedObject.kind === "macro" && (
                        <MacroProperties
                            key={selectedObject.id}
                            object={selectedObject}
                            onCommit={(partial) => ObjectService.updateMacroParams(dispatch, selectedObject, partial)}
                        />
                    )}
                </div>
            </div>
            <style>{`
                .form-label { display: block; font-size: 12px; color: #555; margin-bottom: 4px; font-weight: 500; }
                .form-input { 
                    width: 100%; 
                    padding: 8px; 
                    font-size: 13px; 
                    border: 1px solid #ddd; 
                    border-radius: 4px; 
                    background: #fff; 
                    color: #333;
                }
                .form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
                .form__group { margin-bottom: 12px; }
            `}</style>
        </div>
    );
}

function MacroProperties({
    object,
    onCommit
}: {
    object: MacroObj;
    onCommit: (partial: Record<string, unknown>) => void;
}) {
    const def = getMacroDef(object.defId);
    const [draft, setDraft] = useState(object.params);

    useEffect(() => {
        setDraft(object.params);
    }, [object.id, object.params]);

    if (!def) {
        return (
            <div className="form__group" style={{ padding: 8, background: "#fee2e2", borderRadius: 4, color: "#991b1b", fontSize: 12 }}>
                Missing macro definition: <code>{object.defId}</code>. Update Laseryx or remove this object.
            </div>
        );
    }

    const commitNumber = (spec: MacroParamSpec, raw: string) => {
        const v = Number(raw);
        if (!Number.isFinite(v)) return;
        onCommit({ [spec.key]: v });
    };

    return (
        <>
            <div className="form__group" style={{ color: "#2563eb", fontWeight: 600, fontSize: 13 }}>
                {def.name} · macro
            </div>
            {def.approxNote && (
                <div className="form__group" style={{ fontSize: 10, color: "#9a3412", background: "#fff7ed", padding: 8, borderRadius: 4 }}>
                    {def.approxNote}
                </div>
            )}
            <div className="form__group" style={{ fontSize: 10, color: "#888" }}>
                defVersion {object.defVersion}
            </div>
            {def.params.map((spec) => {
                const value = draft[spec.key] ?? spec.default;
                if (spec.type === "enum" && spec.options) {
                    return (
                        <div className="form__group" key={spec.key}>
                            <label className="form-label">{spec.label}
                                <select
                                    className="form-input"
                                    value={String(value)}
                                    onChange={(e) => onCommit({ [spec.key]: e.target.value })}
                                >
                                    {spec.options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    );
                }
                if (spec.type === "boolean") {
                    return (
                        <div className="form__group" key={spec.key}>
                            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    onChange={(e) => onCommit({ [spec.key]: e.target.checked })}
                                />
                                {spec.label}
                            </label>
                        </div>
                    );
                }
                if (spec.type === "string") {
                    return (
                        <div className="form__group" key={spec.key}>
                            <label className="form-label">{spec.label}
                                <input
                                    className="form-input"
                                    value={String(value ?? "")}
                                    onChange={(e) => setDraft({ ...draft, [spec.key]: e.target.value })}
                                    onBlur={(e) => onCommit({ [spec.key]: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            onCommit({ [spec.key]: (e.target as HTMLInputElement).value });
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    );
                }
                // number
                return (
                    <div className="form__group" key={spec.key}>
                        <label className="form-label">
                            {spec.label}{spec.unit ? ` (${spec.unit})` : ""}
                            <input
                                type="number"
                                className="form-input"
                                step={spec.step ?? 0.1}
                                min={spec.min}
                                max={spec.max}
                                value={value === undefined || value === null ? "" : Number(value)}
                                onChange={(e) => {
                                    const n = e.target.valueAsNumber;
                                    setDraft({
                                        ...draft,
                                        [spec.key]: Number.isFinite(n) ? n : draft[spec.key]
                                    });
                                }}
                                onBlur={(e) => commitNumber(spec, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        commitNumber(spec, (e.target as HTMLInputElement).value);
                                    }
                                }}
                            />
                        </label>
                    </div>
                );
            })}
        </>
    );
}
