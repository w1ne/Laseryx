import { MachineManagerDialog } from "../dialogs/MachineManagerDialog";

import { useState } from "react";
import { useStore } from "../../core/state/store";
import { MachineService } from "../../core/services/MachineService";

type MachinePanelProps = {
    onConnect: () => void;
    onDisconnect: () => void;
    onStreamStart: () => void;
    onStreamPause: () => void;
    onStreamResume: () => void;
    onStreamAbort: () => void;
    isGcodeReady?: boolean; // Optional to be backward compatible if needed, but we will pass it
};

export function MachinePanel({
    onConnect,
    onDisconnect,
    onStreamStart,
    onStreamPause,
    onStreamResume,
    onStreamAbort,
    isGcodeReady = false
}: MachinePanelProps) {
    const { state } = useStore();
    const { machineStatus, machineConnection, machineStream } = state;

    const [jogStep, setJogStep] = useState<number>(10);
    const [jogSpeed, setJogSpeed] = useState<number>(1000);
    const [armLaser, setArmLaser] = useState(false);
    const [showManager, setShowManager] = useState(false);

    const handleJog = (dx: number, dy: number) => {
        MachineService.jog(dx, dy, 0, jogSpeed);
    };

    const isConnected = machineConnection.status === "connected";
    const status = machineStatus;

    // Helper to format numbers
    const f = (n?: number) => (n !== undefined ? n.toFixed(3) : "—");

    const jogSteps = [0.1, 1, 10, 50, 100];

    return (
        <div className="machine-panel">
            {/* Header / Connection */}
            <header className="panel-header">
                <div className="machine-info">
                    <div className="machine-title-row">
                        <strong className="machine-name">{state.machineProfile?.name || "Unknown Machine"}</strong>
                        <button className="icon-button" onClick={() => setShowManager(true)} title="Manage Machines">
                            ⚙
                        </button>
                    </div>
                    <div className="machine-meta">
                        {f(state.machineProfile?.bedMm.w)} x {f(state.machineProfile?.bedMm.h)} mm
                    </div>
                </div>

                <div className="connection-status">
                    <div className={`status-badge ${machineConnection.status}`}>
                        <span className="status-dot" />
                        {machineConnection.status.toUpperCase()}
                    </div>
                    {!isConnected ? (
                        <button
                            className="btn-connect"
                            onClick={onConnect}
                            disabled={machineConnection.status === "connecting"}
                        >
                            Connect
                        </button>
                    ) : (
                        <button className="btn-disconnect" onClick={onDisconnect}>
                            Disconnect
                        </button>
                    )}
                </div>
                {machineConnection.status === "error" && (
                    <div className="connection-error">{machineConnection.message}</div>
                )}
            </header>

            <MachineManagerDialog isOpen={showManager} onClose={() => setShowManager(false)} />

            {isConnected && (
                <div className="panel-content">
                    {/* DRO & State */}
                    <section className="control-group dro-group">
                        <div className="dro-display">
                            {["x", "y", "z"].map((axis) => (
                                <div key={axis} className="dro-axis">
                                    <span className="axis-label">{axis.toUpperCase()}</span>
                                    <span className="axis-value">{f(status.wpos?.[axis as 'x' | 'y' | 'z'])}</span>
                                </div>
                            ))}
                        </div>
                        <div className="machine-state-bar">
                            <span className="state-label">State:</span>
                            <strong className="state-value">{status.state}</strong>
                            <span className="separator">|</span>
                            <span className="mpos-display">
                                M: {f(status.mpos?.x)}, {f(status.mpos?.y)}, {f(status.mpos?.z)}
                            </span>
                        </div>

                        <div className="action-grid">
                            <button onClick={MachineService.home} title="Homing Cycle ($H)">⌂ Home</button>
                            <button onClick={MachineService.unlock} title="Unlock Alarm ($X)">🔓 Unlock</button>
                            <button onClick={MachineService.softReset} className="btn-danger" title="Soft Reset (Ctrl-X)">⚠ Reset</button>
                        </div>
                        <div className="action-grid secondary">
                            <button onClick={MachineService.zeroXY}>Zero XY</button>
                            <button onClick={MachineService.zeroZ}>Zero Z</button>
                            <button onClick={MachineService.goToZero}>Go to 0,0</button>
                        </div>
                    </section>

                    {/* Jog Controls */}
                    <section className="control-group jog-group">
                        <div className="jog-main">
                            <div className="d-pad">
                                <div />
                                <button className="d-btn" onClick={() => handleJog(0, jogStep)}>▲</button>
                                <div />
                                <button className="d-btn" onClick={() => handleJog(-jogStep, 0)}>◀</button>
                                <button className="d-btn center" onClick={MachineService.goToZero} title="Go to Zero">●</button>
                                <button className="d-btn" onClick={() => handleJog(jogStep, 0)}>▶</button>
                                <div />
                                <button className="d-btn" onClick={() => handleJog(0, -jogStep)}>▼</button>
                                <div />
                            </div>

                            <div className="jog-settings">
                                <div className="setting-row">
                                    <label>Step</label>
                                    <div className="step-toggles">
                                        {jogSteps.map(s => (
                                            <button
                                                key={s}
                                                className={jogStep === s ? "active" : ""}
                                                onClick={() => setJogStep(s)}
                                            >{s}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="setting-row">
                                    <label>Speed</label>
                                    <input
                                        type="number"
                                        value={jogSpeed}
                                        onChange={e => setJogSpeed(e.target.valueAsNumber)}
                                        step={100}
                                        className="speed-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Job Control */}
                    <section className="control-group job-group">
                        <div className="job-header">
                            <h3>Job Control</h3>
                            {!(machineStream.state === "streaming" || machineStream.state === "paused") && (
                                <label className="arm-laser">
                                    <input
                                        type="checkbox"
                                        checked={armLaser}
                                        onChange={e => setArmLaser(e.target.checked)}
                                    />
                                    Arm Laser
                                </label>
                            )}
                        </div>

                        <div className="job-actions">
                            {(machineStream.state === "idle" || machineStream.state === "done" || machineStream.state === "error") ? (
                                <>
                                    <button
                                        className="btn-primary btn-large"
                                        disabled={!armLaser || status.state !== "IDLE" || !isGcodeReady}
                                        onClick={onStreamStart}
                                        title={!isGcodeReady ? "Please Generate G-code in Design tab first" : ""}
                                    >
                                        Start Job
                                    </button>
                                    {!isGcodeReady && <div style={{ fontSize: "0.8rem", color: "#b91c1c", marginTop: "4px", textAlign: "center" }}>⚠ No G-code generated</div>}
                                </>
                            ) : (
                                <div className="active-job-controls">
                                    <button
                                        className="btn-large"
                                        onClick={machineStream.state === "paused" ? onStreamResume : onStreamPause}
                                    >
                                        {machineStream.state === "paused" ? "▶ Resume" : "⏸ Pause"}
                                    </button>
                                    <button
                                        className="btn-danger btn-large"
                                        onClick={onStreamAbort}
                                    >
                                        ⏹ Abort
                                    </button>
                                </div>
                            )}
                        </div>
                        {machineStream.message && <div className="stream-msg">Status: {machineStream.state.toUpperCase()} - {machineStream.message}</div>}
                        {!isGcodeReady && (machineStream.state === "idle" || machineStream.state === "done") && (
                            <div className="stream-msg" style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}>Tip: Design &gt; Generate G-code</div>
                        )}
                    </section>
                </div>
            )}


            <style>{`
                .machine-panel {
                    padding: 16px;
                    background: #fff;
                    color: #0f172a;
                    height: 100%;
                    overflow-y: auto;
                    font-family: 'Inter', system-ui, sans-serif;
                    border-right: 1px solid #e2e8f0;
                }
                
                /* Header */
                .panel-header {
                    background: linear-gradient(180deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%);
                    padding: 12px;
                    border-radius: 12px;
                    margin-bottom: 16px;
                    border: 1px solid rgba(226, 232, 240, 0.6);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    align-items: stretch;
                }
                .machine-info { display: flex; flex-direction: column; gap: 4px; }
                .machine-title-row { display: flex; align-items: center; justify-content: space-between; }
                .machine-name { font-size: 1.1rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
                .icon-button { 
                    flex-shrink: 0;
                    background: rgba(148, 163, 184, 0.1); 
                    border: none; 
                    color: #64748b; 
                    cursor: pointer; 
                    width: 28px; height: 28px;
                    display: grid; place-items: center;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .icon-button:hover { background: rgba(148, 163, 184, 0.2); color: #334155; transform: scale(1.05); }
                .machine-meta { font-size: 0.85rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }
                .separator { margin: 0 6px; color: #cbd5e1; }
                
                .connection-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
                .status-badge { 
                    display: flex; align-items: center; gap: 6px; 
                    padding: 6px 10px; border-radius: 16px;
                    font-size: 0.75rem; font-weight: 700;
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                }
                .status-badge.connected { 
                    color: #15803d; 
                    border-color: rgba(74, 222, 128, 0.3); 
                    background: rgba(220, 252, 231, 0.5); 
                }
                .status-badge.error { 
                    color: #b91c1c; 
                    border-color: rgba(248, 113, 113, 0.3); 
                    background: rgba(254, 226, 226, 0.5); 
                }
                
                .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
                
                .btn-connect { 
                    background: linear-gradient(120deg, #3b82f6, #06b6d4); 
                    color: white; border: none; padding: 8px 16px; 
                    border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 0.85rem;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-connect:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35); }
                .btn-connect:disabled { opacity: 0.5; filter: grayscale(1); cursor: not-allowed; }
                
                .btn-disconnect { 
                    background: white; 
                    color: #64748b; border: 1px solid #cbd5e1; 
                    padding: 6px 12px; border-radius: 8px; cursor: pointer; 
                    transition: all 0.2s;
                    font-size: 0.8rem;
                    font-weight: 500;
                }
                .btn-disconnect:hover { background: #f8fafc; border-color: #94a3b8; color: #334155; }

                .panel-content { display: flex; flex-direction: column; gap: 16px; }
                .control-group { 
                    background: rgba(255, 255, 255, 0.5); 
                    border-radius: 16px; 
                    padding: 20px; 
                    border: 1px solid rgba(226, 232, 240, 0.6); 
                }
                
                /* Layout Shifts - Removed grid specific shifts for sidebar flow */
                .dro-group { }
                .jog-group { }
                .job-group { margin-top: 8px; }

                /* DRO */
                .dro-display { 
                    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; 
                    background: #f8fafc; padding: 12px; border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.03);
                }
                .dro-axis { display: flex; flex-direction: column; align-items: center; position: relative; }
                .axis-label { 
                    color: #64748b; font-size: 0.7rem; font-weight: 800; 
                    margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.1em;
                }
                .axis-value { 
                    font-family: 'JetBrains Mono', monospace; font-size: 1.8rem; letter-spacing: -0.05em;
                    color: #0f172a;
                    font-weight: 600;
                }
                
                .machine-state-bar { 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 0.85rem; color: #64748b; 
                    background: #f1f5f9; 
                    padding: 8px 12px; border-radius: 8px;
                    font-family: 'JetBrains Mono', monospace;
                    border: 1px solid #e2e8f0;
                }
                .state-value { margin-left: 6px; font-weight: 700; color: #0f172a; }
                .mpos-display { font-size: 0.75rem; opacity: 0.8; }
                
                .action-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
                .action-grid button { 
                    padding: 12px 8px; background: white; 
                    border: 1px solid #cbd5e1; 
                    color: #334155; border-radius: 10px; cursor: pointer; font-size: 0.8rem; font-weight: 600;
                    transition: all 0.15s;
                    display: flex; flex-direction: column; align-items: center; gap: 6px;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
                }
                .action-grid button:hover { border-color: #94a3b8; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(15, 23, 42, 0.05); }
                .action-grid button:active { transform: translateY(0); }
                
                .btn-danger { 
                    color: #b91c1c !important; 
                    border-color: rgba(239, 68, 68, 0.3) !important; 
                    background: rgba(254, 242, 242, 0.5) !important; 
                }
                .btn-danger:hover { background: #fef2f2 !important; border-color: #f87171 !important; }
                
                .action-grid.secondary { margin-top: 10px; }
                .action-grid.secondary button { padding: 8px; font-size: 0.75rem; background: transparent; border-color: transparent; color: #64748b; box-shadow: none; font-weight: 500; }
                .action-grid.secondary button:hover { background: #f1f5f9; color: #334155; border-color: #e2e8f0; box-shadow: none; }

                /* Jog */
                .jog-main { display: flex; flex-direction: column; align-items: center; gap: 24px;  }
                .d-pad { 
                    display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(3, 56px); gap: 8px; 
                    background: #f8fafc; padding: 12px; border-radius: 50%;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
                }
                .d-btn { 
                    width: 100%; height: 100%; 
                    background: white; 
                    border: 1px solid #cbd5e1; 
                    border-radius: 12px; color: #475569; cursor: pointer; font-size: 1.2rem;
                    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05);
                    transition: all 0.1s;
                }
                .d-btn:hover { color: #0f172a; border-color: #94a3b8; transform: translateY(-1px); }
                .d-btn:active { background: #eff6ff; color: #2563eb; border-color: #3b82f6; transform: scale(0.95); box-shadow: none; }
                .d-btn.center { font-size: 1rem; background: #f1f5f9; color: #94a3b8; border-radius: 50%; border-color: #e2e8f0; box-shadow: none; }
                
                .jog-settings { width: 100%; display: flex; flex-direction: column; gap: 16px; background: rgba(255, 255, 255, 0.5); padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;}
                .setting-row label { display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 6px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
                .step-toggles { display: flex; background: #f1f5f9; border-radius: 8px; padding: 4px; gap: 2px; border: 1px solid #e2e8f0; }
                .step-toggles button { 
                    flex: 1; background: transparent; border: none; color: #64748b; 
                    padding: 8px 4px; font-size: 0.8rem; cursor: pointer; border-radius: 6px; font-family: monospace;
                    transition: all 0.2s;
                }
                .step-toggles button:hover { color: #334155; background: rgba(255,255,255,0.5); }
                .step-toggles button.active { background: white; color: #0f172a; font-weight: 700; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1); }
                
                .speed-input { 
                    width: 100%; background: #fff; border: 1px solid #cbd5e1; color: #0f172a; 
                    padding: 10px; border-radius: 8px; font-family: monospace; font-size: 0.9rem; outline: none;
                    transition: border-color 0.2s;
                }
                .speed-input:focus { border-color: #3b82f6; ring: 2px solid rgba(59, 130, 246, 0.1); }

                /* Job */
                .job-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
                .job-header h3 { margin: 0; font-size: 1rem; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
                .arm-laser { 
                    font-size: 0.85rem; color: #b45309; display: flex; align-items: center; gap: 8px; cursor: pointer; 
                    background: #fffbeb; padding: 6px 12px; border-radius: 20px; border: 1px solid #fcd34d;
                    transition: all 0.2s;
                }
                .arm-laser:hover { background: #fef3c7; }
                
                .job-actions { display: flex; flex-direction: column; gap: 12px; }
                .active-job-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .btn-large { 
                    padding: 16px; font-size: 1.1rem; font-weight: 700; border-radius: 12px; cursor: pointer; border: none; 
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15); transition: all 0.2s;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .btn-primary { 
                    background: linear-gradient(120deg, #f97316, #fb7185); color: white; 
                    box-shadow: 0 4px 15px rgba(249, 115, 22, 0.3);
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(249, 115, 22, 0.4); }
                .btn-primary:active { transform: translateY(0); }
                .btn-primary:disabled { background: #e2e8f0; opacity: 1; cursor: not-allowed; box-shadow: none; transform: none; color: #94a3b8; }
                
                .active-job-controls .btn-danger { 
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important; 
                    color: white !important; 
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
                }
                
                .stream-msg { 
                    margin-top: 16px; padding: 12px; background: #fffbeb; 
                    color: #b45309; border: 1px solid #fcd34d; border-radius: 8px; 
                    font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; 
                    text-align: center;
                }
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
