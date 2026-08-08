import type { Dispatch } from "react";
import type { Action } from "../../core/state/actions";
import type { AppState } from "../../core/state/types";
import type { PathObj, Transform } from "../../core/model";
import type { TemplateEntry } from "../../core/templates";
import { ObjectService } from "../../core/services/ObjectService";
import { parseSvg } from "../../core/svgImport";

export function placeTemplate(
  entry: TemplateEntry,
  state: AppState,
  dispatch: Dispatch<Action>
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

function importFile(state: AppState, dispatch: Dispatch<Action>) {
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
