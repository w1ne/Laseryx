import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_HOSTED_AGENT_PERMISSIONS } from "../../automation/session/types";
import { useAgentSessionController } from "./useAgentSessionController";

describe("useAgentSessionController", () => {
  it("starts off with no connection link", () => {
    const { result } = renderHook(() => useAgentSessionController({ origin: "https://laseryx.test" }));

    expect(result.current.session.state).toBe("off");
    expect(result.current.session.sessionId).toBeNull();
    expect(result.current.connectionLink).toBe("");
  });

  it("enables a waiting session with default hosted permissions and a same-origin link", () => {
    const { result } = renderHook(() =>
      useAgentSessionController({
        origin: "https://laseryx.test",
        createSessionId: () => "session-1"
      })
    );

    act(() => result.current.enableAgentControl());

    expect(result.current.session).toMatchObject({
      sessionId: "session-1",
      state: "waiting",
      permissions: DEFAULT_HOSTED_AGENT_PERMISSIONS,
      connectedAgentName: null,
      lastCommand: null
    });
    expect(result.current.connectionLink).toBe("https://laseryx.test/agent/session#session-1");
  });

  it("revokes the active session and allows starting a new one", () => {
    const ids = ["session-1", "session-2"];
    const { result } = renderHook(() =>
      useAgentSessionController({
        origin: "https://laseryx.test",
        createSessionId: () => ids.shift() ?? "fallback"
      })
    );

    act(() => result.current.enableAgentControl());
    act(() => result.current.disconnectAgentControl());

    expect(result.current.session.state).toBe("revoked");
    expect(result.current.connectionLink).toBe("https://laseryx.test/agent/session#session-1");

    act(() => result.current.enableAgentControl());

    expect(result.current.session.state).toBe("waiting");
    expect(result.current.session.sessionId).toBe("session-2");
    expect(result.current.connectionLink).toBe("https://laseryx.test/agent/session#session-2");
  });

  it("copies the active connection link and reports unavailable without a session", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAgentSessionController({
        origin: "https://laseryx.test",
        createSessionId: () => "session-1",
        clipboard: { writeText }
      })
    );

    await act(async () => {
      await result.current.copyConnectionLink();
    });
    expect(result.current.copyState).toBe("failed");
    expect(writeText).not.toHaveBeenCalled();

    act(() => result.current.enableAgentControl());
    await act(async () => {
      await result.current.copyConnectionLink();
    });

    expect(writeText).toHaveBeenCalledWith("https://laseryx.test/agent/session#session-1");
    expect(result.current.copyState).toBe("copied");
  });
});
