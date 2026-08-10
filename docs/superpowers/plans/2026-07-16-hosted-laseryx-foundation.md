# Hosted Laseryx Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a single browser application-command boundary for projects, CAM settings, and machine-safety preconditions, so React, the existing browser automation path, and the later hosted relay can share one tested contract.

**Architecture:** Keep the current React reducer, IndexedDB repository, worker client, and GRBL driver intact, but introduce an `application/` layer that receives typed command envelopes and explicit ports. The live-command executor becomes an adapter that delegates domain commands to this layer; UI-only selection commands remain UI adapter behavior. This plan is deliberately local-only and does not add Cloudflare dependencies or alter physical machine behavior.

**Tech Stack:** TypeScript, React 18, Vitest, existing IndexedDB `projectRepo`, existing core reducer and automation protocol.

---

## Planned program sequence

This repository-wide change is split into three independently releasable plans:

1. This plan: browser application-command foundation and adapter consolidation.
2. Cloud account and project-sync plan: Worker, OAuth, D1, R2, project/version API, and remote MCP project/CAM tools.
3. Machine-relay plan: Durable Object presence, browser WebSocket pairing, audit records, and approval-gated live controls.

Do not add Cloudflare resources or remote machine control in this plan. Those require separate production credentials, migration policy, and hardware/virtual-machine acceptance tests.

## File structure

- Create: `apps/pwa/src/application/types.ts` — command names, caller context, application ports, and structured results shared by adapters.
- Create: `apps/pwa/src/application/projects.ts` — project command validation and repository-backed mutations.
- Create: `apps/pwa/src/application/cam.ts` — CAM-operation validation and reducer-backed mutation.
- Create: `apps/pwa/src/application/browserApplication.ts` — dispatcher that composes project and CAM handlers.
- Create: `apps/pwa/src/application/browserApplication.test.ts` — behavior tests using real pure handlers and small in-memory ports.
- Modify: `apps/pwa/src/automation/browser/liveCommands.ts` — delegate project and CAM domain commands; retain only UI presentation commands and the protocol envelope adapter.
- Modify: `apps/pwa/src/automation/browser/liveCommands.test.ts` — preserve protocol-level behavior while asserting delegation-compatible outputs.
- Modify: `apps/pwa/src/ui/App.tsx` — instantiate one browser application service and pass it to the automation adapter; no command logic is added to React.

### Task 1: Define the application command contract

**Files:**
- Create: `apps/pwa/src/application/types.ts`
- Test: `apps/pwa/src/application/browserApplication.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { createBrowserApplication } from "./browserApplication";

describe("browser application", () => {
  it("rejects an unsupported domain command with a stable error", async () => {
    const app = createBrowserApplication({
      getState: () => state(),
      dispatch: () => undefined,
      projects: projectPort()
    });

    const result = await app.execute({ command: "machine.startJob", args: {} });

    expect(result).toEqual({
      ok: false,
      code: "UNSUPPORTED_COMMAND",
      message: "Unsupported browser application command: machine.startJob"
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts`

Expected: FAIL because `./browserApplication` does not exist.

- [ ] **Step 3: Create the minimal shared contract**

```ts
// apps/pwa/src/application/types.ts
import type { Action } from "../core/state/actions";
import type { AppState } from "../core/state/types";
import type { ProjectSummary } from "../io/projectRepo";

export type BrowserApplicationCommand =
  | "cam.setOperation"
  | "project.new"
  | "project.save"
  | "project.list"
  | "project.open"
  | "project.delete"
  | "project.summary"
  | "project.exportJson"
  | "project.importJson";

export type ApplicationCommand = { command: string; args: Record<string, unknown> };
export type ApplicationFailure = { ok: false; code: string; message: string };
export type ApplicationSuccess<T> = { ok: true; data: T };
export type ApplicationResult<T> = ApplicationSuccess<T> | ApplicationFailure;

export type ProjectPort = {
  list(): Promise<ProjectSummary[]>;
  load(id: string): Promise<unknown | null>;
  save(...args: never[]): Promise<string>;
  delete(id: string): Promise<void>;
};

export type BrowserApplicationPorts = {
  getState(): AppState;
  dispatch(action: Action): void;
  projects: ProjectPort;
};
```

- [ ] **Step 4: Create the dispatcher skeleton**

