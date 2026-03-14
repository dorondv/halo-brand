'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTheme } from '@/components/theme/theme-context';
import { useHasMounted } from '@/components/theme/useHasMounted';

type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ className = '', width = 32, height = 32 }: LogoProps) {
  const mounted = useHasMounted();
  const { isDark } = useTheme();
  const [useFallback, setUseFallback] = useState(false);

  // Use light logo until mounted to avoid hydration mismatch (server has no theme)
  const logoSrc = mounted && isDark ? '/assets/images/logo-inverted.svg' : '/assets/images/logo.svg';
  const src = useFallback ? '/logo.png' : logoSrc;

  return (
    <div
      className={`${className} flex items-center justify-center transition-opacity hover:opacity-90`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <Image
        src={src}
        alt="Branda Logo"
        width={width}
        height={height}
        className="h-full w-full object-contain drop-shadow-sm"
        priority
        onError={() => setUseFallback(true)}
      />
    </div>
  );
}
