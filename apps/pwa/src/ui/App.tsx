import { useRef, useState, useEffect } from "react";
import { randomId } from "../core/util";

import { useStore } from "../core/state/store";
import { getDriver } from "../io/driverSingleton";
import { createWorkerClient } from "./workerClient";
import { projectRepo, ProjectSummary } from "../io/projectRepo";
import { machineRepo } from "../io/machineRepo";
import { materialRepo } from "../io/materialRepo";
import { MachinePanel } from "./panels/MachinePanel";
import { DocumentPanel } from "./panels/DocumentPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { PreviewPanel } from "./panels/PreviewPanel";
import { DonateButton } from "./DonateButton";
import { AboutDialog } from "./AboutDialog";
import { MaterialManagerDialog } from "./dialogs/MaterialManagerDialog";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/Toast";
import "./app.css";

export function App() {
  const { state, dispatch } = useStore();
  const { ui, machineConnection, document: doc, camSettings, machineProfile } = state;
  const { activeTab } = ui;
  const toast = useToast();

  // Local state for things that don't need to be global yet (Project Loading, Worker init)
  // Worker could be global, but keeping it simple for now.
  const [workerStatus, setWorkerStatus] = useState<{ ready: boolean; error?: string }>({ ready: false });
  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);

  // Persistence State
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);

  const [showAbout, setShowAbout] = useState(false);
  const [showMaterialManager, setShowMaterialManager] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null); // BeforeInstallPromptEvent

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

  // --- PWA Install Prompt ---
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && isZ) {
        e.preventDefault();
        if (e.shiftKey) dispatch({ type: "REDO" });
        else dispatch({ type: "UNDO" });
      } else if (isMod && isY) {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice: any) => {
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
    });
  };

  // --- Machine Profile Init ---
  useEffect(() => {
    const initMachines = async () => {
      try {
        await machineRepo.initDefaults();
        const profiles = await machineRepo.list();
        if (profiles.length > 0) {
          dispatch({ type: "SET_MACHINE_PROFILES", payload: profiles });
          // If the current state has a placeholder profile, switch to the first real one
          // Or if we implementing "Last Used" persistence, load it here.
          // For now, default to first one if we are on the placeholder.
          // Actually, INITIAL_STATE has "default-machine".
          // We should select it from the loaded list to ensure we have the latest properties.
          const defaultId = "default-machine";
          const found = profiles.find(p => p.id === defaultId);
          if (found) {
            dispatch({ type: "SELECT_MACHINE_PROFILE", payload: found.id });
          } else {
            dispatch({ type: "SELECT_MACHINE_PROFILE", payload: profiles[0].id });
          }
        }
      } catch (e) {
        console.error("Failed to load machine profiles", e);
      }
    };
    initMachines();
  }, [dispatch]);

  // --- Material Presets Init ---
  useEffect(() => {
    const initMaterials = async () => {
      try {
        await materialRepo.initDefaults();
        const presets = await materialRepo.list();
        dispatch({ type: "SET_MATERIAL_PRESETS", payload: presets });
      } catch (e) {
        console.error("Failed to load material presets", e);
      }
    };
    initMaterials();
  }, [dispatch]);

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
        const safeStatus = {
          state: status.state,
          mpos: status.mpos || { x: 0, y: 0, z: 0 },
          wpos: status.wpos || { x: 0, y: 0, z: 0 },
          feed: 0, // Driver doesn't return feed yet?
          spindle: 0
        };
        if (active) dispatch({ type: "SET_MACHINE_STATUS", payload: safeStatus });
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
          const assetId = randomId();
          assets.set(assetId, blob);
          obj.src = assetId;
        }
      }
      await projectRepo.save(docClone, assets, name);
      toast.success("Project saved!");
    } catch (e) {
      toast.error("Failed to save project: " + String(e));
    }
  };

  const handleListProjects = async () => {
    try {
      setSavedProjects(await projectRepo.list());
      setShowLoadDialog(true);
    } catch (e) { toast.error("Failed to list projects: " + String(e)); }
  };

  const handleLoadProject = async (id: string) => {
    try {

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
      toast.error("Failed to load project: " + String(e));
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this project?")) {
      try {
        await projectRepo.delete(id);
        setSavedProjects(await projectRepo.list());
        toast.success("Project deleted");
      } catch (e) {
        toast.error("Failed to delete project: " + String(e));
      }
    }
  };

  // --- Export / Stream Logic wrappers --- 
  // Kept local or passed to Panels. 
  // MachinePanel uses MachineService for JOG, but Start Job needs GCode generation which requires Worker.
  // Worker is here (clientRef).
  // So we pass `handleStartJob` to MachinePanel? 
  // MachinePanel logic for `onStreamStart` was: call handleStartJob -> generateGcode -> stream.

  // --- G-code Generation State ---
  const [generatedGcode, setGeneratedGcode] = useState<string | null>(null);
  const [jobStats, setJobStats] = useState<{ estTimeS: number; travelMm: number; markMm: number; segments: number } | null>(null);
  const [generationState, setGenerationState] = useState<{ status: "idle" | "working" | "done" | "error"; message?: string }>({ status: "idle" });
  const [previewMode, setPreviewMode] = useState<"design" | "gcode">("design");

  const handleGenerateGcode = async () => {
    if (!clientRef.current) return;
    try {
      setGenerationState({ status: "working", message: "Generating..." });
      // Use implicit default dialect for now
      const dialect: GcodeDialect = { newline: "\n", useG0ForTravel: true, powerCommand: "S", enableLaser: "M4", disableLaser: "M5" };
      const result = await clientRef.current.generateGcode(doc, camSettings, machineProfile, dialect);
      setGeneratedGcode(result.gcode);
      setJobStats(result.stats);
      setGenerationState({ status: "done", message: "Ready" });
      setPreviewMode("gcode");
    } catch (e) {
      setGeneratedGcode(null);
      setJobStats(null);
      setGenerationState({ status: "error", message: String(e) });
    }
  };

  const handleDownloadGcode = () => {
    if (!generatedGcode) return;
    try {
      const blob = new Blob([generatedGcode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.gcode";
      a.click();
    } catch (e) { toast.error("Failed to download G-code: " + String(e)); }
  };

  // --- Export / Stream Logic wrappers --- 
  // Kept local or passed to Panels. 

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
    if (!generatedGcode) {
      toast.warning("Please generate G-code first!");
      return;
    }
    try {
      dispatch({ type: "SET_STREAM_STATUS", payload: { state: "streaming", message: "Sending..." } });
      const driver = getDriver();
      const handle = driver.streamJob(generatedGcode, "ack");
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



  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Release {__APP_VERSION__}</p>
          <h1>Laseryx Workspace</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button onClick={handleNewProject}>New</button>
            <button onClick={handleListProjects}>Open</button>
            <button onClick={handleSaveProject}>Save</button>
            <button onClick={() => setShowAbout(true)}>About</button>
            {installPrompt && (
              <button
                onClick={handleInstallClick}
                style={{ background: "#4f46e5", color: "white", border: "none" }}
              >
                Install App
              </button>
            )}
            <DonateButton />
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
                onGenerate={handleGenerateGcode}
                onDownload={handleDownloadGcode}
                onOpenMaterialManager={() => setShowMaterialManager(true)}
                generationState={generationState}
                hasGcode={!!generatedGcode}
                isWorkerReady={workerStatus.ready}
                jobStats={jobStats}
              />
            </div>
            <div className="app__preview-area" style={{ position: "relative" }}>
              <div style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                background: "#e2e8f0",
                padding: "4px",
                borderRadius: "8px",
                display: "flex",
                gap: "4px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
              }}>
                <button
                  style={{
                    border: "none",
                    background: previewMode === "design" ? "#fff" : "transparent",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: previewMode === "design" ? "#0f172a" : "#64748b",
                    boxShadow: previewMode === "design" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    cursor: "pointer"
                  }}
                  onClick={() => setPreviewMode("design")}
                >Design</button>
                <button
                  style={{
                    border: "none",
                    background: previewMode === "gcode" ? "#fff" : "transparent",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: previewMode === "gcode" ? "#0f172a" : "#64748b",
                    boxShadow: previewMode === "gcode" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    cursor: !generatedGcode ? "not-allowed" : "pointer",
                    opacity: !generatedGcode ? 0.5 : 1
                  }}
                  onClick={() => generatedGcode && setPreviewMode("gcode")}
                >Preview</button>
              </div>
              <PreviewPanel
                viewMode={previewMode}
                gcode={generatedGcode || undefined}
              />
            </div>
          </>
        ) : (
          <>
            <div className="app__sidebar">
              <MachinePanel
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onStreamStart={handleStreamStart}
                onStreamPause={handleStreamPause}
                onStreamResume={handleStreamResume}
                onStreamAbort={handleStreamAbort}
                isGcodeReady={!!generatedGcode}
              />
            </div>
            <div className="app__preview-area">
              <PreviewPanel
                showMachineHead={true}
                machineStatus={state.machineStatus}
                viewMode={previewMode}
                gcode={generatedGcode || undefined}
              />
            </div>
          </>
        )}
      </main>
      <AboutDialog isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <MaterialManagerDialog isOpen={showMaterialManager} onClose={() => setShowMaterialManager(false)} />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </div>
  );
}
