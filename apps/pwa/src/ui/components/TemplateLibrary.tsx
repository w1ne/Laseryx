import { useMemo, useState } from "react";
import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";
import { PathObj, Transform } from "../../core/model";
import {
  listTemplateCategories,
  searchTemplates,
  type TemplateCategory,
  type TemplateEntry
} from "../../core/templates";

const CATEGORY_LABEL: Record<TemplateCategory | "all", string> = {
  all: "All",
  shape: "Shapes",
  hole: "Holes",
  frame: "Frames",
  cutout: "Cutouts",
  import: "Import"
};

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
  if (place.kind === "import") {
    importFile(state, dispatch);
    return;
  }
  ObjectService.addMacro(state, dispatch, place.defId, place.params);
}

/**
 * Searchable template library (LightBurn Art Library / CAD block browser style).
 */
export function TemplateLibrary() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  const results = useMemo(
    () => searchTemplates(query, { category }),
    [query, category]
  );

  const categories: Array<TemplateCategory | "all"> = ["all", ...listTemplateCategories()];

  return (
    <div className="tpl" data-testid="template-library">
      <div className="tpl__header">
        <h2 className="tpl__title">Library</h2>
      </div>

      <label className="tpl__search-wrap">
        <span className="tpl__sr-only">Search templates</span>
        <input
          className="tpl__search"
          type="search"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="tpl__cats" role="tablist" aria-label="Template categories">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={`tpl__cat ${category === c ? "is-active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <ul className="tpl__list">
        {results.length === 0 ? (
          <li className="tpl__empty">No templates match “{query}”</li>
        ) : (
          results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="tpl__item"
                title={t.description}
                onClick={() => placeTemplate(t, state, dispatch)}
              >
                <span className="tpl__item-name">{t.name}</span>
                <span className="tpl__item-meta">{CATEGORY_LABEL[t.category]}</span>
              </button>
            </li>
          ))
        )}
      </ul>

      <style>{`
        .tpl,
        .tpl * {
          font-size: 13px;
          line-height: 1.35;
          box-sizing: border-box;
        }
        .tpl {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
          max-height: 340px;
        }
        .tpl__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tpl__title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #0f172a;
        }
        .tpl__sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          border: 0;
        }
        .tpl__search-wrap {
          display: block;
        }
        .tpl__search {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          color: #0f172a;
          font: inherit;
        }
        .tpl__search:focus {
          outline: 2px solid #93c5fd;
          border-color: #3b82f6;
          background: #fff;
        }
        .tpl__cats {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .tpl__cat {
          margin: 0;
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: #fff;
          color: #475569;
          font: inherit;
          font-size: 12px;
          cursor: pointer;
        }
        .tpl__cat.is-active {
          border-color: #3b82f6;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 600;
        }
        .tpl__list {
          list-style: none;
          margin: 0;
          padding: 0;
          overflow-y: auto;
          flex: 1;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tpl__empty {
          padding: 12px;
          color: #64748b;
          text-align: center;
        }
        .tpl__item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 0;
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .tpl__item:hover {
          border-color: #3b82f6;
          background: #f8fafc;
        }
        .tpl__item-name {
          font-weight: 600;
        }
        .tpl__item-meta {
          flex-shrink: 0;
          font-size: 11px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
