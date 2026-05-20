import { forwardRef } from 'react';
import { Dialog, DialogProps } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

const MotionPaper = motion.div;

const dialogVariants: Record<string, any> = {
  hidden: {
    opacity: 0,
    scale: 0.75,
    y: 40,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: 20,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

// Custom Paper component that wraps Dialog content with framer-motion
const AnimatedPaper = forwardRef<HTMLDivElement, any>(function AnimatedPaper(props, ref) {
  return (
    <MotionPaper
      ref={ref}
      {...props}
      variants={dialogVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        ...props.style,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
      }}
    />
  );
});

export function AnimatedDialog({ children, open, ...props }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <Dialog
          open={open}
          {...props}
          PaperComponent={AnimatedPaper}
          slotProps={{
            backdrop: {
              sx: {
                backdropFilter: 'blur(4px)',
                backgroundColor: 'rgba(0,0,0,0.3)',
              },
            },
            ...props.slotProps,
          }}
          PaperProps={{
            ...props.PaperProps,
            sx: {
              borderRadius: '16px !important',
              boxShadow: '0 24px 48px rgba(45, 27, 105, 0.2), 0 8px 16px rgba(124, 92, 191, 0.1)',
              ...props.PaperProps?.sx,
            },
          }}
        >
          {children}
        </Dialog>
      )}
    </AnimatePresence>
  );
}
