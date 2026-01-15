import React from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { ImageObj } from "../../core/model";

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

    return (
        <div className="panel">
            <div className="panel__header"><h2>Properties</h2></div>
            <div className="panel__body">
                <div className="form">
                    <div className="form__row">
                        <label className="form-label">X <input type="number" className="form-input" value={selectedObject.transform.e} onChange={e => {
                            const v = e.target.valueAsNumber;
                            if (!isNaN(v)) ObjectService.updateObject(dispatch, selectedObject.id, { transform: { ...selectedObject.transform, e: v } });
                        }} /></label>
                        <label className="form-label">Y <input type="number" className="form-input" value={selectedObject.transform.f} onChange={e => {
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
                            <label className="form-label">W <input type="number" className="form-input" value={selectedObject.kind === "shape" ? selectedObject.shape?.width : (selectedObject as ImageObj).width} onChange={e => {
                                const v = e.target.valueAsNumber;
                                if (!isNaN(v)) {
                                    if (selectedObject.kind === "shape") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { shape: { ...selectedObject.shape, width: v } });
                                    } else if (selectedObject.kind === "image") {
                                        ObjectService.updateObject(dispatch, selectedObject.id, { width: v });
                                    }
                                }
                            }} /></label>
                            <label className="form-label">H <input type="number" className="form-input" value={selectedObject.kind === "shape" ? selectedObject.shape?.height : (selectedObject as ImageObj).height} onChange={e => {
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
