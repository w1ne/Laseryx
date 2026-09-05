# Fabrication-ready Enclosures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the generic Components & Box workflow with traceable multi-cutout component definitions, mechanical envelopes, exact HESTORE preset confidence, simple fit inputs, and verified tilted-box fabrication checks.

**Architecture:** Preserve the current primitive `ComponentPreset` compatibility surface while adding optional mechanical metadata and secondary cutouts. A focused mechanics module derives readiness and body-envelope issues; panel expansion and enclosure preflight consume those results. UI changes use progressive disclosure and immutable bundled presets copied into editable project snapshots.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, existing Laseryx geometry/document/workspace modules.

---

## File structure

- Modify `apps/pwa/src/core/components/types.ts`: version-compatible mechanical component fields and copy helpers.
- Create `apps/pwa/src/core/components/mechanics.ts`: metadata validation, readiness, and body-envelope calculations.
- Create `apps/pwa/src/core/components/mechanics.test.ts`: mechanics unit coverage.
- Modify `apps/pwa/src/core/components/expand.ts`: expand primary and secondary cutouts.
- Modify `apps/pwa/src/core/components/expand.test.ts`: compound cutout transforms and validation.
- Modify `apps/pwa/src/core/components/examples.ts`: seven traceable HESTORE definitions without guessed dimensions.
- Modify `apps/pwa/src/core/hardware/catalog.ts`: remove duplicated mechanical truth and expose component definitions.
- Modify `apps/pwa/src/core/enclosure/workspace.ts`: sanitize/migrate optional mechanics and remove coupon-confirmation state.
- Modify `apps/pwa/src/core/enclosure/workspace.test.ts`: persistence and compatibility coverage.
- Modify `apps/pwa/src/core/panel/types.ts`: add readiness/clearance issue codes.
- Modify `apps/pwa/src/core/panel/validate.ts`: compound cutout and mechanical-envelope validation.
- Modify `apps/pwa/src/core/enclosure/preflight.ts`: actionable mechanics issues and non-blocking coupon reminder.
- Modify `apps/pwa/src/core/enclosure/preflight.test.ts`: readiness behavior.
- Modify `apps/pwa/src/ui/components/ComponentEditor.tsx`: advanced mechanical/source editor.
- Modify `apps/pwa/src/ui/components/ComponentEditor.test.tsx`: editing and validation behavior.
- Modify `apps/pwa/src/ui/components/ComponentsBoxPanel.tsx`: preset confidence/readiness display and remove confirmation control.
- Modify `apps/pwa/src/ui/components/ComponentsBoxPanel.test.tsx`: complete concise workflow.
- Modify `apps/pwa/src/ui/components/BoxDialog.tsx`: explicit tilt summary.
- Modify `apps/pwa/src/ui/components/BoxDialog.test.tsx`: flat/tilted/impossible configurations.
- Modify `docs/hackathon-enclosure-guide.md` and `README.md`: final generic workflow and honest physical caveat.

### Task 1: Mechanical component model

**Files:**
- Modify: `apps/pwa/src/core/components/types.ts`
- Create: `apps/pwa/src/core/components/mechanics.ts`
- Test: `apps/pwa/src/core/components/mechanics.test.ts`

- [ ] **Step 1: Write failing tests for confidence, required fields, copying, and envelopes**

```ts
it("reports missing required mechanics without rejecting design geometry", () => {
  const preset = componentDefinition({ mechanics: { confidence: "required", missing: ["button pitch"] } });
  expect(componentReadiness(preset)).toEqual({ ready: false, missing: ["button pitch"], warnings: [] });
});

it("deep-copies optional mechanical geometry into an instance", () => {
  const instance = createComponentInstance(componentDefinition(), "instance-1");
  instance.mechanics!.mountingHoles![0].diameter = 9;
  expect(componentDefinition().mechanics!.mountingHoles![0].diameter).toBe(3);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/core/components/mechanics.test.ts`

Expected: FAIL because `componentReadiness` and mechanical fields do not exist.

- [ ] **Step 3: Add optional, compatible mechanical types**

```ts
export type MechanicalConfidence = "verified" | "measured" | "nominal" | "required";
export type PositionedHole = { x: number; y: number; diameter: number; label?: string };
export type BodyEnvelope = { width: number; height: number; depth: number };
export type ComponentMechanics = {
  confidence: MechanicalConfidence;
  mountingHoles?: PositionedHole[];
  body?: BodyEnvelope;
  frontProtrusion?: number;
  acousticHole?: PositionedHole;
  missing?: string[];
  warnings?: string[];
};
```

