import { describe, expect, it } from "vitest";
import minimalJob from "../fixtures/minimal-job.json";
import { AUTOMATION_PROTOCOL_VERSION } from "../protocol/types";
import type { AgentJobInput } from "../types";
import { createInAppAutomationBridge } from "./inAppBridge";
import { readLocalBridgeConfig, runLocalBridgePollOnce } from "./localBridgeClient";

const job = minimalJob as AgentJobInput;

describe("localBridgeClient", () => {
  it("fetches one command and posts its protocol response", async () => {
    const posted: unknown[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      if (url.includes("/next")) {
        return new Response(JSON.stringify({
          protocolVersion: AUTOMATION_PROTOCOL_VERSION,
          requestId: "req-1",
          command: "inspect",
          args: {}
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/response")) {
        posted.push(JSON.parse(String(init?.body)));
        return new Response("{}", { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const didWork = await runLocalBridgePollOnce({
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      bridge: createInAppAutomationBridge(() => job),
      fetchImpl
    });

    expect(didWork).toBe(true);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      protocolVersion: AUTOMATION_PROTOCOL_VERSION,
      requestId: "req-1",
      ok: true,
      command: "inspect"
    });
  });

  it("returns false when the broker has no pending command", async () => {
    const didWork = await runLocalBridgePollOnce({
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev",
      bridge: createInAppAutomationBridge(() => job),
      fetchImpl: async () => new Response(null, { status: 204 })
    });

    expect(didWork).toBe(false);
  });

  it("reads bridge settings from URL search params", () => {
    expect(readLocalBridgeConfig("?laseryxBridge=http%3A%2F%2F127.0.0.1%3A17321&laseryxToken=dev")).toEqual({
      bridgeUrl: "http://127.0.0.1:17321",
      token: "dev"
    });
  });

  it("returns null when URL search params do not opt in", () => {
    expect(readLocalBridgeConfig("?x=1")).toBeNull();
  });
});
