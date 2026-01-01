/**
 * Animation utilities for Framer Motion
 *
 * Standardized animation variants and configs used across the application
 */

import { Variants } from 'framer-motion';

// ============================================================================
// PAGE TRANSITION ANIMATIONS
// ============================================================================

/**
 * Standard page transition - fade in with slight upward movement
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * Page transition config for layout routes
 */
export const pageTransitionConfig = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: pageTransition,
  transition: { duration: 0.25, ease: 'easeInOut' },
};

// ============================================================================
// FADE IN ANIMATIONS
// ============================================================================

/**
 * Simple fade in animation
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

/**
 * Fade in with upward slide
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Fade in with downward slide
 */
export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
};

// ============================================================================
// STAGGER ANIMATIONS (for lists/grids)
// ============================================================================

/**
 * Container variant for staggered children animations
 * Items appear one after another with noticeable delay
 */
export const staggerContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

/**
 * Item variant for staggered animations (fade + scale)
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
};

/**
 * Fast stagger for large grids (e.g., warehouse view with many items)
 * 10x faster than regular stagger
 */
export const staggerFastContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.01,
      delayChildren: 0.05,
    },
  },
};

export const staggerFastItem: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
};

/**
 * Stagger with slide up - for items that slide up while fading in
 */
export const staggerUpContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const staggerUpItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
};

// ============================================================================
// CARD/GRID ANIMATIONS
// ============================================================================

/**
 * Card entrance animation
 */
export const cardEntrance: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

/**
 * Grid container with staggered card animations
 * Cards appear one after another with noticeable delay
 */
export const gridContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

export const gridItem: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: {
    duration: 0.4,
    ease: [0.25, 0.1, 0.25, 1],
  },
};

// ============================================================================
// LIST ANIMATIONS
// ============================================================================

/**
 * List container with staggered items
 */
export const listContainer: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const listItem: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
};

// ============================================================================
// DRAWER/SHEET ANIMATIONS
// ============================================================================

/**
 * Slide in from right
 */
export const slideInRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

/**
 * Slide in from left
 */
export const slideInLeft: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
};

/**
 * Scale from center (for modals/dialogs)
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// ============================================================================
// PRESET TRANSITION VALUES
// ============================================================================

export const transitions = {
  /** Fast transition for subtle animations */
  fast: { duration: 0.15, ease: 'easeInOut' },

  /** Default transition */
  default: { duration: 0.25, ease: 'easeInOut' },

  /** Smooth spring animation */
  spring: { type: 'spring', stiffness: 300, damping: 25 },

  /** Bouncy spring */
  bouncy: { type: 'spring', stiffness: 400, damping: 15 },

  /** Smooth ease */
  smooth: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
} as const;

// ============================================================================
// HOVER ANIMATIONS
// ============================================================================

/**
 * Hover effect with scale
 */
export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15 },
};

/**
 * Hover effect with lift
 */
export const hoverLift = {
  whileHover: { y: -2, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' },
  transition: { duration: 0.2 },
};
