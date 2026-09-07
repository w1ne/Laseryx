# Simple Component Editing and Freehand Dragging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove engineering-only component controls and secondary component holes, while making source-panel components directly draggable without snapping.

**Architecture:** Keep mechanical metadata backward-compatible in the saved model and readiness engine, but stop exposing or expanding secondary-hole metadata. Add a focused component-drag resolver between rendered enclosure paths and workspace actions; the preview continues using its existing pointer gesture and one-history-commit behavior.

**Tech Stack:** React, TypeScript, SVG pointer events, Vitest, Testing Library, existing reducer/history architecture.

---

### Task 1: Produce primary component openings only

**Files:**
- Modify: `apps/pwa/src/core/components/expand.ts`
- Modify: `apps/pwa/src/core/components/expand.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that expands a component containing `mountingHoles` and `acousticHole`, then expects exactly one cutout associated with that component:

```ts
it("ignores stored secondary holes and expands only the primary opening", () => {
  const instance = createComponentInstanceFromPreset(presetWithSecondaryHoles, "screen-1", transform);
  expect(expandComponent(instance)).toHaveLength(1);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- --run src/core/components/expand.test.ts`

Expected: FAIL because mounting and acoustic holes are currently returned as extra paths.

- [ ] **Step 3: Implement the primary-only expansion**

Change `expandComponent` so it returns only the path or paths defined by the component kind and dimensions. Do not read `instance.mechanics.mountingHoles` or `instance.mechanics.acousticHole` when producing cut geometry. Preserve `instance.mechanics` itself unchanged.

- [ ] **Step 4: Verify the focused tests pass**

Run: `npm test -- --run src/core/components/expand.test.ts src/core/panel/validate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/core/components/expand.ts apps/pwa/src/core/components/expand.test.ts
git commit -m "fix: generate primary component cutouts only"
```

### Task 2: Simplify component creation and editing

**Files:**
- Modify: `apps/pwa/src/ui/components/ComponentEditor.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentEditor.test.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentsBoxPanel.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentsBoxPanel.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert that the preset creator and instance editor do not render `Mechanical details`, `Confidence`, `Missing measurements`, `Mounting holes`, `Acoustic hole`, `Front protrusion`, `Source URL`, `Source type`, or `Mechanical notes`, while ordinary size and X/Y controls remain available.

```ts
expect(screen.queryByText("Mechanical details")).toBeNull();
expect(screen.queryByLabelText("Mounting holes")).toBeNull();
expect(screen.getByLabelText("Component width")).toBeTruthy();
expect(screen.getByLabelText("Component X")).toBeTruthy();
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run src/ui/components/ComponentEditor.test.tsx src/ui/components/ComponentsBoxPanel.test.tsx`

Expected: FAIL because the engineering fields are still rendered.

- [ ] **Step 3: Remove engineering form state and markup**

Delete mechanical/provenance input state, CSV parsing, and the `Mechanical details` disclosure from both editors. The instance save payload must update only dimensions and transform, leaving an existing `mechanics` and `source` untouched by omission:

```ts
const changes = {
  dimensions,
  transform: { ...instance.transform, e: x, f: y }
};
```

The custom preset creator should save only its name, kind, dimensions, and primary path data. Keep bundled preset metadata in the preset definitions for internal readiness checks.

- [ ] **Step 4: Replace engineering preset badges with plain language**

Use `Check dimensions before cutting` when a bundled preset contains missing measurements; otherwise display no badge. Do not show `Nominal`, `Verified`, or `Editable` terminology.

- [ ] **Step 5: Verify the focused tests pass**

Run: `npm test -- --run src/ui/components/ComponentEditor.test.tsx src/ui/components/ComponentsBoxPanel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pwa/src/ui/components/ComponentEditor.tsx apps/pwa/src/ui/components/ComponentEditor.test.tsx apps/pwa/src/ui/components/ComponentsBoxPanel.tsx apps/pwa/src/ui/components/ComponentsBoxPanel.test.tsx
git commit -m "feat: simplify component editing"
```

### Task 3: Resolve source-panel cutout drags safely

**Files:**
- Create: `apps/pwa/src/core/enclosure/componentDrag.ts`
- Create: `apps/pwa/src/core/enclosure/componentDrag.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Cover rendered cutout lookup, unrestricted in-bounds movement, and clamping at all four panel edges. The public API is:

```ts
export function componentTransformForRenderedDrag(
  workspace: EnclosureWorkspace,
  objectId: string,
  renderedTransform: Transform,
  nextRenderedTransform: Transform
): { componentId: string; transform: Transform } | undefined;
```

For a 10 mm circle on a 100 × 60 mm panel, a requested center of `(-4, 80)` must clamp to `(5, 55)` in panel-local coordinates.

- [ ] **Step 2: Verify the resolver test fails**

Run: `npm test -- --run src/core/enclosure/componentDrag.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement ID resolution and primary-cutout bounds**

Resolve only IDs matching the current source-panel cutout prefix and a current component ID. Calculate the pointer delta from the rendered transforms, add it to the component-local transform, obtain the primary cutout bounds, and clamp translation so those bounds remain within `0..panel.width` and `0..panel.height`. Return `undefined` for outlines, anchors, generated faces, coupons, or stale IDs.

- [ ] **Step 4: Verify resolver tests pass**

Run: `npm test -- --run src/core/enclosure/componentDrag.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/core/enclosure/componentDrag.ts apps/pwa/src/core/enclosure/componentDrag.test.ts
git commit -m "feat: constrain source component dragging"
```

### Task 4: Route preview drags to component workspace updates

**Files:**
- Modify: `apps/pwa/src/core/services/GroupService.ts`
- Modify: `apps/pwa/src/core/services/GroupService.enclosure.test.ts`
- Modify: `apps/pwa/src/ui/panels/PreviewPanel.tsx`
- Modify: `apps/pwa/src/ui/tests/componentsBoxWorkflow.test.tsx`

- [ ] **Step 1: Write failing interaction and service tests**

Assert that selecting a source component cutout selects only that cutout rather than the entire panel group. Simulate a pointer drag and assert the workspace component transform changes, the panel transform does not change, regenerated rendered geometry follows the component, and undo restores the start position in one step.

```ts
expect(next.document.enclosureWorkspace?.sourcePanel.components[0].transform.e).toBe(42);
expect(next.document.enclosureWorkspace?.sourcePanel.transform.e).toBe(panelX);
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run src/core/services/GroupService.enclosure.test.ts src/ui/tests/componentsBoxWorkflow.test.tsx`

Expected: FAIL because cutout selection currently expands to the complete panel group and object patching cannot update an authoritative component.

- [ ] **Step 3: Keep source cutouts independently selectable**

In `GroupService.selectWithGroup`, detect a current source-panel cutout ID before group expansion. Dispatch `SELECT_OBJECT` for that ID and return only that ID. Preserve current grouping behavior for the panel outline and every non-component group.

- [ ] **Step 4: Intercept rendered cutout transform patches**

In `PreviewPanel`'s `onPatchObject`, call `componentTransformForRenderedDrag` before `ObjectService.updateObject`. When it resolves, dispatch:

```ts
dispatch({
  type: "UPDATE_COMPONENT_INSTANCE",
  payload: { id: result.componentId, changes: { transform: result.transform } },
  skipHistory: opts?.skipHistory
});
```

Continue using the existing `commit` callback on pointer-up so all live moves become one undo entry. Fall through to `ObjectService.updateObject` for ordinary objects.

- [ ] **Step 5: Verify interaction tests pass**

Run: `npm test -- --run src/core/services/GroupService.enclosure.test.ts src/ui/tests/componentsBoxWorkflow.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pwa/src/core/services/GroupService.ts apps/pwa/src/core/services/GroupService.enclosure.test.ts apps/pwa/src/ui/panels/PreviewPanel.tsx apps/pwa/src/ui/tests/componentsBoxWorkflow.test.tsx
git commit -m "feat: drag components on source panels"
```

### Task 5: Release verification and integration

**Files:**
- Modify if necessary: `docs/hackathon-enclosure-guide.md`

- [ ] **Step 1: Update the workflow guide**

State that components are positioned by freehand dragging or X/Y fields and that each component creates only its primary opening.

- [ ] **Step 2: Run the complete release suite**

Run from `apps/pwa`:

```bash
npm test
npm run lint
npm run build
npm run cli:build
npm run mcp:build
npm run hosted-mcp:build
git diff --check
```

Expected: all tests and builds pass; lint has zero errors.

- [ ] **Step 3: Review the complete diff**

Confirm that metadata remains loadable, secondary holes are never emitted as cuts, drag applies only before box generation, boundary clamping uses primary geometry, and no calibration state was added.

- [ ] **Step 4: Commit documentation changes**

```bash
git add docs/hackathon-enclosure-guide.md
git commit -m "docs: explain direct component placement"
```

- [ ] **Step 5: Push, open a PR, wait for CI, and merge to `main`**

```bash
git push -u origin feature/simple-components-drag
gh pr create --base main --head feature/simple-components-drag --title "Simplify component editing and add freehand dragging"
gh pr checks --watch
gh pr merge --merge --delete-branch
```

- [ ] **Step 6: Deploy and verify the published bundle**

Dispatch `Deploy PWA to GitHub Pages` on `main`, wait for success, then verify `https://laseryx.com/` returns HTTP 200 and references the newly deployed asset hash.
