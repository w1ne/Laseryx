import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CamSettings,
  Document,
  GcodeDialect,
  Layer,
  MachineProfile,
  Operation,
  ShapeObj,
  ImageObj,
  PathObj,
  Transform
} from "../core/model";
import { IDENTITY_TRANSFORM, computeBounds, composeTransforms } from "../core/geom";
import { parseSvg } from "../core/svgImport";
import type { GrblDriver, StatusSnapshot } from "../io/grblDriver";
import { createWebSerialGrblDriver } from "../io/grblDriver";
import { createWorkerClient } from "./workerClient";
import { projectRepo, ProjectSummary } from "../io/projectRepo";
import { MachinePanel } from "./panels/MachinePanel";
import "./app.css";

type ExportState = {
  status: "idle" | "working" | "done" | "error";
  message?: string;
};

type WorkerStatus = {
  ready: boolean;
  error?: string;
};

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

type MachineConnection = {
  status: ConnectionState;
  message?: string;
};

type StreamState = "idle" | "streaming" | "paused" | "done" | "error";

const DEFAULT_LAYER_ID = "layer-1";
const DEFAULT_OP_ID = "op-1";

function createDefaultDocument(): Document {
  return {
    version: 1,
    units: "mm",
    layers: [
      {
        id: DEFAULT_LAYER_ID,
        name: "Layer 1",
        visible: true,
        locked: false,
        operationId: DEFAULT_OP_ID
      }
    ],
    objects: [
      {
        kind: "shape",
        id: "rect-1",
        layerId: DEFAULT_LAYER_ID,
        transform: { ...IDENTITY_TRANSFORM, e: 20, f: 20 },
        shape: { type: "rect", width: 80, height: 50 }
      }
    ]
  };
}

function createDefaultCamSettings(): CamSettings {
  return {
    operations: [
      {
        id: DEFAULT_OP_ID,
        type: "vectorCut",
        speedMmMin: 1200,
        powerPct: 55,
        passes: 1,
        order: "insideOut"
      }
    ]
  };
}

function createDefaultMachineProfile(): MachineProfile {
  return {
    bedMm: { w: 300, h: 200 },
    origin: "frontLeft",
    sRange: { min: 0, max: 1000 },
    laserMode: "M4",
    preamble: ["G21", "G90"]
  };
}

function createDefaultDialect(): GcodeDialect {
  return {
    newline: "\n",
    useG0ForTravel: true,
    powerCommand: "S",
    enableLaser: "M4",
    disableLaser: "M5"
  };
}