Add `url?: string` and `sourceType?: "vendor" | "datasheet" | "measured"` to `ComponentSource`, add optional `mechanics` to presets and instances, and deep-copy it in `createComponentInstance`.

- [ ] **Step 4: Implement focused readiness and envelope helpers**

```ts
export function componentReadiness(component: Pick<ComponentPreset, "mechanics">) {
  const missing = component.mechanics?.missing?.filter(Boolean) ?? [];
  return { ready: missing.length === 0, missing, warnings: component.mechanics?.warnings ?? [] };
}

export function bodyEnvelopeBounds(instance: ComponentInstance): Bounds | undefined {
  const body = instance.mechanics?.body;
  return body ? transformedCenteredBounds(body.width, body.height, instance.transform) : undefined;
}
```

Validate every optional number as finite and positive, every hole position as finite, and every missing label as non-empty.

- [ ] **Step 5: Run tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/core/components/mechanics.test.ts`

Expected: PASS.

Commit: `git commit -am "feat: model component mechanics"`

### Task 2: Compound component cutouts

**Files:**
- Modify: `apps/pwa/src/core/components/expand.ts`
- Modify: `apps/pwa/src/core/components/expand.test.ts`
- Modify: `apps/pwa/src/core/panel/validate.ts`

- [ ] **Step 1: Write failing expansion tests**

```ts
it("adds mounting and acoustic holes to the primary cutout", () => {
  const paths = expandComponent(instanceWith({
    mountingHoles: [{ x: -20, y: 0, diameter: 3 }, { x: 20, y: 0, diameter: 3 }],
    acousticHole: { x: 0, y: 4, diameter: 2 }
  }));
  expect(paths).toHaveLength(4);
  expect(bounds(paths[1])).toMatchObject({ minX: -21.5, maxX: -18.5 });
});
```

- [ ] **Step 2: Run the expansion test and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/core/components/expand.test.ts`

Expected: FAIL because expansion returns only the primary primitive.

- [ ] **Step 3: Expand secondary cutouts deterministically**

```ts
const holes = [...(instance.mechanics?.mountingHoles ?? []), ...(instance.mechanics?.acousticHole ? [instance.mechanics.acousticHole] : [])];
return [...primaryPaths(instance), ...holes.map(({ x, y, diameter }) => circleToPolyline(x, y, diameter / 2, 32))];
```

Keep all paths local so the existing panel expansion applies the instance transform once.

- [ ] **Step 4: Update panel validation to use path-level bounds**

Derive each component's union from `expandComponent(component)` rather than assuming one primitive. Preserve component-level overlap messages and reject invalid secondary holes through mechanics validation.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/core/components/expand.test.ts src/core/panel/validate.test.ts`

Expected: PASS.

Commit: `git commit -am "feat: support compound component cutouts"`

### Task 3: Traceable HESTORE library

**Files:**
- Modify: `apps/pwa/src/core/components/examples.ts`
- Modify: `apps/pwa/src/core/hardware/catalog.ts`
- Create: `apps/pwa/src/core/components/examples.test.ts`

- [ ] **Step 1: Write failing catalog tests for all seven SKUs**

```ts
expect(HESTORE_COMPONENTS.map(item => item.source?.sku)).toEqual([
  "100.491.54", "100.357.19", "100.431.82", "100.355.72",
  "100.220.17", "100.321.00", "100.519.82"
]);
expect(bySku("100.491.54").mechanics?.confidence).toBe("verified");
expect(bySku("100.519.82").mechanics?.missing).toContain("button diameter and pitch");
expect(bySku("100.357.19").mechanics?.warnings).toContain("Internal wiring; no panel cutout required.");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/core/components/examples.test.ts`

Expected: FAIL because only four presets exist and mechanics/source URLs are absent.

- [ ] **Step 3: Define seven immutable entries with truthful confidence**

Use the vendor-backed values already established: display `62 x 29` body and `43.72 x 23.695` window; encoder nominal `6 mm` shaft with editable `7 mm` cutout; toggle `6 mm` mounting hole and `12.5 x 6.5 x 9.5` body; slider `88 x 12.5 x 11` body and editable `60 x 4` slot. Mark undocumented encoder hardware, slider mounting holes, microphone carrier geometry, and button-row geometry as missing where they affect the chosen mounting mode. Represent the ribbon as internal-only metadata, not a fabricated panel opening.

