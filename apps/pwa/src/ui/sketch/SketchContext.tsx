import React, { createContext, useContext, useMemo, useState } from "react";

/** Fusion-style active sketch tool */
export type SketchToolId =
  | "select"
  | "rect"
  | "circle"
  | "line"
  | "slot"
  | "round-rect"
  | "import";

type SketchContextValue = {
  tool: SketchToolId;
  setTool: (t: SketchToolId) => void;
};

const SketchContext = createContext<SketchContextValue | null>(null);

export function SketchProvider({ children }: { children: React.ReactNode }) {
  const [tool, setTool] = useState<SketchToolId>("select");
  const value = useMemo(() => ({ tool, setTool }), [tool]);
  return <SketchContext.Provider value={value}>{children}</SketchContext.Provider>;
}

export function useSketchTool() {
  const ctx = useContext(SketchContext);
  // Fallback for tests that render App without provider
  if (!ctx) {
    return {
      tool: "select" as SketchToolId,
      setTool: (_t: SketchToolId) => undefined
    };
  }
  return ctx;
}