```ts
// apps/pwa/src/application/browserApplication.ts
import type { ApplicationCommand, ApplicationResult, BrowserApplicationPorts } from "./types";

export function createBrowserApplication(_ports: BrowserApplicationPorts) {
  return {
    async execute(command: ApplicationCommand): Promise<ApplicationResult<never>> {
      return {
        ok: false,
        code: "UNSUPPORTED_COMMAND",
        message: `Unsupported browser application command: ${command.command}`
      };
    }
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pwa/src/application/types.ts apps/pwa/src/application/browserApplication.ts apps/pwa/src/application/browserApplication.test.ts
git commit -m "feat: add browser application command contract"
```

### Task 2: Move CAM operation mutation into the application layer

**Files:**
- Create: `apps/pwa/src/application/cam.ts`
- Modify: `apps/pwa/src/application/browserApplication.ts`
- Modify: `apps/pwa/src/application/browserApplication.test.ts`

- [ ] **Step 1: Write the failing CAM command test**

```ts
it("updates only supplied CAM operation fields", async () => {
  const dispatches: Action[] = [];
  const app = createBrowserApplication({
    getState: () => stateWithOperation({ id: "op-1", speed: 1000, power: 80, passes: 1, mode: "line" }),
    dispatch: (action) => dispatches.push(action),
    projects: projectPort()
  });

  const result = await app.execute({ command: "cam.setOperation", args: { operation: "op-1", power: 50 } });

  expect(result).toMatchObject({ ok: true, data: { operation: { id: "op-1", speed: 1000, power: 50, passes: 1 } } });
  expect(dispatches).toHaveLength(1);
  expect(dispatches[0].type).toBe("SET_CAM_SETTINGS");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts`

Expected: FAIL with `UNSUPPORTED_COMMAND` for `cam.setOperation`.

- [ ] **Step 3: Implement the focused CAM handler**

Create `apps/pwa/src/application/cam.ts` exporting `executeCamCommand(ports, command)`. Move the existing numeric validation from `automation/browser/liveCommands.ts` unchanged: require a known `operation` ID, accept `speed`, `power`, `passes`, and `mode`, reject invalid values, preserve unspecified fields, support `dryRun`, and dispatch exactly one `SET_CAM_SETTINGS` action for a non-dry-run update. Return `ApplicationResult<{ operation: Operation; dryRun?: true; changed?: false }>`.

Update the dispatcher:

```ts
if (command.command === "cam.setOperation") {
  return executeCamCommand(ports, command);
}
```

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts automation/browser/liveCommands.test.ts`

Expected: PASS; existing live-command tests still pass before adapter migration.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/application/cam.ts apps/pwa/src/application/browserApplication.ts apps/pwa/src/application/browserApplication.test.ts
git commit -m "refactor: move CAM command into application layer"
```

### Task 3: Move project commands behind an explicit repository port

**Files:**
- Create: `apps/pwa/src/application/projects.ts`
- Modify: `apps/pwa/src/application/types.ts`
- Modify: `apps/pwa/src/application/browserApplication.ts`
- Modify: `apps/pwa/src/application/browserApplication.test.ts`

- [ ] **Step 1: Write failing project behavior tests**

```ts
it("lists projects through the project port", async () => {
  const app = createBrowserApplication({
    getState: () => state(),
    dispatch: () => undefined,
    projects: projectPort({ list: async () => [{ id: "p-1", name: "Badge", updatedAt: 1 }] })
  });

  await expect(app.execute({ command: "project.list", args: {} })).resolves.toEqual({
    ok: true,
    data: { projects: [{ id: "p-1", name: "Badge", updatedAt: 1 }] }
  });
});

it("does not load a missing project into state", async () => {
  const dispatches: Action[] = [];
  const app = createBrowserApplication({
    getState: () => state(),
    dispatch: (action) => dispatches.push(action),
    projects: projectPort({ load: async () => null })
  });

  await expect(app.execute({ command: "project.open", args: { projectId: "missing" } })).resolves.toEqual({
    ok: false,
    code: "PROJECT_NOT_FOUND",
    message: "Project not found: missing"
  });
  expect(dispatches).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts`

Expected: FAIL with `UNSUPPORTED_COMMAND` for both project commands.

- [ ] **Step 3: Implement project handlers**

Create `apps/pwa/src/application/projects.ts` with `executeProjectCommand(ports, command)`. Port current behavior from `automation/browser/projectCommands.ts` without protocol concerns:

- `project.list` returns `{ projects }` from `ports.projects.list()`;
- `project.open` requires non-empty `projectId`, calls `load`, returns `PROJECT_NOT_FOUND` when absent, and dispatches `SET_DOCUMENT`, `SET_CAM_SETTINGS` when present, and `SELECT_MACHINE_PROFILE` when present;
- `project.summary` returns the active document object/operation counts;
- `project.exportJson` returns the active document, CAM settings, and machine profile;
- `project.importJson` validates the current v1 job shape before dispatching;
- `project.save`, `project.new`, and `project.delete` preserve current command semantics through the port.

Replace the `never[]` placeholder save signature in `ProjectPort` with the exact existing project-repository arguments:

```ts
save(document: Document, assets: Map<string, Blob>, name?: string, id?: string, metadata?: ProjectSaveMetadata): Promise<string>;
```

- [ ] **Step 4: Run project and adapter tests**

Run: `npm --prefix apps/pwa test -- browserApplication.test.ts automation/browser/projectCommands.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/application/types.ts apps/pwa/src/application/projects.ts apps/pwa/src/application/browserApplication.ts apps/pwa/src/application/browserApplication.test.ts
git commit -m "refactor: move project commands into application layer"
```

### Task 4: Make live automation a thin protocol adapter

**Files:**
- Modify: `apps/pwa/src/automation/browser/liveCommands.ts`
- Modify: `apps/pwa/src/automation/browser/liveCommands.test.ts`
- Modify: `apps/pwa/src/ui/App.tsx`

- [ ] **Step 1: Write the failing delegation test**

```ts
it("forwards a project command to the supplied browser application", async () => {
  const execute = vi.fn().mockResolvedValue({ ok: true, data: { projects: [] } });
  const executor = createLiveCommandExecutor({
    getState: () => state(),
    dispatch: () => undefined,
    setPreviewMode: () => undefined,
    setDesignPanel: () => undefined,
    application: { execute }
  });

  await executor.request({ protocolVersion: 1, requestId: "r-1", command: "project.list", args: {} });

  expect(execute).toHaveBeenCalledWith({ command: "project.list", args: {} });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix apps/pwa test -- automation/browser/liveCommands.test.ts`

Expected: FAIL because `application` is not an accepted executor option.

- [ ] **Step 3: Delegate domain commands and preserve response envelopes**

Add `application: { execute(command: ApplicationCommand): Promise<ApplicationResult<unknown>> }` to `LiveCommandExecutorOptions`. Keep protocol validation and `wrap()` in this adapter. For `cam.setOperation` and every `project.*` command, await `application.execute`, translate its success data to `okResponse`, and translate failures to one `diagnostic(result.code, "error", result.message)` response. Delete the former CAM helper and `executeProjectCommand` imports from this file. Do not migrate `document.*` or `ui.*` commands in this task.

In `App.tsx`, construct `createBrowserApplication({ getState: () => stateRef.current, dispatch, projects: projectRepo })` beside the existing bridge setup and pass it to `createLiveCommandExecutor`.

- [ ] **Step 4: Run adapter and UI tests**

Run: `npm --prefix apps/pwa test -- automation/browser/liveCommands.test.ts ui/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/automation/browser/liveCommands.ts apps/pwa/src/automation/browser/liveCommands.test.ts apps/pwa/src/ui/App.tsx
git commit -m "refactor: route live commands through application API"
```

### Task 5: Verify the foundation and document the next boundary

**Files:**
- Modify: `docs/architecture.md`
- Test: all existing PWA tests

- [ ] **Step 1: Update architecture documentation**

Add an `Application API` section to `docs/architecture.md` stating that UI and automation are adapters over `apps/pwa/src/application`; cloud Worker/remote MCP and browser relay will be future adapters; CAM and GRBL remain their existing independent layers. Link to `docs/superpowers/specs/2026-07-16-hosted-laseryx-design.md`.

- [ ] **Step 2: Run full verification**

Run: `npm test && npm run lint && npm run build`

Expected: all tests, lint, and production build pass.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: record application API boundary"
```

## Plan self-review

Coverage: Tasks 1–4 implement the common browser application boundary required before remote adapters; Task 5 locks the boundary and verifies current product behavior. Cloud identity, sync, relay, and live safety remain intentionally assigned to the next two independently deployable plans.

No placeholders: all new files, commands, expected failures, and verification commands are named. `project.save`, `new`, and `delete` are explicitly limited to preserved existing behavior because their current operation semantics are defined in the source being moved.

Type consistency: `ApplicationCommand`, `ApplicationResult`, `BrowserApplicationPorts`, and `createBrowserApplication().execute()` are the same contract in all tasks. The protocol adapter remains responsible only for protocol envelopes.