- [ ] **Step 4: Make hardware catalog derive from component definitions**

```ts
export const HACKATHON_KIT = HESTORE_COMPONENTS.map(toHardwareModule);
```

Do not retain a second set of conflicting mechanical numbers.

- [ ] **Step 5: Run tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/core/components/examples.test.ts`

Expected: PASS.

Commit: `git commit -am "feat: add traceable HESTORE component definitions"`

### Task 4: Persistence and migration

**Files:**
- Modify: `apps/pwa/src/core/enclosure/workspace.ts`
- Modify: `apps/pwa/src/core/enclosure/workspace.test.ts`

- [ ] **Step 1: Write failing workspace tests**

```ts
it("sanitizes valid optional component mechanics", () => {
  expect(sanitizeEnclosureWorkspace(workspaceWithMechanics())).toBeDefined();
});

it("rejects non-finite hole positions and negative body depth", () => {
  expect(sanitizeEnclosureWorkspace(workspaceWithHoleX(Infinity))).toBeUndefined();
  expect(sanitizeEnclosureWorkspace(workspaceWithBodyDepth(-1))).toBeUndefined();
});

it("loads version-one workspaces without mechanical metadata", () => {
  expect(sanitizeEnclosureWorkspace(legacyWorkspace())).toMatchObject({ version: 1 });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/core/enclosure/workspace.test.ts`

Expected: FAIL on mechanics validation/copy assertions.

- [ ] **Step 3: Extend sanitization without breaking version one**

Add `mechanics(value)` and `source(value)` guards, cap hole/missing/warning arrays, and accept absent optional fields. Return a structured clone only after the existing identity and layout invariants pass.

- [ ] **Step 4: Remove coupon confirmation state**

Change `CouponState` to `{ selectedClearance?: number }`; while sanitizing old workspaces, ignore `confirmed`. Update regeneration so coupon inclusion is represented only by `selectedClearance`.

- [ ] **Step 5: Run tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/core/enclosure/workspace.test.ts`

Expected: PASS including legacy fixtures.

Commit: `git commit -am "feat: persist mechanical component definitions"`

### Task 5: Mechanical readiness and internal clearance

**Files:**
- Modify: `apps/pwa/src/core/panel/types.ts`
- Modify: `apps/pwa/src/core/panel/validate.ts`
- Modify: `apps/pwa/src/core/enclosure/preflight.ts`
- Modify: `apps/pwa/src/core/enclosure/preflight.test.ts`

- [ ] **Step 1: Write failing preflight tests**

```ts
it("blocks a placed component with required mounting measurements", () => {
  const result = preflightEnclosure({ workspace: workspaceWithMissing("button pitch") });
  expect(result.ready).toBe(false);
  expect(result.issues).toContainEqual(expect.objectContaining({ code: "MEASURE_REQUIRED", objectIds: ["buttons-1"] }));
});

it("blocks a body deeper than the local tilted enclosure clearance", () => {
  const result = preflightEnclosure({ workspace: workspaceWithBody({ depth: 80 }) });
  expect(result.issues).toContainEqual(expect.objectContaining({ code: "BODY_CLEARANCE" }));
});

it("does not block solely because no coupon was confirmed", () => {
  expect(preflightEnclosure({ workspace: readyWorkspaceWithCoupon() }).ready).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/core/enclosure/preflight.test.ts`

Expected: FAIL because instance mechanics are ignored and coupon confirmation still blocks readiness.

- [ ] **Step 3: Implement local tilted clearance**

For component panel coordinate `y`, calculate the enclosure height under the sloped source face by linear interpolation between front and rear height, subtract stock thickness, and compare with `body.depth`. Compare transformed body-envelope rectangles pairwise and report `BODY_OVERLAP` only when both depth intervals overlap.

- [ ] **Step 4: Integrate readiness into preflight**

Add `BODY_CLEARANCE` and `BODY_OVERLAP` issue codes. Convert every instance `mechanics.missing` item into one actionable `MEASURE_REQUIRED` error. Emit nominal/source warnings as `REVIEW_WARNING`. Keep an unconfirmed coupon as a warning only and calculate `ready` strictly from errors.

- [ ] **Step 5: Run tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/core/enclosure/preflight.test.ts src/core/enclosure/generate.test.ts`

Expected: PASS.

Commit: `git commit -am "feat: validate enclosure component clearance"`

### Task 6: Concise mechanical editor and preset readiness UI

**Files:**
- Modify: `apps/pwa/src/ui/components/ComponentEditor.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentEditor.test.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentsBoxPanel.tsx`
- Modify: `apps/pwa/src/ui/components/ComponentsBoxPanel.test.tsx`

- [ ] **Step 1: Write failing UI tests**

```tsx
expect(screen.queryByLabelText("Body depth")).not.toBeInTheDocument();
fireEvent.click(screen.getByText("Mechanical details"));
fireEvent.change(screen.getByLabelText("Body depth"), { target: { value: "18" } });
fireEvent.click(screen.getByText("Save component"));
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mechanics: expect.objectContaining({ body: expect.objectContaining({ depth: 18 }) }) }));

