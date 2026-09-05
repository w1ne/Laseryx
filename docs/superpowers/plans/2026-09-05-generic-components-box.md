# Generic Components & Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hackathon-specific panel with a simple generic component-to-panel-to-box-to-sheet workflow that generates a complete enclosure from the user’s actual panel.

**Architecture:** A versioned `EnclosureWorkspace` owns reusable component presets, panel-local component instances, the source panel, generated enclosure faces, and independent sheet-placement transforms. Pure TypeScript expands and validates geometry; React presents four progressive actions and commits generated paths through existing state/history and project persistence.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, IndexedDB, existing Laseryx model/state/CAM services.

---

### Task 1: Define generic component presets and instances

**Files:**
- Create: `apps/pwa/src/core/components/types.ts`
- Create: `apps/pwa/src/core/components/expand.ts`
- Create: `apps/pwa/src/core/components/expand.test.ts`
- Create: `apps/pwa/src/core/components/examples.ts`
- Delete: `apps/pwa/src/core/hardware/place.ts`

- [ ] **Step 1: Write failing primitive tests**

Create tests asserting that `expandComponent(instance)` returns closed local paths for circle, slot, rectangle, rounded rectangle, and button row; assert a four-button row creates four circles using the instance’s copied diameter and pitch.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/components/expand.test.ts`
Expected: FAIL because `expandComponent` does not exist.

- [ ] **Step 3: Implement generic types and expansion**

Define `ComponentKind`, `ComponentPreset`, `ComponentInstance`, and discriminated dimension records. Implement expansion without SKU branching. Convert the seven HESTORE records into optional `EXAMPLE_COMPONENT_PRESETS`, using only their known generic geometry.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/core/components/expand.test.ts src/core/hardware/catalog.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/components apps/pwa/src/core/hardware
git commit -m "refactor: model cutouts as generic components"
```

### Task 2: Make the source panel own component openings

**Files:**
- Create: `apps/pwa/src/core/panel/types.ts`
- Create: `apps/pwa/src/core/panel/expand.ts`
- Create: `apps/pwa/src/core/panel/expand.test.ts`
- Create: `apps/pwa/src/core/panel/validate.ts`
- Create: `apps/pwa/src/core/panel/validate.test.ts`

- [ ] **Step 1: Write failing ownership tests**

Test a 160 × 100 panel containing a 44 × 24 display rectangle at local `(40, 30)` and a Ø7 circle at `(110, 45)`. Assert `expandPanel` returns one panel outline plus both translated cutouts, moving the panel changes only its outer transform, and changing a preset after placement does not change the copied instance dimensions.

- [ ] **Step 2: Write failing safety tests**

Assert `validatePanel` reports named errors for non-positive dimensions, an opening crossing an edge, and overlapping openings; assert valid separated openings pass.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/core/panel`
Expected: FAIL because panel expansion and validation do not exist.

- [ ] **Step 4: Implement, verify, and commit**

Keep all component positions panel-local and calculate primitive bounds before expansion.

Run: `npm test -- --run src/core/panel`
Expected: PASS.

```bash
git add apps/pwa/src/core/panel
git commit -m "feat: make panels own component cutouts"
```

### Task 3: Generate the full enclosure from the source panel

**Files:**
- Modify: `apps/pwa/src/core/enclosure/types.ts`
- Modify: `apps/pwa/src/core/enclosure/generate.ts`
- Modify: `apps/pwa/src/core/enclosure/generate.test.ts`
- Create: `apps/pwa/src/core/enclosure/joints.ts`
- Create: `apps/pwa/src/core/enclosure/joints.test.ts`

- [ ] **Step 1: Write the failing source-face regression test**

Pass a `PanelDesign` with two component cutouts to `generateEnclosure`. Assert exactly six stable face IDs, assert the `source-panel` face contains its finger-jointed outline plus the two original cutout paths, and assert the five generated faces contain no component cutouts.

- [ ] **Step 2: Write failing complementary-joint tests**

For every adjacent edge pair, assert equal segment counts, opposite phases, equal nominal lengths, and clearance applied only to mating offsets. Assert edges too short for three fingers produce a validation error.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/core/enclosure/generate.test.ts src/core/enclosure/joints.test.ts`
Expected: FAIL because generation does not accept the source panel and current edges are not paired.

- [ ] **Step 4: Implement paired joints and six faces**

