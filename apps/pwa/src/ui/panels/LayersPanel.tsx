import React from "react";
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
                            <div key={layer.id} className="layer-row" style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                                padding: "12px",
                                background: "#ffffff",
                                borderRadius: "8px",
                                marginBottom: "12px",
                                border: "1px solid #e0e0e0",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: "600", fontSize: "14px", color: "#333" }}>{layer.name}</span>
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                        <select
                                            style={{ fontSize: "12px", padding: "4px", borderRadius: "4px", border: "1px solid #ddd", background: "#f8f9fa" }}
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
                                            className="button"
                                            style={{ fontSize: "11px", padding: "3px 6px", minHeight: "auto", background: "#f0f0f0" }}
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
                                        <button
                                            className="button button--danger"
                                            style={{ fontSize: "11px", padding: "3px 8px", minHeight: "auto", background: "#fff5f5", color: "#d32f2f", border: "1px solid #ffcdd2", borderRadius: "4px" }}
                                            onClick={() => LayerService.deleteLayer(state, dispatch, layer.id)}
                                            title="Delete Layer"
                                        >
                                            Del
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))", gap: "10px", alignItems: "end" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Mode</label>
                                        <select
                                            value={op.mode}
                                            style={{ fontSize: "13px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, mode: e.target.value as OperationMode }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        >
                                            <option value="line">Line</option>
                                            <option value="fill">Fill</option>
                                        </select>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Speed</label>
                                        <input
                                            type="number"
                                            style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            value={op.speed}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, speed: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Pwr %</label>
                                        <input
                                            type="number"
                                            style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            value={op.power}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, power: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Passes</label>
                                        <input
                                            type="number"
                                            style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            value={op.passes}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, passes: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>

                                    {op.mode === "fill" && (
                                        <>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Interval</label>
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                                    value={op.lineInterval || 0.1}
                                                    onChange={e => {
                                                        const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, lineInterval: e.target.valueAsNumber }));
                                                        dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                                    }}
                                                />
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Angle</label>
                                                <input
                                                    type="number"
                                                    style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
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

                <div className="form__group" style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            className="button button--primary"
                            onClick={onGenerate}
                            disabled={!isWorkerReady || generationState.status === "working"}
                            style={{ flex: 1 }}
                        >
                            {generationState.status === "working" ? "Generating..." : "Generate G-code"}
                        </button>
                        <button
                            className="button"
                            onClick={onDownload}
                            disabled={!hasGcode}
                            style={{ flex: 1 }}
                            title={!hasGcode ? "Trigger Generation first" : "Download .gcode file"}
                        >
                            Download
                        </button>
                    </div>
                    <div style={{ marginTop: "8px", padding: "8px", background: "#f8f9fa", borderRadius: "4px", border: "1px solid #e0e0e0" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={camSettings.optimizePaths !== false}
                                onChange={(e) => {
                                    dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, optimizePaths: e.target.checked } });
                                }}
                            />
                            <span style={{ fontWeight: "500", color: "#333" }}>Optimize path order</span>
                            <span style={{ color: "#666", fontSize: "11px" }}>(reduces air travel)</span>
                        </label>
                    </div>
                    {
                        generationState.message && (
                            <div className={`status status--${generationState.status === "error" ? "error" : "info"}`}>
                                {generationState.message}
                            </div>
                        )
                    }
                    {
                        jobStats && (
                            <div style={{
                                marginTop: "12px",
                                padding: "12px",
                                background: "#f8f9fa",
                                borderRadius: "6px",
                                border: "1px solid #e0e0e0"
                            }}>
                                <div style={{ fontSize: "11px", fontWeight: "600", color: "#666", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    Job Statistics
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                                    <div>
                                        <div style={{ color: "#999", fontSize: "11px", marginBottom: "2px" }}>⏱️ Est. Time</div>
                                        <div style={{ fontWeight: "600", color: "#333" }}>{formatTime(jobStats.estTimeS)}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "#999", fontSize: "11px", marginBottom: "2px" }}>📏 Total Distance</div>
                                        <div style={{ fontWeight: "600", color: "#333" }}>{formatDistance(jobStats.travelMm + jobStats.markMm)}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "#999", fontSize: "11px", marginBottom: "2px" }}>🔥 Laser On</div>
                                        <div style={{ fontWeight: "600", color: "#333" }}>{formatDistance(jobStats.markMm)}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: "#999", fontSize: "11px", marginBottom: "2px" }}>📊 Segments</div>
                                        <div style={{ fontWeight: "600", color: "#333" }}>{formatNumber(jobStats.segments)}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div >
            </div >
        </div >
    );
}
