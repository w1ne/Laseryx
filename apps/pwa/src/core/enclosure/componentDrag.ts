import { expandComponent } from "../components/expand";
import type { Document, Transform } from "../model";
import type { EnclosureWorkspace } from "./workspace";

const round = (value: number) => Math.round(value * 1000) / 1000;

export function componentIdForSourceCutout(workspace: EnclosureWorkspace, objectId: string): string | undefined {
  if (workspace.enclosure.result) return undefined;
  const prefix = `components-box:panel:${workspace.sourcePanel.id}:cutout:`;
  if (!objectId.startsWith(prefix)) return undefined;
  return workspace.sourcePanel.components.find(({ id }) => {
    const suffix = objectId.slice(prefix.length);
    return suffix.startsWith(`${id}:`) && /^\d+$/.test(suffix.slice(id.length + 1));
  })?.id;
}

export function componentTransformForRenderedDrag(
  workspace: EnclosureWorkspace,
  objectId: string,
  renderedTransform: Transform,
  nextRenderedTransform: Transform
): { componentId: string; transform: Transform } | undefined {
  const componentId = componentIdForSourceCutout(workspace, objectId);
  const component = workspace.sourcePanel.components.find(({ id }) => id === componentId);
  if (!component) return undefined;
  const transform = {
    ...component.transform,
    e: component.transform.e + nextRenderedTransform.e - renderedTransform.e,
    f: component.transform.f + nextRenderedTransform.f - renderedTransform.f
  };
  const points = expandComponent(component).flatMap((path) => path.points.map(({ x, y }) => ({
    x: transform.a * x + transform.c * y + transform.e,
    y: transform.b * x + transform.d * y + transform.f
  })));
  const xs = points.map(({ x }) => x), ys = points.map(({ y }) => y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (maxX - minX > workspace.sourcePanel.width || maxY - minY > workspace.sourcePanel.height) return undefined;
  if (minX < 0) transform.e -= minX;
  if (maxX > workspace.sourcePanel.width) transform.e -= maxX - workspace.sourcePanel.width;
  if (minY < 0) transform.f -= minY;
  if (maxY > workspace.sourcePanel.height) transform.f -= maxY - workspace.sourcePanel.height;
  transform.e = round(transform.e); transform.f = round(transform.f);
  return { componentId, transform };
}

export function createComponentDragSession(document: Document, objectId: string): { resolve: (nextRenderedTransform: Transform) => { componentId: string; transform: Transform } } | undefined {
  const workspace = document.enclosureWorkspace;
  const renderedObject = document.objects.find(({ id }) => id === objectId);
  if (!workspace || !renderedObject || !componentIdForSourceCutout(workspace, objectId)) return undefined;
  const startWorkspace = structuredClone(workspace);
  const startRenderedTransform = { ...renderedObject.transform };
  return {
    resolve(nextRenderedTransform) {
      return componentTransformForRenderedDrag(startWorkspace, objectId, startRenderedTransform, nextRenderedTransform)!;
    }
  };
}
