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
    expect(screen.queryByLabelText("Source URL")).toBeNull();
  });

  it("keeps engineering metadata out of the component form", () => {
    const onSave = vi.fn();
    render(<ComponentEditor onSave={onSave} onCancel={vi.fn()} />);
    for (const label of ["Body width", "Body height", "Body depth", "Confidence", "Missing measurements", "Mounting holes", "Acoustic hole", "Front protrusion", "Source URL", "Source type", "Mechanical notes"]) expect(screen.queryByLabelText(label)).toBeNull();
    expect(screen.queryByText("Mechanical details")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save component" }));
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("mechanics");
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
