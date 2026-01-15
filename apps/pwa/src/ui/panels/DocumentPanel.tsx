import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";

export function DocumentPanel() {
    const { state, dispatch } = useStore();
    const { document, selectedObjectId } = state;

    // Helper to format numbers for display
    const f = (n: number) => n.toFixed(2);

    const handleAddRectangle = () => {
        ObjectService.addRectangle(state, dispatch);
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

                    ObjectService.addObjects(dispatch, importedObjects);

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
                        ObjectService.addImage(dispatch, src, mmW, mmH);
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
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="button" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={handleAddRectangle}>Add Rect</button>
                    <button className="button" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={handleImportFile}>Import</button>
                </div>
            </div>
            <div className="panel__body">
                <div className="list" style={{ gap: "4px", display: "flex", flexDirection: "column" }}>
                    {document.objects.map(obj => {
                        const isSelected = obj.id === selectedObjectId;
                        let label = obj.id;
                        if (obj.kind === "shape") label = `Rect ${f(obj.shape.width)}x${f(obj.shape.height)}`;
                        if (obj.kind === "image") label = `Image ${f(obj.width)}x${f(obj.height)}`;
                        if (obj.kind === "path") label = "Path";

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
                                <span style={{ fontWeight: isSelected ? "600" : "400" }}>{label}</span>
                                <span className="list__meta" style={{ fontSize: "10px", color: "#888", background: "#f5f5f5", padding: "2px 6px", borderRadius: "10px" }}>
                                    {layerName}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
