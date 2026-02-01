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
};

export function LayersPanel({
    onGenerate,
    onDownload,
    onOpenMaterialManager,
    generationState,
    hasGcode,
    isWorkerReady,
    jobStats
}: LayersPanelProps) {
    const { state, dispatch } = useStore();
    const { document, camSettings } = state;

    return (
        <div className="panel">
            <div className="panel__header">
                <h2>Operations</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        className="button"
                        style={{ fontSize: "12px", padding: "4px 8px", minHeight: "auto", background: "#f8f9fa", border: "1px solid #ddd" }}
                        onClick={onOpenMaterialManager}
                    >
                        Manage
                    </button>
                    <button
                        className="button"
                        style={{ fontSize: "12px", padding: "4px 8px", minHeight: "auto" }}
                        onClick={() => LayerService.addLayer(state, dispatch)}
                    >
                        + Add
                    </button>
                </div>
            </div>
            <div className="panel__body">
                <div className="layer-list">
                    {document.layers.map(layer => {
                        const op = camSettings.operations.find(o => o.id === layer.operationId);
                        if (!op) return null;

                        return (
                            <div key={layer.id} className="layer-card">
                                <div className="layer-card__header">
                                    <span className="layer-card__title" title={layer.name}>
                                        {layer.name}
                                    </span>
                                    <button
                                        className="button button--small"
                                        style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
                                        onClick={() => LayerService.deleteLayer(state, dispatch, layer.id)}
                                        title="Delete Layer"
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
                                        className="button button--small"
                                        title="Save as Preset"
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
                            className="button button--primary"
                            onClick={onGenerate}
                            disabled={!isWorkerReady || generationState.status === "working"}
                            style={{ flex: 1.5 }}
                        >
                            {generationState.status === "working" ? "Wait..." : "Generate"}
                        </button>
                        <button
                            className="button"
                            onClick={onDownload}
                            disabled={!hasGcode}
                            style={{ flex: 1 }}
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
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>Optimize path order</span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>Reduces air travel by ~20-40%</span>
                        </div>
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
