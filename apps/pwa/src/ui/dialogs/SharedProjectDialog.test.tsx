import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SharedProjectPayload } from "../../io/shareCapsule";
import { SharedProjectDialog } from "./SharedProjectDialog";

const payload = { version: 1, document: { version: 1, units: "mm", layers: [], objects: [], enclosureWorkspace: { enclosure: { result: { panels: Array.from({ length: 6 }) } } } }, camSettings: { operations: [{}, {}] } } as unknown as SharedProjectPayload;

describe("SharedProjectDialog", () => {
  it("summarizes the fabrication payload and confirms", () => {
    const onOpen = vi.fn(), onCancel = vi.fn();
    render(<SharedProjectDialog payload={payload} onOpen={onOpen} onCancel={onCancel} />);
    expect(screen.getByRole("dialog", { name: "Shared fabrication project" })).toHaveTextContent("6 box faces");
    expect(screen.getByRole("dialog")).toHaveTextContent("2 cutting operations");
    fireEvent.click(screen.getByRole("button", { name: "Open shared design" }));
    expect(onOpen).toHaveBeenCalledOnce(); expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels without opening", () => {
    const onOpen = vi.fn(), onCancel = vi.fn();
    render(<SharedProjectDialog payload={payload} onOpen={onOpen} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce(); expect(onOpen).not.toHaveBeenCalled();
  });
});
