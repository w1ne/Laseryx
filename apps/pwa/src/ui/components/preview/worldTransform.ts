import type { MachineProfile } from "../../../core/model";

/**
 * Machine / laser convention (default frontLeft):
 * - Origin at front-left of bed
 * - +X to the right
 * - +Y toward the rear (up on screen)
 *
 * SVG viewBox is Y-down; we map machine → SVG with a flip for front* origins
 * so (0,0) sits in the lower-left corner and we measure “up” into the bed.
 */
export function machineWorldTransform(
  bedH: number,
  origin: MachineProfile["origin"] = "frontLeft"
): string | undefined {
  // front* → origin bottom of view (Y up on screen)
  if (origin === "frontLeft") {
    return `matrix(1 0 0 -1 0 ${bedH})`;
  }
  if (origin === "frontRight") {
    // origin bottom-right: flip both axes
    return `matrix(-1 0 0 -1 ${/* bedW set by caller */ 0} ${bedH})`;
  }
  // rearLeft: SVG native (0,0) top-left matches origin — no transform
  // rearRight: would flip X only
  if (origin === "rearRight") {
    return undefined; // bedW needed; handled below
  }
  return undefined;
}

export function machineWorldTransformForProfile(
  bed: { w: number; h: number },
  origin: MachineProfile["origin"] = "frontLeft"
): string | undefined {
  if (origin === "frontLeft") {
    return `matrix(1 0 0 -1 0 ${bed.h})`;
  }
  if (origin === "frontRight") {
    return `matrix(-1 0 0 -1 ${bed.w} ${bed.h})`;
  }
  if (origin === "rearRight") {
    return `matrix(-1 0 0 1 ${bed.w} 0)`;
  }
  // rearLeft — native SVG top-left
  return undefined;
}

/** True when the world group is Y-flipped (text needs counter-scale). */
export function worldIsYFlipped(origin: MachineProfile["origin"] = "frontLeft"): boolean {
  return origin === "frontLeft" || origin === "frontRight";
}
