'use client';

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

  return (
    <SelectContext value={{ value, onValueChange, open, setOpen }}>
      <div className="relative" ref={containerRef}>{children}</div>
    </SelectContext>
  );
}

export function SelectTrigger({ children, className, id, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectTrigger must be used within Select');
  }

  return (
    <button
      id={id}
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectValue({ placeholder, selectedLabel }: { placeholder?: string; selectedLabel?: string }) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectValue must be used within Select');
  }

  return <span>{selectedLabel || placeholder || 'Select...'}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectContent must be used within Select');
  }

  if (!ctx.open) {
    return null;
  }

  return (
    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg">
      {children}
    </div>
  );
}

export function SelectItem({ children, value, ...props }: { children: React.ReactNode; value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.use(SelectContext);
  if (!ctx) {
    throw new Error('SelectItem must be used within Select');
  }

  const isSelected = ctx.value === value;

  return (
    <button
      type="button"
      onClick={() => {
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100',
        isSelected && 'bg-gray-100 font-medium',
      )}
      {...props}
    >
      {children}
    </button>
  );
}
