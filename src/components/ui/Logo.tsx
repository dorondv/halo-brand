'use client';

import Image from 'next/image';
import { useState } from 'react';

type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ className = '', width = 32, height = 32 }: LogoProps) {
  const [imgSrc, setImgSrc] = useState('/assets/images/logo.png');

  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <Image
        src={imgSrc}
        alt="Halo Brand Logo"
        width={width}
        height={height}
        className="h-full w-full object-contain"
        priority
        onError={() => {
          // Fallback to /logo.png if the first path doesn't work
          if (imgSrc !== '/logo.png') {
            setImgSrc('/logo.png');
          }
        }}
      />
    </div>
  );
}
