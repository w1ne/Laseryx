import { useStore } from "../../core/state/store";
import { SketchService } from "../../core/services/SketchService";
import { isSketchObjectId } from "../../core/sketch/bake";
import { useSketchTool } from "../sketch/SketchContext";

const TOOLS: {
  type: Parameters<typeof SketchService.applyConstraintType>[2];
  label: string;
  title: string;
  needsTwo?: boolean;
}[] = [
  {
    type: "horizontal",
    label: "H",
    title: "Horizontal — force selected line(s) level (constant Y). Select line(s) first."
  },
  {
    type: "vertical",
    label: "V",
    title: "Vertical — force selected line(s) plumb (constant X). Select line(s) first."
  },
  {
    type: "coincident",
    label: "⊙",
    title: "Coincident — join nearest endpoints of two selected lines. Shift+click both lines, then press.",
    needsTwo: true
  },
  {
    type: "parallel",
    label: "∥",
    title: "Parallel — keep two selected lines parallel. Shift+click two lines first.",
    needsTwo: true
  },
  {
    type: "perpendicular",
    label: "⊥",
    title: "Perpendicular — keep two selected lines at 90°. Shift+click two lines first.",
    needsTwo: true
  },
  {
    type: "equalLength",
    label: "=",
    title: "Equal length — make two selected lines the same length. Shift+click two lines first.",
    needsTwo: true
  },
  {
    type: "equalRadius",
    label: "R=",
    title: "Equal radius — make two selected circles the same size. Shift+click two circles first.",
    needsTwo: true
  },
  {
    type: "concentric",
    label: "◎",
    title: "Concentric — share the same center for two selected circles. Shift+click two circles first.",
    needsTwo: true
  },
  {
    type: "fix",
    label: "📌",
    title: "Fix — lock the selected entity’s anchor point so the solver cannot move it."
  }
];

export function shouldShowConstraintToolbar(selectedObjectId: string | undefined, selectedObjectIds: string[]): boolean {
  const ids = selectedObjectIds.length > 0 ? selectedObjectIds : selectedObjectId ? [selectedObjectId] : [];
  return ids.some(isSketchObjectId);
}

/**
 * Apply constraints only. Existing constraints show as glyphs on the canvas, not a list.
 */
export function ConstraintToolbar() {
  const { state, dispatch } = useStore();
  const { tool, setTool, dimSession, resetDimSession } = useSketchTool();
  const sketch = state.document.sketch;
  const status = state.document.sketchStatus;
  const ids =
    state.selectedObjectIds.length > 0
      ? state.selectedObjectIds
      : state.selectedObjectId
        ? [state.selectedObjectId]
        : [];
  const sketchCount = ids.filter(isSketchObjectId).length;
  const hasSketch = !!sketch && Object.keys(sketch.entities).length > 0;
  const dimActive = tool === "dimension";

  if (!shouldShowConstraintToolbar(state.selectedObjectId, state.selectedObjectIds)) return null;

  const dimHint =
    dimSession.phase === "idle"
      ? "click point or curve"
      : dimSession.phase === "picked1"
        ? "click 2nd ref"
        : dimSession.phase === "place"
          ? "click to place"
          : "type on dim";

  const dof = status?.dof;
  const badge =
    !hasSketch || !status
      ? null
      : status.ok
        ? dof === 0
          ? "Fully defined"
          : dof && dof > 0
            ? `Under (${dof} DOF)`
            : "Solved"
        : "Over / failed";

  return (
    <div className="cbar" data-testid="constraint-toolbar">
      <div className="cbar__label">Constraints</div>
      <div className="cbar__tools">
        <button
          type="button"
          className={`cbar__btn cbar__btn--dim ${dimActive ? "is-active" : ""}`}
          title={
            !hasSketch
              ? "Draw sketch geometry first"
              : "Sketch Dimension (D) — Fusion: select a line (or press Dim with a line selected) → purple dim follows mouse → click to place → type mm + Enter."
          }
          disabled={!hasSketch}
          onClick={() => {
            if (dimActive) {
              resetDimSession();
              setTool("select");
            } else {
              setTool("dimension");
            }
          }}
        >
          📏 Dim
        </button>
        {TOOLS.map((t) => {
          const disabled = !hasSketch || (t.needsTwo ? sketchCount < 2 : sketchCount < 1);
          return (
            <button
              key={t.type}
              type="button"
              className="cbar__btn"
              title={
                !hasSketch
                  ? "Draw a line, circle, or rectangle first — then constraints apply"
                  : t.title
              }
              disabled={disabled}
              onClick={() => {
                if (dimActive) {
                  resetDimSession();
                  setTool("select");
                }
                SketchService.applyConstraintType(state, dispatch, t.type);
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        className="cbar__sel"
        title={
          dimActive
            ? `Dimension tool: ${dimHint}`
            : !hasSketch
              ? "No sketch yet — draw geometry to enable constraints"
              : sketchCount > 0
                ? `${sketchCount} sketch object(s) selected`
                : "Select sketch geometry, then apply a constraint — or press D for dimensions"
        }
      >
        {dimActive ? `Dim · ${dimHint}` : !hasSketch ? "draw first" : sketchCount > 0 ? `${sketchCount} sk` : "select / D"}
      </div>
      {badge && (
        <div
          className={`cbar__status ${status?.ok ? "is-ok" : "is-bad"}`}
          title={
            status
              ? `Sketch solver: residual ${status.residual.toExponential(2)}, ${status.iterations} iterations` +
                (status.message ? ` — ${status.message}` : "")
              : "Sketch solver status"
          }
        >
          {badge}
        </div>
      )}
      <style>{`
        .cbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 6px 10px;
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 10px;
          font-size: 12px;
        }
        .cbar__label {
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 10px;
          color: #94a3b8;
        }
        .cbar__tools {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .cbar__btn {
          min-width: 32px;
          height: 28px;
          padding: 0 8px;
          border: 1px solid #334155;
          border-radius: 6px;
          background: #1e293b;
          color: #f8fafc;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        .cbar__btn:hover:not(:disabled) {
          background: #334155;
        }
        .cbar__btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .cbar__btn--dim.is-active {
          background: #7c3aed;
          border-color: #a78bfa;
          color: #fff;
        }
        .cbar__sel {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
        }
        .cbar__status {
          margin-left: auto;
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
        }
        .cbar__status.is-ok { color: #4ade80; }
        .cbar__status.is-bad { color: #f87171; }
      `}</style>
    </div>
  );
}
