# Direct Project Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add serverless share links that round-trip an editable vector/enclosure project, sheet layout, and CAM settings without including machine or device state.

**Architecture:** A focused `shareCapsule` module owns the versioned compressed wire format, integrity check, validation, and URL-fragment parsing. A small `SharedProjectDialog` owns confirmation UI; `App` only coordinates clipboard creation and atomic store replacement. The existing `lx` automation-command fragment remains independent from the new `share` project fragment.

**Tech Stack:** TypeScript, React 18, Vitest, Testing Library, `fflate` for deterministic DEFLATE compression, browser Clipboard and History APIs.

---

### Task 1: Versioned compressed share capsule

**Files:**
- Create: `apps/pwa/src/io/shareCapsule.ts`
- Create: `apps/pwa/src/io/shareCapsule.test.ts`
- Modify: `apps/pwa/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the compression dependency**

Run:

```bash
npm --prefix apps/pwa install fflate@^0.8.2
```

Expected: `fflate` is recorded in the workspace package and lockfile.

- [ ] **Step 2: Write failing round-trip and exclusion tests**

Create tests that construct this public payload:

```ts
const payload: SharedProjectPayload = {
  version: 1,
  document: generatedEnclosureDocument,
  camSettings: { operations: [{ id: "cut", name: "Cut", mode: "line", speed: 900, power: 80, passes: 2 }] }
};

const hash = encodeSharedProject(payload);
expect(hash.startsWith("#share=v1.")).toBe(true);
expect(decodeSharedProjectHash(hash)).toEqual({ ok: true, payload });
expect(JSON.stringify(payload)).not.toContain("machineProfile");
expect(encodeSharedProject(payload)).toBe(encodeSharedProject(payload));
```

Also assert that a document containing `{ kind: "image" }` throws `Raster images cannot be included in a share link.`

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
npm --prefix apps/pwa test -- --run src/io/shareCapsule.test.ts
```

Expected: FAIL because `shareCapsule.ts` and its exports do not exist.

- [ ] **Step 4: Implement the minimal codec**

Create these types and API:

```ts
export type SharedProjectPayload = {
  version: 1;
  document: Document;
  camSettings: CamSettings;
};

export type SharedProjectDecodeResult =
  | { ok: true; payload: SharedProjectPayload }
  | { ok: false; error: string };

export function encodeSharedProject(payload: SharedProjectPayload): string;
export function decodeSharedProjectHash(hash: string): SharedProjectDecodeResult;
export function sharedProjectUrl(payload: SharedProjectPayload, location: Pick<Location, "origin" | "pathname">): string;
```

Implementation requirements:

- serialize with `JSON.stringify`;
- UTF-8 encode and `gzipSync` using `{ mtime: 0 }`;
- calculate a CRC32 integrity value over the compressed bytes using `fflate.crc32` if exported by the installed version, otherwise implement the standard CRC32 polynomial `0xEDB88320` locally;
- encode bytes as unpadded base64url;
- use `#share=v1.<crc32-hex>.<base64url>`;
- reject encoded capsules over `65_536` characters and decoded JSON over `1_000_000` bytes;
- reject image objects before encoding and after decoding;
- require payload version `1`, a document object with `units === "mm"`, arrays for `layers` and `objects`, and CAM settings with an operations array;
- run `sanitizeEnclosureWorkspace` when an enclosure workspace is present and reject the entire capsule if it is invalid;
- return concise errors without throwing from the decoder.

- [ ] **Step 5: Add corruption, version, schema, and size tests**

Test a changed checksum, invalid base64url, `v2`, invalid document shape, invalid enclosure workspace, an oversized encoded fragment, and a gzip payload that expands beyond the decoded limit. Each must return `{ ok: false, error: expect.any(String) }` and never return a payload.

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```bash
npm --prefix apps/pwa test -- --run src/io/shareCapsule.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the codec**

```bash
git add apps/pwa/src/io/shareCapsule.ts apps/pwa/src/io/shareCapsule.test.ts apps/pwa/package.json package-lock.json
git commit -m "feat: add compressed project share capsules"
```

### Task 2: Shared-project confirmation dialog

**Files:**
- Create: `apps/pwa/src/ui/dialogs/SharedProjectDialog.tsx`
- Create: `apps/pwa/src/ui/dialogs/SharedProjectDialog.test.tsx`
- Modify: `apps/pwa/src/ui/app.css`

- [ ] **Step 1: Write failing dialog behavior tests**

Render the dialog with a payload containing a named panel, six generated faces, and two CAM operations. Assert that it displays `Shared fabrication project`, `6 box faces`, `2 cutting operations`, and buttons named `Open shared design` and `Cancel`. Assert each button calls only its corresponding callback.

- [ ] **Step 2: Run the test and verify RED**

```bash
npm --prefix apps/pwa test -- --run src/ui/dialogs/SharedProjectDialog.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the dialog**

Export:

```tsx
export function SharedProjectDialog({ payload, onOpen, onCancel }: {
  payload: SharedProjectPayload;
  onOpen: () => void;
  onCancel: () => void;
})
```

