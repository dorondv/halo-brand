import * as React from 'react';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['rounded-lg border border-gray-200 bg-white', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['p-4', className].filter(Boolean).join(' ')} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['text-lg font-semibold leading-none tracking-tight', className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['p-4 pt-0', className].filter(Boolean).join(' ')} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={['text-sm text-gray-500 mt-1', className].filter(Boolean).join(' ')} {...props} />
  );
}
