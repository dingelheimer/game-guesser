// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "./Timeline";
import { Timeline } from "./Timeline";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    fill,
    priority,
    ...rest
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    priority?: boolean;
    className?: string;
    [key: string]: unknown;
  }) => {
    void fill;
    void priority;

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} {...rest} />
    );
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, animate, initial, transition, layout, ...rest }: any) => {
      void animate;
      void initial;
      void transition;
      void layout;

      return <div {...rest}>{children}</div>;
    },
    span: ({ children, animate, initial, transition, ...rest }: any) => {
      void animate;
      void initial;
      void transition;

      return <span {...rest}>{children}</span>;
    },
  },
  useReducedMotion: vi.fn(() => false),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const tentativeCard: TimelineItem = {
  id: "7",
  screenshotImageId: "shot_7",
  coverImageId: null,
  title: "?",
  releaseYear: 0,
  platform: "?",
  isRevealed: false,
};

const revealedCard: TimelineItem = {
  id: "7",
  screenshotImageId: "shot_7",
  coverImageId: "cover_7",
  title: "Portal 2",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: true,
};

describe("Timeline reveal flow", () => {
  it("updates the dropped timeline card from hidden to revealed in place", () => {
    const { rerender } = render(<Timeline placedCards={[tentativeCard]} />);

    const card = screen.getByLabelText("Mystery game card");

    rerender(<Timeline placedCards={[revealedCard]} />);

    expect(card).toHaveAttribute("aria-label", "Portal 2, 2011");
    expect(screen.getAllByText("Portal 2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2011").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PC").length).toBeGreaterThanOrEqual(1);
  });
});
