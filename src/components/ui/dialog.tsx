'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/libs/cn';

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!mounted) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setMounted(true);
    }
  }, [mounted]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <DialogContext value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        {/* Backdrop/Overlay */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          role="button"
          aria-label="Close dialog"
          tabIndex={0}
          onClick={() => onOpenChange(false)}
          onKeyDown={(e) => {
            // Support Enter and Space to activate the backdrop as a button
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
        />
        {/* Dialog content - centered */}
        <div className="relative z-[9999] w-full max-w-md px-4">
          {children}
        </div>
      </div>
    </DialogContext>,
    document.body,
  );
}

export function DialogContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.use(DialogContext);
  if (!ctx) {
    throw new Error('DialogContent must be used within Dialog');
  }

  return (
    <div
      className={cn(
        'relative w-full rounded-lg bg-white p-6 shadow-xl',
        className,
      )}
      // Use pointer down to avoid triggering eslint jsx-a11y/click-events-have-key-events
      onPointerDown={e => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold text-gray-900', className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-gray-500 mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export function DialogClose({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.use(DialogContext);
  if (!ctx) {
    throw new Error('DialogClose must be used within Dialog');
  }

  return (
    <button
      type="button"
      onClick={() => ctx.onOpenChange(false)}
      className={cn(
        'absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-pink-500',
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
}
