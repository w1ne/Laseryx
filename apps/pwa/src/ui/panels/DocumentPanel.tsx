import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { getMacroDef } from "../../core/macros/catalog";
import { UndoToolbar } from "../components/UndoToolbar";

/**
 * Selection list (what’s on the design).
 * Creation lives in the Create toolbar — like LightBurn / CAD object browsers.
 */
export function DocumentPanel() {
    const { state, dispatch } = useStore();
    const { document, selectedObjectId } = state;

    const f = (n: number) => n.toFixed(1);

    const objectLabel = (obj: (typeof document.objects)[number]): string => {
        if (obj.kind === "shape") return `Rect ${f(obj.shape.width)}×${f(obj.shape.height)}`;
        if (obj.kind === "image") return `Image ${f(obj.width)}×${f(obj.height)}`;
        if (obj.kind === "path") return "Path";
        if (obj.kind === "macro") {
            const def = getMacroDef(obj.defId);
            if (!def) return `Missing: ${obj.defId}`;
            if (obj.defId === "mount-hole" || obj.defId === "button") {
                return `Circle Ø${f(Number(obj.params.diameterMm))}`;
            }
            // legacy frame/cutout macros
            if (obj.defId === "panel" || obj.defId === "screen") {
                return `${obj.defId === "panel" ? "Frame" : "Cutout"} (legacy)`;
            }
            return def.name;
        }
        return obj.id;
    };

    return (
        <div className="panel objects-panel">
            <div className="panel__header">
                <h2>Objects</h2>
                <UndoToolbar />
            </div>

            <div className="panel__body objects-panel__body">
                {document.objects.length === 0 ? (
                    <p className="objects-panel__empty">Empty. Use Create to add shapes.</p>
                ) : (
                    <ul className="objects-panel__list">
                        {document.objects.map((obj) => {
                            const isSelected = obj.id === selectedObjectId;
                            return (
                                <li key={obj.id}>
                                    <button
                                        type="button"
                                        className={`objects-panel__row ${isSelected ? "is-selected" : ""}`}
                                        onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                    >
                                        {objectLabel(obj)}
                                    </button>
                                    <button
                                        type="button"
                                        className="objects-panel__del"
                                        onClick={() => ObjectService.deleteObject(dispatch, obj.id)}
                                        aria-label={`Remove ${objectLabel(obj)}`}
                                    >
                                        ×
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <style>{`
                .objects-panel,
                .objects-panel * {
                    font-size: 13px;
                    line-height: 1.4;
                }
                .objects-panel .panel__header h2 {
                    font-size: 16px;
                    font-weight: 600;
                }
                .objects-panel__body {
                    gap: 8px;
                }
                .objects-panel__empty {
                    margin: 0;
                    padding: 12px;
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                    color: #64748b;
                    background: #f8fafc;
                }
                .objects-panel__list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .objects-panel__list li {
                    display: flex;
                    gap: 4px;
                    align-items: stretch;
                }
                .objects-panel__row {
                    flex: 1;
                    margin: 0;
                    padding: 8px 10px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #fff;
                    color: #0f172a;
                    font: inherit;
                    text-align: left;
                    cursor: pointer;
                }
                .objects-panel__row.is-selected {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
                .objects-panel__del {
                    width: 32px;
                    margin: 0;
                    padding: 0;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #fff;
                    color: #64748b;
                    font: inherit;
                    font-size: 16px;
                    line-height: 1;
                    cursor: pointer;
                }
                .objects-panel__del:hover {
                    color: #b91c1c;
                    border-color: #fecaca;
                    background: #fef2f2;
                }
            `}</style>
        </div>
    );
}
