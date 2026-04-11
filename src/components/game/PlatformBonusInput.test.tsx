import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PlatformBonusInput } from "./PlatformBonusInput";

afterEach(cleanup);

const PLATFORMS = [
  { id: 1, name: "PC" },
  { id: 2, name: "PS4" },
  { id: 3, name: "Xbox One" },
  { id: 4, name: "Switch" },
  { id: 5, name: "PS3" },
  { id: 6, name: "Xbox 360" },
  { id: 7, name: "Wii U" },
  { id: 8, name: "3DS" },
];

const CORRECT_IDS = [1, 2, 4]; // PC, PS4, Switch

describe("PlatformBonusInput", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  it("renders the prompt text", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/which platforms is this game on/i)).toBeInTheDocument();
  });

  it("renders a chip for each platform", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    for (const platform of PLATFORMS) {
      expect(screen.getByText(platform.name)).toBeInTheDocument();
    }
  });

  it("renders the Confirm button", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: /confirm platform selection/i })).toBeInTheDocument();
  });

  // ── Selection ─────────────────────────────────────────────────────────────

  it("Confirm button is disabled when nothing is selected", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("chips start with aria-pressed=false", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    const pcButton = screen.getByRole("button", { name: "PC" });
    expect(pcButton).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a chip toggles aria-pressed to true", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    const pcButton = screen.getByRole("button", { name: "PC" });
    fireEvent.click(pcButton);
    expect(pcButton).toHaveAttribute("aria-pressed", "true");
  });

  it("clicking a selected chip deselects it (aria-pressed → false)", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    const pcButton = screen.getByRole("button", { name: "PC" });
    fireEvent.click(pcButton);
    fireEvent.click(pcButton);
    expect(pcButton).toHaveAttribute("aria-pressed", "false");
  });

  it("enables Confirm after selecting at least one chip", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PC" }));
    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeDisabled();
  });

  it("disables Confirm again when selection is cleared", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    const pcButton = screen.getByRole("button", { name: "PC" });
    fireEvent.click(pcButton);
    fireEvent.click(pcButton);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  // ── Submission ────────────────────────────────────────────────────────────

  it("calls onSubmit with selected IDs when Confirm is clicked", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PC" }));
    fireEvent.click(screen.getByRole("button", { name: "PS4" }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onSubmit).toHaveBeenCalledOnce();
    const call = onSubmit.mock.calls[0];
    if (call === undefined) throw new Error("onSubmit not called");
    const ids: number[] = call[0] as number[];
    expect(ids.sort()).toEqual([1, 2]);
  });

  // ── Result states ─────────────────────────────────────────────────────────

  it("shows +1 bonus message when result is correct", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result="correct"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/\+1 bonus/i);
  });

  it("shows incorrect message when result is incorrect", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result="incorrect"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/not quite/i);
  });

  it("hides the Confirm button after result is set", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result="correct"
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("disables all chips when result is set", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result="correct"
        onSubmit={onSubmit}
      />,
    );
    const chips = PLATFORMS.map((p) => screen.getByRole("button", { name: p.name }));
    for (const chip of chips) {
      expect(chip).toBeDisabled();
    }
  });

  it("does not call onSubmit when chip is clicked after result", () => {
    render(
      <PlatformBonusInput
        platforms={PLATFORMS}
        correctPlatformIds={CORRECT_IDS}
        result="correct"
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PC" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
