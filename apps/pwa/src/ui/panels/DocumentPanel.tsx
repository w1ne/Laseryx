import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";
import { UndoToolbar } from "../components/UndoToolbar";
import { getMacroDef, listMacroDefs } from "../../core/macros/catalog";

const PART_META: Record<string, { icon: string; blurb: string; primary?: boolean }> = {
    panel: { icon: "▭", blurb: "Outer plate to cut", primary: true },
    screen: { icon: "▣", blurb: "Display cutout + 4 holes", primary: true },
    "mount-hole": { icon: "○", blurb: "Screw / standoff hole", primary: true },
    button: { icon: "◎", blurb: "Round switch hole (16 mm)", primary: true }
};

export function DocumentPanel() {
    const { state, dispatch } = useStore();
    const { document, selectedObjectId } = state;
    const hardwareDefs = listMacroDefs();
    const isEmpty = document.objects.length === 0;

    const f = (n: number) => n.toFixed(1);

    const handleAddRectangle = () => {
        ObjectService.addRectangle(state, dispatch);
    };

    const handleAddMacro = (defId: string) => {
        ObjectService.addMacro(state, dispatch, defId);
    };

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
                        const apply = (p: { x: number, y: number }, t: Transform) => ({
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
                } catch (error) {
                    console.error(error);
                    alert("Failed to parse SVG");
                }
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    const src = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                        const mmW = img.width * 0.264583;
                        const mmH = img.height * 0.264583;
                        ObjectService.addImage(dispatch, state, src, mmW, mmH);
                    };
                    img.src = src;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const objectLabel = (obj: (typeof document.objects)[number]): string => {
        if (obj.kind === "shape") return `Rectangle ${f(obj.shape.width)}×${f(obj.shape.height)} mm`;
        if (obj.kind === "image") return `Image ${f(obj.width)}×${f(obj.height)} mm`;
        if (obj.kind === "path") return "Path (imported)";
        if (obj.kind === "macro") {
            const def = getMacroDef(obj.defId);
            if (!def) return `Broken part (${obj.defId})`;
            if (obj.defId === "screen") {
                const preset = String(obj.params.preset ?? "custom");
                return preset === "custom"
                    ? `Screen ${f(Number(obj.params.widthMm))}×${f(Number(obj.params.heightMm))} mm`
                    : `Screen · ${preset}`;
            }
            if (obj.defId === "mount-hole") return `Mount hole Ø${f(Number(obj.params.diameterMm))} mm`;
            if (obj.defId === "button") return `Button Ø${f(Number(obj.params.diameterMm))} mm`;
            if (obj.defId === "panel") return `Panel ${f(Number(obj.params.widthMm))}×${f(Number(obj.params.heightMm))} mm`;
            return def.name;
        }
        return obj.id;
    };

    return (
        <div className="panel hw-panel">
            <div className="panel__header">
                <div>
                    <h2>Build panel</h2>
                    <p className="hw-panel__subtitle">Add parts → edit size → cut</p>
                </div>
                <UndoToolbar />
            </div>

            <div className="panel__body hw-panel__body">
                <section className="hw-section">
                    <div className="hw-section__title">1. Add a part</div>
                    <p className="hw-section__hint">
                        Click a block. It appears on the bed (right). Select it, then set size in <strong>Properties</strong>.
                    </p>
                    <div className="hw-parts-grid">
                        {hardwareDefs.map((d) => {
                            const meta = PART_META[d.id] ?? { icon: "◆", blurb: d.category };
                            return (
                                <button
                                    key={d.id}
                                    type="button"
                                    className="hw-part-card"
                                    onClick={() => handleAddMacro(d.id)}
                                >
                                    <span className="hw-part-card__icon" aria-hidden>{meta.icon}</span>
                                    <span className="hw-part-card__name">{d.name}</span>
                                    <span className="hw-part-card__blurb">{meta.blurb}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="hw-advanced">
                        <span className="hw-advanced__label">Also:</span>
                        <button type="button" className="button hw-advanced__btn" onClick={handleAddRectangle}>
                            Plain rectangle
                        </button>
                        <button type="button" className="button hw-advanced__btn" onClick={handleImportFile}>
                            Import SVG / image
                        </button>
                    </div>
                    <p className="hw-disclaimer">
                        Sizes are workshop estimates — check your module datasheet before a final cut.
                    </p>
                </section>

                <section className="hw-section">
                    <div className="hw-section__title">
                        2. Parts on this design
                        {document.objects.length > 0 && (
                            <span className="hw-count">{document.objects.length}</span>
                        )}
                    </div>

                    {isEmpty ? (
                        <div className="hw-empty">
                            <p className="hw-empty__title">Nothing on the bed yet</p>
                            <ol className="hw-empty__steps">
                                <li>Add <strong>Panel outline</strong> (the plate)</li>
                                <li>Add <strong>Screen</strong> / holes / button</li>
                                <li>Click a part → change X/Y and sizes in Properties</li>
                                <li>Generate G-code (top bar) when ready</li>
                            </ol>
                        </div>
                    ) : (
                        <div className="hw-list">
                            {document.objects.map(obj => {
                                const isSelected = obj.id === selectedObjectId;
                                const layerName = document.layers.find(l => l.id === obj.layerId)?.name || obj.layerId;
                                return (
                                    <div
                                        key={obj.id}
                                        className={`hw-list__item ${isSelected ? "is-active" : ""}`}
                                        onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                dispatch({ type: "SELECT_OBJECT", payload: obj.id });
                                            }
                                        }}
                                    >
                                        <div className="hw-list__main">
                                            <span className="hw-list__label">{objectLabel(obj)}</span>
                                            <span className="hw-list__meta">{layerName}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="hw-list__del"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                ObjectService.deleteObject(dispatch, obj.id);
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {!isEmpty && (
                    <section className="hw-section hw-next">
                        <div className="hw-section__title">3. Next</div>
                        <p className="hw-section__hint">
                            Select a part in the list or on the canvas. Edit position and sizes in the <strong>Properties</strong> panel.
                            When the layout looks right, use <strong>Generate</strong> in the top bar to make G-code, then open <strong>Machine</strong> to cut.
                        </p>
                    </section>
                )}
            </div>

            <style>{`
                .hw-panel__subtitle {
                    margin: 2px 0 0;
                    font-size: 11px;
                    font-weight: 500;
                    color: #64748b;
                }
                .hw-panel .panel__header {
                    align-items: flex-start;
                    gap: 8px;
                }
                .hw-panel__body {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding-top: 4px;
                }
                .hw-section__title {
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #0f172a;
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .hw-count {
                    font-size: 10px;
                    background: #e2e8f0;
                    color: #334155;
                    padding: 1px 7px;
                    border-radius: 999px;
                    letter-spacing: 0;
                    text-transform: none;
                }
                .hw-section__hint {
                    margin: 0 0 10px;
                    font-size: 12px;
                    color: #475569;
                    line-height: 1.45;
                }
                .hw-parts-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                .hw-part-card {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 2px;
                    text-align: left;
                    padding: 10px 10px 12px;
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    background: #fff;
                    cursor: pointer;
                    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
                }
                .hw-part-card:hover {
                    border-color: #3b82f6;
                    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
                    transform: translateY(-1px);
                }
                .hw-part-card:active {
                    transform: translateY(0);
                }
                .hw-part-card__icon {
                    font-size: 18px;
                    line-height: 1;
                    color: #1d4ed8;
                    margin-bottom: 4px;
                }
                .hw-part-card__name {
                    font-size: 13px;
                    font-weight: 700;
                    color: #0f172a;
                }
                .hw-part-card__blurb {
                    font-size: 11px;
                    color: #64748b;
                    line-height: 1.3;
                }
                .hw-advanced {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px;
                    margin-top: 10px;
                }
                .hw-advanced__label {
                    font-size: 11px;
                    color: #94a3b8;
                }
                .hw-advanced__btn {
                    font-size: 11px !important;
                    padding: 4px 8px !important;
                }
                .hw-disclaimer {
                    margin: 10px 0 0;
                    font-size: 10px;
                    color: #9a3412;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 6px;
                    padding: 6px 8px;
                    line-height: 1.35;
                }
                .hw-empty {
                    background: #f8fafc;
                    border: 1px dashed #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 14px;
                }
                .hw-empty__title {
                    margin: 0 0 8px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #334155;
                }
                .hw-empty__steps {
                    margin: 0;
                    padding-left: 18px;
                    font-size: 12px;
                    color: #475569;
                    line-height: 1.55;
                }
                .hw-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .hw-list__item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    padding: 10px 10px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #fff;
                    cursor: pointer;
                }
                .hw-list__item.is-active {
                    border-color: #3b82f6;
                    background: #eff6ff;
                    box-shadow: 0 0 0 1px #93c5fd;
                }
                .hw-list__main {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }
                .hw-list__label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #0f172a;
                }
                .hw-list__meta {
                    font-size: 10px;
                    color: #64748b;
                }
                .hw-list__del {
                    flex-shrink: 0;
                    border: 1px solid #fecaca;
                    background: #fef2f2;
                    color: #b91c1c;
                    font-size: 11px;
                    border-radius: 6px;
                    padding: 4px 8px;
                    cursor: pointer;
                }
                .hw-list__del:hover {
                    background: #fee2e2;
                }
                .hw-next {
                    padding-top: 4px;
                    border-top: 1px solid #e2e8f0;
                }
            `}</style>
        </div>
    );
}
