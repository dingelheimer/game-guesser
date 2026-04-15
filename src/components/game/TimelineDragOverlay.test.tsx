// SPDX-License-Identifier: AGPL-3.0-only
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";

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

const pendingCard: TimelineItem = {
  id: "99",
  screenshotImageId: "img99",
  coverImageId: "cover99",
  title: "Portal 2",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: false,
};

/** Returns the drag overlay wrapper div. */
function getDragOverlay(container: HTMLElement): HTMLDivElement {
  const overlay = Array.from(container.querySelectorAll("div")).find(
    (element) =>
      element.className.includes("w-fit") && element.className.includes("pointer-events-none"),
  );
  if (!(overlay instanceof HTMLDivElement)) {
    throw new Error("Expected drag overlay wrapper");
  }
  return overlay;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Timeline — drag overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedState.lastDndContextProps = null;
    hoistedState.lastDragOverlayProps = null;
    hoistedState.mockUseReducedMotion.mockReturnValue(false);
  });

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

  it("wraps the ghost card with w-fit and rounded-xl so the ring hugs the card", () => {
    const { container } = render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

    act(() => {
      hoistedState.lastDndContextProps?.onDragStart?.();
    });

    const overlay = getDragOverlay(container);
    expect(overlay.className).toContain("w-fit");
    expect(overlay.className).toContain("rounded-xl");
  });

  it("removes scale and rotation transforms on drop for visual continuity", () => {
    const { container } = render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

    act(() => {
      hoistedState.lastDndContextProps?.onDragStart?.();
    });

    const overlay = getDragOverlay(container);
    expect(overlay.className).toContain("scale-95");
    expect(overlay.className).toContain("rotate-2");

    act(() => {
      hoistedState.lastDndContextProps?.onDragEnd?.({ over: { id: "zone-1" } });
    });

    expect(overlay.className).not.toContain("scale-95");
    expect(overlay.className).not.toContain("rotate-2");
  });

  it("restores transforms on the next drag after a drop", () => {
    const { container } = render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);

    act(() => {
      hoistedState.lastDndContextProps?.onDragStart?.();
    });
    act(() => {
      hoistedState.lastDndContextProps?.onDragEnd?.({ over: null });
    });

    // Start a second drag — isDropping should reset
    act(() => {
      hoistedState.lastDndContextProps?.onDragStart?.();
    });

    const overlay = getDragOverlay(container);
    expect(overlay.className).toContain("scale-95");
    expect(overlay.className).toContain("rotate-2");
  });
});
