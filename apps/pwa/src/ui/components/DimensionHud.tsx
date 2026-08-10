import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../../core/state/store";
import { useSketchTool } from "../sketch/SketchContext";
import { SketchService } from "../../core/services/SketchService";
import { svgToClientPoint } from "./preview/designGeometry";

/**
 * Fusion-style in-place dimension value editor.
 * Sits on the dim label (not a separate top menu).
 * - Create: after placing a dim (dimSession.phase === "edit")
 * - Re-edit: double-click an existing dim (dimInlineEdit)
 */
export function DimensionHud() {
  const { state, dispatch } = useStore();
  const {
    tool,
    dimSession,
    setDimSession,
    resetDimSession,
    setTool,
    dimInlineEdit,
    setDimInlineEdit
  } = useSketchTool();
  const ref = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const createMode = tool === "dimension" && dimSession.phase === "edit";
  const existingMode = !!dimInlineEdit;
  const active = createMode || existingMode;

  const draft = createMode
    ? dimSession.draft
    : existingMode
      ? dimInlineEdit!.draft
      : "";
  const place = createMode
    ? dimSession.place
    : existingMode
      ? dimInlineEdit!.place
      : null;

  // Position the editor over the dim label in the preview container
  useLayoutEffect(() => {
    if (!active || !place) {
      setPos(null);
      return;
    }
    const update = () => {
      const svg = document.querySelector("svg.preview-svg") as SVGSVGElement | null;
      const host = document.querySelector(".preview-container") as HTMLElement | null;
      if (!svg || !host) {
        setPos(null);
        return;
      }
      const screen = svgToClientPoint(svg, place.x, place.y);
      if (!screen) {
        setPos(null);
        return;
      }
      const hostBox = host.getBoundingClientRect();
      setPos({
        left: screen.x - hostBox.left,
        top: screen.y - hostBox.top
      });
    };
    update();
    // Reposition on zoom/pan (viewBox changes / resize)
    const svg = document.querySelector("svg.preview-svg");
    const ro = new ResizeObserver(update);
    if (svg) ro.observe(svg);
    window.addEventListener("resize", update);
    // poll lightly while open — pan/zoom don't always fire resize
    const t = window.setInterval(update, 120);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.clearInterval(t);
    };
  }, [active, place?.x, place?.y]);

  useEffect(() => {
    doneRef.current = false;
    if (!active) return;
    // Defer focus so it wins over the second click of a double-press
    const id = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [active, createMode, dimInlineEdit?.constraintId]);

  // Still mount while measuring position so the first frame can open the editor
  if (!active) return null;
  if (!pos) {
    return (
      <div className="dim-inplace dim-inplace--measuring" data-testid="dim-inplace" aria-hidden>
        <input ref={ref} className="dim-inplace__input dim-hud__input" readOnly value={draft} />
      </div>
    );
  }

  const setDraft = (v: string) => {
    if (createMode && dimSession.phase === "edit") {
      setDimSession({ ...dimSession, draft: v });
    } else if (existingMode && dimInlineEdit) {
      setDimInlineEdit({ ...dimInlineEdit, draft: v });
    }
  };

  const cancel = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (createMode) {
      resetDimSession();
    } else {
      setDimInlineEdit(null);
    }
  };

  const commit = () => {
    if (doneRef.current) return;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    doneRef.current = true;

    if (createMode && dimSession.phase === "edit") {
      SketchService.applyDimension(state, dispatch, dimSession.first, dimSession.second, {
        valueMm: parsed,
        skipPrompt: true,
        placeWorld: dimSession.place
      });
      resetDimSession();
      setTool("select");
      return;
    }

    if (existingMode && dimInlineEdit) {
      SketchService.setDimValue(state, dispatch, dimInlineEdit.constraintId, parsed);
      setDimInlineEdit(null);
    }
  };

  return (
    <div
      className="dim-inplace"
      data-dim-hud="true"
      data-testid="dim-inplace"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        data-dim-hud="true"
        data-testid="dim-inplace-input"
        type="text"
        inputMode="decimal"
        className="dim-inplace__input dim-hud__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        onBlur={() => {
          // Commit on blur if valid (Fusion-like); otherwise cancel empty
          const parsed = Number(draft);
          if (Number.isFinite(parsed) && parsed >= 0) commit();
          else cancel();
        }}
        title="Type size · Enter apply · Esc cancel"
        aria-label="Dimension value in millimetres"
      />
      <span className="dim-inplace__unit">mm</span>
      {/* Hidden OK hook for automation that still clicks .dim-hud__ok */}
      <button
        type="button"
        className="dim-hud__ok dim-inplace__ok"
        data-dim-hud="true"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          commit();
        }}
        aria-hidden
      >
        OK
      </button>
      <style>{`
        .dim-inplace {
          position: absolute;
          z-index: 40;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 6px 3px 4px;
          background: #faf5ff;
          border: 2px solid #7c3aed;
          border-radius: 6px;
          box-shadow: 0 2px 12px rgba(91, 33, 182, 0.28);
          pointer-events: auto;
        }
        .dim-inplace__input {
          width: 72px;
          padding: 4px 6px;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          font-weight: 800;
          font-size: 14px;
          text-align: center;
          color: #6b21a8;
        }
        .dim-inplace__unit {
          font-size: 11px;
          font-weight: 700;
          color: #7c3aed;
          user-select: none;
        }
        .dim-inplace__ok {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
