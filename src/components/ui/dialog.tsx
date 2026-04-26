'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/libs/cn';

let createPortalFn: typeof import('react-dom').createPortal | null = null;
const loadCreatePortal = async () => {
  if (typeof window !== 'undefined' && !createPortalFn) {
    const reactDom = await import('react-dom');
    createPortalFn = reactDom.createPortal;
  }
  return createPortalFn;
};

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

export function Dialog({ children, open, onOpenChange }: { children: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [portalReady, setPortalReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    loadCreatePortal().then(() => {
      setPortalReady(true);
    });
  }, []);

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

  if (!open || !portalReady || !createPortalFn) {
    return null;
  }

  const closeDialog = () => onOpenChange(false);

  return createPortalFn(
    <DialogContext value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          role="button"
          aria-label="Close dialog"
          tabIndex={0}
          onClick={closeDialog}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
              e.preventDefault();
              closeDialog();
            }
          }}
        />
        <div className="relative z-9999 flex w-full max-w-full items-center justify-center">
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
        'relative w-full rounded-lg bg-white p-6 text-gray-900 shadow-xl mx-auto dark:border dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
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
    <h2 className={cn('text-lg font-semibold text-gray-900 dark:text-gray-100', className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm text-gray-500 dark:text-slate-300', className)} {...props}>
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
        'absolute top-4 right-4 rounded-sm text-gray-600 opacity-80 hover:bg-slate-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-pink-500 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
        className,
      )}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
}

export function DialogFooter({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex justify-end gap-2 mt-6', className)} {...props}>
      {children}
    </div>
  );
}
