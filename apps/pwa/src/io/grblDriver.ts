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
      let serialImpl: any = (navigator as any).serial;

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
      const filters = (isAndroid || serialImpl === (polyfillSerial as any)) ? [
        { usbVendorId: 0x1a86 }, // CH340
        { usbVendorId: 0x10c4 }, // CP210x (Silicon Labs)
        { usbVendorId: 0x0403 }, // FTDI
        { usbVendorId: 0x2341 }, // Arduino (Atmel)
        { usbVendorId: 0x2a03 }, // Arduino (Newer)
        { usbVendorId: 0x0483 }, // STM32 (some controllers)
      ] : undefined;

      port = await serialImpl.requestPort({ filters });
      if (!port) {
        throw new Error("No serial port selected.");
      }
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

// --- Virtual Driver Implementation ---

export type VirtualGrblDriver = GrblDriver & {
  getSentLines: () => string[];
  pushAck: (ack: Ack) => void;
  // Direct state manipulation for testing
  setState: (state: Partial<StatusSnapshot>) => void;
};

type VirtualState = {
  status: StatusState;
  mpos: Position;
  wpos: Position;
  // Internal machine state
  workOffset: Position; // G54 offset
  feedRate: number;
  spindleSpeed: number;
  laserEnabled: boolean;
  isAbsolute: boolean; // G90 vs G91
  reportInches?: boolean; // G20 vs G21
};

