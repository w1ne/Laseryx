# Canvas Component Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete complete source-panel component instances from canvas selections and add the measured four-button mounting-hole pattern.

**Architecture:** Reuse the existing strict source-cutout ID resolver. Route valid component selections through one new reducer action so authoritative workspace mutation, derived-geometry regeneration, selection clearing, and undo history remain atomic; keep all other generated geometry protected.

**Tech Stack:** TypeScript, React reducer/services, Vitest.

---

### Task 1: Specify deletion behavior with failing tests

**Files:**
- Modify: `apps/pwa/src/core/services/GroupService.enclosure.test.ts`
- Modify: `apps/pwa/src/core/state/history.test.ts`

- [ ] **Step 1: Add single-component mounting-hole deletion test**

Create a workspace with one component containing a primary opening and mounting holes. Select a rendered mounting-hole ID, call `GroupService.deleteSelection`, and assert the component and every rendered cutout disappear while unrelated objects remain.

- [ ] **Step 2: Add multi-component and protection tests**

Select paths belonging to two components and assert both instances are removed once. Assert mixed selections and generated face IDs remain rejected without changing the document.

- [ ] **Step 3: Add undo coverage**

Delete a component through the reducer-backed harness, dispatch Undo, and verify the authoritative component and rendered paths return.

- [ ] **Step 4: Run tests and verify RED**

Run: `npm --prefix apps/pwa test -- src/core/services/GroupService.enclosure.test.ts src/core/state/history.test.ts`

Expected: FAIL because protected component paths cannot yet route to authoritative deletion.

### Task 2: Implement atomic authoritative deletion

**Files:**
- Modify: `apps/pwa/src/core/state/actions.ts`
- Modify: `apps/pwa/src/core/state/reducer.ts`
- Modify: `apps/pwa/src/core/services/GroupService.ts`

- [ ] **Step 1: Add the reducer action**

Add `DELETE_COMPONENT_INSTANCES` with a string-array payload and include it in the undoable action set.

- [ ] **Step 2: Implement reducer mutation**

Validate and deduplicate component IDs against `enclosureWorkspace.sourcePanel.components`. Remove matching instances, clear `enclosure.result` and `sheetLayout`, render the updated workspace, and clear object/constraint selections in one state transition.

- [ ] **Step 3: Route source cutouts through GroupService**

When protected IDs are present, resolve every selected ID with `componentIdForSourceCutout`. Dispatch `DELETE_COMPONENT_INSTANCES` only if every ID resolves; otherwise return false without partial deletion. Existing free/sketch deletion remains unchanged.

- [ ] **Step 4: Run focused tests**

Run: `npm --prefix apps/pwa test -- src/core/services/GroupService.enclosure.test.ts src/core/services/GroupService.delete.test.ts src/core/state/history.test.ts`

Expected: PASS.

### Task 3: Add four-button mounting holes

**Files:**
- Modify: `apps/pwa/src/core/components/examples.test.ts`
- Modify: `apps/pwa/src/core/components/examples.ts`
- Modify: `apps/pwa/src/core/hardware/place.test.ts`

- [ ] **Step 1: Add failing preset assertions**

Assert SKU `100.519.82` contains four Ø3.5 mm mounting holes at `(-41.25,-8)`, `(41.25,-8)`, `(-41.25,8)`, and `(41.25,8)`, with no remaining missing mounting-hole warning.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm --prefix apps/pwa test -- src/core/components/examples.test.ts`

Expected: FAIL because the preset currently has no mounting holes.

- [ ] **Step 3: Update both catalog mechanics copies**

Add the four holes to the HESTORE definition and its preset mechanics, remove `mounting-hole positions` from missing data, and note that the positions are user-measured approximations.

- [ ] **Step 4: Verify generated path counts**

Assert the example preset expands to eight paths—four button openings and four mounting holes—and the automation placement path preserves the same geometry.

### Task 4: Verify and release

**Files:**
- Modify only if a scoped verification failure is found.

- [ ] **Step 1: Run release gates**

Run: `git diff --check && npm test && npm run lint && npm run build && npm --prefix apps/pwa run cli:build && npm --prefix apps/pwa run mcp:build && npm --prefix apps/pwa run hosted-mcp:build`

Expected: all tests/builds pass and lint reports zero errors.

- [ ] **Step 2: Integrate**

Commit as `feat: delete placed components from canvas`, push a PR to `main`, wait for CI, merge, deploy GitHub Pages, verify the live bundle, and remove the temporary worktree and branch.
