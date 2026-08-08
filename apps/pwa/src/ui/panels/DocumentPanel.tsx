import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { getMacroDef } from "../../core/macros/catalog";
import { UndoToolbar } from "../components/UndoToolbar";

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
            if (obj.defId === "screen") return `Screen ${f(Number(obj.params.widthMm))}×${f(Number(obj.params.heightMm))}`;
            if (obj.defId === "mount-hole") return `Hole Ø${f(Number(obj.params.diameterMm))}`;
            if (obj.defId === "button") return `Button Ø${f(Number(obj.params.diameterMm))}`;
            if (obj.defId === "panel") return `Panel ${f(Number(obj.params.widthMm))}×${f(Number(obj.params.heightMm))}`;
            return def.name;
        }
        return obj.id;
    };

    return (
        <div className="panel parts">
            <div className="panel__header">
                <h2>Parts</h2>
                <UndoToolbar />
            </div>

            <div className="panel__body parts__body">
                {document.objects.length === 0 ? (
                    <p className="parts__empty">No parts yet. Use the tools above the bed.</p>
                ) : (
                    <ul className="parts__list">
                        {document.objects.map((obj) => {
                            const isSelected = obj.id === selectedObjectId;
                            return (
                                <li key={obj.id}>
                                    <button
                                        type="button"
                                        className={`parts__row ${isSelected ? "is-selected" : ""}`}
                                        onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                    >
                                        {objectLabel(obj)}
                                    </button>
                                    <button
                                        type="button"
                                        className="parts__row-del"
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
                .parts,
                .parts * {
                    font-size: 13px;
                    line-height: 1.4;
                }
                .parts .panel__header h2 {
                    font-size: 16px;
                    font-weight: 600;
                }
                .parts__body {
                    gap: 8px;
                }
                .parts__empty {
                    margin: 0;
                    padding: 12px;
                    border: 1px dashed #cbd5e1;
                    border-radius: 8px;
                    color: #64748b;
                    background: #f8fafc;
                }
                .parts__list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .parts__list li {
                    display: flex;
                    gap: 4px;
                    align-items: stretch;
                }
                .parts__row {
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
                .parts__row.is-selected {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
                .parts__row-del {
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
                .parts__row-del:hover {
                    color: #b91c1c;
                    border-color: #fecaca;
                    background: #fef2f2;
                }
            `}</style>
        </div>
    );
}
