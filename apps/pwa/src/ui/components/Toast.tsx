import React, { useEffect } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    onDismiss: (id: string) => void;
}

const TOAST_STYLES = {
    success: {
        background: "#10b981",
        icon: "✓"
    },
    error: {
        background: "#ef4444",
        icon: "✕"
    },
    info: {
        background: "#3b82f6",
        icon: "ℹ"
    },
    warning: {
        background: "#f59e0b",
        icon: "⚠"
    }
};

export function Toast({ id, type, message, duration = 3000, onDismiss }: ToastProps) {
    const style = TOAST_STYLES[type];

    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(id);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onDismiss]);

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                background: style.background,
                color: "#fff",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                minWidth: "300px",
                maxWidth: "500px",
                animation: "slideIn 0.3s ease-out",
                marginBottom: "8px"
            }}
        >
            <div style={{ fontSize: "18px", fontWeight: "bold" }}>{style.icon}</div>
            <div style={{ flex: 1, fontSize: "14px", lineHeight: "1.4" }}>{message}</div>
            <button
                type="button"
                title="Dismiss this notification"
                onClick={() => onDismiss(id)}
                style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "18px",
                    padding: "0",
                    opacity: 0.7,
                    transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
            >
                ×
            </button>
        </div>
    );
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastProps[]; onDismiss: (id: string) => void }) {
    return (
        <>
            <style>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
            <div
                style={{
                    position: "fixed",
                    top: "20px",
                    right: "20px",
                    zIndex: 9999,
                    display: "flex",
                    flexDirection: "column"
                }}
            >
                {toasts.slice(0, 3).map((toast) => (
                    <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
                ))}
            </div>
        </>
    );
}
