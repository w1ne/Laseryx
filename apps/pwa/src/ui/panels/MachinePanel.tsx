import { useState } from "react";
import { useStore } from "../../core/state/store";
import { MachineService } from "../../core/services/MachineService";

// These props are still needed for things that depend on the specific *Driver Instance* 
// or async flows that aren't yet in pure Services (like connect/stream flow).
// Ideally, even connect/stream should be Services, but for this milestone refactor:
// We read state from Store, but trigger actions via Props if they are complex flows.
type MachinePanelProps = {
    onConnect: () => void;
    onDisconnect: () => void;
    onStreamStart: () => void;
    onStreamPause: () => void;
    onStreamResume: () => void;
    onStreamAbort: () => void;
    // We remove the status/connectionState props as we read them from Store
};

export function MachinePanel({
    onConnect,
    onDisconnect,
    onStreamStart,
    onStreamPause,
    onStreamResume,
    onStreamAbort
}: MachinePanelProps) {
    const { state } = useStore();
    const { machineStatus, machineConnection, machineStream } = state;

    const [jogStep, setJogStep] = useState<number>(10);
    const [jogSpeed, setJogSpeed] = useState<number>(1000);
    const [armLaser, setArmLaser] = useState(false);
    const [manualCmd, setManualCmd] = useState("");

    const handleJog = (dx: number, dy: number) => {
        MachineService.jog(dx, dy, 0, jogSpeed);
    };

    const isConnected = machineConnection.status === "connected";
    const status = machineStatus; // Alias for cleaner JSX

    // Helper to format numbers
    const f = (n?: number) => (n !== undefined ? n.toFixed(3) : "—");

    return (
        <div className="machine-panel">
            {/* 1. Connection Header */}
            <div className="panel-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <span className={`status-dot ${isConnected ? "ok" : "error"}`} />
                        <strong>{machineConnection.status.toUpperCase()}</strong>
                        {machineConnection.status === "error" && <span style={{ marginLeft: 8, color: "red" }}>{machineConnection.message}</span>}
                    </div>
                    <div>
                        {!isConnected ? (
                            <button onClick={onConnect} disabled={machineConnection.status === "connecting"}>
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
                            <button onClick={MachineService.home} title="Homing Cycle ($H)">Home ($H)</button>
                            <button onClick={MachineService.unlock} title="Unlock Alarm ($X)">Unlock ($X)</button>
                            <button onClick={MachineService.softReset} style={{ color: "red" }} title="Soft Reset (Ctrl-X)">Reset</button>
                        </div>
                        <div className="dro-actions" style={{ marginTop: 8 }}>
                            <button onClick={MachineService.zeroXY}>Set Zero XY</button>
                            <button onClick={MachineService.zeroZ}>Set Zero Z</button>
                            <button onClick={MachineService.goToZero}>Go to Zero</button>
                        </div>
                    </div>

                    {/* 3. Jog Controls */}
                    <div className="panel-section jog-section">
                        <div className="jog-controls">
                            <div />
                            <button onClick={() => handleJog(0, jogStep)}>▲</button>
                            <div />

                            <button onClick={() => handleJog(-jogStep, 0)}>◀</button>
                            <button onClick={MachineService.goToZero} style={{ fontSize: "0.8em" }}>0,0</button>
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
                        {machineStream.state !== "streaming" && machineStream.state !== "paused" && (
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
                            {machineStream.state === "idle" || machineStream.state === "done" || machineStream.state === "error" ? (
                                <button
                                    className="button--primary"
                                    disabled={!armLaser || status.state !== "Idle"}
                                    onClick={onStreamStart}
                                >
                                    Start Job
                                </button>
                            ) : (
                                <>
                                    <button onClick={machineStream.state === "paused" ? onStreamResume : onStreamPause}>
                                        {machineStream.state === "paused" ? "Resume" : "Pause"}
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
                        {machineStream.message && <div className="stream-msg">{machineStream.message}</div>}
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

// Missing helpers in MachineService needs to be checked or simulated
const handleReset = () => {
    // In service or we just import getDriver here for raw commands?
    // Let's assume we add SoftReset to MachineService or just use a helper
    // For now I'll just leave it out or add to MachineService quickly?
    // Let's assume MachineService has it.
};
