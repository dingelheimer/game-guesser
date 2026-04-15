// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared motion configuration for Framer Motion animations.
 *
 * Import from this module instead of hardcoding timing values in components
 * so that durations, easing curves, and spring config are consistent across
 * the app and easy to tune from a single location.
 */
export const MOTION = {
  duration: {
    /** Quick state feedback: badge slides, platform result (0.15s). */
    fast: 0.15,
    /** Standard transitions: page fades, timeline layout shifts (0.3s). */
    normal: 0.3,
    /** Deliberate animations: card flip (0.6s). */
    slow: 0.6,
  },
  ease: {
    /** Material Design standard curve — balanced acceleration/deceleration. */
    default: [0.4, 0, 0.2, 1] as const,
    /** Ease-out — natural deceleration for entry animations. */
    out: [0.22, 1, 0.36, 1] as const,
    /** Snappy ease-out — used for timeline layout and drop animations. */
    snappy: [0.25, 1, 0.5, 1] as const,
    /** Slight overshoot — used for spring-like CSS transitions. */
    bounce: [0.34, 1.56, 0.64, 1] as const,
  },
  /** Spring config for drop zone width animations. */
  spring: { stiffness: 500, damping: 30 } as const,
} as const;
