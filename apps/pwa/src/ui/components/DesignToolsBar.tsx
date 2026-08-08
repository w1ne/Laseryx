import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";

/**
 * Creation tools — LightBurn / CAD style.
 * Primitive shapes + import. Parametric compounds as normal shapes, not a product mode.
 */
export function DesignToolsBar() {
    const { state, dispatch } = useStore();

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

    type Tool = {
        id: string;
        label: string;
        title: string;
        run: () => void;
    };

    const tools: Tool[] = [
        {
            id: "rect",
            label: "Rect",
            title: "Rectangle",
            run: () => ObjectService.addRectangle(state, dispatch)
        },
        {
            id: "circle",
            label: "Circle",
            title: "Circle",
            run: () => ObjectService.addMacro(state, dispatch, "button")
        },
        {
            id: "hole",
            label: "Hole",
            title: "Circle hole (cut)",
            run: () => ObjectService.addMacro(state, dispatch, "mount-hole")
        },
        {
            id: "frame",
            label: "Frame",
            title: "Outer frame / plate outline",
            run: () => ObjectService.addMacro(state, dispatch, "panel")
        },
        {
            id: "cutout",
            label: "Cutout",
            title: "Rectangle cutout with corner holes",
            run: () => ObjectService.addMacro(state, dispatch, "screen")
        },
        {
            id: "import",
            label: "Import",
            title: "Import SVG or image",
            run: handleImportFile
        }
    ];

    return (
        <div className="creation-toolbar" role="toolbar" aria-label="Create">
            <div className="creation-toolbar__title">Create</div>
            {tools.map((tool) => (
                <button
                    key={tool.id}
                    type="button"
                    className="creation-toolbar__btn"
                    title={tool.title}
                    onClick={tool.run}
                >
                    {tool.label}
                </button>
            ))}

            <style>{`
                .creation-toolbar {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 10px;
                    border-radius: 12px;
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    font-size: 13px;
                    line-height: 1.3;
                    min-width: 88px;
                }
                .creation-toolbar__title {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #64748b;
                    padding: 0 2px 4px;
                }
                .creation-toolbar__btn {
                    margin: 0;
                    padding: 8px 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    background: #f8fafc;
                    color: #0f172a;
                    font: inherit;
                    font-weight: 600;
                    text-align: center;
                    cursor: pointer;
                }
                .creation-toolbar__btn:hover {
                    border-color: #3b82f6;
                    background: #eff6ff;
                }
            `}</style>
        </div>
    );
}
