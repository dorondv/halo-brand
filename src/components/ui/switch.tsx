'use client';

import { cn } from '@/libs/cn';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  isRTL?: boolean;
};

export function Switch({ checked, onCheckedChange, disabled, className, isRTL = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900',
        checked ? 'bg-pink-500' : 'bg-gray-200 dark:bg-gray-700',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked
            ? (isRTL ? '-translate-x-5' : 'translate-x-5')
            : 'translate-x-0',
        )}
      />
    </button>
  );
}
