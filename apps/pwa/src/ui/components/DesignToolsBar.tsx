import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";
import { listMacroDefs } from "../../core/macros/catalog";

/** Tools for the bed — not the left list. */
export function DesignToolsBar() {
    const { state, dispatch } = useStore();
    const hardwareDefs = listMacroDefs();

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

    return (
        <div className="design-tools" role="toolbar" aria-label="Add to bed">
            <span className="design-tools__label">Add</span>
            {hardwareDefs.map((d) => (
                <button
                    key={d.id}
                    type="button"
                    className="design-tools__btn"
                    onClick={() => ObjectService.addMacro(state, dispatch, d.id)}
                >
                    {d.name}
                </button>
            ))}
            <span className="design-tools__sep" aria-hidden />
            <button
                type="button"
                className="design-tools__btn design-tools__btn--quiet"
                onClick={() => ObjectService.addRectangle(state, dispatch)}
            >
                Rect
            </button>
            <button
                type="button"
                className="design-tools__btn design-tools__btn--quiet"
                onClick={handleImportFile}
            >
                Import
            </button>

            <style>{`
                .design-tools {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 10px;
                    border-radius: 10px;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    font-size: 13px;
                    line-height: 1.3;
                }
                .design-tools__label {
                    color: #64748b;
                    font-weight: 600;
                    margin-right: 2px;
                }
                .design-tools__btn {
                    margin: 0;
                    padding: 6px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    background: #f8fafc;
                    color: #0f172a;
                    font: inherit;
                    font-weight: 600;
                    cursor: pointer;
                }
                .design-tools__btn:hover {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
                .design-tools__btn--quiet {
                    font-weight: 500;
                    color: #475569;
                    background: transparent;
                }
                .design-tools__sep {
                    width: 1px;
                    height: 20px;
                    background: #e2e8f0;
                    margin: 0 2px;
                }
            `}</style>
        </div>
    );
}