Use the source panel’s width as box width and its sloped face length as the source-face depth. Generate rear, left, right, base, and service faces with stable IDs. Preserve source cutout paths verbatim after replacing only its outline.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/core/enclosure`
Expected: PASS.

```bash
git add apps/pwa/src/core/enclosure
git commit -m "feat: generate a complete box from its source panel"
```

### Task 4: Preserve geometry while arranging visible sheets

**Files:**
- Modify: `apps/pwa/src/core/layout/types.ts`
- Modify: `apps/pwa/src/core/layout/pack.ts`
- Modify: `apps/pwa/src/core/layout/pack.test.ts`
- Create: `apps/pwa/src/core/layout/sheets.ts`
- Create: `apps/pwa/src/core/layout/sheets.test.ts`

- [ ] **Step 1: Write failing layout tests**

Assert A5 sheet records are explicit 210 × 148 entities, packing assigns every fitting stable part ID, no rectangles overlap, rotations are recorded separately, and repacking identical inputs is deterministic.

- [ ] **Step 2: Write the failing regeneration test**

Give `preservePlacements` an old layout and resized parts. Assert unchanged fitting IDs retain their manual transforms while new or invalidated parts enter `unplacedPartIds`.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/core/layout`
Expected: FAIL because sheet entities and placement preservation do not exist.

- [ ] **Step 4: Implement, verify, and commit**

Keep part geometry immutable and store only `{sheetId, x, y, rotation}` in layout records.

Run: `npm test -- --run src/core/layout`
Expected: PASS.

```bash
git add apps/pwa/src/core/layout
git commit -m "feat: arrange enclosure parts on visible sheets"
```

### Task 5: Persist the generic enclosure workspace

**Files:**
- Create: `apps/pwa/src/core/enclosure/workspace.ts`
- Create: `apps/pwa/src/core/enclosure/workspace.test.ts`
- Modify: `apps/pwa/src/core/model.ts`
- Modify: `apps/pwa/src/io/projectRepo.ts`
- Modify: `apps/pwa/src/io/projectRepo.test.ts`
- Create: `apps/pwa/src/io/componentPresetRepo.ts`
- Create: `apps/pwa/src/io/componentPresetRepo.test.ts`

- [ ] **Step 1: Write failing copy and regeneration tests**

Test `createInstanceFromPreset`, source-panel component addition, box regeneration, stable face IDs, and preservation of valid manual layout transforms.

- [ ] **Step 2: Write failing persistence tests**

Round-trip a project containing custom presets, instances, panel, enclosure parameters, six generated faces, and sheet placements. Load an old project without `enclosureWorkspace`. Test local preset create/list/delete and confirm deleting a preset does not mutate an existing instance.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/core/enclosure/workspace.test.ts src/io/projectRepo.test.ts src/io/componentPresetRepo.test.ts`
Expected: FAIL on missing workspace and repository behavior.

- [ ] **Step 4: Implement versioned optional persistence**

Add `enclosureWorkspace?: EnclosureWorkspace` to `Document`; keep deserialization backward compatible and store user presets in a dedicated IndexedDB store.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/core/enclosure/workspace.test.ts src/io/projectRepo.test.ts src/io/componentPresetRepo.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/enclosure/workspace* apps/pwa/src/core/model.ts apps/pwa/src/io
git commit -m "feat: persist generic component box workspaces"
```

### Task 6: Replace the complex hackathon interface

**Files:**
- Create: `apps/pwa/src/ui/components/ComponentsBoxPanel.tsx`
- Create: `apps/pwa/src/ui/components/ComponentsBoxPanel.test.tsx`
- Create: `apps/pwa/src/ui/components/ComponentEditor.tsx`
- Create: `apps/pwa/src/ui/components/ComponentEditor.test.tsx`
- Create: `apps/pwa/src/ui/components/BoxDialog.tsx`
- Create: `apps/pwa/src/ui/components/BoxDialog.test.tsx`
- Modify: `apps/pwa/src/ui/panels/DocumentPanel.tsx`
- Modify: `apps/pwa/src/ui/app.css`
- Delete: `apps/pwa/src/ui/components/HackathonEnclosurePanel.tsx`
- Delete: `apps/pwa/src/ui/components/HackathonEnclosurePanel.test.tsx`

- [ ] **Step 1: Write failing progressive-interface tests**

