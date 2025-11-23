'use client';

import * as React from 'react';
import { cn } from '@/libs/cn';

type ProgressProps = {
  value?: number;
  max?: number;
} & React.HTMLAttributes<HTMLDivElement>;

const Progress = ({ ref, className, value = 0, max = 100, ...props }: ProgressProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-gray-200', className)}
      {...props}
    >
      <div
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
};
Progress.displayName = 'Progress';

export { Progress };
