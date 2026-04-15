// SPDX-License-Identifier: AGPL-3.0-only
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { Timeline } from "./Timeline";
import type { TimelineItem } from "./Timeline";

afterEach(cleanup);

interface MockDndContextProps {
  children: React.ReactNode;
  sensors?: unknown;
  accessibility?: { announcements?: Record<string, unknown> };
  onDragStart?: (event: { active: { id: string } }) => string | undefined;
  onDragOver?: (event: { over: { id: string } | null }) => void;
  onDragEnd?: (event: { over: { id: string } | null }) => void;
  onDragCancel?: () => void;
}

const hoistedState = vi.hoisted(() => ({
  lastDndContextProps: null as MockDndContextProps | null,
  mockUseReducedMotion: vi.fn(() => false),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
    span: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
  },
  useReducedMotion: hoistedState.mockUseReducedMotion,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, ...rest }: MockDndContextProps) => {
    hoistedState.lastDndContextProps = { children, ...rest };
    return <>{children}</>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  screenshotImageId: null,
  coverImageId: null,
  title: "Half-Life 2",
  releaseYear: 2004,
  platform: "PC",
  isRevealed: true,
};

const card2: TimelineItem = {
  id: "2",
  screenshotImageId: null,
  coverImageId: null,
  title: "Portal 2",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: true,
};

const pendingCard: TimelineItem = {
  id: "99",
  screenshotImageId: null,
  coverImageId: null,
  title: "Minecraft",
  releaseYear: 2011,
  platform: "PC",
  isRevealed: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

type AnnouncementFn = (event: { active?: { id: string }; over?: { id: string } | null }) => string;
interface CapturedAnnouncements {
  onDragStart: AnnouncementFn;
  onDragOver: AnnouncementFn;
  onDragEnd: AnnouncementFn;
  onDragCancel: AnnouncementFn;
}

function getAnnouncements(): CapturedAnnouncements {
  const props = hoistedState.lastDndContextProps;
  if (props === null) throw new Error("DndContext was not rendered");
  const ann = props.accessibility?.announcements;
  if (ann === undefined) throw new Error("accessibility.announcements not set");
  return ann as unknown as CapturedAnnouncements;
}

describe("Timeline dnd-kit announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoistedState.lastDndContextProps = null;
  });

  it("passes an accessibility.announcements object to DndContext", () => {
    render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);
    expect(hoistedState.lastDndContextProps?.accessibility?.announcements).toBeDefined();
  });

  describe("onDragStart", () => {
    it("returns a message naming the pending card", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragStart({ active: { id: "card-99" } });
      expect(result).toContain("Minecraft");
    });
  });

  describe("onDragOver", () => {
    it("returns a 'not over a drop zone' message when over is null", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragOver({ over: null });
      expect(result).toContain("Not over a drop zone");
    });

    it("returns a positional message when hovering over zone 1 (between cards)", () => {
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragOver({ over: { id: "zone-1" } });
      expect(result).toContain("Half-Life 2 (2004)");
      expect(result).toContain("Portal 2 (2011)");
    });
  });

  describe("onDragEnd", () => {
    it("returns a 'cancelled' message when dropped outside any zone", () => {
      render(<Timeline placedCards={[card1]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragEnd({ over: null });
      expect(result).toContain("cancelled");
    });

    it("returns a placed message naming the card and position", () => {
      render(<Timeline placedCards={[card1, card2]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragEnd({ over: { id: "zone-1" } });
      expect(result).toContain("Minecraft");
      expect(result).toContain("Half-Life 2");
    });
  });

  describe("onDragCancel", () => {
    it("returns a cancellation message", () => {
      render(<Timeline placedCards={[]} pendingCard={pendingCard} />);
      const result = getAnnouncements().onDragCancel({});
      expect(result).toContain("cancelled");
    });
  });
});
