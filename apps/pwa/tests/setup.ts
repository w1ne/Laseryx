import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock URL.createObjectURL since it's not available in happy-dom
if (typeof window !== "undefined") {
    window.URL.createObjectURL = vi.fn(() => "blob:mock");
    window.URL.revokeObjectURL = vi.fn();
}

// Mock structuredClone if not available (Node < 17 or old browsers)
if (typeof global.structuredClone !== "function") {
    global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}
