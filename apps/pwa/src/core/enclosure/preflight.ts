export type EnclosureIssue = { code: "INVALID_STOCK" | "MEASURE_REQUIRED" | "OUTSIDE_SHEET" | "PART_OVERLAP" | "COUPON_UNCONFIRMED"; severity: "error" | "warning"; message: string; objectIds?: string[] };
export type EnclosurePreflightInput = { thickness: number; couponConfirmed: boolean; unknownMeasurements: string[]; overflowPartIds: string[]; overlappingPartIds: string[] };

export function preflightEnclosure(input: EnclosurePreflightInput): { ready: boolean; issues: EnclosureIssue[] } {
  const issues: EnclosureIssue[] = [];
  if (!Number.isFinite(input.thickness) || input.thickness <= 0) issues.push({ code: "INVALID_STOCK", severity: "error", message: "Stock thickness must be measured and greater than zero." });
  if (input.unknownMeasurements.length) issues.push({ code: "MEASURE_REQUIRED", severity: "error", message: `Enter measured dimensions for ${input.unknownMeasurements.join(", ")}.`, objectIds: input.unknownMeasurements });
  if (input.overflowPartIds.length) issues.push({ code: "OUTSIDE_SHEET", severity: "error", message: "Some parts do not fit the selected sheet.", objectIds: input.overflowPartIds });
  if (input.overlappingPartIds.length) issues.push({ code: "PART_OVERLAP", severity: "error", message: "Packed parts overlap.", objectIds: input.overlappingPartIds });
  if (!input.couponConfirmed) issues.push({ code: "COUPON_UNCONFIRMED", severity: "warning", message: "Cut and test the fit coupon before the enclosure." });
  return { ready: issues.length === 0, issues };
}
