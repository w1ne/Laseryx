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
            <div className="panel props">
                <div className="panel__header"><h2>Properties</h2></div>
                <div className="panel__body">
                    <p className="props__empty">Select an object to edit.</p>
                </div>
                <PropsStyles />
            </div>
        );
    }

    const f = (n?: number) => n !== undefined ? Number(n.toFixed(2)) : "";

    return (
        <div className="panel props">
            <div className="panel__header"><h2>Properties</h2></div>
            <div className="panel__body">
                <div className="props__form">
                    <div className="props__row">
                        <label className="props__field">
                            X
                            <input
                                type="number"
                                className="props__input"
                                value={f(selectedObject.transform.e)}
                                onChange={e => {
                                    const v = e.target.valueAsNumber;
                                    if (!isNaN(v)) {
                                        ObjectService.updateObject(dispatch, selectedObject.id, {
                                            transform: { ...selectedObject.transform, e: v }
                                        });
                                    }
                                }}
                            />
                        </label>
                        <label className="props__field">
                            Y
                            <input
                                type="number"
                                className="props__input"
                                value={f(selectedObject.transform.f)}
                                onChange={e => {
                                    const v = e.target.valueAsNumber;
                                    if (!isNaN(v)) {
                                        ObjectService.updateObject(dispatch, selectedObject.id, {
                                            transform: { ...selectedObject.transform, f: v }
                                        });
                                    }
                                }}
                            />
                        </label>
                    </div>

                    <label className="props__field">
                        Layer
                        <select
                            className="props__input"
                            value={selectedObject.layerId}
                            onChange={e => ObjectService.updateObjectLayer(dispatch, selectedObject.id, e.target.value)}
                        >
                            {document.layers.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </label>

                    {(selectedObject.kind === "shape" || selectedObject.kind === "image") && (
                        <div className="props__row">
                            <label className="props__field">
                                W
                                <input
                                    type="number"
                                    className="props__input"
                                    value={f(selectedObject.kind === "shape" ? selectedObject.shape?.width : (selectedObject as ImageObj).width)}
                                    onChange={e => {
                                        const v = e.target.valueAsNumber;
                                        if (isNaN(v)) return;
                                        if (selectedObject.kind === "shape") {
                                            ObjectService.updateObject(dispatch, selectedObject.id, {
                                                shape: { ...selectedObject.shape, width: v }
                                            });
                                        } else {
                                            ObjectService.updateObject(dispatch, selectedObject.id, { width: v });
                                        }
                                    }}
                                />
                            </label>
                            <label className="props__field">
                                H
                                <input
                                    type="number"
                                    className="props__input"
                                    value={f(selectedObject.kind === "shape" ? selectedObject.shape?.height : (selectedObject as ImageObj).height)}
                                    onChange={e => {
                                        const v = e.target.valueAsNumber;
                                        if (isNaN(v)) return;
                                        if (selectedObject.kind === "shape") {
                                            ObjectService.updateObject(dispatch, selectedObject.id, {
                                                shape: { ...selectedObject.shape, height: v }
                                            });
                                        } else {
                                            ObjectService.updateObject(dispatch, selectedObject.id, { height: v });
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    )}

                    {selectedObject.kind === "macro" && (
                        <MacroFields
                            key={selectedObject.id}
                            object={selectedObject}
                            onCommit={(partial) => ObjectService.updateMacroParams(dispatch, selectedObject, partial)}
                        />
                    )}
                </div>
            </div>
            <PropsStyles />
        </div>
    );
}

function MacroFields({
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
        return <p className="props__empty">Unknown element: {object.defId}</p>;
    }

    const commitNumber = (spec: MacroParamSpec, raw: string) => {
        const v = Number(raw);
        if (!Number.isFinite(v)) return;
        onCommit({ [spec.key]: v });
    };

    return (
        <>
            <p className="props__name">{def.name}</p>
            {def.params.map((spec) => {
                const value = draft[spec.key] ?? spec.default;

                if (spec.type === "enum" && spec.options) {
                    return (
                        <label className="props__field" key={spec.key}>
                            {spec.label}
                            <select
                                className="props__input"
                                value={String(value)}
                                onChange={(e) => onCommit({ [spec.key]: e.target.value })}
                            >
                                {spec.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </label>
                    );
                }

                if (spec.type === "boolean") {
                    return (
                        <label className="props__check" key={spec.key}>
                            <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) => onCommit({ [spec.key]: e.target.checked })}
                            />
                            {spec.label}
                        </label>
                    );
                }

                if (spec.type === "string") {
                    return (
                        <label className="props__field" key={spec.key}>
                            {spec.label}
                            <input
                                className="props__input"
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
                    );
                }

                return (
                    <label className="props__field" key={spec.key}>
                        {spec.label}{spec.unit ? ` (${spec.unit})` : ""}
                        <input
                            type="number"
                            className="props__input"
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
                );
            })}
        </>
    );
}

function PropsStyles() {
    return (
        <style>{`
            .props,
            .props * {
                font-size: 13px;
                line-height: 1.4;
            }
            .props .panel__header h2 {
                font-size: 16px;
                font-weight: 600;
            }
            .props__empty {
                margin: 0;
                color: #64748b;
            }
            .props__form {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .props__name {
                margin: 0;
                font-weight: 600;
                color: #0f172a;
            }
            .props__row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            .props__field {
                display: flex;
                flex-direction: column;
                gap: 4px;
                color: #334155;
                font: inherit;
            }
            .props__input {
                width: 100%;
                box-sizing: border-box;
                padding: 8px 10px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #fff;
                color: #0f172a;
                font: inherit;
            }
            .props__check {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #334155;
                font: inherit;
                cursor: pointer;
            }
        `}</style>
    );
}
