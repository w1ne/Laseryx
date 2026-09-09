# Slider and Button Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the CDE23N slider cutout and mounting holes and replace the TACTS-12MOD-4CH placeholder button geometry with measured values.

**Architecture:** Keep hardware measurements in the existing HESTORE catalog. Extend button-row dimensions with optional explicit centre offsets; expansion, bounds validation, and enclosure deserialization consume them while legacy uniform-pitch rows remain unchanged.

**Tech Stack:** TypeScript, React data model, Vitest.

---

### Task 1: Describe the corrected catalog geometry with failing tests

**Files:**
- Modify: `apps/pwa/src/core/components/examples.test.ts`
- Modify: `apps/pwa/src/core/components/expand.test.ts`

- [ ] **Step 1: Add catalog assertions**

Assert that SKU `100.321.00` has `{ length: 60, width: 2 }`, two Ø3.2 holes at x ±40, and verified confidence. Assert that SKU `100.519.82` has count 4, diameter 12, explicit centres `[-31.25, -10.25, 9.75, 30.75]`, and an 86.5 × 20 body.

- [ ] **Step 2: Add expansion assertion**

Create a button-row instance with `centers: [{x: -3, y: 1}, {x: 4, y: -1}]` and assert the two generated circle centres match those offsets.

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `npm --prefix apps/pwa test -- src/core/components/examples.test.ts src/core/components/expand.test.ts`

Expected: FAIL because slider catalog values are old and `centers` is not supported.

### Task 2: Support explicit button centres generically

**Files:**
- Modify: `apps/pwa/src/core/components/types.ts`
- Modify: `apps/pwa/src/core/components/expand.ts`
- Modify: `apps/pwa/src/core/panel/validate.ts`
- Modify: `apps/pwa/src/core/enclosure/workspace.ts`

- [ ] **Step 1: Extend the button-row type**

Change the dimensions to `type ButtonRowDimensions = { count: number; diameter: number; pitch: number; centers?: Array<{ x: number; y: number }> }` and deep-copy `centers` when instantiating a preset.

- [ ] **Step 2: Validate and expand explicit centres**

When `centers` exists, require its length to equal `count` and every coordinate to be finite. Expand circles at those centres; otherwise retain the existing pitch formula.

- [ ] **Step 3: Use explicit centres for panel bounds**

Compute each transformed circle bound from both centre coordinates, preserving the existing uniform-row behavior when centres are absent.

- [ ] **Step 4: Accept explicit centres in persisted enclosure workspaces**

Allow only a bounded array whose length equals count and whose x/y values are finite, so save/load and shared-link sanitization preserve safe measured geometry.

- [ ] **Step 5: Run the focused tests**

Run: `npm --prefix apps/pwa test -- src/core/components/expand.test.ts src/core/enclosure/workspace.test.ts src/core/panel/validate.test.ts`

Expected: PASS.

### Task 3: Correct both HESTORE presets

**Files:**
- Modify: `apps/pwa/src/core/components/examples.ts`
- Test: `apps/pwa/src/core/components/examples.test.ts`

- [ ] **Step 1: Update the slider preset**

Set width to 2; add `{ x: -40, y: 0, diameter: 3.2 }` and `{ x: 40, y: 0, diameter: 3.2 }`; set confidence to verified; remove the missing mounting-hole entry.

- [ ] **Step 2: Update the four-button preset**

Set diameter 12, pitch 20.5, and explicit centres `[{x:-31.25,y:0},{x:-10.25,y:0},{x:9.75,y:0},{x:30.75,y:0}]`. Set its measured body to 86.5 × 20, retain only `mounting-hole positions` as missing, and record a concise user-measured warning.

- [ ] **Step 3: Run catalog and expansion tests**

Run: `npm --prefix apps/pwa test -- src/core/components/examples.test.ts src/core/components/expand.test.ts`

Expected: PASS.

### Task 4: Release verification and integration

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint && npm run build`

Expected: zero lint errors and successful build.

- [ ] **Step 3: Commit, push, open a PR, wait for CI, merge, and deploy**

Commit the implementation as `fix: correct slider and button module geometry`, create a PR against `main`, merge after CI, run the Pages deployment workflow, and verify the live bundle.
