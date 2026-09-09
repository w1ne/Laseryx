# Direct Project Sharing Design

## Goal

Hackathon participants can send a normal Laserix link containing an editable fabrication project. Opening the link lets the recipient review, edit, save, arrange, and laser-cut the same design without an account or sharing server.

## Scope

The share link includes:

- document geometry and layers;
- sketch data and constraints;
- component presets and placed component instances;
- source panel and generated enclosure;
- sheet arrangement;
- CAM operations and cutting settings required to reproduce the job.

The link excludes machine profiles, machine connection state, agent sessions, locally saved project metadata, and other device-specific settings.

The first release supports vector and enclosure projects only. A project containing raster image objects cannot be shared by URL and produces a clear error before the clipboard is changed.

## Link Format

Shared state is stored in the URL fragment so it is not sent to the web host:

```text
https://laseryx.com/#share=<capsule>
```

The capsule contains a format version, compressed project payload, and integrity checksum. Encoding is deterministic: identical supported project state produces identical capsule content. The decoder rejects malformed data, failed checksums, excessive decoded size, unsupported versions, and invalid project schemas.

The format is independent from IndexedDB records so opening a link does not require or overwrite a local project ID.

## Share Flow

The main project controls provide a **Share link** action.

1. Build a share payload from the current document and CAM settings.
2. Reject unsupported raster assets or an unsafe payload size with a concise explanation.
3. Encode and compress the payload.
4. Copy the complete canonical URL to the clipboard.
5. Confirm that the link was copied and show its approximate length.

Sharing does not save, rename, or otherwise mutate the project.

## Open Flow

On application startup, Laserix detects `#share=` and decodes it without modifying current state. A confirmation dialog summarizes the shared design and asks **Open shared design?**

- Confirming replaces the in-memory document and CAM settings with the shared payload, clears selection, and removes the share fragment from browser history.
- Cancelling keeps the current project unchanged and removes the share fragment.
- The opened design is not silently written into IndexedDB. Saving it uses the normal save flow and creates a local project.
- Decode or validation errors show a concise error and leave the current project unchanged.

## Compatibility and Safety

- The initial capsule version is `1`.
- Decoding passes through the same document and enclosure sanitization boundaries used by project import.
- Strict compressed and decompressed size limits prevent a link from allocating unbounded memory.
- No decoded content is executed or interpreted as HTML.
- Unknown future capsule versions fail with an upgrade message.
- Machine profiles and machine-control state can never be activated by a shared link.

## Testing

Automated tests cover:

- deterministic encode/decode round trips for document, enclosure, sheet layout, and CAM settings;
- exclusion of local machine and connection state;
- rejection of raster projects;
- checksum, malformed-input, unsupported-version, and size-limit failures;
- Share link clipboard behavior without project mutation;
- confirmation before replacing current work;
- cancel and error paths preserving current work;
- removal of the share fragment after either decision;
- saving an opened shared design as a normal local project.

An integration test will create a component panel, generate six box faces, arrange sheets, share it, open the link in a fresh store, and assert that the editable fabrication state round-trips exactly.
