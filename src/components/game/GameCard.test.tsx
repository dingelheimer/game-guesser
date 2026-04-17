// SPDX-License-Identifier: AGPL-3.0-only
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameCard } from "./GameCard";

// next/image renders a real <img> in tests
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

// framer-motion: skip animations, pass through children and props
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, animate, initial, transition, layout, ...rest }: any) => {
      void animate;
      void initial;
      void transition;
      void layout;

      return <div {...rest}>{children}</div>;
    },
  },
  useReducedMotion: vi.fn(() => false),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const defaultProps = {
  screenshotImageId: "abc123",
  coverImageId: "def456",
  title: "Half-Life 2",
  releaseYear: 2004,
  platform: "PC",
  isRevealed: false,
};

describe("GameCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders a skeleton with aria-busy when isLoading is true", () => {
      const { container } = render(<GameCard {...defaultProps} isLoading />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveAttribute("aria-busy", "true");
      expect(wrapper).toHaveAttribute("aria-label", "Loading game card");
      expect(wrapper.className).toContain("aspect-video");
    });

    it("does not render the mystery badge or title while loading", () => {
      render(<GameCard {...defaultProps} isLoading />);
      expect(screen.queryByText("?")).not.toBeInTheDocument();
      expect(screen.queryByText("Half-Life 2")).not.toBeInTheDocument();
    });
  });

  describe("hidden state (isRevealed = false)", () => {
    it("renders the mystery '?' badge", () => {
      render(<GameCard {...defaultProps} />);
      // Both faces in DOM for 3-D flip — at least one '?' exists
      expect(screen.getAllByText("?").length).toBeGreaterThanOrEqual(1);
    });

    it("renders screenshot image with correct src", () => {
      const { container } = render(<GameCard {...defaultProps} />);
      const wrapper = container.firstChild as HTMLElement;
      const imgs = screen.getAllByAltText("Game screenshot");

      expect(wrapper.className).toContain("aspect-video");
      expect(wrapper.className).toContain(
        "w-[80vw] shrink-0 md:w-[440px] lg:w-[540px] xl:w-[620px]",
      );
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://images.igdb.com/igdb/image/upload/t_screenshot_big/abc123.jpg",
      );
      expect(imgs[0]).toHaveClass("object-cover");
      expect(imgs[0]).toHaveAttribute(
        "sizes",
        "(max-width: 768px) 80vw, (max-width: 1024px) 440px, (max-width: 1280px) 540px, 620px",
      );
      expect(screen.getByRole("button", { name: "View full-size screenshot" })).toBeInTheDocument();
    });

    it("uses mobile screenshot URL for size=timeline variant", () => {
      const { container } = render(<GameCard {...defaultProps} size="timeline" />);
      const wrapper = container.firstChild as HTMLElement;
      const imgs = screen.getAllByAltText("Game screenshot");
      // Verify size=timeline is applied via sizes attribute
      expect(wrapper.className).toContain("aspect-video");
      expect(imgs[0]).toHaveAttribute(
        "sizes",
        "(max-width: 768px) 40vw, (max-width: 1024px) 180px, (max-width: 1280px) 200px, 220px",
      );
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://images.igdb.com/igdb/image/upload/t_screenshot_med/abc123.jpg",
      );
      expect(
        screen.queryByRole("button", { name: "View full-size screenshot" }),
      ).not.toBeInTheDocument();
    });

    it("labels the card as a mystery card", () => {
      render(<GameCard {...defaultProps} />);
      // getAllByLabelText because both faces share the outer motion.div aria-label
      const el = screen.getAllByLabelText("Mystery game card");
      expect(el.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("revealed state (isRevealed = true)", () => {
    const revealedProps = { ...defaultProps, isRevealed: true };

    it("renders the game title", () => {
      const { container } = render(<GameCard {...revealedProps} />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper.className).toContain("aspect-[3/4]");
      expect(screen.getAllByText("Half-Life 2").length).toBeGreaterThanOrEqual(1);
    });

    it("renders the release year", () => {
      render(<GameCard {...revealedProps} />);
      const years = screen.getAllByLabelText("Release year: 2004");
      expect(years.length).toBeGreaterThanOrEqual(1);
      expect(years[0]).toHaveTextContent("2004");
    });

    it("renders the platform name", () => {
      render(<GameCard {...revealedProps} />);
      expect(screen.getAllByText("PC").length).toBeGreaterThanOrEqual(1);
    });

    it("renders cover art with correct src", () => {
      render(<GameCard {...revealedProps} />);
      const imgs = screen.getAllByAltText("Half-Life 2 cover art");
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://images.igdb.com/igdb/image/upload/t_cover_big/def456.jpg",
      );
      expect(imgs[0]).toHaveAttribute(
        "sizes",
        "(max-width: 768px) 80vw, (max-width: 1024px) 440px, (max-width: 1280px) 540px, 620px",
      );
    });

    it("labels the card with title and year", () => {
      render(<GameCard {...revealedProps} />);
      const labels = screen.getAllByLabelText("Half-Life 2, 2004");
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render the screenshot viewer trigger once revealed", () => {
      render(<GameCard {...revealedProps} />);

      expect(
        screen.queryByRole("button", { name: "View full-size screenshot" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("null image IDs (graceful fallback)", () => {
    it("renders without crashing when screenshotImageId is null", () => {
      render(<GameCard {...defaultProps} screenshotImageId={null} />);
      expect(screen.getAllByText("?").length).toBeGreaterThanOrEqual(1);
    });

    it("renders without crashing when coverImageId is null", () => {
      render(<GameCard {...defaultProps} isRevealed coverImageId={null} />);
      expect(screen.getAllByText("Half-Life 2").length).toBeGreaterThanOrEqual(1);
    });
  });
});