Use `role="dialog"`, `aria-modal="true"`, a heading `Shared fabrication project`, and summary counts derived from `payload.document.objects`, `payload.document.enclosureWorkspace?.enclosure.result?.panels`, and `payload.camSettings.operations`. Explain that opening replaces the current unsaved canvas but does not change machine settings.

- [ ] **Step 4: Add compact dialog styling**

Add `shared-project-dialog` overlay/card/actions classes following the existing dark workbench palette and existing responsive button sizing.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm --prefix apps/pwa test -- --run src/ui/dialogs/SharedProjectDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the dialog**

```bash
git add apps/pwa/src/ui/dialogs/SharedProjectDialog.tsx apps/pwa/src/ui/dialogs/SharedProjectDialog.test.tsx apps/pwa/src/ui/app.css
git commit -m "feat: add shared project confirmation"
```

### Task 3: Share action and startup import

**Files:**
- Modify: `apps/pwa/src/ui/App.tsx`
- Modify: `apps/pwa/src/ui/App.test.tsx`

- [ ] **Step 1: Write failing Share link tests**

In `App.test.tsx`, mock `navigator.clipboard.writeText`. Render the app with a vector document and click `Share link`. Assert the copied value starts with the current origin/path and `#share=v1.`, and that a success toast says `Share link copied`. Render with an image object and assert no clipboard call plus the visible error `Raster images cannot be included in a share link.`

- [ ] **Step 2: Write failing startup confirmation tests**

Set `window.location.hash` to a valid encoded shared project before rendering. Assert the confirmation dialog appears and no `SET_DOCUMENT` or `SET_CAM_SETTINGS` action occurs before confirmation. Click `Open shared design` and assert both actions occur, selection is cleared with `SELECT_OBJECT: null`, machine state is unchanged, and `window.location.hash` is removed. Repeat with `Cancel` and malformed data, asserting the original document remains unchanged and the fragment is removed.

- [ ] **Step 3: Run the tests and verify RED**

```bash
npm --prefix apps/pwa test -- --run src/ui/App.test.tsx
```

Expected: FAIL because no Share link action or shared-project confirmation exists.

- [ ] **Step 4: Implement sharing in App**

Add imports for the codec and dialog, local state `pendingSharedProject`, and an initial parse ref for `#share=`. Implement:

```ts
const handleShareProject = async () => {
  try {
    const url = sharedProjectUrl({ version: 1, document: doc, camSettings }, window.location);
    await navigator.clipboard.writeText(url);
    toast.success(`Share link copied (${url.length.toLocaleString()} characters)`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not create share link.");
  }
};
```

On startup, decode only when the hash contains `share=`. Put valid payloads into `pendingSharedProject`; show decoder errors immediately. Clear only the handled share parameter with `history.replaceState`, preserving pathname, search, and unrelated fragment parameters. Keep existing `lx` command behavior unchanged.

On confirmation, dispatch `SET_DOCUMENT`, `SET_CAM_SETTINGS`, `SELECT_OBJECT` with `null`, and `SELECT_CONSTRAINT` with `null`; then close the dialog and clear the fragment. On cancel, close and clear without dispatching project changes.

Add a top-bar button labeled `Share link` beside Save and render `SharedProjectDialog` when a valid pending payload exists.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
npm --prefix apps/pwa test -- --run src/ui/App.test.tsx src/io/shareCapsule.test.ts src/ui/dialogs/SharedProjectDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the application integration**

```bash
git add apps/pwa/src/ui/App.tsx apps/pwa/src/ui/App.test.tsx
git commit -m "feat: share and open fabrication projects"
```

### Task 4: End-to-end enclosure round trip and release verification

**Files:**
- Create: `apps/pwa/src/ui/tests/sharedProjectWorkflow.test.tsx`
- Modify: `docs/hackathon-enclosure-guide.md`

- [ ] **Step 1: Write the integration test**

Build an `EnclosureWorkspace` with a source-panel component, call `regenerateEnclosureWorkspace`, arrange all six faces with `packParts`, render it into a document, encode it with CAM settings, decode it, and assert exact equality for `sourcePanel`, `enclosure.result`, `sheetLayout`, and CAM operations. Assert the decoded document contains no image objects.

- [ ] **Step 2: Run the integration test**

```bash
npm --prefix apps/pwa test -- --run src/ui/tests/sharedProjectWorkflow.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Document the hackathon workflow**

Add a `Share for cutting` section explaining: finish and arrange the box, click Share link, send the copied URL, recipient reviews and opens it, then generates/exports for their own machine. State that raster images and machine profiles are intentionally excluded.

- [ ] **Step 4: Run complete verification**

```bash
npm test
npm run lint
npm run build
npm --prefix apps/pwa run cli:build
npm --prefix apps/pwa run mcp:build
npm --prefix apps/pwa run hosted-mcp:build
```

Expected: all tests and builds pass; lint reports no new errors.

- [ ] **Step 5: Commit workflow coverage and documentation**

```bash
git add apps/pwa/src/ui/tests/sharedProjectWorkflow.test.tsx docs/hackathon-enclosure-guide.md
git commit -m "test: verify shared enclosure workflow"
```
