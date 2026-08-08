import { useEffect, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import {
  duplicateObject,
  getObjectSize,
  mirrorHorizontal,
  mirrorVertical,
  rotate90,
  setObjectSize,
  nudgeObject
} from "../../core/objectEdit";
import { formatMm, roundMm } from "../../core/util";

/**
 * CAD-style modify tools for the selection: size, mirror, rotate, duplicate, nudge.
 */
export function ModifyToolbar() {
  const { state, dispatch } = useStore();
  const selected = state.document.objects.find((o) => o.id === state.selectedObjectId);

  const size = selected ? getObjectSize(selected) : null;
  const [w, setW] = useState("");
  const [h, setH] = useState("");

  useEffect(() => {
    if (size) {
      setW(formatMm(size.w));
      setH(formatMm(size.h));
    } else {
      setW("");
      setH("");
    }
  }, [selected?.id, size?.w, size?.h]);

  if (!selected) {
    return (
      <div className="modify" data-testid="modify-toolbar">
        <span className="modify__hint">Select an object to move, resize, or mirror</span>
        <style>{modifyCss}</style>
      </div>
    );
  }

  const applyPatch = (patch: ReturnType<typeof mirrorHorizontal>) => {
    if (!patch) return;
    ObjectService.updateObject(dispatch, selected.id, patch);
  };

  const applySize = () => {
    const nw = roundMm(Number(w));
    const nh = roundMm(Number(h));
    if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return;
    const patch = setObjectSize(selected, nw, nh);
    applyPatch(patch);
  };

  const dup = () => {
    const copy = duplicateObject(selected, 10);
    dispatch({ type: "ADD_OBJECT", payload: copy });
    dispatch({ type: "SELECT_OBJECT", payload: copy.id });
  };

  return (
    <div className="modify" data-testid="modify-toolbar" role="toolbar" aria-label="Modify">
      <span className="modify__label">Size</span>
      <label className="modify__field">
        W
        <input
          className="modify__input"
          type="number"
          step="0.1"
          min="0.1"
          value={w}
          onChange={(e) => setW(e.target.value)}
          onBlur={applySize}
          onKeyDown={(e) => e.key === "Enter" && applySize()}
        />
      </label>
      <label className="modify__field">
        H
        <input
          className="modify__input"
          type="number"
          step="0.1"
          min="0.1"
          value={h}
          onChange={(e) => setH(e.target.value)}
          onBlur={applySize}
          onKeyDown={(e) => e.key === "Enter" && applySize()}
        />
      </label>
      <span className="modify__unit">mm</span>

      <span className="modify__sep" />

      <button type="button" className="modify__btn" title="Mirror horizontal" onClick={() => applyPatch(mirrorHorizontal(selected))}>
        Flip H
      </button>
      <button type="button" className="modify__btn" title="Mirror vertical" onClick={() => applyPatch(mirrorVertical(selected))}>
        Flip V
      </button>
      <button type="button" className="modify__btn" title="Rotate 90° clockwise" onClick={() => applyPatch(rotate90(selected, 1))}>
        Rot 90°
      </button>
      <button type="button" className="modify__btn" title="Duplicate" onClick={dup}>
        Duplicate
      </button>

      <span className="modify__sep" />

      <button type="button" className="modify__btn" title="Nudge left 1mm" onClick={() => applyPatch(nudgeObject(selected, -1, 0))}>
        ←
      </button>
      <button type="button" className="modify__btn" title="Nudge right 1mm" onClick={() => applyPatch(nudgeObject(selected, 1, 0))}>
        →
      </button>
      <button type="button" className="modify__btn" title="Nudge up 1mm" onClick={() => applyPatch(nudgeObject(selected, 0, -1))}>
        ↑
      </button>
      <button type="button" className="modify__btn" title="Nudge down 1mm" onClick={() => applyPatch(nudgeObject(selected, 0, 1))}>
        ↓
      </button>

      <style>{modifyCss}</style>
    </div>
  );
}

const modifyCss = `
  .modify {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #e2e8f0;
    font-size: 13px;
    line-height: 1.3;
  }
  .modify__hint {
    color: #64748b;
  }
  .modify__label {
    font-weight: 700;
    color: #64748b;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .modify__field {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #334155;
    font: inherit;
  }
  .modify__input {
    width: 64px;
    padding: 5px 6px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font: inherit;
    color: #0f172a;
  }
  .modify__unit {
    color: #94a3b8;
    margin-right: 4px;
  }
  .modify__sep {
    width: 1px;
    height: 22px;
    background: #e2e8f0;
    margin: 0 2px;
  }
  .modify__btn {
    margin: 0;
    padding: 5px 9px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    color: #0f172a;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .modify__btn:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }
`;
