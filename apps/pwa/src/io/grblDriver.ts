import { serial as polyfillSerial } from "web-serial-polyfill";
export type StatusState = "IDLE" | "RUN" | "HOLD" | "ALARM" | "UNKNOWN";

export type Position = {
  x: number;
  y: number;
  z: number;
};

export type StatusSnapshot = {
  state: StatusState;
  wpos?: Position;
  mpos?: Position;
};

export type Ack = {
  ok: boolean;
  error?: string;
  lines?: string[];
};

export type StreamMode = "ack" | "buffered";

export type StreamHandle = {
  done: Promise<void>;
  abort: () => Promise<void>;
};

export type GrblDriver = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isConnected: () => boolean;
  getStatus: () => Promise<StatusSnapshot>;
  sendLine: (line: string) => Promise<Ack>;
  streamJob: (gcode: string, mode: StreamMode) => StreamHandle;
  abort: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

export type SimulatedGrblDriver = GrblDriver & {
  getSentLines: () => string[];
  pushAck: (ack: Ack) => void;
  setStatus: (state: StatusState) => void;
};

type WebSerialOptions = {
  baudRate?: number;
};

type SimulatedOptions = {
  initialState?: StatusState;
  ackQueue?: Ack[];
  responseDelayMs?: number;
};

export function createWebSerialGrblDriver(options: WebSerialOptions = {}): GrblDriver {
  const baudRate = options.baudRate ?? 115200;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let port: SerialPort | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let connected = false;
  let buffer = "";
  const lineQueue: string[] = [];
  const lineWaiters: Array<(line: string) => void> = [];
  let activeStreamAbort: AbortController | null = null;

  const enqueueLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const waiter = lineWaiters.shift();
    if (waiter) {
      waiter(trimmed);
      return;
    }
    lineQueue.push(trimmed);
  };

  const readLoop = async () => {
    if (!reader) {
      return;
    }
    try {
      let keepReading = true;
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) {
          keepReading = false;
          break;
        }
        if (!value) {
          continue;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          enqueueLine(part);
        }
      }
    } catch (error) {
      if (connected) {
        console.warn("Serial read loop ended", error);
      }
    }
  };

  const readLine = async (): Promise<string> => {
    if (!connected) {
      throw new Error("Not connected");
    }
    const next = lineQueue.shift();
    if (next !== undefined) {
      return next;
    }
    return new Promise((resolve) => {
      lineWaiters.push(resolve);
    });
  };

  const waitForLine = async (signal?: AbortSignal): Promise<string> => {
    if (!signal) {
      return readLine();
    }
    if (signal.aborted) {
      throw new Error("Stream aborted");
    }
    const abortPromise = new Promise<string>((_, reject) => {
      const onAbort = () => {
        signal.removeEventListener("abort", onAbort);
        reject(new Error("Stream aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
    return Promise.race([readLine(), abortPromise]);
  };

  const writeRaw = async (text: string) => {
    if (!writer) {
      throw new Error("Not connected");
    }
    await writer.write(encoder.encode(text));
  };

  const readAck = async (signal?: AbortSignal): Promise<Ack> => {
    const lines: string[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const line = await waitForLine(signal);
      if (line.startsWith("ok")) {
        return lines.length > 0 ? { ok: true, lines } : { ok: true };
      }
      if (line.startsWith("error:") || line.startsWith("ALARM")) {
        return lines.length > 0 ? { ok: false, error: line, lines } : { ok: false, error: line };
      }
      lines.push(line);
    }
    throw new Error("Stream ended without ack");
  };

  const parseStatus = (line: string): StatusSnapshot => {
    const trimmed = line.replace(/[<>]/g, "");
    const parts = trimmed.split("|");
    const state = (parts[0]?.toUpperCase() as StatusState) ?? "UNKNOWN";
    const snapshot: StatusSnapshot = { state };

    for (const part of parts) {
      if (part.startsWith("MPos:")) {
        snapshot.mpos = parsePosition(part.slice(5));
      }
      if (part.startsWith("WPos:")) {
        snapshot.wpos = parsePosition(part.slice(5));
      }
    }

    return snapshot;
  };

  return {
    connect: async () => {
      if (connected) {
        return;
      }

      // Determine which serial implementation to use
      let serialImpl = navigator.serial;

      // Check if we are on Android (heuristic) or if native serial is missing
      const isAndroid = /android/i.test(navigator.userAgent);
      const isNativeSupported = "serial" in navigator;

      if (!isNativeSupported || isAndroid) {
        // Force polyfill on Android because native implementation is often blocked/shimmed incorrectly
        // or simply prefer the polyfill for reliability via WebUSB.
        serialImpl = polyfillSerial;
        console.log("Using Web Serial Polyfill (WebUSB)");
      }

      if (!serialImpl) {
        throw new Error("Web Serial is not supported in this browser.");
      }

      // Android/WebUSB often requires filters to show devices.
      // We list common USB-Serial chips used in lasers (CH340, CP210x, FTDI, CDC, Arduino).
      const filters = (isAndroid || serialImpl === polyfillSerial) ? [
        { usbVendorId: 0x1a86 }, // CH340
        { usbVendorId: 0x10c4 }, // CP210x (Silicon Labs)
        { usbVendorId: 0x0403 }, // FTDI
        { usbVendorId: 0x2341 }, // Arduino (Atmel)
        { usbVendorId: 0x2a03 }, // Arduino (Newer)
        { usbVendorId: 0x0483 }, // STM32 (some controllers)
      ] : undefined;

      port = await serialImpl.requestPort({ filters });
      await port.open({ baudRate });
      reader = port.readable?.getReader() ?? null;
      writer = port.writable?.getWriter() ?? null;
      connected = true;
      buffer = "";
      readLoop();
    },
    disconnect: async () => {
      activeStreamAbort?.abort();
      activeStreamAbort = null;
      connected = false;
      if (reader) {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
        reader = null;
      }
      if (writer) {
        await writer.close().catch(() => undefined);
        writer.releaseLock();
        writer = null;
      }
      if (port) {
        await port.close().catch(() => undefined);
        port = null;
      }
      lineQueue.length = 0;
      lineWaiters.length = 0;
    },
    isConnected: () => connected,
    getStatus: async () => {
      await writeRaw("?");
      const line = await readLine();
      if (!line.startsWith("<")) {
        return { state: "UNKNOWN" };
      }
      return parseStatus(line);
    },
    sendLine: async (line: string) => {
      await writeRaw(`${line}\n`);
      return readAck();
    },
    streamJob: (gcode: string, mode: StreamMode) => {
      if (mode !== "ack") {
        throw new Error("Buffered streaming is not implemented.");
      }
      const lines = parseGcodeLines(gcode);
      const abortController = new AbortController();
      activeStreamAbort = abortController;
      const done = (async () => {
        for (const line of lines) {
          if (abortController.signal.aborted) {
            throw new Error("Stream aborted");
          }
          await writeRaw(`${line}\n`);
          const ack = await readAck(abortController.signal);
          if (!ack.ok) {
            throw new Error(ack.error ?? "Streaming error");
          }
        }
      })().finally(() => {
        if (activeStreamAbort === abortController) {
          activeStreamAbort = null;
        }
      });
      return {
        done,
        abort: async () => {
          await abortControllerAbort(abortController, () => writeRaw("\x18"));
        }
      };
    },
    abort: async () => {
      if (activeStreamAbort) {
        activeStreamAbort.abort();
      }
      if (connected) {
        await writeRaw("\x18");
      }
    },
    pause: async () => {
      await writeRaw("!");
    },
    resume: async () => {
      await writeRaw("~");
    }
  };
}

export function createSimulatedGrblDriver(options: SimulatedOptions = {}): SimulatedGrblDriver {
  const ackQueue = [...(options.ackQueue ?? [])];
  const sentLines: string[] = [];
  let connected = false;
  let status: StatusSnapshot = { state: options.initialState ?? "IDLE" };
  let activeStreamAbort: AbortController | null = null;
  const responseDelayMs = options.responseDelayMs ?? 0;

  const delay = (ms: number, signal?: AbortSignal) => {
    if (ms <= 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Stream aborted"));
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  };

  const sendLineInternal = async (line: string, signal?: AbortSignal): Promise<Ack> => {
    if (!connected) {
      throw new Error("Not connected");
    }
    if (signal?.aborted) {
      throw new Error("Stream aborted");
    }
    sentLines.push(line);
    await delay(responseDelayMs, signal);
    const ack = ackQueue.shift() ?? { ok: true };
    if (!ack.ok) {
      status = { ...status, state: "ALARM" };
    }
    return ack;
  };

  const disconnect = async () => {
    activeStreamAbort?.abort();
    activeStreamAbort = null;
    connected = false;
    status = { ...status, state: "UNKNOWN" };
  };

  return {
    connect: async () => {
      connected = true;
      status = { ...status, state: status.state === "UNKNOWN" ? "IDLE" : status.state };
    },
    disconnect,
    isConnected: () => connected,
    getStatus: async () => status,
    sendLine: async (line: string) => sendLineInternal(line),
    streamJob: (gcode: string, mode: StreamMode) => {
      if (mode !== "ack") {
        throw new Error("Buffered streaming is not implemented.");
      }
      const lines = parseGcodeLines(gcode);
      const abortController = new AbortController();
      activeStreamAbort = abortController;
      const done = (async () => {
        status = { ...status, state: "RUN" };
        for (const line of lines) {
          const ack = await sendLineInternal(line, abortController.signal);
          if (!ack.ok) {
            throw new Error(ack.error ?? "Streaming error");
          }
        }
        status = { ...status, state: "IDLE" };
      })().catch((error) => {
        if (error instanceof Error && error.message.includes("aborted")) {
          status = { ...status, state: "ALARM" };
        }
        throw error;
      }).finally(() => {
        if (activeStreamAbort === abortController) {
          activeStreamAbort = null;
        }
      });
      return {
        done,
        abort: async () => {
          await abortControllerAbort(abortController, async () => undefined);
        }
      };
    },
    abort: async () => {
      if (activeStreamAbort) {
        activeStreamAbort.abort();
      }
      status = { ...status, state: "ALARM" };
    },
    pause: async () => {
      status = { ...status, state: "HOLD" };
    },
    resume: async () => {
      status = { ...status, state: "RUN" };
    },
    getSentLines: () => [...sentLines],
    pushAck: (ack: Ack) => {
      ackQueue.push(ack);
    },
    setStatus: (state: StatusState) => {
      status = { ...status, state };
    }
  };
}

function parsePosition(csv: string): Position {
  const values = csv.split(",").map((value) => Number(value));
  return {
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    z: values[2] ?? 0
  };
}

function parseGcodeLines(gcode: string): string[] {
  return gcode
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => stripInlineComment(line))
    .filter((line) => line.length > 0 && !isComment(line));
}

function isComment(line: string): boolean {
  return line.startsWith(";") || line.startsWith("(");
}

function stripInlineComment(line: string): string {
  const semicolonIndex = line.indexOf(";");
  if (semicolonIndex >= 0) {
    return line.slice(0, semicolonIndex).trim();
  }
  return line;
}

async function abortControllerAbort(controller: AbortController, sendReset: () => Promise<void>) {
  if (!controller.signal.aborted) {
    controller.abort();
  }
  await sendReset().catch(() => undefined);
}
