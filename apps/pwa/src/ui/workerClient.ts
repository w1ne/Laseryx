import type {
  CamPlan,
  CamSettings,
  Document,
  GcodeDialect,
  JobStats,
  MachineProfile,
  PreviewGeom
} from "../core/model";
import { createRequestId } from "../shared/ids";
import type { WorkerRequest, WorkerResponse } from "../shared/workerProtocol";

type PendingRequest = {
  resolve: (response: WorkerResponse) => void;
  reject: (error: Error) => void;
};

export function createWorkerClient(worker: Worker) {
  const pending = new Map<string, PendingRequest>();

  const onMessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (!message || typeof message.id !== "string") {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error.message));
      return;
    }
    entry.resolve(message);
  };

  worker.addEventListener("message", onMessage);

  const request = (type: string, payload: unknown) =>
    new Promise<WorkerResponse>((resolve, reject) => {
      const id = createRequestId();
      pending.set(id, { resolve, reject });
      const message: WorkerRequest = { id, type, payload };
      worker.postMessage(message);
    });

  return {
    ping: async (): Promise<string> => {
      const response = await request("worker.ping", {});
      const payload = response.payload as { value?: string };
      if (!payload || payload.value !== "pong") {
        throw new Error("Unexpected ping response");
      }
      return payload.value;
    },
    camPlan: async (
      document: Document,
      cam: CamSettings
    ): Promise<{ plan: CamPlan; preview: PreviewGeom; warnings: string[] }> => {
      const response = await request("core.camPlan", { document, cam });
      return response.payload as { plan: CamPlan; preview: PreviewGeom; warnings: string[] };
    },
    emitGcode: async (
      plan: CamPlan,
      cam: CamSettings,
      machine: MachineProfile,
      dialect: GcodeDialect
    ): Promise<{ gcode: string; stats: JobStats }> => {
      const response = await request("core.emitGcode", {
        plan,
        cam,
        machine,
        dialect
      });
      return response.payload as { gcode: string; stats: JobStats };
    },
    generateGcode: async (
      document: Document,
      cam: CamSettings,
      machine: MachineProfile,
      dialect: GcodeDialect
    ): Promise<{ gcode: string; preview: PreviewGeom; stats: JobStats; warnings: string[] }> => {
      // 1. Extract images
      const images = new Map<string, ImageData>();
      for (const obj of document.objects) {
        if (obj.kind === "image") {
          try {
            const imageData = await decodeImage(obj.src);
            images.set(obj.id, imageData);
          } catch (error) {
            console.warn(`Failed to decode image ${obj.id}`, error);
          }
        }
      }

      // 2. Send request
      const response = await request("core.generateGcode", {
        document,
        cam,
        machine,
        dialect,
        images
      });
      return response.payload as {
        gcode: string;
        preview: PreviewGeom;
        stats: JobStats;
        warnings: string[];
      };
    },
    dispose: () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
    }
  };
}

async function decodeImage(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}
