import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DimPick } from "../../core/sketch/dimension";

/** Fusion-style active sketch tool */
export type SketchToolId =
  | "select"
  | "rect"
  | "circle"
  | "line"
  | "slot"
  | "round-rect"
  | "import"
  /** Smart dimension: pick entities → place dim → type value (Fusion D) */
  | "dimension";

/**
 * Fusion Sketch Dimension session:
 * 1) pick first entity  2) pick second (or re-pick same for length/Ø)
 * 3) move to place dim  4) click place  5) type value in-place on the dim
 */
export type DimSession =
  | { phase: "idle" }
  | { phase: "picked1"; first: DimPick }
  | {
      phase: "place";
      first: DimPick;
      second: DimPick | null;
      measuredMm: number;
      cursor: { x: number; y: number };
    }
  | {
      phase: "edit";
      first: DimPick;
      second: DimPick | null;
      measuredMm: number;
      place: { x: number; y: number };
      draft: string;
    };

/** Double-click an existing dim → edit its value in place (not a separate menu). */
export type DimInlineEdit = {
  constraintId: string;
  draft: string;
  place: { x: number; y: number };
} | null;

type SketchContextValue = {
  tool: SketchToolId;
  setTool: (t: SketchToolId) => void;
  dimSession: DimSession;
  setDimSession: (s: DimSession) => void;
  resetDimSession: () => void;
  dimInlineEdit: DimInlineEdit;
  setDimInlineEdit: (e: DimInlineEdit) => void;
};

const SketchContext = createContext<SketchContextValue | null>(null);

export function SketchProvider({ children }: { children: React.ReactNode }) {
  const [tool, setToolState] = useState<SketchToolId>("select");
  const [dimSession, setDimSession] = useState<DimSession>({ phase: "idle" });
  const [dimInlineEdit, setDimInlineEdit] = useState<DimInlineEdit>(null);
  const resetDimSession = useCallback(() => setDimSession({ phase: "idle" }), []);
  const setTool = useCallback((t: SketchToolId) => {
    setToolState(t);
    if (t !== "dimension") setDimSession({ phase: "idle" });
    // Esc / tool switch cancels any open in-place value editor
    setDimInlineEdit(null);
  }, []);
  const value = useMemo(
    () => ({
      tool,
      setTool,
      dimSession,
      setDimSession,
      resetDimSession,
      dimInlineEdit,
      setDimInlineEdit
    }),
    [tool, setTool, dimSession, resetDimSession, dimInlineEdit]
  );
  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
}

export function useSketchTool() {
  const ctx = useContext(SketchContext);
  if (!ctx) {
    return {
      tool: "select" as SketchToolId,
      setTool: (_t: SketchToolId) => undefined,
      dimSession: { phase: "idle" } as DimSession,
      setDimSession: (_s: DimSession) => undefined,
      resetDimSession: () => undefined,
      dimInlineEdit: null as DimInlineEdit,
      setDimInlineEdit: (_e: DimInlineEdit) => undefined,
      // legacy stubs so old call sites don't crash during hot reload
      dimPick: null,
      setDimPick: (_p: unknown) => undefined,
      clearDimPick: () => undefined
    };
  }
  return {
    ...ctx,
    // legacy aliases
    dimPick: ctx.dimSession.phase === "picked1" ? ctx.dimSession.first : null,
    setDimPick: (p: DimPick | null) => {
      if (!p) ctx.resetDimSession();
      else ctx.setDimSession({ phase: "picked1", first: p });
    },
    clearDimPick: ctx.resetDimSession
  };
}
