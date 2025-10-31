'use client';

import * as React from 'react';
import { cn } from '@/libs/cn';

type LabelProps = { } & React.LabelHTMLAttributes<HTMLLabelElement>;

/* eslint-disable jsx-a11y/label-has-associated-control */
const Label = ({ ref, className, ...props }: LabelProps & { ref?: React.RefObject<HTMLLabelElement | null> }) => (
  <label
    ref={ref}
    className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
);
/* eslint-enable jsx-a11y/label-has-associated-control */
Label.displayName = 'Label';

export { Label };
