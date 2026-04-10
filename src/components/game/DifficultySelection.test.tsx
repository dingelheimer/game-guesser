import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DifficultySelection } from "./DifficultySelection";

afterEach(cleanup);

describe("DifficultySelection", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    onSelect.mockReset();
  });

  it("renders all four difficulty buttons", () => {
    render(<DifficultySelection onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /easy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /extreme/i })).toBeInTheDocument();
  });

  it("calls onSelect with 'easy' when Easy is clicked", () => {
    render(<DifficultySelection onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /easy/i }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("easy");
  });

  it("calls onSelect with 'extreme' when Extreme is clicked", () => {
    render(<DifficultySelection onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /extreme/i }));
    expect(onSelect).toHaveBeenCalledWith("extreme");
  });

  it("disables all buttons when disabled=true", () => {
    render(<DifficultySelection onSelect={onSelect} disabled />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it("does not call onSelect when disabled and button is clicked", () => {
    render(<DifficultySelection onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /medium/i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows the heading 'Solo Mode'", () => {
    render(<DifficultySelection onSelect={onSelect} />);
    expect(screen.getByRole("heading", { name: /solo mode/i })).toBeInTheDocument();
  });
});
