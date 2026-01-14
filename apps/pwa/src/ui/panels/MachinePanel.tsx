import { useState } from "react";
import type { GrblDriver, StatusSnapshot } from "../../io/grblDriver";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type StreamState = "idle" | "streaming" | "paused" | "done" | "error";

interface MachinePanelProps {
    driver: GrblDriver | null;
    connectionState: ConnectionState;
    connectionMessage?: string;
    maxS: number;
    status: StatusSnapshot;
    streamState: StreamState;
    streamMessage: string | null;
    streamProgress?: number; // Not implemented yet but good for future
    onConnect: () => void;
    onDisconnect: () => void;
    onStreamStart: () => void;
    onStreamPause: () => void;
    onStreamResume: () => void;
    onStreamAbort: () => void;
}

export function MachinePanel({
    driver,
    connectionState,
    connectionMessage,
    maxS,
    status,
    streamState,
    streamMessage,
    onConnect,
    onDisconnect,
    onStreamStart,
    onStreamPause,
    onStreamResume,
    onStreamAbort
}: MachinePanelProps) {
    const [jogStep, setJogStep] = useState<number>(10);
    const [jogSpeed, setJogSpeed] = useState<number>(1000);
    const [armLaser, setArmLaser] = useState(false);
    const [manualCmd, setManualCmd] = useState("");

    const send = async (line: string) => {
        if (!driver) return;
        try {
            await driver.sendLine(line);
        } catch (e) {
            console.error("Command failed", e);
        }
    };

    const handleJog = (dx: number, dy: number) => {
        // $J=G91 G21 X... Y... F...
        const cmd = `$J=G91 G21 X${dx} Y${dy} F${jogSpeed}`;
        send(cmd);
    };

    const handleHome = () => send("$H");
    const handleUnlock = () => send("$X");
    const handleZeroXY = () => send("G10 L20 P1 X0 Y0");
    const handleGoToZero = () => send("G0 X0 Y0");
    const handleReset = () => send("\x18"); // Ctrl-X (Soft Reset)

    const isConnected = connectionState === "connected";

    // Helper to format numbers
    const f = (n?: number) => (n !== undefined ? n.toFixed(3) : "—");

    return (
        <div className="machine-panel">
            {/* 1. Connection Header */}
            <div className="panel-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span className={`status-dot ${isConnected ? "ok" : "error"}`} />
                        <strong>{connectionState.toUpperCase()}</strong>
                        {connectionMessage && <span style={{ marginLeft: 8, color: "red" }}>{connectionMessage}</span>}
                    </div>
                    <div>
                        {!isConnected ? (
                            <button onClick={onConnect} disabled={connectionState === "connecting"}>
                                Connect
                            </button>
                        ) : (
                            <button onClick={onDisconnect}>Disconnect</button>
                        )}
                    </div>
                </div>
            </div>

            {isConnected && (
                <>
                    {/* 2. DRO & Status */}
                    <div className="panel-section dro-section">
                        <div className="dro-main">
                            <div className="dro-axis">
                                <label>X</label>
                                <span className="dro-value">{f(status.wpos?.x)}</span>
                            </div>
                            <div className="dro-axis">
                                <label>Y</label>
                                <span className="dro-value">{f(status.wpos?.y)}</span>
                            </div>
                            <div className="dro-axis">
                                <label>Z</label>
                                <span className="dro-value">{f(status.wpos?.z)}</span>
                            </div>
                        </div>
                        <div className="dro-sub">
                            MPos: {f(status.mpos?.x)}, {f(status.mpos?.y)}, {f(status.mpos?.z)} | State: <strong>{status.state}</strong>
                        </div>
                        <div className="dro-actions">
                            <button onClick={handleHome} title="Homing Cycle ($H)">Home ($H)</button>
                            <button onClick={handleUnlock} title="Unlock Alarm ($X)">Unlock ($X)</button>
                            <button onClick={handleReset} style={{ color: "red" }} title="Soft Reset (Ctrl-X)">Reset</button>
                        </div>
                        <div className="dro-actions" style={{ marginTop: 8 }}>
                            <button onClick={handleZeroXY}>Set Zero XY</button>
                            <button onClick={handleGoToZero}>Go to Zero</button>
                        </div>
                    </div>

                    {/* 3. Jog Controls */}
                    <div className="panel-section jog-section">
                        <div className="jog-controls">
                            {/* D-Pad Layout */}
                            <div />
                            <button onClick={() => handleJog(0, jogStep)}>▲</button>
                            <div />

                            <button onClick={() => handleJog(-jogStep, 0)}>◀</button>
                            <button onClick={handleGoToZero} style={{ fontSize: "0.8em" }}>0,0</button>
                            <button onClick={() => handleJog(jogStep, 0)}>▶</button>

                            <div />
                            <button onClick={() => handleJog(0, -jogStep)}>▼</button>
                            <div />
                        </div>

                        <div className="jog-settings">
                            <label>Step (mm)</label>
                            <div className="toggle-group">
                                {[0.1, 1, 10, 50, 100].map(s => (
                                    <button
                                        key={s}
                                        className={jogStep === s ? "is-active" : ""}
                                        onClick={() => setJogStep(s)}
                                    >{s}</button>
                                ))}
                            </div>
                            <label>Speed (mm/min)</label>
                            <input
                                type="number"
                                value={jogSpeed}
                                onChange={e => setJogSpeed(e.target.valueAsNumber)}
                                step={100}
                            />
                        </div>
                    </div>

                    {/* 4. Stream / Job Control */}
                    <div className="panel-section stream-section">
                        <h3>Job Control</h3>
                        {streamState !== "streaming" && streamState !== "paused" && (
                            <div style={{ marginBottom: 8 }}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={armLaser}
                                        onChange={e => setArmLaser(e.target.checked)}
                                    />
                                    Arm Laser (Enable Start)
                                </label>
                            </div>
                        )}

                        <div className="stream-buttons">
                            {streamState === "idle" || streamState === "done" || streamState === "error" ? (
                                <button
                                    className="button--primary"
                                    disabled={!armLaser || status.state !== "IDLE"}
                                    onClick={onStreamStart}
                                >
                                    Start Job
                                </button>
                            ) : (
                                <>
                                    <button onClick={streamState === "paused" ? onStreamResume : onStreamPause}>
                                        {streamState === "paused" ? "Resume" : "Pause"}
                                    </button>
                                    <button
                                        className="button--danger"
                                        onClick={onStreamAbort}
                                    >
                                        Abort
                                    </button>
                                </>
                            )}
                        </div>
                        {streamMessage && <div className="stream-msg">{streamMessage}</div>}
                    </div>

                    {/* 5. Manual Command */}
                    <div className="panel-section">
                        <form onSubmit={(e) => { e.preventDefault(); send(manualCmd); setManualCmd(""); }}>
                            <input
                                placeholder="Send G-code or $ command..."
                                value={manualCmd}
                                onChange={e => setManualCmd(e.target.value)}
                                style={{ width: "100%", padding: 8 }}
                            />
                        </form>
                    </div>
                </>
            )}

            <style>{`
        .machine-panel {
            padding: 16px;
            background: #252525;
            color: #eee;
        }
        .panel-section {
            background: #333;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .status-dot {
            display: inline-block;
            width: 8px; height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            background: #666;
        }
        .status-dot.ok { background: #4caf50; }
        .status-dot.error { background: #f44336; }
        
        .dro-main {
            display: flex;
            justify-content: space-around;
            font-family: monospace;
            font-size: 1.5rem;
            margin-bottom: 8px;
            background: #000;
            padding: 8px;
            border-radius: 4px;
        }
        .dro-axis { display: flex; flex-direction: column; align-items: center; }
        .dro-axis label { font-size: 0.8rem; color: #888; }
        .dro-sub { font-size: 0.8rem; color: #aaa; text-align: center; margin-bottom: 12px;}
        
        .dro-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;}
        .dro-actions button { flex: 1; padding: 6px; }

        .jog-section { display: flex; gap: 16px; align-items: flex-start; }
        .jog-controls {
            display: grid;
            grid-template-columns: repeat(3, 40px);
            grid-template-rows: repeat(3, 40px);
            gap: 4px;
        }
        .jog-controls button { width: 100%; height: 100%; padding: 0; font-size: 1.2rem; }
        
        .jog-settings { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .toggle-group { display: flex; gap: 4px; }
        .toggle-group button { flex: 1; font-size: 0.8em; padding: 4px; border: 1px solid #555; background: transparent; color: #aaa; }
        .toggle-group button.is-active { background: #00e5ff; color: #000; border-color: #00e5ff; }
        
        .button--danger { background: #d32f2f; color: white; }
        .stream-msg { margin-top: 8px; font-size: 0.9em; color: #ffd700; white-space: pre-wrap; font-family: monospace}
      `}</style>
        </div>
    );
}
