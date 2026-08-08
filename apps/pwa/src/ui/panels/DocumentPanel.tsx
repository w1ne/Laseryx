import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";
import { UndoToolbar } from "../components/UndoToolbar";
import { getMacroDef, listMacroDefs } from "../../core/macros/catalog";

export function DocumentPanel() {
    const { state, dispatch } = useStore();
    const { document, selectedObjectId } = state;
    const hardwareDefs = listMacroDefs();

    const f = (n: number) => n.toFixed(1);

    const handleAddRectangle = () => ObjectService.addRectangle(state, dispatch);
    const handleAddMacro = (defId: string) => ObjectService.addMacro(state, dispatch, defId);

    const handleImportFile = () => {
        const input = window.document.createElement("input");
        input.type = "file";
        input.accept = "image/png, image/jpeg, image/svg+xml, .svg";
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            if (file.name.toLowerCase().endsWith(".svg")) {
                try {
                    const text = await file.text();
                    const importedObjects = parseSvg(text);
                    if (importedObjects.length === 0) {
                        alert("No supported shapes found in SVG.");
                        return;
                    }

                    const paths = importedObjects.filter(o => o.kind === "path") as PathObj[];
                    if (paths.length > 0) {
                        let minX = Infinity, minY = Infinity;
                        const apply = (p: { x: number; y: number }, t: Transform) => ({
                            x: p.x * t.a + p.y * t.c + t.e,
                            y: p.x * t.b + p.y * t.d + t.f
                        });
                        for (const p of paths) {
                            for (const pt of p.points) {
                                const t = apply(pt, p.transform);
                                if (t.x < minX) minX = t.x;
                                if (t.y < minY) minY = t.y;
                            }
                        }
                        if (minX !== Infinity) {
                            const shiftX = -minX + 10;
                            const shiftY = -minY + 10;
                            paths.forEach(obj => {
                                obj.transform.e += shiftX;
                                obj.transform.f += shiftY;
                            });
                        }
                    }
                    ObjectService.addObjects(dispatch, state, importedObjects);
                } catch {
                    alert("Failed to parse SVG");
                }
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    const src = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                        ObjectService.addImage(dispatch, state, src, img.width * 0.264583, img.height * 0.264583);
                    };
                    img.src = src;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

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
                <div className="parts__grid">
                    {hardwareDefs.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            className="parts__add"
                            onClick={() => handleAddMacro(d.id)}
                        >
                            {d.name}
                        </button>
                    ))}
                </div>

                <div className="parts__more">
                    <button type="button" className="parts__link" onClick={handleAddRectangle}>Rectangle</button>
                    <button type="button" className="parts__link" onClick={handleImportFile}>Import</button>
                </div>

                {document.objects.length === 0 ? (
                    <p className="parts__empty">Add a part above. It shows on the bed.</p>
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
                                        <span className="parts__row-label">{objectLabel(obj)}</span>
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
                    gap: 12px;
                }
                .parts__grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .parts__add {
                    margin: 0;
                    padding: 10px 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    background: #fff;
                    color: #0f172a;
                    font: inherit;
                    font-weight: 600;
                    text-align: center;
                    cursor: pointer;
                }
                .parts__add:hover {
                    border-color: #3b82f6;
                    background: #f8fafc;
                }
                .parts__more {
                    display: flex;
                    gap: 12px;
                }
                .parts__link {
                    margin: 0;
                    padding: 0;
                    border: none;
                    background: none;
                    color: #2563eb;
                    font: inherit;
                    cursor: pointer;
                    text-decoration: underline;
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
                .parts__row-label {
                    font: inherit;
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
