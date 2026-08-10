import { useMemo, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";
import { searchTemplates, type TemplateEntry } from "../../core/templates";
import { TemplateIconSvg } from "./TemplateIcons";

function importFile(
  state: ReturnType<typeof useStore>["state"],
  dispatch: ReturnType<typeof useStore>["dispatch"]
) {
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

        const paths = importedObjects.filter((o) => o.kind === "path") as PathObj[];
        if (paths.length > 0) {
          let minX = Infinity,
            minY = Infinity;
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
            paths.forEach((obj) => {
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
}

function placeTemplate(
  entry: TemplateEntry,
  state: ReturnType<typeof useStore>["state"],
  dispatch: ReturnType<typeof useStore>["dispatch"]
) {
  const { place } = entry;
  if (place.kind === "rect") {
    ObjectService.addRectangle(state, dispatch);
    return;
  }
  if (place.kind === "line") {
    ObjectService.addLine(state, dispatch);
    return;
  }
  if (place.kind === "import") {
    importFile(state, dispatch);
    return;
  }
  ObjectService.addMacro(state, dispatch, place.defId, place.params);
}

/**
 * Fusion-style sketch create palette: few primitives + icons.
 */
export function TemplateLibrary() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchTemplates(query), [query]);

  return (
    <div className="sketch" data-testid="template-library">
      <h2 className="sketch__title">Sketch</h2>

      <input
        className="sketch__search"
        type="search"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        aria-label="Search tools"
      />

      <div className="sketch__tools" role="toolbar" aria-label="Sketch tools">
        {results.map((t) => (
          <button
            key={t.id}
            type="button"
            className="sketch__tool"
            title={t.description}
            onClick={() => placeTemplate(t, state, dispatch)}
          >
            <TemplateIconSvg name={t.icon} />
            <span>{t.name}</span>
          </button>
        ))}
        {results.length === 0 && <p className="sketch__empty">No match</p>}
      </div>

      <p className="sketch__tip">
        Place a shape, then set size. Use Construction in Properties for guides (not burned).
      </p>

      <style>{`
        .sketch,
        .sketch * {
          font-size: 13px;
          line-height: 1.3;
          box-sizing: border-box;
        }
        .sketch {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
        }
        .sketch__title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }
        .sketch__search {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          color: #0f172a;
          font: inherit;
        }
        .sketch__search:focus {
          outline: 2px solid #93c5fd;
          border-color: #3b82f6;
          background: #fff;
        }
        .sketch__tools {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .sketch__tool {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin: 0;
          padding: 14px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          color: #0f172a;
          font: inherit;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }
        .sketch__tool:hover {
          border-color: #3b82f6;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .sketch__empty {
          grid-column: 1 / -1;
          margin: 0;
          text-align: center;
          color: #64748b;
        }
        .sketch__tip {
          margin: 0;
          font-size: 11px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
