# Hackathon Enclosure Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser-first hackathon workflow that places the purchased HESTORE modules, edits their dimensions, turns a front panel into a constrained press-fit enclosure, packs it onto A5 sheets, and verifies the result before cutting.

**Architecture:** Preserve the existing sketch solver as the source of parametric geometry. New kit, enclosure, coupon, packing, and preflight modules are pure TypeScript; the UI calls those modules through one workspace service and stores generated parts in the existing project state/history. Each generated panel has local constrained geometry plus a separate placement transform so sheet packing never changes its dimensions.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing Laseryx sketch/CAM/state services.

---

### Task 1: Establish the `main` release worktree

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/release.sh`

- [ ] **Step 1: Preserve the unmerged cloud chain and create an isolated trunk**

Run:
```bash
git branch recovery/hosted-cloud-oauth c85d57f
git worktree add .worktrees/hackathon-main -b main develop
git -C .worktrees/hackathon-main merge --no-edit master
```
Expected: `main` contains both the hardware/sketch work from `develop` and the material/layer work from `master`; `recovery/hosted-cloud-oauth` points at `c85d57f`.

- [ ] **Step 2: Make automation name only `main`**

Change CI branch filters from `develop`/`master` to `main`, and change the release guard in `scripts/release.sh` to accept only `main`.

- [ ] **Step 3: Run the merged baseline**

Run: `npm test -- --run && npm run lint && npm run build`
Expected: all tests pass, ESLint exits 0, and Vite emits `apps/pwa/dist`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml scripts/release.sh
git commit -m "chore: establish main release trunk"
```

### Task 2: Add the exact hackathon kit catalog

**Files:**
- Create: `apps/pwa/src/core/hardware/types.ts`
- Create: `apps/pwa/src/core/hardware/catalog.ts`
- Create: `apps/pwa/src/core/hardware/catalog.test.ts`

- [ ] **Step 1: Write the failing catalog test**

Test that `HACKATHON_KIT` has the seven SKU values `100.491.54`, `100.357.19`, `100.431.82`, `100.355.72`, `100.220.17`, `100.321.00`, and `100.519.82`; test known dimensions (display board 62×29 and window 43.72×23.695, encoder shaft Ø6, toggle Ø6, slider body 88×12.5 with 60 travel); and test microphone/ribbon are internal-only by default.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/hardware/catalog.test.ts`
Expected: FAIL because the hardware catalog does not exist.

- [ ] **Step 3: Implement typed definitions**

Define `HardwareModule`, `ModuleGeometry`, `CutoutPrimitive`, `MountingHole`, and `DimensionConfidence`. Export an immutable `HACKATHON_KIT` with editable nominal dimensions and provenance/confidence for every measurement; represent unknown four-button dimensions explicitly instead of inventing them.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/core/hardware/catalog.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/hardware
git commit -m "feat: add exact hackathon hardware kit"
```

### Task 3: Generate editable module cutouts

**Files:**
- Create: `apps/pwa/src/core/hardware/place.ts`
- Create: `apps/pwa/src/core/hardware/place.test.ts`
- Modify: `apps/pwa/src/core/macros/types.ts`
- Modify: `apps/pwa/src/core/macros/expand.ts`

- [ ] **Step 1: Write failing placement tests**

Cover display window plus mounting holes, encoder and toggle round holes, slider travel slot, unique parameter names for two copies, and a blocking validation result for missing required four-button measurements.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/hardware/place.test.ts`
Expected: FAIL because `placeHardwareModule` is missing.

- [ ] **Step 3: Implement module-to-sketch expansion**

Add `placeHardwareModule(module, origin, overrides)` returning a local `SketchDocument`, named editable parameters, cut/engrave roles, mounting geometry, keep-out bounds, and component metadata. Reuse existing rectangle, rounded rectangle, slot, circle, dimension, and constraint machinery.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/core/hardware/place.test.ts src/core/macros/macros.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/hardware apps/pwa/src/core/macros
git commit -m "feat: generate parametric hardware cutouts"
```