function downloadGcode(filename: string, gcode: string) {
  const blob = new Blob([gcode], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function updateOperation(
  operations: Operation[],
  opId: string,
  updater: (op: Operation) => Operation
): Operation[] {
  return operations.map((op) => (op.id === opId ? updater(op) : op));
}

function updateLayer(layers: Layer[], layerId: string, updater: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => (layer.id === layerId ? updater(layer) : layer));
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

export function App() {
  const initialDocument = useMemo(() => createDefaultDocument(), []);
  const [document, setDocument] = useState<Document>(initialDocument);
  const [camSettings, setCamSettings] = useState<CamSettings>(() => createDefaultCamSettings());
  const [machineProfile, setMachineProfile] = useState<MachineProfile>(() =>
    createDefaultMachineProfile()
  );
  const dialect = useMemo<GcodeDialect>(
    () => ({ ...createDefaultDialect(), enableLaser: machineProfile.laserMode }),
    [machineProfile.laserMode]
  );
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialDocument.objects[0]?.id ?? null
  );
  const [nextRectId, setNextRectId] = useState(2);
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({ ready: false });
  const [latestGcode, setLatestGcode] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"design" | "machine">("design");
  const [machineConnection, setMachineConnection] = useState<MachineConnection>({
    status: "disconnected"
  });
  const [machineStatus, setMachineStatus] = useState<StatusSnapshot>({ state: "UNKNOWN" });
  const [machineMessage, setMachineMessage] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [streamMessage, setStreamMessage] = useState<string | null>(null);

  const clientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null);
  const driverRef = useRef<GrblDriver | null>(null);
  const streamRef = useRef<ReturnType<GrblDriver["streamJob"]> | null>(null);

  const isExportDisabled = !workerStatus.ready || exportState.status === "working";
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  // Persistence State
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  const handleNewProject = () => {
    if (confirm("Create new project? Unsaved changes will be lost.")) {
      setDocument(createDefaultDocument());
      setMachineProfile(createDefaultMachineProfile());
      setCamSettings(createDefaultCamSettings());
      setSelectedObjectId(null);
    }
  };

  const handleSaveProject = async () => {
    const name = prompt("Project Name:", "Untitled Project");
    if (!name) return;

    try {
      const assets = new Map<string, Blob>();
      const docClone = structuredClone(document);

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
      console.error(e);
      alert("Failed to save project: " + e);
    }
  };

  const handleListProjects = async () => {
    try {
      const list = await projectRepo.list();
      setSavedProjects(list);
      setShowLoadDialog(true);
    } catch (e) {
      alert("Failed to list projects: " + e);
    }
  };

  const handleLoadProject = async (id: string) => {
    try {
      setIsProjectLoading(true);
      const loaded = await projectRepo.load(id);
      if (!loaded) throw new Error("Project not found");

      const doc = loaded.document;
      for (const obj of doc.objects) {
        if (obj.kind === "image") {
          const blob = loaded.assets.get(obj.src);
          if (blob) {
            const url = URL.createObjectURL(blob);
            obj.src = url;
          } else {
            console.warn("Asset not found for image:", obj.id);
          }
        }
      }

      setDocument(doc);
      setShowLoadDialog(false);
    } catch (e) {
      console.error(e);
      alert("Failed to load: " + e);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this project?")) {
      await projectRepo.delete(id);
      const list = await projectRepo.list();
      setSavedProjects(list);
    }
  };

  useEffect(() => {
    const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
      type: "module"
    });
    const client = createWorkerClient(worker);
    clientRef.current = client;

    client
      .ping()
      .then(() => {
        setWorkerStatus({ ready: true });
      })
      .catch((err) => {
        setWorkerStatus({ ready: false, error: err instanceof Error ? err.message : String(err) });
      });

    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (machineConnection.status !== "connected") return;
    const driver = driverRef.current;
    if (!driver) return;

    let active = true;
    const pollStatus = async () => {
      try {
        const status = await driver.getStatus();
        if (active) setMachineStatus(status);
      } catch (error) {
        if (active) setMachineMessage(error instanceof Error ? error.message : "Status poll failed");
      }
    };

    pollStatus();
    const timer = window.setInterval(pollStatus, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [machineConnection.status]);

  const selectedObject = document.objects.find((obj) => obj.id === selectedObjectId) ?? null;

  const handleAddRectangle = () => {
    const id = `rect-${nextRectId}`;
    setNextRectId((value) => value + 1);
    const rect: ShapeObj = {
      kind: "shape",
      id,
      layerId: DEFAULT_LAYER_ID,
      transform: { ...IDENTITY_TRANSFORM, e: 40, f: 40 },
      shape: { type: "rect", width: 60, height: 40 }
    };
    setDocument((prev) => ({ ...prev, objects: [...prev.objects, rect] }));
    setSelectedObjectId(id);
  };

  const handleImportFile = () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = "image/png, image/jpeg, image/svg+xml, .svg";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.name.toLowerCase().endsWith(".svg")) {
        try {
          const text = await file.text();
          const importedObjects = parseSvg(text);
          if (importedObjects.length === 0) {
            alert("No supported shapes found in SVG.");
            return;
          }
          const paths = importedObjects.filter(o => o.kind === "path") as PathObj[];
          if (paths.length === 0) return;

          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const apply = (p: { x: number, y: number }, t: Transform) => ({
            x: p.x * t.a + p.y * t.c + t.e,
            y: p.x * t.b + p.y * t.d + t.f
          });

          for (const p of paths) {
            for (const pt of p.points) {
              const t = apply(pt, p.transform);
              if (t.x < minX) minX = t.x;
              if (t.y < minY) minY = t.y;
              if (t.x > maxX) maxX = t.x;
              if (t.y > maxY) maxY = t.y;
            }
          }

          if (minX === Infinity) return;

          const shiftX = -minX;
          const shiftY = -minY;

          const newObjects = paths.map(obj => {
            const t = obj.transform;
            return {
              ...obj,
              transform: { ...t, e: t.e + shiftX, f: t.f + shiftY }
            };
          });

          setDocument(prev => ({
            ...prev,
            objects: [...prev.objects, ...newObjects]
          }));
          if (newObjects.length > 0) setSelectedObjectId(newObjects[0].id);

        } catch (error) {
          console.error(error);
          alert("Failed to parse SVG");
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const id = `img-${nextRectId}`;
            setNextRectId(i => i + 1);
            const mmW = img.width * 0.264583;
            const mmH = img.height * 0.264583;
            const imageObj: ImageObj = {
              kind: "image",
              id,
              layerId: DEFAULT_LAYER_ID,
              transform: { ...IDENTITY_TRANSFORM, e: 10, f: 10 },
              width: mmW,
              height: mmH,
              src
            };
            setDocument(prev => ({ ...prev, objects: [...prev.objects, imageObj] }));
            setSelectedObjectId(id);
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const generateGcode = async () => {
    const client = clientRef.current;
    if (!client) throw new Error("Worker not ready.");
    const result = await client.generateGcode(document, camSettings, machineProfile, dialect);
    setLatestGcode(result.gcode);
    setWarnings(result.warnings);
    return result.gcode;
  };

  const handleExport = async () => {
    setExportState({ status: "working", message: "Generating G-code..." });
    try {
      const gcode = await generateGcode();
      downloadGcode("laser-job.gcode", gcode);
      setExportState({ status: "done", message: "Downloaded laser-job.gcode" });
    } catch (error) {
      setExportState({
        status: "error",
        message: error instanceof Error ? error.message : "Export failed"
      });
    }
  };

  const getDriver = () => {
    if (!driverRef.current) {
      driverRef.current = createWebSerialGrblDriver();
    }
    return driverRef.current;
  };

  const handleConnect = async () => {
    setMachineMessage(null);
    if (!serialSupported) {
      setMachineConnection({ status: "error", message: "Web Serial is not available." });
      return;
    }
    setMachineConnection({ status: "connecting" });
    try {
      const driver = getDriver();
      await driver.connect();
      setMachineConnection({ status: "connected" });
      const status = await driver.getStatus();
      setMachineStatus(status);
    } catch (error) {
      setMachineConnection({
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed"
      });
    }
  };

  const handleDisconnect = async () => {
    setMachineMessage(null);
    if (driverRef.current) {
      await driverRef.current.disconnect();
    }
    setMachineConnection({ status: "disconnected" });
    setMachineStatus({ state: "UNKNOWN" });
    setStreamState("idle");
    setStreamMessage(null);
  };

  const handleStartJob = async () => {
    setStreamMessage(null);
    setMachineMessage(null);

    if (!workerStatus.ready) {
      setStreamState("error");
      setStreamMessage("Worker not ready.");
      return;
    }
    if (!driverRef.current || !driverRef.current.isConnected()) {
      setStreamState("error");
      setStreamMessage("Not connected to a controller.");
      return;
    }
    try {
      setStreamState("streaming");
      setStreamMessage("Generating G-code...");
      const gcode = await generateGcode();
      setStreamMessage("Streaming job (ack mode)...");
      const handle = driverRef.current.streamJob(gcode, "ack");
      streamRef.current = handle;
      await handle.done;
      setStreamState("done");
      setStreamMessage("Job complete.");
    } catch (error) {
      setStreamState("error");
      setStreamMessage(error instanceof Error ? error.message : "Streaming failed");
    } finally {
      streamRef.current = null;
    }
  };

  const handleStreamPause = async () => {
    if (driverRef.current) {
      await driverRef.current.pause();
      setStreamState("paused");
      setStreamMessage("Job paused.");
    }
  };

  const handleStreamResume = async () => {
    if (driverRef.current) {
      await driverRef.current.resume();
      setStreamState("streaming");
      setStreamMessage("Job resumed.");
    }
  };

  const handleStreamAbort = async () => {
    if (driverRef.current) await driverRef.current.abort();
    if (streamRef.current) await streamRef.current.abort();
    setStreamState("error");
    setStreamMessage("Job aborted.");
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="app__eyebrow">Milestone 6</p>
          <h1>LaserFather Workspace</h1>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button onClick={handleNewProject}>New</button>
            <button onClick={handleListProjects}>Open</button>
            <button onClick={handleSaveProject}>Save</button>
          </div>
        </div>
        <div className={`app__worker ${workerStatus.ready ? "is-ready" : ""}`}>
          {workerStatus.ready ? "Worker ready" : workerStatus.error || "Worker starting"}
        </div>
      </header>

      {showLoadDialog && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#222", padding: "20px", borderRadius: "8px",
            width: "400px", maxHeight: "80vh", overflowY: "auto",
            border: "1px solid #444"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2>Open Project</h2>
              <button onClick={() => setShowLoadDialog(false)}>X</button>
            </div>
            {savedProjects.length === 0 && <p>No saved projects.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {savedProjects.map(p => (
                <div key={p.id}
                  onClick={() => handleLoadProject(p.id)}
                  style={{
                    padding: "10px", background: "#333", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    border: "1px solid #444"
                  }}>
                  <div>
                    <strong>{p.name}</strong><br />
                    <small style={{ color: "#888" }}>{new Date(p.updatedAt).toLocaleString()}</small>
                  </div>
                  <button onClick={(e) => handleDeleteProject(p.id, e)} style={{ background: "#500", border: "none", padding: "4px 8px" }}>Del</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="app__tabs" aria-label="Workspace tabs">
        <button
          className={`tab ${activeTab === "design" ? "is-active" : ""}`}
          onClick={() => setActiveTab("design")}
        >
          Design
        </button>
        <button
          className={`tab ${activeTab === "machine" ? "is-active" : ""}`}
          onClick={() => setActiveTab("machine")}
        >
          Machine
        </button>
      </nav>

      <main className="app__main">
        {activeTab === "design" ? (
          <>
            <div className="app__sidebar">
              <div className="panel">
                <div className="panel__header">
                  <h2>Document</h2>
                  <button className="button" onClick={handleAddRectangle}>Add Rect</button>
                  <button className="button" onClick={handleImportFile} style={{ marginLeft: 8 }}>Import</button>
                </div>
                <div className="panel__body">
                  <div className="list">
                    {document.objects.map(obj => {
                      const isSelected = obj.id === selectedObjectId;
                      let label = obj.id;
                      if (obj.kind === "shape") label = `Rect ${formatNumber(obj.shape.width)}x${formatNumber(obj.shape.height)}`;
                      if (obj.kind === "image") label = `Image ${formatNumber(obj.width)}x${formatNumber(obj.height)}`;
                      if (obj.kind === "path") label = "Path";

                      return (
                        <button key={obj.id}
                          className={`list__item ${isSelected ? "is-active" : ""}`}
                          onClick={() => setSelectedObjectId(obj.id)}>
                          <span>{label}</span>
                          <span className="list__meta">{obj.layerId}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedObject ? (
                    <div className="form">
                      <div className="form__row">
                        <label>X <input type="number" value={selectedObject.transform.e} onChange={e => {
                          const v = e.target.valueAsNumber;
                          if (!isNaN(v)) setDocument(p => ({ ...p, objects: p.objects.map(o => o.id === selectedObjectId ? { ...o, transform: { ...o.transform, e: v } } : o) }));
                        }} /></label>
                        <label>Y <input type="number" value={selectedObject.transform.f} onChange={e => {
                          const v = e.target.valueAsNumber;
                          if (!isNaN(v)) setDocument(p => ({ ...p, objects: p.objects.map(o => o.id === selectedObjectId ? { ...o, transform: { ...o.transform, f: v } } : o) }));
                        }} /></label>
                      </div>
                      {(selectedObject.kind === "shape" || selectedObject.kind === "image") && (
                        <div className="form__row">
                          <label>W <input type="number" value={selectedObject.kind === "shape" ? selectedObject.shape.width : selectedObject.width} onChange={e => {
                            const v = e.target.valueAsNumber;
                            if (!isNaN(v)) setDocument(p => ({
                              ...p, objects: p.objects.map(o => {
                                if (o.id !== selectedObjectId) return o;
                                if (o.kind === "shape") return { ...o, shape: { ...o.shape, width: v } };
                                if (o.kind === "image") return { ...o, width: v };
                                return o;
                              })
                            }));
                          }} /></label>
                          <label>H <input type="number" value={selectedObject.kind === "shape" ? selectedObject.shape.height : selectedObject.height} onChange={e => {
                            const v = e.target.valueAsNumber;
                            if (!isNaN(v)) setDocument(p => ({
                              ...p, objects: p.objects.map(o => {
                                if (o.id !== selectedObjectId) return o;
                                if (o.kind === "shape") return { ...o, shape: { ...o.shape, height: v } };
                                if (o.kind === "image") return { ...o, height: v };
                                return o;
                              })
                            }));
                          }} /></label>
                        </div>
                      )}
                    </div>
                  ) : <div className="panel__note">Select an object.</div>}
                </div>
              </div>

              <div className="panel">
                <div className="panel__header"><h2>Operations</h2></div>
                <div className="panel__body">
                  <div className="form__group">
                    <div className="form__title">Layers</div>
                    {document.layers.map(layer => (
                      <label key={layer.id}>{layer.name}
                        <select value={layer.operationId ?? ""} onChange={e => {
                          setDocument(p => ({ ...p, layers: updateLayer(p.layers, layer.id, l => ({ ...l, operationId: e.target.value })) }));
                        }}>
                          {camSettings.operations.map(op => <option key={op.id} value={op.id}>{op.type}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="form__group">
                    <div className="form__title">Settings</div>
                    {camSettings.operations.map(op => (
                      <div key={op.id} className="form__stack">
                        <label>Type <select value={op.type} onChange={e => setCamSettings(p => ({ ...p, operations: updateOperation(p.operations, op.id, o => ({ ...o, type: e.target.value as any })) }))}>
                          <option value="vectorCut">Vector Cut</option>
                          <option value="vectorEngrave">Vector Engrave</option>
                          <option value="rasterEngrave">Raster Engrave</option>
                        </select></label>
                        <label>Speed <input type="number" value={op.speedMmMin} onChange={e => setCamSettings(p => ({ ...p, operations: updateOperation(p.operations, op.id, o => ({ ...o, speedMmMin: e.target.valueAsNumber })) }))} /></label>
                        <label>Power <input type="number" value={op.powerPct} onChange={e => setCamSettings(p => ({ ...p, operations: updateOperation(p.operations, op.id, o => ({ ...o, powerPct: e.target.valueAsNumber })) }))} /></label>
                        <label>Passes <input type="number" value={op.passes} onChange={e => setCamSettings(p => ({ ...p, operations: updateOperation(p.operations, op.id, o => ({ ...o, passes: e.target.valueAsNumber })) }))} /></label>
                      </div>
                    ))}
                  </div>

                  <div className="form__group">
                    <div className="form__title">Export</div>
                    <button className="button button--primary" onClick={handleExport} disabled={isExportDisabled}>Export G-code</button>
                    {exportState.message && <div className={`status status--${exportState.status === "error" ? "error" : "info"}`}>{exportState.message}</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="app__preview">
              <div className="preview-container">
                <svg className="preview-svg" viewBox={`0 0 ${machineProfile.bedMm.w} ${machineProfile.bedMm.h}`} preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#333" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  <path d="M 0 0 L 20 0 M 0 0 L 0 20" stroke="#666" strokeWidth="2" />

                  {document.objects.map(obj => {
                    if (obj.kind === "image") {
                      return (
                        <image key={obj.id} href={obj.src} x={obj.transform.e} y={obj.transform.f} width={obj.width} height={obj.height}
                          className={obj.id === selectedObjectId ? "preview__image is-active" : "preview__image"}
                          style={{ outline: obj.id === selectedObjectId ? "2px solid #00E5FF" : "none" }}
                        />
                      );
                    }
                    if (obj.kind === "path") {
                      const t = obj.transform;
                      const matrix = `matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`;
                      const points = obj.points.map(p => `${p.x},${p.y}`).join(" ");
                      return <g key={obj.id} transform={matrix} onClick={() => setSelectedObjectId(obj.id)} className={obj.id === selectedObjectId ? "preview__object is-active" : "preview__object"}>
                        {obj.closed ? <polygon points={points} /> : <polyline points={points} />}
                      </g>;
                    }
                    if (obj.kind === "shape" && obj.shape.type === "rect") {
                      const t = obj.transform;
                      return <g key={obj.id} transform={`matrix(${t.a},${t.b},${t.c},${t.d},${t.e},${t.f})`} onClick={() => setSelectedObjectId(obj.id)} className={obj.id === selectedObjectId ? "preview__object is-active" : "preview__object"}>
                        <rect width={obj.shape.width} height={obj.shape.height} />
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
              driver={driverRef.current}
              connectionState={machineConnection.status}
              connectionMessage={machineConnection.message}
              maxS={machineProfile.sRange.max}
              status={machineStatus}
              streamState={streamState}
              streamMessage={streamMessage}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onStreamStart={handleStartJob}
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
