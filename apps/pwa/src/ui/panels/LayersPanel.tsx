import React from "react";
import { OperationMode } from "../../core/model";
import { useStore } from "../../core/state/store";
import { LayerService } from "../../core/services/LayerService";
import { updateOperation } from "../../core/util";
import { materialRepo } from "../../io/materialRepo";
import { formatTime, formatDistance, formatNumber } from "../../core/formatters";

// ExportState is still local to App or MachineService, so we accept it for now
type GenerationState = {
    status: "idle" | "working" | "done" | "error";
    message?: string;
};

type LayersPanelProps = {
    onGenerate: () => void;
    onDownload: () => void;
    onOpenMaterialManager: () => void;
    generationState: GenerationState;
    hasGcode: boolean;
    isWorkerReady: boolean;
    jobStats: { estTimeS: number; travelMm: number; markMm: number; segments: number } | null;
    sheetId?: string;
    onSheetChange?: (id: string) => void;
};

export function LayersPanel({
    onGenerate,
    onDownload,
    onOpenMaterialManager,
    generationState,
    hasGcode,
    isWorkerReady,
    jobStats,
    sheetId,
    onSheetChange
}: LayersPanelProps) {
    const { state, dispatch } = useStore();
    const { document, camSettings } = state;

    return (
        <div className="panel">
            <div className="panel__header">
                <h2>Operations</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        type="button"
                        className="button button--small"
                        onClick={onOpenMaterialManager}
                        title="Material library — manage cut/engrave presets for materials"
                    >
                        📚 Materials
                    </button>
                    <button
                        type="button"
                        className="button button--small"
                        onClick={() => LayerService.addLayer(state, dispatch)}
                        title="Add a new operation layer (separate speed/power settings)"
                    >
                        Add Layer
                    </button>
                </div>
            </div>
            <div className="panel__body">
                {document.enclosureWorkspace?.sheetLayout && <label>Cut sheet
                    <select aria-label="Cut sheet" value={sheetId} onChange={event => onSheetChange?.(event.target.value)}>
                        {document.enclosureWorkspace.sheetLayout.sheets.map((sheet, index) => <option key={sheet.id} value={sheet.id}>Sheet {index + 1}</option>)}
                    </select>
                </label>}
                <div className="layer-list">
                    {document.layers.map(layer => {
                        const op = camSettings.operations.find(o => o.id === layer.operationId);
                        if (!op) {
                            if (!document.objects.some(object => object.layerId === layer.id && !object.construction)) return null;
                            return <div key={layer.id} className="layer-card">
                                <span className="layer-card__title">{layer.name}</span>
                                <button type="button" onClick={() => {
                                    const id = `op-${layer.id}`;
                                    dispatch({ type: "ADD_OPERATION", payload: { id, name: "Cut", mode: "line", speed: 1000, power: 50, passes: 1, order: "insideOut" } });
                                    dispatch({ type: "SET_DOCUMENT", payload: { ...document, layers: document.layers.map(item => item.id === layer.id ? { ...item, operationId: id } : item) } });
                                }}>Add cut operation</button>
                            </div>;
                        }

                        return (
                            <div key={layer.id} className="layer-card">
                                <div className="layer-card__header">
                                    <span className="layer-card__title" title={layer.name}>
                                        {layer.name}
                                    </span>
                                    <button
                                        type="button"
                                        className="button button--small"
                                        style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
                                        onClick={() => LayerService.deleteLayer(state, dispatch, layer.id)}
                                        title={`Delete layer “${layer.name}” and its operation settings`}
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="layer-card__presets">
                                    <select
                                        className="layer-card__select"
                                        value=""
                                        onChange={async (e) => {
                                            const preset = state.materialPresets.find(p => p.id === e.target.value);
                                            if (preset) {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({
                                                    ...o,
                                                    mode: preset.mode,
                                                    speed: preset.speed,
                                                    power: preset.power,
                                                    passes: preset.passes,
                                                    lineInterval: preset.lineInterval,
                                                    angle: preset.angle
                                                }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }
                                        }}
                                    >
                                        <option value="" disabled>Apply Preset...</option>
                                        {state.materialPresets.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="button button--small"
                                        title="Save this layer’s speed/power/passes as a reusable material preset"
                                        onClick={async () => {
                                            const name = prompt("Preset Name:", "My Preset");
                                            if (!name) return;
                                            const newPreset = {
                                                id: crypto.randomUUID(),
                                                name,
                                                mode: op.mode,
                                                speed: op.speed,
                                                power: op.power,
                                                passes: op.passes,
                                                lineInterval: op.lineInterval,
                                                angle: op.angle
                                            };
                                            await materialRepo.save(newPreset);
                                            dispatch({ type: "ADD_MATERIAL_PRESET", payload: newPreset });
                                        }}
                                    >
                                        💾
                                    </button>
                                </div>

                                <div className="layer-card__grid">
                                    <div className="layer-card__input-group">
                                        <label className="layer-card__label">Mode</label>
                                        <select
                                            className="layer-card__input"
                                            value={op.mode}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, mode: e.target.value as OperationMode }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        >
                                            <option value="line">Line</option>
                                            <option value="fill">Fill</option>
                                        </select>
                                    </div>

                                    <div className="layer-card__input-group">
                                        <label className="layer-card__label">Speed</label>
                                        <input
                                            type="number"
                                            className="layer-card__input"
                                            value={op.speed}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, speed: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>
                                    <div className="layer-card__input-group">
                                        <label className="layer-card__label">Power %</label>
                                        <input
                                            type="number"
                                            className="layer-card__input"
                                            value={op.power}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, power: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>
                                    <div className="layer-card__input-group">
                                        <label className="layer-card__label">Passes</label>
                                        <input
                                            type="number"
                                            className="layer-card__input"
                                            value={op.passes}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, passes: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>

                                    {op.mode === "fill" && (
                                        <>
                                            <div className="layer-card__input-group">
                                                <label className="layer-card__label">Interval</label>
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    className="layer-card__input"
                                                    value={op.lineInterval || 0.1}
                                                    onChange={e => {
                                                        const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, lineInterval: e.target.valueAsNumber }));
                                                        dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                                    }}
                                                />
                                            </div>
                                            <div className="layer-card__input-group">
                                                <label className="layer-card__label">Angle</label>
                                                <input
                                                    type="number"
                                                    className="layer-card__input"
                                                    value={op.angle || 0}
                                                    onChange={e => {
                                                        const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, angle: e.target.valueAsNumber }));
                                                        dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="form__group" style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <button
                            type="button"
                            className="button button--primary"
                            onClick={onGenerate}
                            disabled={!isWorkerReady || generationState.status === "working"}
                            style={{ flex: 1 }}
                            title={
                              !isWorkerReady
                                ? "CAM worker not ready yet — wait a moment"
                                : generationState.status === "working"
                                  ? "Generating G-code…"
                                  : "Generate G-code toolpaths from the current design"
                            }
                        >
                            {generationState.status === "working" ? "Wait..." : "Generate"}
                        </button>
                        <button
                            type="button"
                            className="button"
                            onClick={onDownload}
                            disabled={!hasGcode}
                            style={{ flex: 1 }}
                            title={
                              hasGcode
                                ? "Download the last generated G-code file"
                                : "Generate G-code first, then download"
                            }
                        >
                            Download
                        </button>
                    </div>

                    <label className="checkbox-row">
                        <input
                            type="checkbox"
                            checked={camSettings.optimizePaths !== false}
                            onChange={(e) => {
                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, optimizePaths: e.target.checked } });
                            }}
                        />
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                            <strong style={{ color: "#1e293b", marginRight: "4px" }}>Optimize path order</strong>
                            (reduces air travel)
                        </span>
                    </label>

                    {generationState.message && (
                        <div className={`status status--${generationState.status === "error" ? "error" : "info"}`}>
                            {generationState.status === "error" ? "❌" : "ℹ️"} {generationState.message}
                        </div>
                    )}

                    {jobStats && (
                        <div className="job-stats">
                            <div className="job-stats__title">Job Statistics</div>
                            <div className="job-stats__grid">
                                <div className="job-stats__item">
                                    <div className="job-stats__label">⏱️ Est. Time</div>
                                    <div className="job-stats__value">{formatTime(jobStats.estTimeS)}</div>
                                </div>
                                <div className="job-stats__item">
                                    <div className="job-stats__label">📏 Total Distance</div>
                                    <div className="job-stats__value">{formatDistance(jobStats.travelMm + jobStats.markMm)}</div>
                                </div>
                                <div className="job-stats__item">
                                    <div className="job-stats__label">🔥 Laser On</div>
                                    <div className="job-stats__value">{formatDistance(jobStats.markMm)}</div>
                                </div>
                                <div className="job-stats__item">
                                    <div className="job-stats__label">📊 Segments</div>
                                    <div className="job-stats__value">{formatNumber(jobStats.segments)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