### Task 4: Build the press-fit enclosure engine

**Files:**
- Create: `apps/pwa/src/core/enclosure/types.ts`
- Create: `apps/pwa/src/core/enclosure/joints.ts`
- Create: `apps/pwa/src/core/enclosure/generate.ts`
- Create: `apps/pwa/src/core/enclosure/generate.test.ts`

- [ ] **Step 1: Write failing enclosure tests**

Test a 160×95 mm front panel, 65 mm rear height, 35 mm front height, 3 mm stock, 0.15 mm clearance, and 8 mm finger target. Assert six named panels, matching complementary edge segment counts, valid sloped side outlines, a removable base/service lid, and all front-panel module geometry preserved.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/enclosure/generate.test.ts`
Expected: FAIL because `generateEnclosure` is missing.

- [ ] **Step 3: Implement deterministic joints and panels**

Implement `chooseOddFingerCount(edgeLength, targetWidth)`, complementary tab/slot paths adjusted by thickness and clearance, and `generateEnclosure(input)` producing front, rear, left, right, base, and service-lid local sketches with independent placement transforms.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/core/enclosure/generate.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/enclosure
git commit -m "feat: generate constrained press-fit enclosures"
```

### Task 5: Add the fit calibration coupon

**Files:**
- Create: `apps/pwa/src/core/enclosure/coupon.ts`
- Create: `apps/pwa/src/core/enclosure/coupon.test.ts`

- [ ] **Step 1: Write failing coupon tests**

Assert that `generateFitCoupon({ thickness: 3, clearance: 0.15 })` produces labeled mating slots for clearances 0.05, 0.10, 0.15, 0.20, and 0.25 mm and fits inside 80×30 mm.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/enclosure/coupon.test.ts`
Expected: FAIL because `generateFitCoupon` is missing.

- [ ] **Step 3: Implement and verify**

Generate one cuttable coupon sketch with engrave labels and a `recommendedClearance` parameter.

Run: `npm test -- --run src/core/enclosure/coupon.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/pwa/src/core/enclosure/coupon.ts apps/pwa/src/core/enclosure/coupon.test.ts
git commit -m "feat: add press-fit calibration coupon"
```

### Task 6: Pack generated parts onto A5 sheets

**Files:**
- Create: `apps/pwa/src/core/layout/types.ts`
- Create: `apps/pwa/src/core/layout/pack.ts`
- Create: `apps/pwa/src/core/layout/pack.test.ts`

- [ ] **Step 1: Write failing packing tests**

Test deterministic first-fit-decreasing packing onto 210×148 mm sheets, configurable margins/gap, optional 90° rotation, no overlaps, explicit overflow, and unchanged local panel geometry after placement.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/layout/pack.test.ts`
Expected: FAIL because `packParts` is missing.

- [ ] **Step 3: Implement, verify, and commit**

Implement pure packing and validation over part bounds and transforms.

Run: `npm test -- --run src/core/layout/pack.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/layout
git commit -m "feat: pack enclosure parts onto A5 sheets"
```

### Task 7: Persist one editable enclosure workspace

**Files:**
- Create: `apps/pwa/src/core/enclosure/workspace.ts`
- Create: `apps/pwa/src/core/enclosure/workspace.test.ts`
- Modify: `apps/pwa/src/core/model.ts`
- Modify: `apps/pwa/src/core/state/types.ts`
- Modify: `apps/pwa/src/core/state/actions.ts`
- Modify: `apps/pwa/src/core/state/reducer.ts`
- Modify: `apps/pwa/src/io/projectRepo.ts`
- Modify: `apps/pwa/src/io/projectRepo.test.ts`

- [ ] **Step 1: Write failing state and round-trip tests**

