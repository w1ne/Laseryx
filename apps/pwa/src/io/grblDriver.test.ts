import { describe, expect, it } from "vitest";
import { createSimulatedGrblDriver } from "./grblDriver";

describe("Simulated GRBL driver", () => {
  it("streams in ack mode and resolves", async () => {
    const driver = createSimulatedGrblDriver();
    await driver.connect();

    const handle = driver.streamJob("G0 X0 Y0\nG1 X10 Y10", "ack");
    await expect(handle.done).resolves.toBeUndefined();

    expect(driver.getSentLines()).toEqual(["G0 X0 Y0", "G1 X10 Y10"]);
  });

  it("rejects on error response", async () => {
    const driver = createSimulatedGrblDriver({
      ackQueue: [{ ok: true }, { ok: false, error: "error:20" }]
    });
    await driver.connect();

    const handle = driver.streamJob("G0 X0 Y0\nG1 X10 Y10", "ack");
    await expect(handle.done).rejects.toThrow("error:20");
  });

  it("aborts an active stream", async () => {
    const driver = createSimulatedGrblDriver({ responseDelayMs: 20 });
    await driver.connect();

    const handle = driver.streamJob("G0 X0 Y0\nG1 X10 Y10\nG1 X20 Y20", "ack");
    await driver.abort();

    await expect(handle.done).rejects.toThrow("Stream aborted");
  });

  it("returns response lines for manual commands", async () => {
    const driver = createSimulatedGrblDriver({
      ackQueue: [{ ok: true, lines: ["$0=10", "$1=25"] }]
    });
    await driver.connect();

    const ack = await driver.sendLine("$$");

    expect(ack.ok).toBe(true);
    expect(ack.lines).toEqual(["$0=10", "$1=25"]);
  });
});
