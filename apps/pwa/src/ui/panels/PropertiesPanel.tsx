import React, { useEffect, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { MacroObj } from "../../core/model";
import { getMacroDef } from "../../core/macros/catalog";
import type { MacroParamSpec } from "../../core/macros/types";
import {
  getObjectSize,
  setObjectPosition,
  setObjectSize,
  pathLength,
  setPathLength,
  boundsOf
} from "../../core/objectEdit";
import { formatMm, roundMm } from "../../core/util";
import { SketchService } from "../../core/services/SketchService";
import { isSketchObjectId, entityIdFromObjectId } from "../../core/sketch/bake";
import { objectListLabel } from "../../core/objectLabels";

/**
 * Properties: name, dimensions, layer, construction (not transform / group — those live in Edit).
 */
export function PropertiesPanel() {
  const { state, dispatch } = useStore();
  const { document, selectedObjectId } = state;
  const selectedObject = document.objects.find((o) => o.id === selectedObjectId);

  if (!selectedObject) {
    return (
      <div className="panel props">
        <div className="panel__header">
          <h2>Properties</h2>
        </div>
        <div className="panel__body">
          <p className="props__empty">
            Select an object, or pick a sketch tool and drag on the bed.
          </p>
        </div>
        <PropsStyles />
      </div>
    );
  }

  if (selectedObject.id.startsWith("components-box:")) return <div className="panel props"><div className="panel__header"><h2>{selectedObject.name ?? "Enclosure geometry"}</h2></div><div className="panel__body"><p className="props__empty">Generated enclosure geometry is controlled by Components &amp; Box. Move or rotate the complete face group.</p></div><PropsStyles /></div>;

  const f = (n?: number) => (n !== undefined && Number.isFinite(n) ? formatMm(n) : "");
  const bbox = boundsOf(selectedObject);
  const size = getObjectSize(selectedObject);
  const typeLabel =
    selectedObject.kind === "shape"
      ? "Rectangle"
      : selectedObject.kind === "path"
        ? selectedObject.closed
          ? "Path"
          : "Line"
        : selectedObject.kind === "macro"
          ? getMacroDef(selectedObject.defId)?.name ?? "Sketch"
          : selectedObject.kind === "image"
            ? "Image"
            : "Object";

  return (
    <div className="panel props">
      <div className="panel__header">
        <h2>{selectedObject.name?.trim() || typeLabel}</h2>
      </div>
      <div className="panel__body">
        <div className="props__form">
          <div className="props__section">Name</div>
          <label className="props__field">
            Label
            <input
              type="text"
              className="props__input"
              placeholder={objectListLabel(selectedObject, document)}
              value={selectedObject.name ?? ""}
              onChange={(e) => {
                const name = e.target.value;
                ObjectService.updateObject(dispatch, selectedObject.id, { name });
                // Keep sketch entity name in sync so re-bake preserves it
                if (isSketchObjectId(selectedObject.id) && document.sketch) {
                  const eid = entityIdFromObjectId(selectedObject.id);
                  if (eid && document.sketch.entities[eid]) {
                    const ent = document.sketch.entities[eid];
                    const sketch = {
                      ...document.sketch,
                      entities: {
                        ...document.sketch.entities,
                        [eid]: { ...ent, name: name.trim() || undefined }
                      }
                    };
                    dispatch({
                      type: "SET_DOCUMENT",
                      payload: { ...document, sketch },
                      skipHistory: true
                    });
                  }
                }
              }}
            />
          </label>
          <p className="props__hint">{objectListLabel(selectedObject, document)}</p>

          <div className="props__section">Dimensions</div>
          <div className="props__row">
            <label className="props__field">
              X
              <input
                type="number"
                className="props__input"
                step={0.1}
                value={f(bbox?.minX)}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v) || !bbox) return;
                  const patch = setObjectPosition(selectedObject, v, bbox.minY);
                  if (patch) ObjectService.updateObject(dispatch, selectedObject.id, patch);
                }}
              />
            </label>
            <label className="props__field">
              Y
              <input
                type="number"
                className="props__input"
                step={0.1}
                value={f(bbox?.minY)}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v) || !bbox) return;
                  const patch = setObjectPosition(selectedObject, bbox.minX, v);
                  if (patch) ObjectService.updateObject(dispatch, selectedObject.id, patch);
                }}
              />
            </label>
          </div>

          {selectedObject.kind === "path" && !selectedObject.closed ? (
            <label className="props__field">
              Length
              <input
                type="number"
                className="props__input"
                step={0.1}
                min={0.1}
                value={f(pathLength(selectedObject) ?? undefined)}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v)) return;
                  if (isSketchObjectId(selectedObject.id)) {
                    SketchService.setDimLiteral(state, dispatch, selectedObject.id, "length", v);
                    return;
                  }
                  const patch = setPathLength(selectedObject, v);
                  if (patch) ObjectService.updateObject(dispatch, selectedObject.id, patch);
                }}
              />
            </label>
          ) : selectedObject.kind === "path" &&
            selectedObject.closed &&
            isSketchObjectId(selectedObject.id) ? (
            <label className="props__field">
              Diameter
              <input
                type="number"
                className="props__input"
                step={0.1}
                min={0.5}
                value={f(size ? Math.min(size.w, size.h) : undefined)}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v)) return;
                  SketchService.setDimLiteral(state, dispatch, selectedObject.id, "diameter", v);
                }}
              />
            </label>
          ) : selectedObject.kind === "macro" &&
            (selectedObject.defId === "mount-hole" || selectedObject.defId === "button") ? (
            <label className="props__field">
              Diameter
              <input
                type="number"
                className="props__input"
                step={0.1}
                min={0.5}
                value={f(Number(selectedObject.params.diameterMm))}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v)) return;
                  ObjectService.updateMacroParams(dispatch, selectedObject, { diameterMm: v });
                }}
              />
            </label>
          ) : (
            <div className="props__row">
              <label className="props__field">
                {selectedObject.kind === "macro" && selectedObject.defId === "slot" ? "Length" : "Width"}
                <input
                  type="number"
                  className="props__input"
                  step={0.1}
                  min={0.1}
                  value={f(size?.w)}
                  onChange={(e) => {
                    const v = roundMm(e.target.valueAsNumber);
                    if (!Number.isFinite(v) || !size) return;
                    const patch = setObjectSize(selectedObject, v, size.h);
                    if (patch) ObjectService.updateObject(dispatch, selectedObject.id, patch);
                  }}
                />
              </label>
              <label className="props__field">
                {selectedObject.kind === "macro" && selectedObject.defId === "slot" ? "Width" : "Height"}
                <input
                  type="number"
                  className="props__input"
                  step={0.1}
                  min={0.1}
                  value={f(size?.h)}
                  onChange={(e) => {
                    const v = roundMm(e.target.valueAsNumber);
                    if (!Number.isFinite(v) || !size) return;
                    const patch = setObjectSize(selectedObject, size.w, v);
                    if (patch) ObjectService.updateObject(dispatch, selectedObject.id, patch);
                  }}
                />
              </label>
            </div>
          )}

          {selectedObject.kind === "macro" && selectedObject.defId === "round-rect" && (
            <label className="props__field">
              Corner R
              <input
                type="number"
                className="props__input"
                step={0.1}
                min={0}
                value={f(Number(selectedObject.params.radiusMm))}
                onChange={(e) => {
                  const v = roundMm(e.target.valueAsNumber);
                  if (!Number.isFinite(v)) return;
                  ObjectService.updateMacroParams(dispatch, selectedObject, { radiusMm: v });
                }}
              />
            </label>
          )}

          <div className="props__section">Options</div>

          {selectedObject.kind !== "image" && (
            <label
              className="props__check"
              title="Construction geometry is drawn dashed and skipped by CAM (not burned). Shortcut: X"
            >
              <input
                type="checkbox"
                checked={selectedObject.construction === true}
                onChange={(e) =>
                  ObjectService.setConstruction(dispatch, selectedObject.id, e.target.checked)
                }
              />
              Construction (not burned)
            </label>
          )}

          <label className="props__field">
            Layer
            <select
              className="props__input"
              value={selectedObject.layerId}
              onChange={(e) => ObjectService.updateObjectLayer(dispatch, selectedObject.id, e.target.value)}
            >
              {document.layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          {document.sketch && Object.keys(document.sketch.parameters).length > 0 && (
            <>
              <div className="props__section">Parameters</div>
              {Object.values(document.sketch.parameters).map((p) => (
                <label key={p.id} className="props__field">
                  {p.name}
                  <input
                    type="number"
                    className="props__input"
                    step={0.1}
                    value={formatMm(p.value)}
                    onChange={(e) => {
                      const v = roundMm(e.target.valueAsNumber);
                      if (!Number.isFinite(v)) return;
                      SketchService.setParameter(state, dispatch, p.name, v);
                    }}
                  />
                </label>
              ))}
            </>
          )}

          {isSketchObjectId(selectedObject.id) && (
            <p className="props__hint">
              Sketch entity — size updates re-solve. Constraints show as glyphs (H, V, L…) on the canvas.
            </p>
          )}
        </div>
      </div>
      <PropsStyles />
    </div>
  );
}

function PropsStyles() {
  return (
    <style>{`
      .props, .props * { font-size: 13px; line-height: 1.4; }
      .props .panel__header h2 { font-size: 15px; font-weight: 600; }
      .props__empty { margin: 0; color: #64748b; }
      .props__hint { margin: 4px 0 0; font-size: 11px; color: #94a3b8; }
      .props__form { display: flex; flex-direction: column; gap: 10px; }
      .props__section {
        margin: 4px 0 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
      }
      .props__row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .props__field { display: flex; flex-direction: column; gap: 4px; color: #334155; font: inherit; }
      .props__input {
        width: 100%; box-sizing: border-box; padding: 8px 10px;
        border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #0f172a; font: inherit;
      }
      .props__check {
        display: flex; align-items: center; gap: 8px; color: #334155; font: inherit; cursor: pointer;
      }
      .props__actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .props__btn {
        margin: 0;
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #f8fafc;
        color: #0f172a;
        font: inherit;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }
      .props__btn:hover {
        border-color: #3b82f6;
        background: #eff6ff;
      }
    `}</style>
  );
}
