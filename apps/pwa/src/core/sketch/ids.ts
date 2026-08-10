let seq = 0;

export function sketchId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

/** Test helper — reset monotonic counter. */
export function resetSketchIdSeq(): void {
  seq = 0;
}