Test create/update/remove module instances, regenerate enclosure after a dimension edit, move a panel without changing its sketch, one-step undo, and IndexedDB JSON round-trip without losing SKU, parameters, panels, sheets, or coupon.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/enclosure/workspace.test.ts src/io/projectRepo.test.ts src/core/state/history.test.ts`
Expected: FAIL on absent enclosure workspace state/actions.

- [ ] **Step 3: Implement state integration**

Add an optional versioned `enclosureWorkspace` to the project model, one reducer action per atomic edit, deterministic regeneration through the pure core modules, and backward-compatible deserialization for old projects.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/core/enclosure/workspace.test.ts src/io/projectRepo.test.ts src/core/state/history.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/enclosure apps/pwa/src/core/model.ts apps/pwa/src/core/state apps/pwa/src/io/projectRepo*
git commit -m "feat: persist editable enclosure workspaces"
```

### Task 8: Add enclosure-aware preflight

**Files:**
- Create: `apps/pwa/src/core/enclosure/preflight.ts`
- Create: `apps/pwa/src/core/enclosure/preflight.test.ts`
- Modify: `apps/pwa/src/automation/commands/preflight.ts`

- [ ] **Step 1: Write failing preflight tests**

Cover blockers for unknown required dimensions, out-of-sheet parts, overlap, open cut contours, impossible tabs, keep-out collisions, and stock mismatch; cover warnings for missing coupon confirmation and low measurement confidence; cover a valid kit enclosure.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/core/enclosure/preflight.test.ts`
Expected: FAIL because `preflightEnclosure` is missing.

- [ ] **Step 3: Implement structured issues and command integration**

Return stable issue codes with severity, object/panel IDs, and actionable messages. Merge these issues into the existing automation preflight result.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/core/enclosure/preflight.test.ts src/automation/commands/commands.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/core/enclosure/preflight* apps/pwa/src/automation/commands/preflight.ts
git commit -m "feat: preflight enclosure manufacturing risks"
```

### Task 9: Build the discoverable kit and dimension UI

**Files:**
- Create: `apps/pwa/src/ui/components/HackathonKitPanel.tsx`
- Create: `apps/pwa/src/ui/components/HackathonKitPanel.test.tsx`
- Create: `apps/pwa/src/ui/panels/HardwarePropertiesPanel.tsx`
- Create: `apps/pwa/src/ui/panels/HardwarePropertiesPanel.test.tsx`
- Modify: `apps/pwa/src/ui/App.tsx`
- Modify: `apps/pwa/src/ui/app.css`

- [ ] **Step 1: Write failing interaction tests**

Render the app, open “Hackathon kit”, place display/encoder/toggle/slider/button modules, edit a width in millimetres, and assert the canvas/state changes. Assert internal-only modules are labeled and unknown measurements show a blocking “measure first” editor.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/ui/components/HackathonKitPanel.test.tsx src/ui/panels/HardwarePropertiesPanel.test.tsx`
Expected: FAIL because the UI does not exist.

- [ ] **Step 3: Implement accessible UI**

Add the kit as a first-class design tool, searchable cards with SKU and mounting summary, click-to-place plus existing drag/drop support, and numeric property inputs bound to named sketch parameters.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/ui/components/HackathonKitPanel.test.tsx src/ui/panels/HardwarePropertiesPanel.test.tsx src/ui/App.test.tsx`
Expected: PASS.

```bash
git add apps/pwa/src/ui
git commit -m "feat: add hackathon kit placement workflow"
```

### Task 10: Add the front-panel-to-box wizard and hierarchy

**Files:**
- Create: `apps/pwa/src/ui/components/EnclosureWizard.tsx`
- Create: `apps/pwa/src/ui/components/EnclosureWizard.test.tsx`
- Create: `apps/pwa/src/ui/panels/EnclosureTree.tsx`
- Create: `apps/pwa/src/ui/panels/EnclosureTree.test.tsx`
- Modify: `apps/pwa/src/ui/App.tsx`
- Modify: `apps/pwa/src/ui/app.css`

- [ ] **Step 1: Write failing workflow tests**

