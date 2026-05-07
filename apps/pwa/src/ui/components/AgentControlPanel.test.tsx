import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("AgentControlPanel", () => {
  it("renders a compact off-state control", () => {
    render(<AgentControlPanel session={offSession} onEnable={vi.fn()} onDisconnect={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Agent Control: Off" });
    expect(button).toBeInTheDocument();
  });

  it("shows permissions, connected agent, last command, and disconnect", () => {
    const onDisconnect = vi.fn();
    render(<AgentControlPanel session={connectedSession} onEnable={vi.fn()} onDisconnect={onDisconnect} />);

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
    render(<AgentControlPanel session={offSession} onEnable={onEnable} onDisconnect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Agent Control: Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable Agent Control" }));

    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it("copies the same-origin connection link for active sessions", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<AgentControlPanel session={connectedSession} onEnable={vi.fn()} onDisconnect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Agent Control: Connected" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/agent/session#session-1`);
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
  });
});
