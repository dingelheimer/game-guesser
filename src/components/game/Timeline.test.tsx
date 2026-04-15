// SPDX-License-Identifier: AGPL-3.0-only
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";

// @testing-library/react does not auto-register cleanup in vitest without
// globals:true. Register it explicitly so each test starts with a clean DOM.
afterEach(cleanup);
import { Timeline } from "./Timeline";
import type { TimelineItem } from "./Timeline";

interface MockDndContextProps {
  children: React.ReactNode;
  sensors?: unknown;
  onDragStart?: () => void;
  onDragOver?: (event: { over: { id: string } | null }) => void;
  onDragEnd?: (event: { over: { id: string } | null }) => void;
  onDragCancel?: () => void;
}

interface MockDragOverlayProps {
  children: React.ReactNode;
  dropAnimation?: {
    duration?: number;
    easing?: string;
    sideEffects?: unknown;
  };
}

const hoistedState = vi.hoisted(() => ({
  lastDndContextProps: null as MockDndContextProps | null,
  lastDragOverlayProps: null as MockDragOverlayProps | null,
  mockUseReducedMotion: vi.fn(() => false),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

      return (
        <div data-layout={layout === true ? "true" : undefined} {...rest}>
          {children}
        </div>
      );
    },
    span: ({ children, animate, initial, transition, ...rest }: any) => {
      void animate;
      void initial;
      void transition;

      return <span {...rest}>{children}</span>;
    },
  },
  useReducedMotion: hoistedState.mockUseReducedMotion,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, ...rest }: MockDndContextProps) => {
    hoistedState.lastDndContextProps = { children, ...rest };
    return <>{children}</>;
  },
  DragOverlay: ({ children, ...rest }: MockDragOverlayProps) => {
    hoistedState.lastDragOverlayProps = { children, ...rest };
    return <>{children}</>;
  },
  useDroppable: vi.fn((opts: { id: string }) => ({
    setNodeRef: vi.fn(),
    isOver: false,
    id: opts.id,
  })),
  useDraggable: vi.fn(() => ({
    attributes: { role: "button", tabIndex: 0 },
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  })),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  TouchSensor: vi.fn(),
  useSensor: vi.fn((S: unknown) => S),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  defaultDropAnimationSideEffects: vi.fn(() => vi.fn()),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const card1: TimelineItem = {
  id: "1",
  screenshotImageId: "img1",
  coverImageId: "cover1",
  title: "Half-Life 2",
  releaseYear: 2004,
  platform: "PC",
  isRevealed: true,
};

const card2: TimelineItem = {
  id: "2",
  screenshotImageId: "img2",
  coverImageId: "cover2",
  title: "Minecraft",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: true,
};

const card3: TimelineItem = {
  id: "3",
  screenshotImageId: "img3",
  coverImageId: "cover3",
  title: "The Witcher 3",
  releaseYear: 2015,
  platform: "PC",
  isRevealed: true,
};

const pendingCard: TimelineItem = {
  id: "99",
  screenshotImageId: "img99",
  coverImageId: "cover99",
  title: "Portal 2",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: false,
};

const tentativeTimelineCard: TimelineItem = {
  id: "4",
  screenshotImageId: "img4",
  coverImageId: null,
  title: "?",
  releaseYear: 0,
  platform: "?",
  isRevealed: false,
};

/** Returns all drop zone buttons (excludes the draggable pending card). */
function getDropZones() {
  return screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-label")?.includes("Place card") === true);
}

/** Returns the drop zone button at the given index, throwing if absent. */
function getDropZone(index: number): HTMLElement {
  const zone = getDropZones()[index];
  if (!zone) throw new Error(`Expected drop zone at index ${String(index)}`);
  return zone;
}

