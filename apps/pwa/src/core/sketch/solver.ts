import { cloneSketch } from "./create";
import { evaluateResiduals, residualNorm } from "./residuals";
import type { SketchDocument, SolveResult, SolveStatus } from "./types";

type VarRef =
  | { kind: "point"; id: string; axis: "x" | "y" }
  | { kind: "radius"; id: string };

const EPS = 1e-7;
const MAX_ITER = 40;
const TOL = 1e-6;

/** Points pinned by fix constraints (not free variables). */
function fixedPointIds(sketch: SketchDocument): Set<string> {
  const s = new Set<string>();
  for (const c of Object.values(sketch.constraints)) {
    if (c.type === "fix") s.add(c.pointId);
  }
  return s;
}

/**
 * Build free variable list.
 * Circle radii are free unless a diameter/radius constraint drives them
 * (still free vars — residuals pull them).
 */
export function collectVariables(sketch: SketchDocument): VarRef[] {
  const fixed = fixedPointIds(sketch);
  const vars: VarRef[] = [];
  for (const p of Object.values(sketch.points)) {
    if (fixed.has(p.id)) continue;
    vars.push({ kind: "point", id: p.id, axis: "x" });
    vars.push({ kind: "point", id: p.id, axis: "y" });
  }
  for (const e of Object.values(sketch.entities)) {
    if (e.kind === "circle") {
      vars.push({ kind: "radius", id: e.id });
    }
  }
  return vars;
}

function readVar(sketch: SketchDocument, v: VarRef): number {
  if (v.kind === "point") {
    return sketch.points[v.id][v.axis];
  }
  const e = sketch.entities[v.id];
  return e && e.kind === "circle" ? e.r : 0;
}

function writeVar(sketch: SketchDocument, v: VarRef, value: number): void {
  if (v.kind === "point") {
    const p = sketch.points[v.id];
    if (!p) return;
    if (v.axis === "x") p.x = value;
    else p.y = value;
    return;
  }
  const e = sketch.entities[v.id];
  if (e && e.kind === "circle") {
    e.r = Math.max(0.05, value);
  }
}

function applyVars(sketch: SketchDocument, vars: VarRef[], values: number[]): SketchDocument {
  const s = cloneSketch(sketch);
  for (let i = 0; i < vars.length; i++) {
    writeVar(s, vars[i], values[i]);
  }
  return s;
}

function readVars(sketch: SketchDocument, vars: VarRef[]): number[] {
  return vars.map((v) => readVar(sketch, v));
}

/** Finite-difference Jacobian: J[i][j] = d residual_i / d var_j */
function jacobian(sketch: SketchDocument, vars: VarRef[], baseR: number[]): number[][] {
  const n = baseR.length;
  const m = vars.length;
  const J: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  const x0 = readVars(sketch, vars);

  for (let j = 0; j < m; j++) {
    const xPert = x0.slice();
    const step = EPS * (1 + Math.abs(x0[j]));
    xPert[j] += step;
    const s2 = applyVars(sketch, vars, xPert);
    const r2 = evaluateResiduals(s2);
    for (let i = 0; i < n; i++) {
      J[i][j] = ((r2[i] ?? 0) - (baseR[i] ?? 0)) / step;
    }
  }
  return J;
}

/**
 * Solve A x = b for small dense systems via Gaussian elimination with partial pivot.
 * A is m×m, b is m.
 */
function solveLinear(Ain: number[][], bin: number[]): number[] | null {
  const n = bin.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let max = Math.abs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r][col]);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max < 1e-14) return null;
    if (pivot !== col) {
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [b[col], b[pivot]] = [b[pivot], b[col]];
    }
    const div = A[col][col];
    for (let c = col; c < n; c++) A[col][c] /= div;
    b[col] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  return b;
}

/**
 * Damped Gauss–Newton: solve (JᵀJ + λI) δ = -Jᵀr
 */
export function solveSketch(
  input: SketchDocument,
  opts?: { maxIter?: number; tol?: number }
): SolveResult {
  let sketch = cloneSketch(input);
  const maxIter = opts?.maxIter ?? MAX_ITER;
  const tol = opts?.tol ?? TOL;
  const vars = collectVariables(sketch);
  let residuals = evaluateResiduals(sketch);
  let bestNorm = residualNorm(residuals);
  let lambda = 1e-3;
  let iterations = 0;

  if (vars.length === 0) {
    const status: SolveStatus = {
      ok: bestNorm < tol,
      iterations: 0,
      residual: bestNorm,
      dof: -residuals.length,
      message: residuals.length ? "no free variables" : "empty"
    };
    return { sketch, status };
  }

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    residuals = evaluateResiduals(sketch);
    const norm = residualNorm(residuals);
    if (norm < tol) {
      return {
        sketch,
        status: {
          ok: true,
          iterations,
          residual: norm,
          dof: vars.length - residuals.length
        }
      };
    }

    const J = jacobian(sketch, vars, residuals);
    const m = vars.length;
    const n = residuals.length;

    // JtJ (m×m) and -Jt r
    const JtJ: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    const g = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        g[j] -= J[i][j] * residuals[i];
        for (let k = 0; k < m; k++) {
          JtJ[j][k] += J[i][j] * J[i][k];
        }
      }
    }
    for (let j = 0; j < m; j++) {
      JtJ[j][j] += lambda;
    }

    const delta = solveLinear(JtJ, g);
    if (!delta) {
      lambda *= 10;
      continue;
    }

    const x0 = readVars(sketch, vars);
    const x1 = x0.map((v, i) => v + delta[i]);
    const trial = applyVars(sketch, vars, x1);
    const trialR = evaluateResiduals(trial);
    const trialNorm = residualNorm(trialR);

    if (trialNorm < norm) {
      sketch = trial;
      bestNorm = trialNorm;
      lambda = Math.max(lambda * 0.3, 1e-9);
    } else {
      lambda *= 8;
      if (lambda > 1e8) break;
    }
  }

  residuals = evaluateResiduals(sketch);
  bestNorm = residualNorm(residuals);
  return {
    sketch,
    status: {
      ok: bestNorm < tol * 10,
      iterations,
      residual: bestNorm,
      dof: vars.length - residuals.length,
      message: bestNorm < tol * 10 ? undefined : "did not fully converge"
    }
  };
}

/** Convenience: solve in place and return status. */
export function solveInPlace(sketch: SketchDocument): SolveStatus {
  const r = solveSketch(sketch);
  // mutate caller's structure to match solved
  sketch.points = r.sketch.points;
  sketch.entities = r.sketch.entities;
  return r.status;
}
