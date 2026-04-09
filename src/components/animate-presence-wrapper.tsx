"use client";

import { AnimatePresence, type AnimatePresenceProps } from "framer-motion";

interface AnimatePresenceWrapperProps extends AnimatePresenceProps {
  children: React.ReactNode;
}

/**
 * Client-side AnimatePresence wrapper for use in Server Components.
 * Wrap route transitions or conditional renders with this component
 * to get enter/exit animations via Framer Motion.
 */
export function AnimatePresenceWrapper({ children, ...props }: AnimatePresenceWrapperProps) {
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
}
