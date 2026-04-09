import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TitleGuessInput, isTitleMatch } from "./TitleGuessInput";

afterEach(cleanup);

// ── isTitleMatch ──────────────────────────────────────────────────────────────

describe("isTitleMatch", () => {
  it("returns true for an exact match", () => {
    expect(isTitleMatch("The Legend of Zelda", "The Legend of Zelda")).toBe(true);
  });

  it("returns true for a case-insensitive match", () => {
    expect(isTitleMatch("the legend of zelda", "The Legend of Zelda")).toBe(true);
  });

  it("returns true for a close fuzzy match", () => {
    expect(isTitleMatch("Legend of Zelda", "The Legend of Zelda")).toBe(true);
  });

  it("returns false for a completely wrong title", () => {
    expect(isTitleMatch("Minecraft", "The Legend of Zelda")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isTitleMatch("", "The Legend of Zelda")).toBe(false);
  });
});

// ── TitleGuessInput component ─────────────────────────────────────────────────

describe("TitleGuessInput", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockReset();
  });

  it("renders the text input and guess button", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result={null}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("textbox", { name: /game title guess/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guess/i })).toBeInTheDocument();
  });

  it("disables the Guess button when input is empty", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result={null}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: /guess/i })).toBeDisabled();
  });

  it("enables the Guess button after typing", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mario" } });
    expect(screen.getByRole("button", { name: /guess/i })).not.toBeDisabled();
  });

  it("calls onSubmit with trimmed guess on form submit", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result={null}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Super Mario  " },
    });
    const form = screen.getByRole("textbox").closest("form");
    if (form === null) throw new Error("form not found");
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledWith("Super Mario");
  });

  it("shows correct result message when submitted=true and result=correct", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result="correct"
        submitted
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/title correct/i)).toBeInTheDocument();
  });

  it("shows incorrect result message with correct title when result=incorrect", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result="incorrect"
        submitted
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByText("Super Mario Bros")).toBeInTheDocument();
  });

  it("hides the input when submitted=true", () => {
    render(
      <TitleGuessInput
        correctTitle="Super Mario Bros"
        result="correct"
        submitted
        onSubmit={onSubmit}
      />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
