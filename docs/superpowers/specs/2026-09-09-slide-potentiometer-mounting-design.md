# Hackathon Slider and Four-Button Geometry

## Goal

Correct two built-in HESTORE component presets: make the `CDE23N-60-B10K` generate a narrow slider opening plus its chassis mounting holes, and replace the `TACTS-12MOD-4CH` placeholder geometry with the user's measured board and button layout.

## Geometry

### CDE23N-60-B10K

- Keep the primary slot centered on the component origin and aligned with the slider travel.
- Set the editable slot dimensions to 60 mm long by 2 mm wide.
- Add two centered mounting holes, each 3.2 mm in diameter, at `(-40, 0)` and `(40, 0)` millimetres relative to the component origin.
- Keep the existing 88 × 12.5 × 11 mm body envelope.
- Change the mechanical confidence to verified and remove the missing mounting-hole warning.
- Retain a short note that dimensions remain editable for fabrication needs.

### TACTS-12MOD-4CH

- Set the measured board envelope to 86.5 × 20 mm.
- Generate four editable 12 mm-diameter button openings.
- Locate the button centres 12, 33, 53, and 74 mm from the left board edge and on the 10 mm vertical centreline.
- Store those positions relative to the component origin as `x = -31.25, -10.25, 9.75, 30.75 mm` and `y = 0`.
- Do not invent mounting holes: keep mounting-hole positions explicitly missing until measured or sourced.
- Replace the existing placeholder warning with a concise note that the button layout is user-measured and mounting-hole positions remain unknown.

## Data flow

The slider correction belongs only in the reusable HESTORE component definition. Button-row dimensions gain an optional list of explicit centre offsets for real modules whose measured spacing is not perfectly uniform; rows without offsets continue to use count and pitch unchanged. The HESTORE button preset supplies the four measured offsets. Existing component expansion produces the slider slot followed by both mounting-hole circles and produces the four measured button openings. Panel validation, dragging, enclosure generation, sheet layout, save/load, and sharing continue to use the same generic component-mechanics pipeline.

## Verification

- Add a catalog regression test for the exact slot and mounting-hole geometry.
- Add an expansion regression test proving the preset generates one slot and two mounting circles.
- Add regression coverage for the measured four-button diameter, non-uniform button centres, and board envelope.
- Run the focused tests, complete PWA test suite, lint, and production build before integration.

## Source

The dimensional drawing for the CDE23N family shows two M3×0.5 mounting points on 80 mm centres. The vendor specification identifies a 60 mm travel and a 1.2 mm-thick slider blade. The 2 mm opening provides modest clearance without retaining the previous oversized 4 mm cutout.
