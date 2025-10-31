'use client';

import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/libs/cn';

import { buttonVariants } from './button-variants';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = (
  { ref, className, variant, size, type = 'button', ...props }: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> },
) => (
  <button
    ref={ref}
    type={type}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
);
Button.displayName = 'Button';

export { Button };
