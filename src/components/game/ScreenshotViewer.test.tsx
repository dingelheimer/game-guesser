// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenshotViewer } from "./ScreenshotViewer";

const useReducedMotionMock = vi.fn(() => false);

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    width,
    height,
    priority,
    ...rest
  }: {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
    priority?: boolean;
    [key: string]: unknown;
  }) => {
    void width;
    void height;
    void priority;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} {...rest} />
    );
  },
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

describe("ScreenshotViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReducedMotionMock.mockReturnValue(false);
  });

  it("renders the magnifying-glass trigger button", () => {
    render(<ScreenshotViewer screenshotImageId="abc123" title="Half-Life 2" />);

    expect(screen.getByRole("button", { name: "View full-size screenshot" })).toBeInTheDocument();
  });

  it("opens the dialog with the screenshot_huge image URL", async () => {
    const user = userEvent.setup();

    render(<ScreenshotViewer screenshotImageId="abc123" title="Half-Life 2" />);

    await user.click(screen.getByRole("button", { name: "View full-size screenshot" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Full-resolution half-life 2 screenshot for inspecting visual details before placing the card.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Half-Life 2 screenshot")).toHaveAttribute(
      "src",
      "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/abc123.jpg",
    );
  });

  it("stops click propagation from the trigger", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <ScreenshotViewer screenshotImageId="abc123" title="Half-Life 2" />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "View full-size screenshot" }));

    expect(parentClick).not.toHaveBeenCalled();
  });
});
