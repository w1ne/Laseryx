import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/state/store";
import { getDriver } from "../io/driverSingleton";
import { createWorkerClient } from "./workerClient";
import { projectRepo, ProjectSummary } from "../io/projectRepo";
import { MachinePanel } from "./panels/MachinePanel";
import { DocumentPanel } from "./panels/DocumentPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { parseSvg } from "../core/svgImport";
import { Transform } from "../core/model";
import { IDENTITY_TRANSFORM } from "../core/geom";
import { ObjectService } from "../core/services/ObjectService";
import "./app.css";

export function App() {
  const { state, dispatch } = useStore();
  const { ui, machineConnection, document: doc, camSettings, machineProfile } = state;
  const { activeTab } = ui;

  // Local state for things that don't need to be global yet (Project Loading, Worker init)
  // Worker could be global, but keeping it simple for now.
  const [workerStatus, setWorkerStatus] = useState<{ ready: boolean; error?: string }>({ ready: false });
  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);

  // Persistence State
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  // --- Worker Init ---
  useEffect(() => {
    const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), { type: "module" });
    const client = createWorkerClient(worker);
    clientRef.current = client;

    client.ping()
      .then(() => setWorkerStatus({ ready: true }))
      .catch((err) => setWorkerStatus({ ready: false, error: String(err) }));

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  // --- Machine Status Polling ---
  useEffect(() => {
    const driver = getDriver();

    // We only poll if we think we are connected or connecting
    // Actually, checking driver.isConnected() is safer
    let active = true;
    const pollStatus = async () => {
      if (!driver.isConnected()) {
        if (machineConnection.status === "connected") {
          dispatch({ type: "SET_CONNECTION_STATUS", payload: { status: "disconnected" } });
        }
        return;
      }

      try {
        const status = await driver.getStatus();
        if (active) dispatch({ type: "SET_MACHINE_STATUS", payload: status });
      } catch (error) {
        // If poll fails repeatedly, we might be disconnected, but let's just log or ignore specific errors
        console.warn("Poll failed", error);
      }
    };

    const timer = window.setInterval(pollStatus, 500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [dispatch, machineConnection.status]);


  // --- Helper Functions (Project wrappers) ---
  // Ideally these move to a ProjectService
  const handleNewProject = () => {
    if (confirm("Create new project? Unsaved changes will be lost.")) {
      // Resetting logic... we need a RESET_APP action ideally.
      // For now, reload page or manually dispatch SET_DOCUMENT etc.
      // Let's just reload for simplicity in this MVP refactor step, 
      // OR implement the proper reset actions.
      // Let's assume user accepts a page reload for "New Project" if it's easiest, 
      // BUT nicer to just clear state.
      window.location.reload();
    }
  };

  const handleSaveProject = async () => {
    const name = prompt("Project Name:", "Untitled Project");
    if (!name) return;
    try {
      const assets = new Map<string, Blob>();
      const docClone = structuredClone(doc); // state.document

      // Asset logic...
      for (const obj of docClone.objects) {
        if (obj.kind === "image" && obj.src.startsWith("blob:")) {
          const res = await fetch(obj.src);
          const blob = await res.blob();
          const assetId = crypto.randomUUID();
          assets.set(assetId, blob);
          obj.src = assetId;
        }
      }
      await projectRepo.save(docClone, assets, name);
      alert("Project saved!");
    } catch (e) {
      alert("Failed: " + e);
    }
  };

  const handleListProjects = async () => {
    try {
      setSavedProjects(await projectRepo.list());
      setShowLoadDialog(true);
    } catch (e) { alert(String(e)); }
  };

  const handleLoadProject = async (id: string) => {
    try {
      setIsProjectLoading(true);
      const loaded = await projectRepo.load(id);
      if (!loaded) throw new Error("Project not found");

      // Hydrate blobs
      const doc = loaded.document;
      for (const obj of doc.objects) {
        if (obj.kind === "image") {
          const blob = loaded.assets.get(obj.src);
          if (blob) obj.src = URL.createObjectURL(blob);
        }
      }
      dispatch({ type: "SET_DOCUMENT", payload: doc });
      setShowLoadDialog(false);
    } catch (e) {
      alert("Failed: " + e);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete?")) {
      await projectRepo.delete(id);
      setSavedProjects(await projectRepo.list());
    }
  };

  // --- Export / Stream Logic wrappers --- 
  // Kept local or passed to Panels. 
  // MachinePanel uses MachineService for JOG, but Start Job needs GCode generation which requires Worker.
  // Worker is here (clientRef).
  // So we pass `handleStartJob` to MachinePanel? 
  // MachinePanel logic for `onStreamStart` was: call handleStartJob -> generateGcode -> stream.

  const generateGcode = async () => {
    if (!clientRef.current) throw new Error("Worker not ready");
    // Use implicit default dialect for now
    const dialect = { newline: "\n", useG0ForTravel: true, powerCommand: "S", enableLaser: "M4", disableLaser: "M5" } as any;
    // Update logic to pull from machineProfile if needed.
    const result = await clientRef.current.generateGcode(doc, camSettings, machineProfile, dialect);
    return result.gcode;
  };

  const handleExport = async () => {
    try {
      const gcode = await generateGcode();
      const blob = new Blob([gcode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.gcode";
      a.click();
    } catch (e) { alert(e); }
  };

  const handleConnect = async () => {
    try {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: { status: "connecting" } });
      await getDriver().connect();
      dispatch({ type: "SET_CONNECTION_STATUS", payload: { status: "connected" } });
    } catch (e) {
      dispatch({ type: "SET_CONNECTION_STATUS", payload: { status: "error", message: String(e) } });
    }
  };

  const handleDisconnect = async () => {
    await getDriver().disconnect();
    dispatch({ type: "SET_CONNECTION_STATUS", payload: { status: "disconnected" } });
  };

  // Streaming Handlers
  const handleStreamStart = async () => {
    try {
      dispatch({ type: "SET_STREAM_STATUS", payload: { state: "streaming", message: "Generating..." } });
      const gcode = await generateGcode();

      dispatch({ type: "SET_STREAM_STATUS", payload: { state: "streaming", message: "Sending..." } });
      const driver = getDriver();
      const handle = driver.streamJob(gcode, "ack");
      await handle.done;

      dispatch({ type: "SET_STREAM_STATUS", payload: { state: "done", message: "Job Complete" } });
    } catch (e) {
      dispatch({ type: "SET_STREAM_STATUS", payload: { state: "error", message: String(e) } });
    }
  };

  const handleStreamAbort = async () => {
    await getDriver().abort();
    dispatch({ type: "SET_STREAM_STATUS", payload: { state: "error", message: "Aborted" } });
  };

  const handleStreamPause = async () => {
    await getDriver().pause();
    dispatch({ type: "SET_STREAM_STATUS", payload: { state: "paused", message: "Paused" } });
  };

  const handleStreamResume = async () => {
    await getDriver().resume();
    dispatch({ type: "SET_STREAM_STATUS", payload: { state: "streaming", message: "Resumed" } });
  };

  const selectedObjectId = state.selectedObjectId;

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Milestone 8</p>
          <h1>LaserFather Workspace</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button onClick={handleNewProject}>New</button>
            <button onClick={handleListProjects}>Open</button>
            <button onClick={handleSaveProject}>Save</button>
          </div>
        </div>
        <div className={`app__worker ${workerStatus.ready ? "is-ready" : ""}`}>
          {workerStatus.ready ? "Worker Ready" : "Loading..."}
        </div>
      </header>

      {/* Load Dialog Overlay */}
      {showLoadDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, right: 0, background: "rgba(0,0,0,0.8)", zIndex: 999, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#222", padding: "20px", width: "400px", borderRadius: "8px", border: "1px solid #444" }}>
            <h2>Load Project</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
              {savedProjects.map(p => (
                <div key={p.id} onClick={() => handleLoadProject(p.id)} style={{ padding: "10px", background: "#333", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                  <span>{p.name}</span>
                  <button onClick={(e) => handleDeleteProject(p.id, e)}>Del</button>
                </div>
              ))}
            </div>
            <button style={{ marginTop: "10px" }} onClick={() => setShowLoadDialog(false)}>Cancel</button>
          </div>
        </div>
      )}

      <nav className="app__tabs">
        <button className={`tab ${activeTab === "design" ? "is-active" : ""}`} onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "design" })}>Design</button>
        <button className={`tab ${activeTab === "machine" ? "is-active" : ""}`} onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "machine" })}>Machine</button>
      </nav>

      <main className="app__main">
        {activeTab === "design" ? (
          <>
            <div className="app__sidebar">
              <DocumentPanel />
              <PropertiesPanel />
              <LayersPanel
                onExport={handleExport}
                exportState={{ status: "idle" }} // TODO: Move export state to Store if we want proper UI feedback
                isExportDisabled={!workerStatus.ready}
              />
            </div>

            <div className="panel panel--preview">
              <div className="preview-container">
                {/* Simplified Preview Render - Ideally move to a PreviewComponent */}
                <svg className="preview-svg" viewBox={`0 0 ${machineProfile.bedMm.w} ${machineProfile.bedMm.h}`} preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#333" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  {doc.objects.map(obj => {
                    if (obj.kind === "image") {
                      return (
                        <image key={obj.id} href={obj.src} x={obj.transform.e} y={obj.transform.f} width={obj.width} height={obj.height}
                          onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                          style={{ outline: obj.id === selectedObjectId ? "2px solid #00E5FF" : "none", cursor: "pointer" }}
                        />
                      );
                    }
                    if (obj.kind === "path") {
                      const t = obj.transform;
                      const points = obj.points.map(p => `${p.x},${p.y}`).join(" ");
                      return <g key={obj.id} transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
                        onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                        style={{ cursor: "pointer" }}>
                        {obj.closed ?
                          <polygon points={points} fill="none" stroke={obj.id === selectedObjectId ? "#00E5FF" : "white"} strokeWidth="1" /> :
                          <polyline points={points} fill="none" stroke={obj.id === selectedObjectId ? "#00E5FF" : "white"} strokeWidth="1" />
                        }
                      </g>;
                    }
                    if (obj.kind === "shape" && obj.shape.type === "rect") {
                      const t = obj.transform;
                      return <g key={obj.id} transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`}
                        onClick={() => dispatch({ type: "SELECT_OBJECT", payload: obj.id })}
                        style={{ outline: obj.id === selectedObjectId ? "2px solid #00E5FF" : "none" }}>
                        <rect width={obj.shape.width} height={obj.shape.height} fill="rgba(255,255,255,0.1)" stroke="white" />
                      </g>;
                    }
                    return null;
                  })}
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="panel machine-control-wrapper" style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
            <h2>Machine Control</h2>
            <MachinePanel
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onStreamStart={handleStreamStart}
              onStreamPause={handleStreamPause}
              onStreamResume={handleStreamResume}
              onStreamAbort={handleStreamAbort}
            />
          </div>
        )}
      </main>
    </div>
  );
}
