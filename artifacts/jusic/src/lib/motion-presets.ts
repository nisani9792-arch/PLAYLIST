import type { Transition, Variants } from 'framer-motion';

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 0.9,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 24,
  mass: 1,
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSoft,
  },
  exit: { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.18 } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const scaleTap = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.985 },
  transition: springSnappy,
};
