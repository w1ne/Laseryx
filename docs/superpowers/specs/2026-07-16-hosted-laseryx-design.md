# Hosted Laseryx Architecture

## Goal

Turn Laseryx into an account-based, cloud-synced laser workspace with a hosted MCP server. An authenticated agent can create and edit projects from anywhere and can control a connected engraver only through a paired, active Laseryx browser tab.

The product is hosted on Cloudflare. Users do not run a local MCP process or configure a local bridge URL.

## Non-negotiable browser and safety boundary

Web Serial is available only to the browser tab that received the user's serial-port permission. Neither a Cloudflare Worker nor an MCP client may access the engraver directly.

The browser tab is therefore the machine authority. It alone may:

- open or close a serial port;
- read GRBL status;
- stream G-code;
- pause or abort a job.

The cloud may request a machine operation, but the browser validates the request against the connected machine's live state before performing it. Starting a laser job additionally requires a short-lived approval created by a visible in-app action. Pause and abort do not require approval.

## Target architecture

```text
MCP client -- OAuth / Streamable HTTP --> Cloudflare Worker (remote MCP + API)
                                         |        |          |
                                         |        |          +-- Durable Object: one machine relay
                                         |        +------------- D1: users, projects, metadata, audit trail
                                         +---------------------- R2: SVG/raster assets and generated artifacts

Laseryx PWA -- authenticated WebSocket --------------------------------------> machine relay
Laseryx PWA -- user-granted Web Serial --------------------------------------> GRBL engraver
```

### Cloud control plane

One Worker owns the HTTP API and the remote MCP endpoint. It uses OAuth 2.1 and returns a current MCP Streamable HTTP transport. Every request resolves an authenticated user and authorizes access to that user's projects and machines.

Use a Durable Object keyed by `machineId` for online presence and command routing. It holds only ephemeral connection and command state; durable machine metadata and audit records belong in D1. The PWA opens one authenticated WebSocket for each selected machine. The object relays requests and responses between a tool call and that tab. It must use hibernatable WebSockets and persist no critical state solely in memory.

Use D1 for relational data: users, projects, project versions, machines, permissions, approvals, and immutable command audit records. Use R2 for project blobs, imported raster/SVG assets, and exportable G-code artifacts. Project reads and writes go through an application service that enforces ownership and optimistic version checks.

### Application API

Create one TypeScript application-command API that owns schemas, authorization inputs, validation, state transitions, and structured errors. It has three domains:

- `projects`: document, layers, objects, materials, persistence and versioning;
- `cam`: preflight, toolpath generation, preview, and G-code artifacts;
- `machines`: pairing, status, frame, job-start request, pause, resume and abort.

React UI handlers, remote MCP tools, and relay-message handlers are thin adapters over these commands. They may format input/output for their transport but may not contain separate business rules or mutation logic.

Core CAM algorithms and the GRBL driver remain separate from cloud and UI concerns. The browser application service invokes the existing worker/CAM and GRBL driver; the server never imports browser-only code.

## Machine protocol

### Pairing and presence

1. A signed-in user creates or selects a machine in Laseryx.
2. The active tab connects to its machine relay using a short-lived, user-and-machine-scoped token.
3. The tab reports online presence, browser build version, serial connection state, and a sanitized GRBL status snapshot.
4. The MCP tool selects a named online machine. The relay does not silently choose one when several are available.

### Command handling

1. An MCP call is authorized for a user, project, and optional machine.
2. Project/CAM commands run in the cloud application API and return persisted results.
3. A machine command is added to the selected machine's relay with a request ID, actor, expiry, and audit record.
4. The browser tab checks request schema, account/machine binding, expiry, machine connectivity, GRBL state, and safety policy.
5. The tab executes the permitted command and returns an authoritative result and updated status.
6. The Worker stores the final audit outcome and returns it to MCP.

Commands are idempotent by request ID. Browser reconnects must never replay an expired or completed physical command.

### Safety policy

- Read-only status and project inspection: allowed for the authorized account.
- Project edits and CAM generation: allowed for the authorized account; project version conflict returns an explicit conflict.
- Connect/disconnect and framing moves: require the selected browser tab to be online and connected; framing is bounded to the configured bed and uses no laser power.
- Job start: requires a generated, current G-code artifact, a connected `IDLE` machine, preflight success, and an unexpired in-app approval tied to its project version and artifact hash.
- Pause, resume, abort: require online machine control. Abort always takes priority over queued commands.
- The UI visibly shows the selected machine, connection state, and whether a remote agent currently has control.

## Removal and consolidation

Remove or replace these after their replacement path is verified:

- URL/hash command capsules;
- query-string local bridge configuration and polling client;
- local CLI browser bridge server;
- in-memory hosted session broker and HTTP hosted-MCP stack;
- duplicate command dispatch/validation paths and duplicated capability catalogs;
- automation wiring and persistence/machine orchestration currently embedded in `ui/App.tsx`.

The replacement remote MCP service must not carry forward pairing codes, per-session agent tokens, or browser polling. Account identity, selected machine, short-lived relay tokens, and command IDs replace them.

## Migration phases

1. Establish command/domain boundaries and tests without altering existing user behavior. Extract project, CAM, and machine application services from React and existing automation handlers.
2. Add Cloudflare deployment foundation: Worker, OAuth, D1 migrations, R2 asset access, and authenticated project API. Keep IndexedDB as an offline cache with explicit sync/version behavior.
3. Move MCP to the Worker and expose account-scoped project/CAM tools. Verify remote OAuth and data isolation.
4. Add machine records, PWA relay WebSocket, presence, command envelope, audit trail, and read-only live status.
5. Add safe live controls in order: frame, pause/abort, then approval-gated job start. Test with the virtual machine before hardware.
6. Migrate the React UI to the application API and delete all superseded bridge/session/capsule code.

Each phase is independently deployable. The existing local PWA remains usable until cloud sync and its replacement control path have passed acceptance tests.

## Tests and acceptance criteria

- Unit tests cover each command's validation, authorization inputs, idempotency, and structured errors.
- Integration tests cover OAuth-scoped project access, D1/R2 ownership isolation, Durable Object reconnects, offline-machine errors, and command result routing.
- Browser tests cover WebSocket pairing, serial-state validation, approval expiry, UI remote-control indication, and abort precedence.
- Virtual-machine tests cover frame bounds, job start refusal in non-`IDLE` states, pause/resume, and abort.
- A user can sign in on a new device, open a synced project, use a hosted MCP client to edit it, pair a browser tab with a machine, and safely initiate an approved job without any local MCP/bridge setup.

## Out of scope

- Native desktop hardware service;
- multi-user project collaboration and sharing;
- unattended laser operation;
- direct cloud-to-USB connectivity;
- rewriting CAM algorithms or GRBL transport during the architecture cleanup.
