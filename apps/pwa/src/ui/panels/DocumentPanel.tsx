import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { getMacroDef } from "../../core/macros/catalog";
import { UndoToolbar } from "../components/UndoToolbar";
import { TEMPLATE_LIBRARY } from "../../core/templates";
import { TemplateIconSvg } from "../components/TemplateIcons";
import { placeTemplate } from "../components/placeTemplate";
import { formatMm } from "../../core/util";

/**
 * Left panel: slim icon tools + object list (CAD-style).
 */
export function DocumentPanel() {
  const { state, dispatch } = useStore();
  const { document, selectedObjectId } = state;

  const objectLabel = (obj: (typeof document.objects)[number]): string => {
    let base: string;
    if (obj.kind === "shape") base = `Rect ${formatMm(obj.shape.width)}×${formatMm(obj.shape.height)}`;
    else if (obj.kind === "image") base = `Image ${formatMm(obj.width)}×${formatMm(obj.height)}`;
    else if (obj.kind === "path") base = obj.closed ? "Path" : "Line";
    else if (obj.kind === "macro") {
      if (obj.defId === "mount-hole" || obj.defId === "button") {
        base = `Circle Ø${formatMm(Number(obj.params.diameterMm))}`;
      } else if (obj.defId === "slot") {
        base = `Slot ${formatMm(Number(obj.params.lengthMm))}×${formatMm(Number(obj.params.widthMm))}`;
      } else if (obj.defId === "round-rect") {
        base = `Round ${formatMm(Number(obj.params.widthMm))}×${formatMm(Number(obj.params.heightMm))}`;
      } else {
        base = getMacroDef(obj.defId)?.name ?? obj.defId;
      }
    } else base = obj.id;

    if (obj.kind !== "image" && obj.construction) {
      return `${base} · construction`;
    }
    return base;
  };

  return (
    <div className="side">
      <div className="side__tools" role="toolbar" aria-label="Draw" data-testid="template-library">
        {TEMPLATE_LIBRARY.map((t) => (
          <button
            key={t.id}
            type="button"
            className="side__tool"
            title={t.description}
            onClick={() => placeTemplate(t, state, dispatch)}
          >
            <TemplateIconSvg name={t.icon} />
            <span className="side__tool-label">{t.name}</span>
          </button>
        ))}
      </div>

      <div className="side__list-head">
        <span className="side__list-title">Objects</span>
        <UndoToolbar />
      </div>

      <div className="side__list">
        {document.objects.length === 0 ? (
          <p className="side__empty">No objects yet</p>
        ) : (
          document.objects.map((obj) => {
            const isSelected = obj.id === selectedObjectId;
            return (
              <div key={obj.id} className={`side__row ${isSelected ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="side__row-main"
                  onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                >
                  {objectLabel(obj)}
                </button>
                <button
                  type="button"
                  className="side__row-del"
                  title="Remove"
                  onClick={() => ObjectService.deleteObject(dispatch, obj.id)}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .side {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          font-size: 13px;
          line-height: 1.35;
          color: #0f172a;
        }
        .side__tools {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .side__tool {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin: 0;
          padding: 10px 4px 8px;
          border: none;
          background: #fff;
          color: #334155;
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .side__tool:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .side__tool:active {
          background: #e2e8f0;
        }
        .side__tool-label {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .side__list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafafa;
        }
        .side__list-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }
        .side__list {
          display: flex;
          flex-direction: column;
          max-height: min(50vh, 360px);
          overflow-y: auto;
        }
        .side__empty {
          margin: 0;
          padding: 16px 12px;
          color: #94a3b8;
          text-align: center;
        }
        .side__row {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid #f1f5f9;
        }
        .side__row.is-selected {
          background: #eff6ff;
        }
        .side__row.is-selected .side__row-main {
          color: #1d4ed8;
          font-weight: 600;
        }
        .side__row-main {
          flex: 1;
          margin: 0;
          padding: 9px 10px;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .side__row-main:hover {
          background: rgba(15, 23, 42, 0.03);
        }
        .side__row-del {
          width: 36px;
          margin: 0;
          border: none;
          border-left: 1px solid #f1f5f9;
          background: transparent;
          color: #94a3b8;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
        }
        .side__row-del:hover {
          color: #b91c1c;
          background: #fef2f2;
        }
      `}</style>
    </div>
  );
}
