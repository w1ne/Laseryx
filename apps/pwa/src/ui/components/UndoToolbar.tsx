import React from "react";
import { useStore } from "../../core/state/store";
import { canUndo, canRedo } from "../../core/state/history";

export function UndoToolbar() {
    const { state, dispatch } = useStore();
    const { history } = state;

    return (
        <div className="undo-toolbar" style={{ display: "flex", gap: "4px" }}>
            <button
                className="button button--icon"
                title="Undo last change (⌘/Ctrl+Z)"
                disabled={!canUndo(history)}
                onClick={() => dispatch({ type: "UNDO" })}
                style={{
                    padding: "4px 8px",
                    minHeight: "auto",
                    fontSize: "12px",
                    background: !canUndo(history) ? "transparent" : "#fff",
                    color: !canUndo(history) ? "#999" : "#333",
                    border: "1px solid #ddd",
                    opacity: !canUndo(history) ? 0.5 : 1
                }}
            >
                ↩ Undo
            </button>
            <button
                className="button button--icon"
                title="Redo (⌘/Ctrl+Y or ⌘/Ctrl+Shift+Z)"
                disabled={!canRedo(history)}
                onClick={() => dispatch({ type: "REDO" })}
                style={{
                    padding: "4px 8px",
                    minHeight: "auto",
                    fontSize: "12px",
                    background: !canRedo(history) ? "transparent" : "#fff",
                    color: !canRedo(history) ? "#999" : "#333",
                    border: "1px solid #ddd",
                    opacity: !canRedo(history) ? 0.5 : 1
                }}
            >
                ↪ Redo
            </button>
        </div>
    );
}
