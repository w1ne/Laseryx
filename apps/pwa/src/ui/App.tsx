import { useRef, useState, useEffect } from "react";
import { GcodeDialect } from "../core/model";
import { randomId } from "../core/util";
import { prepareCutSheet } from "../core/enclosure/cutSheet";

import { useStore } from "../core/state/store";
import { getDriver } from "../io/driverSingleton";
import { createInAppAutomationBridge } from "../automation/browser/inAppBridge";
import { installBrowserAutomation } from "../automation/browser/browserAutomation";
import { createLiveCommandExecutor } from "../automation/browser/liveCommands";
import { executeLinkCommandCapsule, readLinkCommandCapsuleFromHash } from "../automation/browser/linkCommands";
import { readLocalBridgeConfig, startLocalBridgeClient } from "../automation/browser/localBridgeClient";
import { createWorkerClient } from "./workerClient";
import { projectRepo, ProjectSummary } from "../io/projectRepo";
import { machineRepo } from "../io/machineRepo";
import { materialRepo } from "../io/materialRepo";
import { MachinePanel } from "./panels/MachinePanel";
import { DocumentPanel } from "./panels/DocumentPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { PreviewPanel } from "./panels/PreviewPanel";
import { ConstraintToolbar } from "./components/ConstraintToolbar";
import { ModifyToolbar } from "./components/ModifyToolbar";
import { duplicateObject, nudgeObject } from "../core/objectEdit";
import { useSketchTool } from "./sketch/SketchContext";
import { GroupService } from "../core/services/GroupService";
import { SketchService } from "../core/services/SketchService";
import { syncDocumentSketch } from "../core/sketch/sync";
import { MaterialManagerDialog } from "./dialogs/MaterialManagerDialog";
import { AboutDialog } from "./AboutDialog";
import { DonateButton } from "./DonateButton";
import { useToast } from "./hooks/useToast";
import { useAgentSessionController } from "./hooks/useAgentSessionController";
import { AgentControlPanel } from "./components/AgentControlPanel";
import { ToastContainer } from "./components/Toast";
import { decodeSharedProjectHash, hasSharedProjectHash, sharedProjectUrl, type SharedProjectPayload } from "../io/shareCapsule";
import { SharedProjectDialog } from "./dialogs/SharedProjectDialog";
import "./app.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function App() {
  const { state, dispatch } = useStore();
  const { ui, machineConnection, document: doc, camSettings, machineProfile } = state;
  const { activeTab } = ui;
  const toast = useToast();
  const stateRef = useRef(state);
  const { setTool } = useSketchTool();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Local state for things that don't need to be global yet (Project Loading, Worker init)
  // Worker could be global, but keeping it simple for now.
  const [workerStatus, setWorkerStatus] = useState<{ ready: boolean; error?: string }>({ ready: false });
  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);

  // Persistence State
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);

  const [showMaterialManager, setShowMaterialManager] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const agentSession = useAgentSessionController();
  const localBridgeConfigRef = useRef(readLocalBridgeConfig(window.location.search));
  const isLocalAgentRuntime = localBridgeConfigRef.current !== null;
  const initialLinkCommandRef = useRef(readLinkCommandCapsuleFromHash(window.location.hash));
  const linkCommandHandledRef = useRef(false);
  const [pendingSharedProject, setPendingSharedProject] = useState<SharedProjectPayload | null>(null);

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
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  // --- Keyboard Shortcuts (CAD-style edit) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;

      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && isZ) {
        e.preventDefault();
        if (e.shiftKey) dispatch({ type: "REDO" });
        else dispatch({ type: "UNDO" });
        return;
      }
      if (isMod && isY) {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }

      const selectedId = stateRef.current.selectedObjectId;
      const selected = stateRef.current.document.objects.find((o) => o.id === selectedId);

      if (isMod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        const copy = duplicateObject(selected, 10);
        dispatch({ type: "ADD_OBJECT", payload: copy });
        dispatch({ type: "SELECT_OBJECT", payload: copy.id });
        return;
      }

      // Group / Ungroup
      if (isMod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          GroupService.ungroupSelection(stateRef.current, dispatch);
        } else {
          GroupService.groupSelection(stateRef.current, dispatch);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        // Fusion: Esc cancels current dimension step, then exits tool
        setTool("select");
        return;
      }

      // Sketch Dimension (Fusion hotkey D)
      if ((e.key === "d" || e.key === "D") && !isMod) {
        e.preventDefault();
        setTool("dimension");
        return;
      }

      // Fusion: X toggles construction on the selection
      if ((e.key === "x" || e.key === "X") && selected) {
        e.preventDefault();
        if (selected.kind !== "image") {
          const next = !selected.construction;
          dispatch({
            type: "UPDATE_OBJECT",
            payload: { id: selected.id, changes: { construction: next } as typeof selected }
          });
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const st = stateRef.current;
        // Fusion: selected dimension → Delete removes the size constraint
        if (st.selectedConstraintId) {
          e.preventDefault();
          SketchService.removeConstraint(st, dispatch, st.selectedConstraintId);
          dispatch({ type: "SELECT_CONSTRAINT", payload: null });
          return;
        }
        const ids =
          st.selectedObjectIds.length > 0
            ? st.selectedObjectIds
            : st.selectedObjectId
              ? [st.selectedObjectId]
              : [];
        if (ids.length === 0) return;
        e.preventDefault();
        GroupService.deleteSelection(st, dispatch);
        return;
      }

      if (selected && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        const selectedIds = stateRef.current.selectedObjectIds;
        if (selectedIds.length > 1) GroupService.translateSelection(stateRef.current, dispatch, selectedIds, dx, dy);
        else {
          const patch = nudgeObject(selected, dx, dy);
          dispatch({ type: "UPDATE_OBJECT", payload: { id: selected.id, changes: patch } });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, setTool]);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choice) => {
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

  const handleShareProject = async () => {
    try {
      const url = sharedProjectUrl({ version: 1, document: doc, camSettings }, window.location);
      await navigator.clipboard.writeText(url);
      toast.success(`Share link copied (${url.length.toLocaleString()} characters)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create share link.");
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
  const [cachedGcode, setGeneratedGcode] = useState<string | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const sheets = doc.enclosureWorkspace?.sheetLayout?.sheets;
  const cutSheetId = sheets?.find(sheet => sheet.id === selectedSheetId)?.id ?? sheets?.[0]?.id;
  const generationKey = JSON.stringify([doc, camSettings, machineProfile, cutSheetId]);
  const generationKeyRef = useRef(generationKey);
  generationKeyRef.current = generationKey;
  const [generatedKey, setGeneratedKey] = useState("");
  const generatedGcode = generatedKey === generationKey ? cachedGcode : null;
  const [jobStats, setJobStats] = useState<{ estTimeS: number; travelMm: number; markMm: number; segments: number } | null>(null);
  const [generationState, setGenerationState] = useState<{ status: "idle" | "working" | "done" | "error"; message?: string }>({ status: "idle" });
  const [previewMode, setPreviewMode] = useState<"design" | "gcode">("design");
  const [designPanel, setDesignPanel] = useState<"document" | "properties" | "layers">("document");

  const clearLinkCommandHash = () => {
    if (window.location.hash.includes("lx=")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  };

  const clearSharedProjectHash = () => {
    const params = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
    params.delete("share");
    const remaining = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`);
  };

  useEffect(() => {
    const receiveSharedProject = () => {
      if (!hasSharedProjectHash(window.location.hash)) return;
      const parsed = decodeSharedProjectHash(window.location.hash);
      if (!parsed.ok) { toast.error(parsed.error); clearSharedProjectHash(); return; }
      setPendingSharedProject(parsed.payload);
    };
    receiveSharedProject();
    window.addEventListener("hashchange", receiveSharedProject);
    return () => window.removeEventListener("hashchange", receiveSharedProject);
  }, []);

  const openSharedProject = () => {
    if (!pendingSharedProject) return;
    dispatch({ type: "SET_DOCUMENT", payload: pendingSharedProject.document });
    dispatch({ type: "SET_CAM_SETTINGS", payload: pendingSharedProject.camSettings });
    dispatch({ type: "SELECT_OBJECT", payload: null });
    dispatch({ type: "SELECT_CONSTRAINT", payload: null });
    setPendingSharedProject(null); clearSharedProjectHash();
    toast.success("Shared design opened");
  };

  const cancelSharedProject = () => { setPendingSharedProject(null); clearSharedProjectHash(); };

  const createCurrentAutomationBridge = () => {
    const liveExecutor = createLiveCommandExecutor({
      getState: () => stateRef.current,
      dispatch,
      setPreviewMode,
      setDesignPanel
    });
    return createInAppAutomationBridge(
      () => ({
        document: stateRef.current.document,
        camSettings: stateRef.current.camSettings,
        machineProfile: stateRef.current.machineProfile
      }),
      liveExecutor
    );
  };

  useEffect(() => {
    if (linkCommandHandledRef.current || !window.location.hash.includes("lx=")) return;
    linkCommandHandledRef.current = true;
    const parsed = initialLinkCommandRef.current;
    if (!parsed.ok) {
      toast.error(parsed.error);
      clearLinkCommandHash();
      return;
    }

    void executeLinkCommandCapsule(parsed.capsule, createCurrentAutomationBridge()).then((responses) => {
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        toast.error(failed.errors[0]?.message ?? `Link command failed: ${failed.command}`);
        return;
      }
      clearLinkCommandHash();
      toast.success(`Applied ${responses.length} link command${responses.length === 1 ? "" : "s"}`);
    });
  }, []);

  useEffect(() => {
    const liveExecutor = createLiveCommandExecutor({
      getState: () => stateRef.current,
      dispatch,
      setPreviewMode,
      setDesignPanel
    });
    return installBrowserAutomation(() => ({
      document: stateRef.current.document,
      camSettings: stateRef.current.camSettings,
      machineProfile: stateRef.current.machineProfile
    }), window, liveExecutor);
  }, [dispatch]);

  useEffect(() => {
    const config = localBridgeConfigRef.current;
    if (!config) return;
    const liveExecutor = createLiveCommandExecutor({
      getState: () => stateRef.current,
      dispatch,
      setPreviewMode,
      setDesignPanel
    });

    return startLocalBridgeClient({
      ...config,
      bridge: createInAppAutomationBridge(
        () => ({
          document: stateRef.current.document,
          camSettings: stateRef.current.camSettings,
          machineProfile: stateRef.current.machineProfile
        }),
        liveExecutor
      )
    });
  }, [dispatch]);

  const handleGenerateGcode = async () => {
    if (!clientRef.current) return;
    const requestKey = generationKey;
    try {
      setGenerationState({ status: "working", message: "Generating..." });
      // Ensure sketch constraints are solved and baked into objects for CAM
      let docForCam = doc;
      if (state.document.sketch) {
        const { document: synced } = syncDocumentSketch(state.document);
        docForCam = synced;
        dispatch({ type: "SET_DOCUMENT", payload: synced });
      }
      // Use implicit default dialect for now
      const dialect: GcodeDialect = { newline: "\n", useG0ForTravel: true, powerCommand: "S", enableLaser: "M4", disableLaser: "M5" };
      docForCam = prepareCutSheet(docForCam, machineProfile, cutSheetId);
      const result = await clientRef.current.generateGcode(docForCam, camSettings, machineProfile, dialect);
      if (generationKeyRef.current !== requestKey) {
        setGenerationState({ status: "idle", message: "Design changed. Generate again." });
        return;
      }
      if (!result.stats.segments) throw new Error("No cutting paths. Check layer operations and visibility.");
      setGeneratedGcode(result.gcode);
      setGeneratedKey(requestKey);
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
      a.download = cutSheetId ? `project-${cutSheetId}.gcode` : "project.gcode";
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
      <header className="app__topbar">
        <div className="app__brand">
          <p className="app__eyebrow">Release {__APP_VERSION__}</p>
          <h1>Laseryx Workspace</h1>
        </div>
        <div className="app__mode-tabs" role="group" aria-label="Workspace mode">
          <button
            type="button"
            className={`tab ${activeTab === "design" ? "is-active" : ""}`}
            title="Design workspace — sketch, objects, layers, and G-code generate"
            onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "design" })}
          >
            Design
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "machine" ? "is-active" : ""}`}
            title="Machine workspace — connect laser, jog, and run jobs"
            onClick={() => dispatch({ type: "SET_ACTIVE_TAB", payload: "machine" })}
          >
            Machine
          </button>
        </div>
        <div className="app__commands" role="group" aria-label="Project actions">
          <button
            type="button"
            className="button"
            title="Start a blank project (clears the current document)"
            onClick={handleNewProject}
          >
            New
          </button>
          <button
            type="button"
            className="button"
            title="Open a saved project from this browser"
            onClick={handleListProjects}
          >
            Open
          </button>
          <button
            type="button"
            className="button"
            title="Save the current project in this browser"
            onClick={handleSaveProject}
          >
            Save
          </button>
          <button type="button" className="button" title="Copy this editable fabrication project as a link" onClick={handleShareProject}>Share link</button>
          <button
            type="button"
            className="button"
            title="About Laseryx — version, author, and links"
            onClick={() => setShowAbout(true)}
          >
            About
          </button>
          {installPrompt && (
            <button
              type="button"
              className="button button--accent"
              title="Install Laseryx as a desktop/home-screen app (PWA)"
              onClick={handleInstallClick}
            >
              Install App
            </button>
          )}
          {isLocalAgentRuntime && (
            <AgentControlPanel
              session={agentSession.session}
              connectionLink={agentSession.connectionLink}
              copyState={agentSession.copyState}
              onEnable={agentSession.enableAgentControl}
              onDisconnect={agentSession.disconnectAgentControl}
              onCopyConnection={agentSession.copyConnectionLink}
            />
          )}
          <DonateButton />
        </div>
      </header>

      {/* Load Dialog Overlay */}
      {pendingSharedProject && <SharedProjectDialog payload={pendingSharedProject} onOpen={openSharedProject} onCancel={cancelSharedProject} />}
      {showLoadDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, right: 0, background: "rgba(0,0,0,0.8)", zIndex: 999, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ background: "#222", padding: "20px", width: "400px", borderRadius: "8px", border: "1px solid #444" }}>
            <h2>Load Project</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
              {savedProjects.map(p => (
                <div key={p.id} onClick={() => handleLoadProject(p.id)} style={{ padding: "10px", background: "#333", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
                  <span>{p.name}</span>
                  <button
                    type="button"
                    title={`Delete saved project “${p.name}” permanently`}
                    onClick={(e) => handleDeleteProject(p.id, e)}
                  >
                    Del
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              style={{ marginTop: "10px" }}
              title="Close without opening a project"
              onClick={() => setShowLoadDialog(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {activeTab === "design" && (
        <nav className="app__panel-tabs" role="tablist" aria-label="Design panels">
          <button
            type="button"
            id="design-panel-tab-document"
            className={`panel-tab ${designPanel === "document" ? "is-active" : ""}`}
            role="tab"
            aria-selected={designPanel === "document"}
            aria-controls="design-panel-document"
            title="Sketch tools and object list (select, group, delete)"
            onClick={() => setDesignPanel("document")}
          >
            Objects
          </button>
          <button
            type="button"
            id="design-panel-tab-properties"
            className={`panel-tab ${designPanel === "properties" ? "is-active" : ""}`}
            role="tab"
            aria-selected={designPanel === "properties"}
            aria-controls="design-panel-properties"
            title="Edit name, size, position, and transforms for the selection"
            onClick={() => setDesignPanel("properties")}
          >
            Properties
          </button>
          <button
            type="button"
            id="design-panel-tab-layers"
            className={`panel-tab ${designPanel === "layers" ? "is-active" : ""}`}
            role="tab"
            aria-selected={designPanel === "layers"}
            aria-controls="design-panel-layers"
            title="Cut/engrave settings per layer, generate and download G-code"
            onClick={() => setDesignPanel("layers")}
          >
            Operations
          </button>
        </nav>
      )}

      <main className="app__main">
        {activeTab === "design" ? (
          <>
            <section
              className="app__left-zone"
              aria-label="Tools and objects"
              data-mobile-panel={designPanel === "document" ? "active" : "inactive"}
            >
              <div
                id="design-panel-document"
                className="app__panel-slot"
                role="tabpanel"
                aria-labelledby="design-panel-tab-document"
                data-mobile-panel={designPanel === "document" ? "active" : "inactive"}
                data-testid="design-panel-document"
              >
                <DocumentPanel />
              </div>
            </section>
            <section className="app__canvas-zone" aria-label="Workspace" data-mobile-panel="canvas">
              <div className="app__preview-area">
                <div className="app__canvas-toolbar">
                  <div className="preview-mode-switch" role="group" aria-label="View mode">
                    <button
                      type="button"
                      className={`segmented-button ${previewMode === "design" ? "is-active" : ""}`}
                      title="Show design geometry on the bed (edit mode)"
                      onClick={() => setPreviewMode("design")}
                    >
                      Design
                    </button>
                    <button
                      type="button"
                      className={`segmented-button ${previewMode === "gcode" ? "is-active" : ""}`}
                      disabled={!generatedGcode}
                      title={
                        generatedGcode
                          ? "Show toolpath preview from generated G-code"
                          : "Generate G-code in Operations first"
                      }
                      onClick={() => generatedGcode && setPreviewMode("gcode")}
                    >
                      Preview
                    </button>
                  </div>
                  <ModifyToolbar />
                  <ConstraintToolbar />
                </div>
                <PreviewPanel
                  viewMode={previewMode}
                  gcode={generatedGcode || undefined}
                />
              </div>
            </section>
            <section
              className="app__right-zone"
              aria-label="Inspector and operations"
              data-mobile-panel={designPanel === "document" ? "inactive" : "active"}
            >
              <div
                id="design-panel-properties"
                className="app__panel-slot"
                role="tabpanel"
                aria-labelledby="design-panel-tab-properties"
                data-mobile-panel={designPanel === "properties" ? "active" : "inactive"}
                data-testid="design-panel-properties"
              >
                <PropertiesPanel />
              </div>
              <div
                id="design-panel-layers"
                className="app__panel-slot"
                role="tabpanel"
                aria-labelledby="design-panel-tab-layers"
                data-mobile-panel={designPanel === "layers" ? "active" : "inactive"}
                data-testid="design-panel-layers"
              >
                <LayersPanel
                  onGenerate={handleGenerateGcode}
                  sheetId={cutSheetId}
                  onSheetChange={setSelectedSheetId}
                  onDownload={handleDownloadGcode}
                  onOpenMaterialManager={() => setShowMaterialManager(true)}
                  generationState={generationState.status === "done" && !generatedGcode ? { status: "idle", message: "Generate G-code for the current design and sheet." } : generationState}
                  hasGcode={!!generatedGcode}
                  isWorkerReady={workerStatus.ready}
                  jobStats={generatedGcode ? jobStats : null}
                />
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="app__left-zone" aria-label="Machine controls" data-mobile-panel="active">
              <MachinePanel
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onStreamStart={handleStreamStart}
                onStreamPause={handleStreamPause}
                onStreamResume={handleStreamResume}
                onStreamAbort={handleStreamAbort}
                isGcodeReady={!!generatedGcode}
              />
            </section>
            <section className="app__canvas-zone app__canvas-zone--wide" aria-label="Workspace" data-mobile-panel="canvas">
              <div className="app__preview-area">
                <PreviewPanel
                  showMachineHead={true}
                  machineStatus={state.machineStatus}
                  viewMode={previewMode}
                  gcode={generatedGcode || undefined}
                />
              </div>
            </section>
          </>
        )}
      </main>
      <AboutDialog isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <MaterialManagerDialog isOpen={showMaterialManager} onClose={() => setShowMaterialManager(false)} />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </div>
  );
}
