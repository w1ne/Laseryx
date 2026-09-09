# Hackathon workflow verification

Date: 2026-09-09. Baseline: `origin/main` at `6edd0aa`.
Fixes: local branch `test/hackathon-box-e2e` in this worktree; not deployed.

## Findings and fixes

- The deployed site generated a six-face, three-sheet box and shared its editable document correctly, but generated zero cutting segments. The box layer had no operation and was hidden from Operations. Unassigned geometry layers now offer **Add cut operation**, and missing operations or empty jobs block generation.
- The overview places physical sheets next to each other. Generating that overview is not a per-sheet cutting job. Operations now selects one **Cut sheet**, and its geometry is translated to the physical sheet origin. Full multi-sheet documents cannot be passed directly to G-code generation without selecting a sheet.
- Generated jobs remained usable after their design inputs changed. Download, preview, and Start Job now use G-code only when its document, operations, machine profile, and selected sheet match the generation inputs.
- Reopening a shared URL after cancelling it in the same tab did not reopen the review dialog. Shared designs now respond to hash changes.

## Executed checks

| Check | Result |
| --- | --- |
| Live-site generation and share round trip | Six faces, three sheets; document and operations preserved |
| Live-site cutting | Failed: zero cutting segments; baseline evidence retained |
| Fixed desktop workflow | Passed in separate creator and operator browser contexts |
| Sheet exports | Three files: 228, 271, and 162 lines; all motion coordinates within 210 x 148 mm stock |
| Geometry regression | Each face and optional coupon exported exactly once; construction guides excluded |
| Invalid enclosure and missing operation checks | Rejected |
| Virtual GRBL | Connected, streamed to completion, paused/resumed, and aborted |
| Edit after generation | Download and Start Job disabled |
| Mobile, 390 x 844 | Cancel, reopen, generate, and download enabled; no horizontal page overflow |
| Browser runtime errors | None in final workflow |
| Automated suite | 604 tests passed; 21 affected UI tests passed again after final sharing fix |
| Build and lint | Passed; 11 existing lint warnings |

Run the browser test from the repository root:

```bash
node apps/pwa/scripts/test-hackathon.mjs http://127.0.0.1:5184/ /tmp/laseryx-hackathon-fixed
```

Evidence is in `/tmp/laseryx-hackathon` (deployed baseline) and
`/tmp/laseryx-hackathon-fixed` (fixed build): JSON reports, screenshots, shared
URLs, the received job, and generated G-code. These G-code files use test
settings; physical material settings were not established.

## Remaining physical verification

No USB serial device was exposed at `/dev/serial/by-id` on this computer.
No physical motion, laser emission, material cut, or assembly fit was tested.

1. Make the fixed build available on the cutter-connected computer.
2. Open the participant's share link, select the real machine profile, and connect through Web Serial.
3. Set speed, power, passes, origin, and material thickness for the actual laser and stock.
4. Cut and physically test a fit coupon, then use the selected clearance to regenerate the enclosure.
5. Generate and inspect each selected sheet, cut one sheet at a time, and dry-assemble all six faces.

The public deployment remains unmodified and still has the baseline blockers.
