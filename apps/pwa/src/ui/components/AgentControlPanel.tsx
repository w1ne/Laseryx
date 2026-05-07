import { useMemo, useState } from "react";
import type { AgentPermission, AgentSessionSnapshot } from "../../automation/session/types";

type AgentControlPanelProps = {
  session: AgentSessionSnapshot;
  onEnable: () => void;
  onDisconnect: () => void;
};

const STATE_LABELS: Record<AgentSessionSnapshot["state"], string> = {
  off: "Off",
  waiting: "Waiting",
  review: "Review",
  connected: "Connected",
  expired: "Expired",
  revoked: "Revoked",
  error: "Error"
};

const PERMISSION_LABELS: Record<AgentPermission, string> = {
  read: "Read",
  edit: "Edit",
  generate: "Generate",
  "project-storage": "Project Storage",
  "machine-control": "Machine Control"
};

function getConnectionLink(sessionId: string | null): string {
  if (!sessionId || typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/agent/session#${encodeURIComponent(sessionId)}`;
}

export function AgentControlPanel({ session, onEnable, onDisconnect }: AgentControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [transportOpen, setTransportOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const statusLabel = STATE_LABELS[session.state];
  const connectionLink = useMemo(() => getConnectionLink(session.sessionId), [session.sessionId]);
  const canDisconnect = session.state !== "off" && session.state !== "revoked";

  const handleCopyConnection = async () => {
    if (!connectionLink) {
      setCopyState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(connectionLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className={`agent-control agent-control--${session.state}`}>
      <button
        type="button"
        className="button agent-control__trigger"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        Agent Control: {statusLabel}
      </button>

      {isOpen && (
        <div className="agent-control__panel" role="dialog" aria-label="Agent Control">
          <div className="agent-control__header">
            <div>
              <p className="agent-control__label">Agent Control</p>
              <strong>{statusLabel}</strong>
            </div>
            <button type="button" className="agent-control__close" aria-label="Close Agent Control" onClick={() => setIsOpen(false)}>
              x
            </button>
          </div>

          {session.state === "off" || session.state === "revoked" || session.state === "expired" ? (
            <button type="button" className="button button--primary agent-control__full-button" onClick={onEnable}>
              Enable Agent Control
            </button>
          ) : null}

          <dl className="agent-control__details">
            <div>
              <dt>Agent</dt>
              <dd>{session.connectedAgentName ?? (session.state === "waiting" ? "Waiting for agent" : "None")}</dd>
            </div>
            <div>
              <dt>Last command</dt>
              <dd>{session.lastCommand?.command ?? "None"}</dd>
            </div>
          </dl>

          <div className="agent-control__permissions" aria-label="Agent permissions">
            {session.permissions.length > 0 ? (
              session.permissions.map((permission) => (
                <span key={permission} className="agent-control__permission">
                  {PERMISSION_LABELS[permission]}
                </span>
              ))
            ) : (
              <span className="agent-control__empty">No permissions</span>
            )}
          </div>

          <div className="agent-control__actions">
            <button type="button" className="button" onClick={handleCopyConnection} disabled={!connectionLink}>
              Copy Link
            </button>
            {canDisconnect ? (
              <button type="button" className="button button--danger" onClick={onDisconnect}>
                Disconnect
              </button>
            ) : null}
          </div>

          <p className="agent-control__copy-status" aria-live="polite">
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Unavailable" : ""}
          </p>

          <button type="button" className="agent-control__transport-toggle" onClick={() => setTransportOpen((open) => !open)}>
            Transport Details
          </button>
          {transportOpen ? (
            <div className="agent-control__transport">
              <span>Same-origin session</span>
              <code>{connectionLink || "/agent/session"}</code>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