export function createVirtualGrblDriver(options: SimulatedOptions = {}): VirtualGrblDriver {
  const ackQueue = [...(options.ackQueue ?? [])];
  const sentLines: string[] = [];
  let connected = false;
  let activeStreamAbort: AbortController | null = null;
  const responseDelayMs = options.responseDelayMs ?? 10;

  // Initial machine state
  const state: VirtualState = {
    status: options.initialState ?? "IDLE",
    mpos: { x: 0, y: 0, z: 0 },
    wpos: { x: 0, y: 0, z: 0 },
    workOffset: { x: 0, y: 0, z: 0 },
    feedRate: 0,
    spindleSpeed: 0,
    laserEnabled: false,
    isAbsolute: true,
    reportInches: false
  };

  const delay = (ms: number, signal?: AbortSignal) => {
    if (ms <= 0) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Stream aborted"));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  };

  const processGCode = (line: string): Ack & { dwell?: number } => {
    let cleanLine = line.toUpperCase().trim();

    // 1. Handle Jogging Prefix ($J=)
    // GRBL jogging commands look like: $J=G91 G21 X10 F1000
    // These commands MUST contain a distance mode (G90/G91).
    // The modal state within $J only applies for that command.
    let isJog = false;
    if (cleanLine.startsWith("$J=")) {
      isJog = true;
      cleanLine = cleanLine.slice(3).trim();
    }

    const parts = cleanLine.split(/\s+/);

    // 2. Pre-scan for Units (G20/G21) 
    // If not a jog, these are permanent. If a jog, they are temporary for this line.
    let lineInches = state.reportInches;
    if (parts.includes("G20")) {
      lineInches = true;
      if (!isJog) state.reportInches = true;
    }
    if (parts.includes("G21")) {
      lineInches = false;
      if (!isJog) state.reportInches = false;
    }

    // 3. Distance Mode (G90/G91)
    let lineAbsolute = state.isAbsolute;
    if (parts.includes("G90")) {
      lineAbsolute = true;
      if (!isJog) state.isAbsolute = true;
    }
    if (parts.includes("G91")) {
      lineAbsolute = false;
      if (!isJog) state.isAbsolute = false;
    }

    // 4. Value parsing helper (with unit handling)
    const getVal = (char: string) => {
      const regex = new RegExp(`${char}([\\d.-]+)`);
      const match = cleanLine.match(regex);
      if (!match) return null;
      let val = parseFloat(match[1]);
      // If units for this line are inches, convert to mm for internal state
      if (lineInches) val = val * 25.4;
      return val;
    };

    // 5. Command handling
    let dwellVal = 0;

    for (const part of parts) {
      if (part === "$H") {
        state.mpos = { x: 0, y: 0, z: 0 };
        state.wpos = {
          x: state.mpos.x - state.workOffset.x,
          y: state.mpos.y - state.workOffset.y,
          z: state.mpos.z - state.workOffset.z
        };
        return { ok: true };
      }

      if (part === "M3" || part === "M4") state.laserEnabled = true;
      if (part === "M5") state.laserEnabled = false;

      // Feed/Speed
      if (part.startsWith("F")) state.feedRate = parseFloat(part.slice(1)) || state.feedRate;
      if (part.startsWith("S")) state.spindleSpeed = parseFloat(part.slice(1)) || state.spindleSpeed;
    }

    // Raw getter for non-unit values
    const getRawVal = (char: string) => {
      const regex = new RegExp(`${char}([\\d.-]+)`);
      const match = cleanLine.match(regex);
      return match ? parseFloat(match[1]) : null;
    };

    if (cleanLine.includes("G4")) {
      const p = getRawVal("P") ?? 0;
      dwellVal = p * 1000;
    }

    // Work Offsets (G10 L20 / G92)
    if (cleanLine.includes("G10") && cleanLine.includes("L20")) {
      const x = getVal("X");
      const y = getVal("Y");
      const z = getVal("Z");
      if (x !== null) state.workOffset.x = state.mpos.x - x;
      if (y !== null) state.workOffset.y = state.mpos.y - y;
      if (z !== null) state.workOffset.z = state.mpos.z - z;
    }

    if (cleanLine.includes("G92") && !cleanLine.includes("G92.1")) {
      const x = getVal("X");
      const y = getVal("Y");
      const z = getVal("Z");
      if (x !== null) state.workOffset.x = state.mpos.x - x;
      if (y !== null) state.workOffset.y = state.mpos.y - y;
      if (z !== null) state.workOffset.z = state.mpos.z - z;
    }

    const x = getVal("X");
    const y = getVal("Y");
    const z = getVal("Z");

    const isMove = cleanLine.includes("G0") || cleanLine.includes("G1") ||
      cleanLine.includes("G2") || cleanLine.includes("G3") || isJog;

    if (isMove) {
      if (lineAbsolute) {
        if (x !== null) state.mpos.x = x + state.workOffset.x;
        if (y !== null) state.mpos.y = y + state.workOffset.y;
        if (z !== null) state.mpos.z = z + state.workOffset.z;
      } else {
        if (x !== null) state.mpos.x += x;
        if (y !== null) state.mpos.y += y;
        if (z !== null) state.mpos.z += z;
      }
    }

    // Sync WPos
    state.wpos = {
      x: state.mpos.x - state.workOffset.x,
      y: state.mpos.y - state.workOffset.y,
      z: state.mpos.z - state.workOffset.z
    };

    return { ok: true, dwell: dwellVal };
  };

  const sendLineInternal = async (line: string, signal?: AbortSignal): Promise<Ack> => {
    if (!connected) throw new Error("Not connected");
    if (signal?.aborted) throw new Error("Stream aborted");

    sentLines.push(line);
    // Simulate processing time
    await delay(responseDelayMs, signal);

    // Inject queued ACKs (for simulating errors)
    const queuedAck = ackQueue.shift();
    if (queuedAck) {
      if (!queuedAck.ok) state.status = "ALARM";
      return queuedAck;
    }

    // Real processing
    try {
      if (line.trim() === "?") return { ok: true };
      const res = processGCode(line);
      if (res.dwell) {
        await delay(res.dwell, signal);
      }
      return res;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  return {
    connect: async () => {
      connected = true;
      state.status = "IDLE";
    },
    disconnect: async () => {
      activeStreamAbort?.abort();
      activeStreamAbort = null;
      connected = false;
      state.status = "UNKNOWN";
    },
    isConnected: () => connected,
    getStatus: async () => {
      // Note: Real GRBL reports MPos usually.
      // We can attach the parsed object directly if we want, but the interface returns snapshot
      return {
        state: state.status,
        mpos: { ...state.mpos },
        wpos: { ...state.wpos }
      };
    },
    sendLine: async (line: string) => sendLineInternal(line),
    streamJob: (gcode: string, mode: StreamMode) => {
      if (mode !== "ack") throw new Error("Buffered streaming is not implemented.");

      const lines = parseGcodeLines(gcode);
      const abortController = new AbortController();
      activeStreamAbort = abortController;

      const done = (async () => {
        state.status = "RUN";
        for (const line of lines) {
          // Check for pause
          // Note: state.status is typed as StatusState which includes RUN, HOLD, etc.
          while ((state.status as string) === "HOLD") {
            if (abortController.signal.aborted) throw new Error("Stream aborted");
            await delay(100);
          }

          const ack = await sendLineInternal(line, abortController.signal);
          if (!ack.ok) throw new Error(ack.error ?? "Streaming error");
        }
        state.status = "IDLE";
      })().catch((error) => {
        if (error instanceof Error && error.message.includes("aborted")) {
          state.status = "ALARM";
        }
        throw error;
      }).finally(() => {
        if (activeStreamAbort === abortController) activeStreamAbort = null;
      });

      return {
        done,
        abort: async () => {
          if (!abortController.signal.aborted) abortController.abort();
          state.status = "IDLE"; // Reset on abort
        }
      };
    },
    abort: async () => {
      activeStreamAbort?.abort();
      state.status = "IDLE";
    },
    pause: async () => { state.status = "HOLD"; },
    resume: async () => { state.status = "RUN"; },
    getSentLines: () => [...sentLines],
    pushAck: (ack: Ack) => ackQueue.push(ack),
    setState: (newState: Partial<StatusSnapshot>) => {
      if (newState.state) state.status = newState.state;
      if (newState.mpos) state.mpos = newState.mpos;
      if (newState.wpos) state.wpos = newState.wpos;
    }
  };
}

// Deprecated alias for backward compatibility until refactor is complete
export const createSimulatedGrblDriver = createVirtualGrblDriver;

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
