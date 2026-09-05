import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentEditor } from "./ComponentEditor";

describe("ComponentEditor", () => {
  it("creates a generic circle preset with its minimum dimension", () => {
    const onSave = vi.fn();
    render(<ComponentEditor onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Vent" } });
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "circle" } });
    fireEvent.change(screen.getByLabelText("Diameter"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save component" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Vent", kind: "circle", dimensions: { diameter: 12 } }));
  });

  it("offers only the five generic component kinds", () => {
    render(<ComponentEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(Array.from((screen.getByLabelText("Kind") as HTMLSelectElement).options).map((option) => option.textContent)).toEqual([
      "Circle", "Slot", "Rectangle", "Rounded rectangle", "Button row"
    ]);
    expect(screen.getByLabelText("Source URL")).not.toBeVisible();
  });

  it("saves optional mechanical details under progressive disclosure", () => {
    const onSave = vi.fn();
    render(<ComponentEditor onSave={onSave} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Body depth")).not.toBeVisible();
    fireEvent.click(screen.getByText("Mechanical details"));
    fireEvent.change(screen.getByLabelText("Body width"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Body height"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Body depth"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Missing measurements"), { target: { value: "mounting holes, connector clearance" } });
    fireEvent.change(screen.getByLabelText("Mounting holes"), { target: { value: "-10,0,3;10,0,3" } });
    fireEvent.change(screen.getByLabelText("Front protrusion"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save component" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mechanics: expect.objectContaining({ body: { width: 30, height: 20, depth: 18 }, mountingHoles: [{ x: -10, y: 0, diameter: 3 }, { x: 10, y: 0, diameter: 3 }], frontProtrusion: 6, missing: ["mounting holes", "connector clearance"] }) }));
  });

  it("blocks invalid kind dimensions with a readable message", () => {
    const onSave = vi.fn();
    render(<ComponentEditor onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Diameter"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Save component" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/diameter must be greater than zero/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});
