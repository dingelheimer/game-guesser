import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameCard } from "./GameCard";

// next/image renders a real <img> in tests
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    ...rest
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    priority?: boolean;
    className?: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} {...rest} />
  ),
}));

// framer-motion: skip animations, pass through children and props
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
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
      render(<GameCard {...defaultProps} />);
      const imgs = screen.getAllByAltText("Game screenshot");
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://images.igdb.com/igdb/image/upload/t_screenshot_big/abc123.jpg",
      );
    });

    it("uses mobile screenshot URL for size=timeline variant", () => {
      render(<GameCard {...defaultProps} size="timeline" />);
      const imgs = screen.getAllByAltText("Game screenshot");
      // Verify size=timeline is applied via sizes attribute
      expect(imgs[0]).toHaveAttribute("sizes", "(max-width: 768px) 40vw, 200px");
      expect(imgs[0]).toHaveAttribute(
        "src",
        "https://images.igdb.com/igdb/image/upload/t_screenshot_med/abc123.jpg",
      );
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
      render(<GameCard {...revealedProps} />);
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
    });

    it("labels the card with title and year", () => {
      render(<GameCard {...revealedProps} />);
      const labels = screen.getAllByLabelText("Half-Life 2, 2004");
      expect(labels.length).toBeGreaterThanOrEqual(1);
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
