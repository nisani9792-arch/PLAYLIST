import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeUpVariants, springSoft } from '@/lib/motion-presets';
import { cn } from '@/lib/utils';

type MotionSurfaceProps = HTMLMotionProps<'div'> & {
  glass?: boolean;
  glow?: boolean;
};

export function MotionSurface({
  className,
  glass = true,
  glow = false,
  children,
  ...props
}: MotionSurfaceProps) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      transition={springSoft}
      className={cn(
        glass && 'j-glass-panel',
        !glass && 'j-surface-card',
        glow && 'j-glow-primary',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