/** Returns the active drag overlay wrapper while a drag is in progress. */
function getDragOverlay(container: HTMLElement): HTMLDivElement {
  const overlay = Array.from(container.querySelectorAll("div")).find((element) =>
    element.className.includes("scale-95 rotate-2"),
  );
  if (!(overlay instanceof HTMLDivElement)) {
    throw new Error("Expected drag overlay wrapper");
  }
  return overlay;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedState.lastDndContextProps = null;
    hoistedState.lastDragOverlayProps = null;
    hoistedState.mockUseReducedMotion.mockReturnValue(false);
  });

  // ── Structure ──────────────────────────────────────────────────────────────

  describe("structure", () => {
    it("renders the timeline group with the correct ARIA label", () => {
      render(<Timeline placedCards={[]} />);
      expect(screen.getByRole("group", { name: "Your timeline" })).toBeInTheDocument();
    });

    it("renders no drop zones when there is no pending card", () => {
      render(<Timeline placedCards={[card1, card2]} />);
      expect(screen.queryAllByRole("button").length).toBe(0);
    });

    it("renders 1 drop zone with 0 placed cards and a pending card", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      expect(getDropZones()).toHaveLength(1);
    });

    it("renders n+1 drop zones for n placed cards when a pending card exists", () => {
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);
      expect(getDropZones()).toHaveLength(3);
    });

    it("renders n+1 drop zones for 3 placed cards", () => {
      render(<Timeline placedCards={[card1, card2, card3]} pendingCard={pendingCard} />);
      expect(getDropZones()).toHaveLength(4);
    });

    it("renders year markers for each placed card", () => {
      render(<Timeline placedCards={[card1, card2]} />);
      // Year text appears in both the GameCard face and the YearMarker badge.
      expect(screen.getAllByText("2004").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("2011").length).toBeGreaterThanOrEqual(1);
    });

    it("centers the desktop rail and applies the xl timeline sizing classes", () => {
      const { container } = render(
        <Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />,
      );
      const rail = screen.getByRole("group", { name: "Your timeline" });
      const timelineCard = Array.from(container.querySelectorAll("div")).find((element) =>
        element.className.includes("xl:w-[220px]"),
      );

      expect(rail.className).toContain("md:justify-center");
      expect(timelineCard?.className).toContain("w-[40vw] md:w-[180px] lg:w-[200px] xl:w-[220px]");
      expect(getDropZone(0)).toHaveClass("xl:h-[293px]");
    });

    it("renders the pending card screenshot when provided", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      const screenshots = screen.getAllByAltText("Game screenshot");
      expect(screenshots.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render the pending card when pendingCard is null", () => {
      render(<Timeline placedCards={[card1]} pendingCard={null} />);
      // No drag handle and no drop zones
      expect(screen.queryAllByRole("button").length).toBe(0);
    });

    it("shows an empty-state message when there are no cards and no pending card", () => {
      render(<Timeline placedCards={[]} />);
      expect(screen.getByText("No cards placed yet")).toBeInTheDocument();
    });

    it("does not show empty-state message when pending card is present", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      expect(screen.queryByText("No cards placed yet")).not.toBeInTheDocument();
    });

    it("does not render a year marker for unrevealed timeline cards", () => {
      const { container } = render(<Timeline placedCards={[tentativeTimelineCard]} />);

      const yearBadge = container.querySelector('span[class*="text-xs"][class*="tabular-nums"]');

      expect(yearBadge).not.toBeInTheDocument();
    });
  });

  // ── Tap to place ───────────────────────────────────────────────────────────

  describe("tap to place", () => {
    it("calls onPlaceCard(0) when the first drop zone is clicked", async () => {
      const user = userEvent.setup();
      const onPlace = vi.fn();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} onPlaceCard={onPlace} />);

      await user.click(getDropZone(0));
      expect(onPlace).toHaveBeenCalledWith(0);
    });

    it("calls onPlaceCard(1) when the second drop zone is clicked", async () => {
      const user = userEvent.setup();
      const onPlace = vi.fn();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} onPlaceCard={onPlace} />);

      await user.click(getDropZone(1));
      expect(onPlace).toHaveBeenCalledWith(1);
    });

    it("calls onPlaceCard(2) when the third drop zone is clicked (3 zones)", async () => {
      const user = userEvent.setup();
      const onPlace = vi.fn();
      render(
        <Timeline placedCards={[card1, card2]} pendingCard={pendingCard} onPlaceCard={onPlace} />,
      );

      await user.click(getDropZone(2));
      expect(onPlace).toHaveBeenCalledWith(2);
    });

    it("does not throw when no onPlaceCard handler is provided", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      await expect(user.click(getDropZone(0))).resolves.not.toThrow();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe("accessibility", () => {
    it("labels zone 0 as 'first position' when there are no placed cards", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      expect(screen.getByRole("button", { name: /first position/i })).toBeInTheDocument();
    });

    it("labels zone 0 as 'before [first card]' when placed cards exist", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      expect(screen.getByRole("button", { name: /before Half-Life 2/i })).toBeInTheDocument();
    });

    it("labels the last zone as 'after [last card]'", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      expect(screen.getByRole("button", { name: /after Half-Life 2/i })).toBeInTheDocument();
    });

    it("labels an intermediate zone as 'between [card A] and [card B]'", () => {
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);
      expect(
        screen.getByRole("button", { name: /between Half-Life 2 and Minecraft/i }),
      ).toBeInTheDocument();
    });

    it("prompts to press Enter on each drop zone label", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      const zones = getDropZones();
      zones.forEach((zone) => {
        expect(zone.getAttribute("aria-label")).toMatch(/press enter to confirm/i);
      });
    });

    it("year markers are hidden from screen readers (aria-hidden)", () => {
      const { container } = render(<Timeline placedCards={[card1]} />);
      const yearEl = container.querySelector('[aria-hidden="true"]');
      expect(yearEl).toBeInTheDocument();
    });

    it("first zone starts with tabIndex 0 (roving tabindex entry point)", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      const zones = getDropZones();
      expect(zones[0]).toHaveAttribute("tabindex", "0");
      expect(zones[1]).toHaveAttribute("tabindex", "-1");
    });
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  describe("keyboard navigation", () => {
    it("moves focus to the next zone with ArrowRight", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(0).focus();
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(zones[1]);
    });

    it("moves focus to the next zone with ArrowDown", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(0).focus();
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(zones[1]);
    });

    it("moves focus to the previous zone with ArrowLeft", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(1).focus();
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(zones[0]);
    });

    it("moves focus to the previous zone with ArrowUp", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(1).focus();
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(zones[0]);
    });

    it("places a card with Enter on a focused drop zone", async () => {
      const user = userEvent.setup();
      const onPlace = vi.fn();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} onPlaceCard={onPlace} />);

      getDropZone(1).focus();
      await user.keyboard("{Enter}");
      expect(onPlace).toHaveBeenCalledWith(1);
    });

    it("does not navigate past zone 0 with ArrowLeft", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(0).focus();
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(zones[0]);
    });

    it("does not navigate past the last zone with ArrowRight", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      const last = zones.at(-1);
      if (!last) throw new Error("Expected at least one drop zone");
      last.focus();
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(last);
    });

    it("chains navigation: ArrowRight × 2 from zone 0 reaches zone 2", async () => {
      const user = userEvent.setup();
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);

      const zones = getDropZones();
      getDropZone(0).focus();
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(zones[2]);
    });
  });

  describe("drag overlay", () => {
    it("configures the drop animation with the story timing and source-hiding side effect", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      expect(hoistedState.lastDragOverlayProps?.dropAnimation?.duration).toBe(300);
      expect(hoistedState.lastDragOverlayProps?.dropAnimation?.easing).toBe(
        "cubic-bezier(0.25, 1, 0.5, 1)",
      );
      expect(typeof hoistedState.lastDragOverlayProps?.dropAnimation?.sideEffects).toBe("function");
    });

    it("disables drop animation timing when reduced motion is preferred", () => {
      hoistedState.mockUseReducedMotion.mockReturnValue(true);

      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      expect(hoistedState.lastDragOverlayProps?.dropAnimation?.duration).toBe(0);
    });

    it("renders a timeline-sized overlay and adds the drop-zone glow on valid hover", () => {
      const { container } = render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      act(() => {
        hoistedState.lastDndContextProps?.onDragStart?.();
      });

      act(() => {
        hoistedState.lastDndContextProps?.onDragOver?.({ over: { id: "zone-1" } });
      });

      const overlay = getDragOverlay(container);
      const overlayCard = Array.from(overlay.querySelectorAll("div")).find((element) =>
        element.className.includes("xl:w-[220px]"),
      );

      expect(overlay.className).toContain("rotate-2");
      expect(overlay.className).toContain("opacity-80");
      expect(overlay.className).toContain("ring-primary-400");
      expect(overlay.className).toContain("shadow-[0_0_24px_rgba(139,92,246,0.45)]");
      expect(overlay.className).toContain("ring-2");
      expect(overlayCard?.className).toContain(
        "w-[40vw] shrink-0 md:w-[180px] lg:w-[200px] xl:w-[220px]",
      );
    });

    it("removes the overlay glow when no valid zone is active", () => {
      const { container } = render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

      act(() => {
        hoistedState.lastDndContextProps?.onDragStart?.();
      });
      act(() => {
        hoistedState.lastDndContextProps?.onDragOver?.({ over: { id: "zone-1" } });
      });

      expect(getDragOverlay(container).className).toContain("ring-primary-400");

      act(() => {
        hoistedState.lastDndContextProps?.onDragOver?.({ over: null });
      });

      expect(getDragOverlay(container).className).not.toContain("ring-primary-400");
      expect(getDragOverlay(container).className).not.toContain(
        "shadow-[0_0_24px_rgba(139,92,246,0.45)]",
      );
    });
  });

  describe("incorrect placement feedback", () => {
    it("highlights the specified timeline card with layout-enabled feedback styling", () => {
      const { container } = render(
        <Timeline
          placedCards={[card1, tentativeTimelineCard]}
          highlightedCardId="4"
          highlightedCardTone="error"
        />,
      );

      const highlightedWrapper = Array.from(container.querySelectorAll("div")).find((element) =>
        element.className.includes("ring-rose-500"),
      );
      const layoutWrapper = highlightedWrapper?.parentElement;

      expect(highlightedWrapper?.className).toContain("ring-rose-500");
      expect(highlightedWrapper?.className).toContain("shadow-[0_0_20px_rgba(244,63,94,0.35)]");
      expect(layoutWrapper).toHaveAttribute("data-layout", "true");
    });
  });
});
