import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HackathonEnclosurePanel } from "./HackathonEnclosurePanel";

describe("HackathonEnclosurePanel", () => {
  it("exposes the purchased kit and generates an A5 enclosure", () => {
    const addPaths = vi.fn();
    render(<HackathonEnclosurePanel addPaths={addPaths} />);
    fireEvent.click(screen.getByRole("button", { name: /hackathon enclosure/i }));
    expect(screen.getByText("IPS-1.9-ST7789-SPI-M")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /place rotary encoder/i }));
    expect(addPaths).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining("Rotary encoder") })]));
    fireEvent.click(screen.getByRole("button", { name: /generate enclosure/i }));
    expect(addPaths).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: "Front control panel" })]));
    const generated = addPaths.mock.calls.at(-1)?.[0] ?? [];
    const sheetDrafts = generated.filter((path) => path.name?.startsWith("Sheet "));
    expect(sheetDrafts.length).toBeGreaterThan(0);
    expect(sheetDrafts[0]).toMatchObject({
      name: "Sheet sheet-1",
      construction: true,
      closed: true,
      points: [{ x: 0, y: 0 }, { x: 210, y: 0 }, { x: 210, y: 148 }, { x: 0, y: 148 }],
    });
    expect(screen.getByText(/sheets required/i)).toBeTruthy();
  });

  it("requires measured four-button dimensions", () => {
    render(<HackathonEnclosurePanel addPaths={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /hackathon enclosure/i }));
    fireEvent.click(screen.getByRole("button", { name: /place four-button/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/measure/i);
  });
});
