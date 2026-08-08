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

    // Helper to format numbers for display
    const f = (n: number) => n.toFixed(2);

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

                    // Normalize position (simple centering logic logic ported from App.tsx)
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
                            const shiftX = -minX + 10; // 10mm padding
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
                // Image Import
                const reader = new FileReader();
                reader.onload = () => {
                    const src = reader.result as string;
                    const img = new Image();
                    img.onload = () => {
                        // Convert px to mm (assuming 96 DPI: 1 inch = 25.4mm)
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

    return (
        <div className="panel">
            <div className="panel__header">
                <h2>Document</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#555" }}>+ Hardware</span>
                        <select
                            className="button"
                            style={{ fontSize: "11px", padding: "4px 6px", maxWidth: 140 }}
                            defaultValue=""
                            onChange={(e) => {
                                const id = e.target.value;
                                if (id) {
                                    handleAddMacro(id);
                                    e.target.value = "";
                                }
                            }}
                        >
                            <option value="" disabled>Part…</option>
                            {hardwareDefs.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </label>
                    <button className="button" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={handleAddRectangle}>Add Rect</button>
                    <button className="button" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={handleImportFile}>Import</button>
                </div>
            </div>
            <div style={{ padding: "6px 12px", borderBottom: "1px solid #eee", fontSize: "10px", color: "#888" }}>
                Workshop approx footprints — verify datasheet before final cut.
            </div>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #eee" }}>
                <UndoToolbar />
            </div>
            <div className="panel__body">
                <div className="list" style={{ gap: "4px", display: "flex", flexDirection: "column" }}>
                    {document.objects.map(obj => {
                        const isSelected = obj.id === selectedObjectId;
                        let label = obj.id;
                        if (obj.kind === "shape") label = `Rect ${f(obj.shape.width)}x${f(obj.shape.height)}`;
                        if (obj.kind === "image") label = `Image ${f(obj.width)}x${f(obj.height)}`;
                        if (obj.kind === "path") label = "Path";
                        if (obj.kind === "macro") {
                            const def = getMacroDef(obj.defId);
                            if (!def) {
                                label = `⚠ Missing: ${obj.defId}`;
                            } else if (obj.defId === "screen") {
                                label = `Screen ${String(obj.params.preset ?? "custom")}`;
                            } else if (obj.defId === "mount-hole" || obj.defId === "button") {
                                label = `${def.name} Ø${f(Number(obj.params.diameterMm))}`;
                            } else if (obj.defId === "panel") {
                                label = `Panel ${f(Number(obj.params.widthMm))}x${f(Number(obj.params.heightMm))}`;
                            } else {
                                label = def.name;
                            }
                        }

                        const layerName = document.layers.find(l => l.id === obj.layerId)?.name || obj.layerId;

                        return (
                            <button key={obj.id}
                                className={`list__item ${isSelected ? "is-active" : ""}`}
                                onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 12px",
                                    background: isSelected ? "#e3f2fd" : "#fff",
                                    border: isSelected ? "1px solid #2196f3" : "1px solid #eee",
                                    borderRadius: "4px",
                                    color: "#333",
                                    cursor: "pointer",
                                    textAlign: "left"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                                    <span style={{ fontWeight: isSelected ? "600" : "400" }}>{label}</span>
                                    <span className="list__meta" style={{ fontSize: "10px", color: "#888", background: "#f5f5f5", padding: "2px 6px", borderRadius: "10px" }}>
                                        {layerName}
                                    </span>
                                </div>
                                <div onClick={(e) => {
                                    e.stopPropagation();
                                    ObjectService.deleteObject(dispatch, obj.id);
                                }} style={{
                                    padding: "2px 6px",
                                    fontSize: "10px",
                                    color: "#d32f2f",
                                    background: "#ffebee",
                                    borderRadius: "4px",
                                    border: "1px solid #ffcdd2",
                                    cursor: "pointer"
                                }}>
                                    Del
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
