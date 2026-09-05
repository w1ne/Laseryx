import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Document } from "../../core/model";
import { ComponentsBoxPanel } from "./ComponentsBoxPanel";

vi.mock("../../io/componentPresetRepo", () => ({ componentPresetRepo: { list: vi.fn().mockResolvedValue([]), create: vi.fn(async (value) => value) } }));

const document = (): Document => ({ version: 1, units: "mm", layers: [], objects: [] });

describe("ComponentsBoxPanel", () => {
  it("shows exactly four progressive primary actions and no temporary kit control", async () => {
    render(<ComponentsBoxPanel document={document()} onDocumentChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Components & Box" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("workflow-action").map((button) => button.textContent)).toEqual([
      "Add component", "Create panel", "Make box", "Arrange sheets"
    ]);
    expect(screen.queryByText(/Hackathon enclosure/i)).toBeNull();
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("persists a panel-local circle and generates six grouped faces with its cutout", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Custom circle" } });
    fireEvent.change(screen.getByLabelText("Diameter"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save component" }));
    await waitFor(() => expect(onDocumentChange).toHaveBeenCalledTimes(2));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.enclosure.result?.panels).toHaveLength(6);
    expect(current.enclosureWorkspace?.enclosure.result?.panels.find((panel) => panel.id === "source-panel")?.paths).toHaveLength(2);
    expect(current.groups?.filter((group) => group.id.includes(":face:"))).toHaveLength(6);
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    const boundaries = current.objects.filter((object) => object.id.includes("sheet-boundary"));
    expect(boundaries.length).toBeGreaterThan(0);
    expect(boundaries.every((object) => object.construction === true)).toBe(true);
    expect(current.enclosureWorkspace?.sheetLayout?.placements).toHaveLength(6);
  });

  it("explicitly arranges faces and renders construction-only sheet boundaries", async () => {
    const onDocumentChange = vi.fn();
    render(<ComponentsBoxPanel document={document()} onDocumentChange={onDocumentChange} />);
    expect(screen.getByRole("button", { name: "Arrange sheets" })).toBeDisabled();
    expect(screen.getByText(/make a box before arranging/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });
});