From a populated front panel, run the wizard with 3 mm stock, sloped-console dimensions, 0.15 mm clearance, A5 sheets, and coupon enabled. Assert a review summary, six panels plus coupon, sheet grouping, editable hierarchy, regeneration after changing rear height, and preservation of manual sheet transforms.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/ui/components/EnclosureWizard.test.tsx src/ui/panels/EnclosureTree.test.tsx`
Expected: FAIL because the wizard/tree do not exist.

- [ ] **Step 3: Implement the four-step wizard and tree**

Implement steps “Panel”, “Box”, “Fit”, and “Sheets”; validate inline; show derived slope and sheet count before generation; then expose Workspace → Front panel → Components and Enclosure → Panels → Sheets as selectable nodes.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/ui/components/EnclosureWizard.test.tsx src/ui/panels/EnclosureTree.test.tsx src/ui/tests/workflows.test.tsx`
Expected: PASS.

```bash
git add apps/pwa/src/ui
git commit -m "feat: add enclosure generation wizard"
```

### Task 11: Expose the workflow to agents

**Files:**
- Create: `apps/pwa/src/automation/commands/enclosure.ts`
- Create: `apps/pwa/src/automation/commands/enclosure.test.ts`
- Modify: `apps/pwa/src/automation/protocol/types.ts`
- Modify: `apps/pwa/src/automation/protocol/validate.ts`
- Modify: `apps/pwa/src/automation/protocol/handler.ts`
- Modify: `apps/pwa/src/automation/capabilities.ts`

- [ ] **Step 1: Write failing protocol tests**

Test `list_hardware_kit`, `place_hardware_module`, `generate_enclosure`, `pack_sheets`, and `preflight_enclosure`, including invalid SKU and missing-dimension errors.

- [ ] **Step 2: Verify red**

Run: `npm test -- --run src/automation/commands/enclosure.test.ts src/automation/protocol/protocol.test.ts`
Expected: FAIL because commands are unknown.

- [ ] **Step 3: Implement command adapters**

Validate typed arguments and call the same workspace functions as the UI so agent and human edits remain identical and undoable.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- --run src/automation/commands/enclosure.test.ts src/automation/protocol/protocol.test.ts src/automation/capabilities.test.ts`
Expected: PASS.

```bash
git add apps/pwa/src/automation
git commit -m "feat: expose enclosure workflow to agents"
```

### Task 12: Verify the complete hackathon release

**Files:**
- Create: `apps/pwa/src/ui/tests/hackathonEnclosure.test.tsx`
- Create: `docs/hackathon-enclosure-guide.md`
- Modify: `README.md`

- [ ] **Step 1: Add an end-to-end browser test**

Automate: start blank project → place display, encoder, toggle, slider, and four-button row → enter measured button dimensions → generate sloped enclosure → add coupon → pack A5 sheets → obtain preflight-ready status → save/reload and compare workspace.

- [ ] **Step 2: Document the physical workflow**

Document measurement entry, kerf coupon cutting, clearance selection, sheet packing, preflight, SVG/G-code export, dry assembly, and the rule that production deployment follows a successful physical coupon/enclosure check.

- [ ] **Step 3: Run focused and full verification**

Run:
```bash
npm test -- --run src/core/hardware src/core/enclosure src/core/layout src/ui/tests/hackathonEnclosure.test.tsx
npm test -- --run
npm run lint
npm run build
git diff --check
```
Expected: every command exits 0; the complete test suite passes; the production bundle builds; no whitespace errors exist.

- [ ] **Step 4: Commit**

```bash
git add apps/pwa/src/ui/tests/hackathonEnclosure.test.tsx docs/hackathon-enclosure-guide.md README.md
git commit -m "docs: prepare hackathon enclosure release"
```

- [ ] **Step 5: Hold the production tag behind the physical gate**

Cut the five-clearance coupon and one enclosure on the actual A5 stock, record the selected clearance and any dimensional corrections, rerun Step 3 after corrections, then tag the verified `main` commit with the next `v*` version so the existing Pages workflow deploys exactly the tested build.

