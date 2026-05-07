import { describe, expect, it } from "vitest";
import { createMcpLineProcessor } from "./stdio";

describe("mcp stdio processor", () => {
  it("writes responses in input order even when later requests finish first", async () => {
    const writes: string[] = [];
    const processor = createMcpLineProcessor(
      async (request) => {
        const id = typeof request === "object" && request !== null && "id" in request ? request.id : null;
        if (id === "slow") {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return { jsonrpc: "2.0", id, result: { id } };
      },
      (line) => writes.push(line)
    );

    processor.enqueue("{\"jsonrpc\":\"2.0\",\"id\":\"slow\",\"method\":\"tools/call\"}");
    processor.enqueue("{\"jsonrpc\":\"2.0\",\"id\":\"fast\",\"method\":\"tools/call\"}");
    await processor.drain();

    expect(writes.map((line) => JSON.parse(line).id)).toEqual(["slow", "fast"]);
  });

  it("continues processing after an unexpected handler error", async () => {
    const writes: string[] = [];
    const processor = createMcpLineProcessor(
      async (request) => {
        const id = typeof request === "object" && request !== null && "id" in request ? request.id : null;
        if (id === "boom") {
          throw new Error("handler failed");
        }
        return { jsonrpc: "2.0", id, result: { ok: true } };
      },
      (line) => writes.push(line)
    );

    processor.enqueue("{\"jsonrpc\":\"2.0\",\"id\":\"boom\",\"method\":\"tools/call\"}");
    processor.enqueue("{\"jsonrpc\":\"2.0\",\"id\":\"after\",\"method\":\"tools/call\"}");
    await processor.drain();

    expect(JSON.parse(writes[0])).toMatchObject({
      id: "boom",
      error: { code: -32603, message: "handler failed" }
    });
    expect(JSON.parse(writes[1])).toMatchObject({
      id: "after",
      result: { ok: true }
    });
  });
});
