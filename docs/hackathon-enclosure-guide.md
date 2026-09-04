# Hackathon enclosure workflow

Open **Objects → ⚡ Hackathon enclosure**. The kit lists the seven HESTORE parts purchased for the Budapest hardware hackathon.

1. Place the display, encoder, toggle switch, and slider. Internal wiring and the microphone are labeled **Internal** because they need no panel cutout by default.
2. Measure the TACTS-12MOD-4CH button cap diameter and center-to-center pitch with calipers, enter both values, then place it. Laseryx deliberately blocks this part until real measurements are supplied.
3. Enter the enclosure width, depth, front and rear heights, actual stock thickness, and desired fit clearance. The defaults create a sloped 160 × 95 mm desktop console in 3 mm sheet.
4. Select **Generate enclosure + A5 layout**. Laseryx creates six finger-jointed parts, a five-clearance fit coupon, and lays them out over as many 210 × 148 mm sheets as required. Every generated contour remains a normal movable/editable canvas object.
5. Cut the coupon first. Test the 0.05, 0.10, 0.15, 0.20, and 0.25 mm clearances in the actual sheet, grain direction, focus, power, and speed that the enclosure will use.
6. Enter the winning clearance, regenerate, and only then check **I cut the coupon and confirmed the selected fit**. The geometry preflight will stay blocked for invalid stock, missing measurements, sheet overflow, overlap, or an unconfirmed coupon.
7. In **Operations**, apply the 3 mm plywood preset, generate the toolpath, inspect Preview, and export/cut one sheet at a time.

Do a dry assembly before mounting electronics. The software validates deterministic geometry and sheet fit; the coupon validates physical kerf and material behavior that software cannot measure.