expect(screen.getByText("Measurements required")).toBeInTheDocument();
expect(screen.queryByText("Confirm fit coupon")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run UI tests and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/ui/components/ComponentEditor.test.tsx src/ui/components/ComponentsBoxPanel.test.tsx`

Expected: FAIL because advanced mechanics and readiness labels are absent.

- [ ] **Step 3: Add progressive mechanical fields**

Inside `<details><summary>Mechanical details</summary>`, edit body width/height/depth, front protrusion, source URL/type, mounting holes, missing measurements, and notes. Keep the existing five primitive selectors and primary dimensions visible. Validate numeric fields inline and create no mechanical object when all advanced fields are blank.

- [ ] **Step 4: Display preset confidence and corrective actions**

Show a compact `Verified`, `Measured`, `Nominal`, or `Measurements required` label beside each library preset. Copy a bundled preset before editing or placement. In fabrication readiness, link issue messages to the affected instance selection. Remove `Confirm fit coupon`; present coupon advice as non-blocking text when included.

- [ ] **Step 5: Run UI tests and commit**

Run: `npm --prefix apps/pwa test -- --run src/ui/components/ComponentEditor.test.tsx src/ui/components/ComponentsBoxPanel.test.tsx`

Expected: PASS.

Commit: `git commit -am "feat: expose component mechanical readiness"`

### Task 7: Tilt clarity and end-to-end release verification

**Files:**
- Modify: `apps/pwa/src/ui/components/BoxDialog.tsx`
- Modify: `apps/pwa/src/ui/components/BoxDialog.test.tsx`
- Modify: `docs/hackathon-enclosure-guide.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing tilted-box UI tests**

```tsx
fireEvent.change(screen.getByLabelText("Front height"), { target: { value: "35" } });
fireEvent.change(screen.getByLabelText("Rear height"), { target: { value: "70" } });
expect(screen.getByRole("status")).toHaveTextContent("Tilted panel");
expect(screen.getByRole("status")).toHaveTextContent(/°/);
```

Retain the existing impossible-rise test where `abs(rearHeight - frontHeight) >= panelHeight` blocks generation.

- [ ] **Step 2: Run the box dialog test and verify failure**

Run: `npm --prefix apps/pwa test -- --run src/ui/components/BoxDialog.test.tsx`

Expected: FAIL because no explicit tilt summary exists.

- [ ] **Step 3: Add the derived tilt summary**

Calculate `Math.asin((rearHeight - frontHeight) / panelHeight) * 180 / Math.PI`. Display `Flat panel` within tolerance or `Tilted panel: N.N° rising toward rear`, alongside the existing read-only derived depth. Keep impossible configurations as blocking inline errors.

- [ ] **Step 4: Update documentation**

Document exact component confidence, mechanical details, simple thickness/clearance inputs, optional non-blocking coupon, tilted height example, six generated faces, readiness errors, and the distinction between software verification and physical assembly.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
npm --prefix apps/pwa run cli:build
npm --prefix apps/pwa run mcp:build
npm --prefix apps/pwa run hosted-mcp:build
git diff --check
```

Expected: all tests and builds exit 0; lint has no errors; diff check is clean.

- [ ] **Step 6: Commit the completed release work**

```bash
git add apps/pwa/src README.md docs/hackathon-enclosure-guide.md
git commit -m "feat: make enclosures fabrication ready"
```

- [ ] **Step 7: Review before integration**

Compare the implementation against `docs/superpowers/specs/2026-09-05-fabrication-ready-enclosures-design.md`, inspect the final diff, and rerun any affected focused tests after review fixes. Push the feature branch and open a PR; merge and deploy only after CI succeeds.
