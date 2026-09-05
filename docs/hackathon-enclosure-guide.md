# Components and box workflow

Use **Design → Objects → Components & Box** to turn a panel design into a sheet-ready enclosure. The intended journey is **Components → Panel → Make Box → Sheets → Cut**.

## 1. Create the panel and component presets

1. Select **Create panel**, enter the panel width and height in millimetres, and select **Save panel**. This panel is the exact source face for the box, not a disposable sketch.
2. Select **Add component** and create a reusable primitive preset. Choose **Circle**, **Slot**, **Rectangle**, **Rounded rectangle**, or **Button row**, name it, and enter the measured dimensions. A button row requires its button count, diameter, and centre-to-centre pitch.
3. Select **Save component** to save the preset and place an instance on the source panel. Saved presets can be placed again from **Saved presets**.
4. Measure real hardware with appropriate tools before entering dimensions. **Example presets** contains only bundled examples such as a mounting hole and cable slot; they are starting points, not verified dimensions for any particular hardware.

Component instances belong to the source panel. Their transforms are panel-local, so their positions and cutouts travel with that face. Keep every cutout inside the panel and clear of other cutouts and the finger-joint recess zone. Editing the panel or adding a component invalidates previously generated faces and sheet layout; run **Make box** again after finishing the panel.

## 2. Make the box

1. Select **Make box**.
2. Enter **Front height** and **Rear height**. The displayed **Depth** is read-only: Laseryx derives it from the exact source-panel height and the difference between the front and rear heights. The height difference must be smaller than the source-panel height.
3. Open **Advanced** to set **Stock thickness**, **Fit clearance**, **Finger target**, **Sheet width**, **Sheet height**, **Sheet margin**, **Part gap**, **Sheet orientation**, and **Include fit coupon**.
4. Select **Generate box**.

Laseryx generates all six finger-jointed faces: the exact source panel, rear, left, right, base, and removable service panel. The source face preserves all of its component cutouts. The other five faces are derived from the source-panel dimensions and the box settings.

Generation resets coupon confirmation. If a generated part is unchanged and its existing manual sheet placement is still valid, regeneration preserves that placement; changed, removed, colliding, or out-of-bounds parts become unplaced. Selecting **Arrange sheets** is an explicit repack and replaces manual placements with a deterministic layout.

## 3. Arrange sheets and test fit

Select **Arrange sheets** after generation. The default 210 × 148 mm sheet size is A5 with a 3 mm inter-part gap; change the dimensions, gap, and orientation under **Advanced** when the physical stock differs. Laseryx lays out the faces across as many sheets as required and reports any face that does not fit.

Sheet boundaries remain visible on the canvas as construction geometry in the **Sheet boundaries** layer. They are guides and are excluded from cutting. Generated faces and the optional coupon remain normal workflow-owned canvas objects.

For a new material, thickness, machine setup, or fit target:

1. Enable **Include fit coupon**, generate the box, and arrange the sheets.
2. Cut the coupon first using the same stock, grain direction, focus, power, speed, and relevant setup as the enclosure.
3. Physically test the five labelled clearances: 0.05, 0.10, 0.15, 0.20, and 0.25 mm.
4. Enter the selected clearance, regenerate and arrange as needed, then select **Confirm fit coupon** only after testing the physical coupon.

## 4. Preflight and cut

The **Fabrication readiness** status must say **Ready to cut** before proceeding. Preflight checks the stored geometry and workflow state, including panel/component validity, joint feasibility, closed and non-self-intersecting contours, fresh generated faces, complete non-overlapping in-bounds placement, configured stock/bed constraints when available, and confirmation of an included coupon.

Then open **Operations**, assign the appropriate cut settings, generate the toolpath, inspect the preview, and proceed one physical sheet at a time.

**Physical release gate:** software preflight does not measure actual kerf, validate the coupon result, or verify dry assembly. Do not tag, publish, or otherwise release a fabrication result until a coupon has been cut and tested in the actual process and the enclosure has been physically dry-assembled before electronics are installed.
