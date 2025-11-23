'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/libs/cn';

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function Select({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const contextValue = React.useMemo(
    () => ({ value, onValueChange, open, setOpen }),
    [value, onValueChange, open],
  );

  return (
    <SelectContext value={contextValue}>
      <div className="relative" ref={containerRef}>{children}</div>
    </SelectContext>
  );
}

export function SelectTrigger({ children, className, id, dir, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { dir?: 'ltr' | 'rtl' }) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectTrigger must be used within Select');
  }

  const isRTL = dir === 'rtl';

  return (
    <button
      id={id}
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      dir={dir}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        ctx.open && 'ring-2 ring-pink-500',
        className,
      )}
      aria-expanded={ctx.open}
      aria-haspopup="listbox"
      {...props}
    >
      <span className={cn('flex-1', isRTL ? 'text-right' : 'text-left')} dir={dir}>
        {children}
      </span>
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200',
          ctx.open && 'rotate-180',
          'ml-2',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export function SelectValue({ placeholder, selectedLabel, options }: { placeholder?: string; selectedLabel?: string; options?: Array<{ value: string; name: string }> }) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectValue must be used within Select');
  }

  // If selectedLabel is provided, use it
  if (selectedLabel) {
    return <span className="text-gray-900">{selectedLabel}</span>;
  }

  // Otherwise, try to find the label from options
  if (options && ctx.value) {
    const selected = options.find(opt => opt.value === ctx.value);
    if (selected) {
      return <span className="text-gray-900">{selected.name}</span>;
    }
  }

  // Fallback to placeholder or default
  return <span className="text-gray-500">{placeholder || 'Select...'}</span>;
}

export function SelectContent({ children, className, dir }: { children: React.ReactNode; className?: string; dir?: 'ltr' | 'rtl' }) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectContent must be used within Select');
  }

  if (!ctx.open) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg',
        className,
      )}
      dir={dir}
      role="listbox"
    >
      {children}
    </div>
  );
}

export function SelectItem({ children, value, dir, ...props }: { children: React.ReactNode; value: string; dir?: 'ltr' | 'rtl' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectItem must be used within Select');
  }

  const isSelected = ctx.value === value;
  const isRTL = dir === 'rtl';

  return (
    <button
      type="button"
      onClick={() => {
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
      dir={dir}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100',
        isSelected && 'bg-gray-100 font-medium',
        isRTL ? 'text-right' : 'text-left',
      )}
      style={isRTL ? { textAlign: 'right' } : { textAlign: 'left' }}
      {...props}
    >
      {children}
    </button>
  );
}
