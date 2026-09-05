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
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Circle", "Slot", "Rectangle", "Rounded rectangle", "Button row"
    ]);
    expect(screen.queryByText(/vendor|sku/i)).toBeNull();
  });
});
