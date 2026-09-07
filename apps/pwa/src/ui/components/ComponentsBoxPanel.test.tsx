import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Document } from "../../core/model";
import type { ComponentPreset } from "../../core/components/types";
import { componentPresetRepo } from "../../io/componentPresetRepo";
import { ComponentsBoxPanel } from "./ComponentsBoxPanel";
import { regenerateEnclosureWorkspace, type EnclosureWorkspace } from "../../core/enclosure/workspace";
import { packParts } from "../../core/layout/pack";
import { generateFitCoupon } from "../../core/enclosure/coupon";
import { EXAMPLE_COMPONENT_PRESETS } from "../../core/components/examples";

vi.mock("../../io/componentPresetRepo", () => ({ componentPresetRepo: { list: vi.fn().mockResolvedValue([]), create: vi.fn(async (value) => value) } }));

const document = (): Document => ({ version: 1, units: "mm", layers: [], objects: [] });
const preset: ComponentPreset = { id: "project-hole", name: "Project hole", kind: "circle", dimensions: { diameter: 5 } };

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

  it("offers every exported HESTORE example in the collapsed example list", async () => {
    render(<ComponentsBoxPanel document={document()} onDocumentChange={vi.fn()} />);
    expect(screen.getByText("Example presets").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Example presets"));
    for (const example of EXAMPLE_COMPONENT_PRESETS) expect(screen.getByRole("button", { name: example.name })).toBeTruthy();
    expect(screen.queryByText("Check dimensions before cutting")).toBeNull();
    await waitFor(() => expect(componentPresetRepo.list).toHaveBeenCalled());
  });

  it("edits, moves, and deletes an independent placed instance while retaining its preset", async () => {
    const instance = { id: "hole-1", presetId: preset.id, name: preset.name, kind: "circle" as const, dimensions: { diameter: 5 }, transform: { a: 1, b: 0, c: 0, d: 1, e: 30, f: 30 } };
    let current = document(); current.enclosureWorkspace = { version: 1, presets: [preset], sourcePanel: { id: "panel", name: "Panel", width: 160, height: 100, components: [instance], transform: { a: 1, b: 0, c: 0, d: 1, e: 12, f: 8 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false } };
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    expect(screen.getByText("Panel position · 12, 8 mm")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Project hole" }));
    expect(screen.queryByText("Mechanical details")).toBeNull();
    fireEvent.change(screen.getByLabelText("Component diameter"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Component X"), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save instance" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.sourcePanel.components[0]).toMatchObject({ dimensions: { diameter: 8 }, transform: { e: 40, f: 30 } });
    expect(current.enclosureWorkspace?.presets[0].dimensions).toEqual({ diameter: 5 });
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Project hole" })); fireEvent.click(screen.getByRole("button", { name: "Delete instance" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.sourcePanel.components).toHaveLength(0);
    expect(current.enclosureWorkspace?.presets).toEqual([preset]);
    await waitFor(() => expect(componentPresetRepo.list).toHaveBeenCalled());
  });

  it("persists a panel-local circle and generates six grouped faces with its cutout", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.groups).toContainEqual(expect.objectContaining({ id: "components-box:panel:source-panel-design", memberIds: ["components-box:panel:source-panel-design:outline", "components-box:panel:source-panel-design:anchor"] }));
    expect(current.objects).toHaveLength(2);
    expect(current.objects.find(({ id }) => id.endsWith(":anchor"))?.construction).toBe(true);
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Custom circle" } });
    fireEvent.change(screen.getByLabelText("Diameter"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save component" }));
    await waitFor(() => expect(onDocumentChange).toHaveBeenCalledTimes(2));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" }));
    const beforeBox = structuredClone(current.enclosureWorkspace!.sourcePanel);
    fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.sourcePanel).toEqual(beforeBox);
    expect(current.enclosureWorkspace?.enclosure.result?.panels[0]).toMatchObject({ width: 160, height: 100 });
    expect(current.enclosureWorkspace?.enclosure.result?.panels).toHaveLength(6);
    expect(current.enclosureWorkspace?.enclosure.result?.panels.find((panel) => panel.id === "source-panel")?.paths).toHaveLength(2);
    expect(current.groups?.filter((group) => group.id.includes(":face:"))).toHaveLength(6);
    expect(current.groups?.filter((group) => group.id.includes(":face:")).every((group) => group.memberIds.length >= 2)).toBe(true);
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    const boundaries = current.objects.filter((object) => object.id.includes("sheet-boundary"));
    expect(boundaries.length).toBeGreaterThan(0);
    expect(boundaries.every((object) => object.construction === true)).toBe(true);
    expect(current.enclosureWorkspace?.sheetLayout?.placements).toHaveLength(6);
    expect(current.enclosureWorkspace?.sheetLayout?.parts.some(({ id }) => id === "fit-coupon")).toBe(false);
    expect(current.objects.some(({ id }) => id.includes(":coupon:"))).toBe(false);
  });

  it("generates a box after placing the display preset with all mounting holes", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByText("Example presets"));
    fireEvent.click(screen.getByRole("button", { name: "1.9-inch IPS display" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.enclosure.result?.panels).toHaveLength(6);
    expect(current.enclosureWorkspace?.enclosure.result?.panels.find(({ id }) => id === "source-panel")?.paths).toHaveLength(6);
  });

  it("includes and packs stable fit-coupon geometry only when requested", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" }));
    fireEvent.click(screen.getByText("Advanced"));
    fireEvent.click(screen.getByLabelText("Include fit coupon"));
    fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.objects.filter(({ id }) => id.includes(":coupon:"))).toHaveLength(6);
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.sheetLayout?.placements.some(({ partId }) => partId === "fit-coupon")).toBe(true);
    expect(current.objects.filter(({ id }) => id.includes(":coupon:"))).toHaveLength(6);
    expect(current.objects.find(({ id }) => id.endsWith(":coupon:1"))?.name).toBe("Fit slot 0.05 mm");
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("blocks invalid panel dimensions without dispatching", async () => {
    const onDocumentChange = vi.fn();
    render(<ComponentsBoxPanel document={document()} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" }));
    fireEvent.change(screen.getByLabelText("Panel width"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Save panel" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/panel dimensions must be greater than zero/i);
    expect(onDocumentChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("merges project presets when the repository resolves empty", async () => {
    const base = document();
    base.enclosureWorkspace = { version: 1, presets: [preset], sourcePanel: { id: "panel", name: "Panel", width: 160, height: 100, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false } };
    render(<ComponentsBoxPanel document={base} onDocumentChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Project hole" })).toBeTruthy());
  });

  it("commits an async component save onto the latest workspace and serializes submits", async () => {
    vi.mocked(componentPresetRepo.create).mockClear();
    let release!: () => void;
    vi.mocked(componentPresetRepo.create).mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve(preset); }));
    const base = document();
    base.enclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "panel", name: "Panel", width: 160, height: 100, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 35, rearHeight: 65, thickness: 3, clearance: .15, fingerTarget: 8 } }, coupon: { confirmed: false } };
    const onDocumentChange = vi.fn();
    const view = render(<ComponentsBoxPanel document={base} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Add component" }));
    const save = screen.getByRole("button", { name: "Save component" });
    fireEvent.click(save);
    fireEvent.click(save);
    const latest = structuredClone(base); latest.enclosureWorkspace!.sourcePanel.width = 175;
    view.rerender(<ComponentsBoxPanel document={latest} onDocumentChange={onDocumentChange} />);
    release();
    await waitFor(() => expect(onDocumentChange).toHaveBeenCalledTimes(1));
    expect(onDocumentChange.mock.calls[0][0].enclosureWorkspace.sourcePanel.width).toBe(175);
    expect(onDocumentChange.mock.calls[0][0].enclosureWorkspace.sourcePanel.components).toHaveLength(1);
    expect(componentPresetRepo.create).toHaveBeenCalledTimes(1);
  });

  it("reopens persisted fabrication settings and arranges with persisted sheet options", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" })); fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0]; view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" })); fireEvent.click(screen.getByText("Advanced"));
    fireEvent.change(screen.getByLabelText("Stock thickness"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Sheet width"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Sheet height"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("Sheet orientation"), { target: { value: "portrait" } });
    fireEvent.change(screen.getByLabelText("Sheet margin"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Part gap"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate box" })); current = onDocumentChange.mock.calls.at(-1)![0];
    view.unmount(); render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" })); fireEvent.click(screen.getByText("Advanced"));
    expect(screen.getByLabelText("Stock thickness")).toHaveValue(4);
    expect(screen.getByLabelText("Sheet width")).toHaveValue(300);
    expect(screen.getByLabelText("Sheet orientation")).toHaveValue("portrait");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    current = onDocumentChange.mock.calls.at(-1)![0];
    expect(current.enclosureWorkspace?.sheetLayout).toMatchObject({ sheetSize: { width: 200, height: 300 }, orientation: "portrait", margin: 7, gap: 4 });
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("preserves a valid custom placement when regenerating the box", async () => {
    let current = document();
    const onDocumentChange = vi.fn((next: Document) => { current = next; });
    const view = render(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Create panel" })); fireEvent.click(screen.getByRole("button", { name: "Save panel" }));
    current = onDocumentChange.mock.calls.at(-1)![0]; view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Make box" })); fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0]; view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />); fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    current = onDocumentChange.mock.calls.at(-1)![0]; current.enclosureWorkspace!.sheetLayout!.placements[0] = { ...current.enclosureWorkspace!.sheetLayout!.placements[0], x: 17 };
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />); fireEvent.click(screen.getByRole("button", { name: "Make box" })); fireEvent.click(screen.getByRole("button", { name: "Generate box" }));
    current = onDocumentChange.mock.calls.at(-1)![0]; expect(current.enclosureWorkspace!.sheetLayout!.placements[0].x).toBe(17);
    view.rerender(<ComponentsBoxPanel document={current} onDocumentChange={onDocumentChange} />); fireEvent.click(screen.getByRole("button", { name: "Arrange sheets" }));
    expect(onDocumentChange.mock.calls.at(-1)![0].enclosureWorkspace.sheetLayout.placements[0].x).not.toBe(17);
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("explicitly arranges faces and renders construction-only sheet boundaries", async () => {
    const onDocumentChange = vi.fn();
    render(<ComponentsBoxPanel document={document()} onDocumentChange={onDocumentChange} />);
    expect(screen.getByRole("button", { name: "Arrange sheets" })).toBeDisabled();
    expect(screen.getByText(/make a box before arranging/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });

  it("shows generic preflight readiness only for a complete confirmed layout that fits the active bed", async () => {
    const base: EnclosureWorkspace = { version: 1, presets: [], sourcePanel: { id: "panel", name: "Panel", width: 100, height: 70, components: [], transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } }, enclosure: { id: "box", revision: 0, parameters: { frontHeight: 30, rearHeight: 40, thickness: 3, clearance: .1, fingerTarget: 8 } }, coupon: { confirmed: false, selectedClearance: .1 } };
    const generated = regenerateEnclosureWorkspace(base);
    if (!generated.ok) throw new Error("fixture failed");
    const view = render(<ComponentsBoxPanel document={{ ...document(), enclosureWorkspace: generated.workspace }} onWorkspaceChange={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Fabrication readiness" })).toHaveTextContent(/not ready/i);
    const generatedCoupon = generateFitCoupon({ thickness: 3, clearance: .1 });
    const coupon = { id: generatedCoupon.id, ...generatedCoupon.bounds };
    const layout = packParts([...generated.workspace.enclosure.result!.panels.map(({ id, width, height }) => ({ id, width, height })), coupon], { sheetSize: { width: 500, height: 500 } });
    view.rerender(<ComponentsBoxPanel document={{ ...document(), enclosureWorkspace: { ...generated.workspace, sheetLayout: layout, coupon: { ...generated.workspace.coupon, confirmed: true } } }} onWorkspaceChange={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Fabrication readiness" })).toHaveTextContent(/ready to cut/i);
    view.rerender(<ComponentsBoxPanel document={{ ...document(), enclosureWorkspace: { ...generated.workspace, sheetLayout: layout, coupon: { ...generated.workspace.coupon, confirmed: true } } }} machineProfile={{ bedMm: { w: 100, h: 100 } }} onWorkspaceChange={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Fabrication readiness" })).toHaveTextContent(/physical sheet exceeds.*machine bed/i);
    await waitFor(() => expect(screen.getByText("Example presets")).toBeTruthy());
  });
});
