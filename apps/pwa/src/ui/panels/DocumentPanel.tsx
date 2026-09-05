import { useStore } from "../../core/state/store";
import { buildObjectListRows, listGroups } from "../../core/groups";
import { GroupService } from "../../core/services/GroupService";
import { UndoToolbar } from "../components/UndoToolbar";
import { TEMPLATE_LIBRARY } from "../../core/templates";
import { TemplateIconSvg } from "../components/TemplateIcons";
import { placeTemplate } from "../components/placeTemplate";
import { useSketchTool, type SketchToolId } from "../sketch/SketchContext";
import { groupListLabel, objectListLabel } from "../../core/objectLabels";
import { ComponentsBoxPanel } from "../components/ComponentsBoxPanel";

const TOOL_BY_TEMPLATE: Record<string, SketchToolId> = {
  rect: "rect",
  circle: "circle",
  line: "line",
  slot: "slot",
  "round-rect": "round-rect",
  import: "import"
};

/**
 * Fusion-style left rail: pick tool (or Select), then draw on canvas.
 * Object list is compact: groups collapse members so you don't get 4 lines per rect.
 */
export function DocumentPanel() {
  const { state, dispatch } = useStore();
  const { document, selectedObjectId, selectedObjectIds } = state;
  const { tool, setTool } = useSketchTool();

  const onToolClick = (templateId: string) => {
    const t = TOOL_BY_TEMPLATE[templateId] ?? "select";
    if (t === "import") {
      const entry = TEMPLATE_LIBRARY.find((x) => x.id === "import");
      if (entry) placeTemplate(entry, state, dispatch);
      setTool("select");
      return;
    }
    setTool(t);
  };

  const rows = buildObjectListRows(document);
  const selSet = new Set(
    selectedObjectIds.length > 0
      ? selectedObjectIds
      : selectedObjectId
        ? [selectedObjectId]
        : []
  );

  return (
    <div className="side">
      <ComponentsBoxPanel document={document} onWorkspaceChange={(next) => dispatch({ type: "SET_ENCLOSURE_WORKSPACE", payload: next })} />
      <div className="side__tools" role="toolbar" aria-label="Sketch tools" data-testid="template-library">
        <button
          type="button"
          className={`side__tool ${tool === "select" ? "is-active" : ""}`}
          title="Select — click objects to select; drag free shapes; Shift+click multi-select. Esc also returns here."
          onClick={() => setTool("select")}
        >
          <SelectIcon />
          <span className="side__tool-label">Select</span>
        </button>
        {TEMPLATE_LIBRARY.map((t) => {
          const tid = TOOL_BY_TEMPLATE[t.id] ?? "select";
          const active = tid !== "import" && tool === tid;
          const toolTips: Record<string, string> = {
            rect: "Rectangle — drag on the bed to draw a constrained box (auto-grouped). Esc = Select.",
            circle: "Circle / hole — drag from center to set diameter. Esc = Select.",
            line: "Line — drag endpoints; snap joins with coincident. Hold Shift for ortho. Esc = Select.",
            slot: "Slot (stadium hole) — drag to set length × width; edit in Properties.",
            "round-rect": "Rounded rectangle — drag size; set corner radius in Properties.",
            import: "Import SVG paths or a PNG/JPEG image onto the bed."
          };
          return (
            <button
              key={t.id}
              type="button"
              className={`side__tool ${active ? "is-active" : ""}`}
              title={toolTips[t.id] ?? t.description}
              onClick={() => onToolClick(t.id)}
            >
              <TemplateIconSvg name={t.icon} />
              <span className="side__tool-label">{t.name}</span>
            </button>
          );
        })}
      </div>

      <div className="side__list-head">
        <span className="side__list-title">Objects</span>
        <UndoToolbar />
      </div>

      <div className="side__list">
        {rows.length === 0 ? (
          <p className="side__empty">
            {tool === "select" ? "Pick a tool, drag on the bed" : "Drag on the bed to draw"}
          </p>
        ) : (
          rows.map((row) => {
            if (row.kind === "group") {
              const isSelected = row.memberIds.some((id) => selSet.has(id));
              return (
                <div
                  key={row.groupId}
                  className={`side__row side__row--group ${isSelected ? "is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="side__row-main"
                    title={`Select group “${row.name}” (${row.memberIds.length} parts). Drag on canvas to move together.`}
                    onClick={(e) => {
                      setTool("select");
                      if (e.shiftKey) {
                        // add all members
                        dispatch({
                          type: "SET_SELECTION",
                          payload: [...new Set([...selectedObjectIds, ...row.memberIds])]
                        });
                      } else {
                        dispatch({ type: "SET_SELECTION", payload: [...row.memberIds] });
                      }
                    }}
                  >
                    <span className="side__group-mark" aria-hidden>
                      ▣
                    </span>
                    {(() => {
                      const g = listGroups(document).find((x) => x.id === row.groupId);
                      return g
                        ? groupListLabel(g, document)
                        : `${row.name} · ${row.memberIds.length}`;
                    })()}
                  </button>
                  <button
                    type="button"
                    className="side__row-del"
                    title={`Delete entire group “${row.name}” and all of its members (Delete key also works when selected)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      GroupService.deleteGroup(state, dispatch, row.groupId);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            }

            const obj = document.objects.find((o) => o.id === row.objectId);
            if (!obj) return null;
            const isSelected = selSet.has(obj.id);
            const label = objectListLabel(obj, document);
            return (
              <div key={obj.id} className={`side__row ${isSelected ? "is-selected" : ""}`}>
                <button
                  type="button"
                  className="side__row-main"
                  title={`Select “${label}”. Shift+click adds to multi-select.`}
                  onClick={(e) => {
                    setTool("select");
                    GroupService.selectWithGroup(state, dispatch, obj.id, {
                      additive: e.shiftKey
                    });
                  }}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="side__row-del"
                  title={
                    selSet.has(obj.id) && selSet.size > 1
                      ? `Delete ${selSet.size} selected objects (Delete key)`
                      : `Delete “${label}” (Delete key)`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    // If this object is currently multi-selected, delete whole selection
                    if (selSet.has(obj.id) && selSet.size > 1) {
                      GroupService.deleteSelection(state, dispatch);
                    } else {
                      GroupService.deleteObjects(state, dispatch, [obj.id]);
                    }
                  }}
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
        .side__tool.is-active {
          background: #0f172a;
          color: #f8fafc;
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
          font-size: 12px;
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
        .side__row--group .side__row-main {
          font-weight: 600;
        }
        .side__group-mark {
          display: inline-block;
          margin-right: 6px;
          color: #64748b;
          font-size: 12px;
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
        .side__row-del {
          width: 36px;
          margin: 0;
          border: none;
          border-left: 1px solid #f1f5f9;
          background: transparent;
          color: #94a3b8;
          font-size: 16px;
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

function SelectIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M8 4l12 14-5 1 3 8-3 1-3-8-4 4V4z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