Assert the collapsed panel is named `Components & Box`, shows only four actions, emphasizes the next valid action, and keeps Advanced fields hidden until expanded.

- [ ] **Step 2: Write failing workflow tests**

Create a named circle preset, create a panel, place the circle, make a box, and arrange sheets. Assert the generated source face contains the circle opening, the document contains six grouped faces and visible sheet boundaries, and the summary reports readiness or one actionable blocker.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/ui/components/ComponentsBoxPanel.test.tsx src/ui/components/ComponentEditor.test.tsx src/ui/components/BoxDialog.test.tsx`
Expected: FAIL because the generic interface does not exist.

- [ ] **Step 4: Implement the four-action UI**

Use short labels and progressive disclosure. Put thickness, clearance, finger width, sheet size, margin, gap, and coupon under one `<details>` element named `Advanced`. List HESTORE entries only beneath `Example presets`.

- [ ] **Step 5: Remove the old interface, verify, and commit**

Run: `npm test -- --run src/ui/components src/ui/App.test.tsx`
Expected: PASS with no `Hackathon enclosure` control rendered.

```bash
git add apps/pwa/src/ui
git commit -m "feat: simplify components and box workflow"
```

### Task 7: Integrate preflight, history, and project reload

**Files:**
- Modify: `apps/pwa/src/core/enclosure/preflight.ts`
- Modify: `apps/pwa/src/core/enclosure/preflight.test.ts`
- Modify: `apps/pwa/src/core/state/actions.ts`
- Modify: `apps/pwa/src/core/state/reducer.ts`
- Modify: `apps/pwa/src/core/state/history.test.ts`
- Create: `apps/pwa/src/ui/tests/componentsBoxWorkflow.test.tsx`

- [ ] **Step 1: Write failing safety tests**

Test blocker messages for invalid dimensions, cutouts outside the panel, overlap, short joint edges, open contours, sheet overflow, and unconfirmed coupon. Test that no internal issue code appears in user messages.

- [ ] **Step 2: Write failing history/reload workflow**

Create a preset, panel, component instance, enclosure, and sheet layout; undo arrangement in one step; redo it; save/reload; assert the source-face cutout and manual placement survive.

- [ ] **Step 3: Verify red**

Run: `npm test -- --run src/core/enclosure/preflight.test.ts src/core/state/history.test.ts src/ui/tests/componentsBoxWorkflow.test.tsx`
Expected: FAIL on missing workspace actions and validations.

- [ ] **Step 4: Implement atomic workspace actions and preflight**

Add `SET_ENCLOSURE_WORKSPACE` as one history-bearing action for each user command and derive readable preflight messages from pure validation results.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/core/enclosure/preflight.test.ts src/core/state/history.test.ts src/ui/tests/componentsBoxWorkflow.test.tsx`
Expected: PASS.

```bash
git add apps/pwa/src/core apps/pwa/src/ui/tests
git commit -m "feat: make box workflow safe and undoable"
```

### Task 8: Document and verify the replacement

**Files:**
- Modify: `docs/hackathon-enclosure-guide.md`
- Modify: `README.md`

- [ ] **Step 1: Update user documentation**

Document `Components → Panel → Make Box → Sheets → Cut`, creation of custom presets, example presets, Advanced settings, regeneration behavior, coupon testing, and the physical-release gate. Remove text describing a hackathon-only tool.

- [ ] **Step 2: Run focused verification**

Run:
```bash
npm test -- --run src/core/components src/core/panel src/core/enclosure src/core/layout src/ui/tests/componentsBoxWorkflow.test.tsx
```
Expected: all focused test files pass.

- [ ] **Step 3: Run the complete release gate**

Run:
```bash
npm test -- --run
npm run lint
npm run build
npm --prefix apps/pwa run cli:build
npm --prefix apps/pwa run mcp:build
git diff --check
```
Expected: all tests pass, lint has zero errors, all three builds exit 0, and Git reports no whitespace errors.

- [ ] **Step 4: Verify the browser journey**

In the local production UI: create a custom circle, create the default panel, place the circle, generate the enclosure, arrange A5 sheets, confirm the source face visibly contains the circle, save/reload, and confirm preflight behavior. Expected: six faces, visible sheet bounds, preserved opening, preserved reload state, and no browser console errors.

- [ ] **Step 5: Commit**

```bash
git add docs/hackathon-enclosure-guide.md README.md
git commit -m "docs: explain generic components and box workflow"
```

