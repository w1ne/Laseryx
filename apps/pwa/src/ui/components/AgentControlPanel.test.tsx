import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AgentSessionSnapshot } from "../../automation/session/types";
import { AgentControlPanel } from "./AgentControlPanel";

const offSession: AgentSessionSnapshot = {
  sessionId: null,
  state: "off",
  permissions: [],
  expiresAt: null,
  connectedAgentName: null,
  lastCommand: null
};

const connectedSession: AgentSessionSnapshot = {
  sessionId: "session-1",
  state: "connected",
  permissions: ["read", "edit", "generate"],
  expiresAt: "2026-05-08T10:00:00.000Z",
  connectedAgentName: "Codex",
  lastCommand: {
    requestId: "req-1",
    command: "document.addRect",
    ok: true,
    startedAt: "2026-05-08T09:00:00.000Z",
    completedAt: "2026-05-08T09:00:01.000Z"
  }
};

function renderPanel(
  session: AgentSessionSnapshot,
  props: Partial<ComponentProps<typeof AgentControlPanel>> = {}
) {
  return render(
    <AgentControlPanel
      session={session}
      connectionLink={session.sessionId ? `${window.location.origin}/agent/session#${session.sessionId}` : ""}
      copyState="idle"
      onEnable={vi.fn()}
      onDisconnect={vi.fn()}
      onCopyConnection={vi.fn()}
      {...props}
    />
  );
}

describe("AgentControlPanel", () => {
  it("renders a compact off-state enable control", () => {
    renderPanel(offSession);

    const button = screen.getByRole("button", { name: "Enable Agent Control" });
    expect(button).toBeInTheDocument();
  });

  it("shows permissions, connected agent, last command, and disconnect", () => {
    const onDisconnect = vi.fn();
    renderPanel(connectedSession, { onDisconnect });

    fireEvent.click(screen.getByRole("button", { name: "Agent Control: Connected" }));

    const panel = screen.getByRole("dialog", { name: "Agent Control" });
    expect(within(panel).getByText("Codex")).toBeInTheDocument();
    expect(within(panel).getByText("Read")).toBeInTheDocument();
    expect(within(panel).getByText("Edit")).toBeInTheDocument();
    expect(within(panel).getByText("Generate")).toBeInTheDocument();
    expect(within(panel).getByText("document.addRect")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Disconnect" }));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("enables a waiting session from the panel", () => {
    const onEnable = vi.fn();
    renderPanel(offSession, { onEnable });

    fireEvent.click(screen.getByRole("button", { name: "Enable Agent Control" }));

    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("opens the panel immediately after enabling from off state", () => {
    renderPanel(offSession);

    fireEvent.click(screen.getByRole("button", { name: "Enable Agent Control" }));

    expect(screen.getByRole("dialog", { name: "Agent Control" })).toBeInTheDocument();
  });

  it("copies the same-origin connection link for active sessions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    renderPanel(connectedSession, { copyState: "copied", onCopyConnection: writeText });

    fireEvent.click(screen.getByRole("button", { name: "Agent Control: Connected" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));

    expect(writeText).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
  });
});
