'use client';

import * as React from 'react';
import { cn } from '@/libs/cn';

const Textarea = ({ ref, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.RefObject<HTMLTextAreaElement | null> }) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pink-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
};
Textarea.displayName = 'Textarea';

export { Textarea };
