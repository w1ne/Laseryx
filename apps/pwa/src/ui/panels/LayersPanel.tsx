import React from "react";
import { useStore } from "../../core/state/store";
import { LayerService } from "../../core/services/LayerService";
import { updateOperation } from "../../core/util";

// ExportState is still local to App or MachineService, so we accept it for now
type ExportState = {
    status: "idle" | "working" | "done" | "error";
    message?: string;
};

type LayersPanelProps = {
    onExport: () => void;
    exportState: ExportState;
    isExportDisabled: boolean;
};

export function LayersPanel({
    onExport,
    exportState,
    isExportDisabled
}: LayersPanelProps) {
    const { state, dispatch } = useStore();
    const { document, camSettings } = state;

    return (
        <div className="panel">
            <div className="panel__header">
                <h2>Operations</h2>
                <button
                    className="button"
                    style={{ fontSize: "12px", padding: "4px 8px", minHeight: "auto" }}
                    onClick={() => LayerService.addLayer(state, dispatch)}
                >
                    + Add
                </button>
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
                                    <button
                                        className="button button--danger"
                                        style={{ fontSize: "11px", padding: "3px 8px", minHeight: "auto", background: "#fff5f5", color: "#d32f2f", border: "1px solid #ffcdd2", borderRadius: "4px" }}
                                        onClick={() => LayerService.deleteLayer(state, dispatch, layer.id)}
                                        title="Delete Layer"
                                    >
                                        Del
                                    </button>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.6fr", gap: "10px", alignItems: "end" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Mode</label>
                                        <select
                                            value={op.type}
                                            style={{ fontSize: "13px", padding: "6px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, type: e.target.value as any }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        >
                                            <option value="vectorCut">Cut</option>
                                            <option value="vectorEngrave">Engrave</option>
                                            <option value="rasterEngrave">Raster</option>
                                        </select>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Speed</label>
                                        <input
                                            type="number"
                                            style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            value={op.speedMmMin}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, speedMmMin: e.target.valueAsNumber }));
                                                dispatch({ type: "SET_CAM_SETTINGS", payload: { ...camSettings, operations: newOps } });
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ fontSize: "11px", marginBottom: "4px", color: "#666", fontWeight: "500" }}>Pwr %</label>
                                        <input
                                            type="number"
                                            style={{ fontSize: "13px", padding: "6px", width: "100%", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", color: "#333" }}
                                            value={op.powerPct}
                                            onChange={e => {
                                                const newOps = updateOperation(camSettings.operations, op.id, o => ({ ...o, powerPct: e.target.valueAsNumber }));
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
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="form__group" style={{ marginTop: "12px" }}>
                    <button className="button button--primary" onClick={onExport} disabled={isExportDisabled} style={{ width: "100%" }}>Export G-code</button>
                    {exportState.message && <div className={`status status--${exportState.status === "error" ? "error" : "info"}`} style={{ marginTop: "8px" }}>{exportState.message}</div>}
                </div>
            </div>
        </div>
    );
}
