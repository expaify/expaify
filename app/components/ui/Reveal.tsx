'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children?: React.ReactNode;
  delayMs?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
}

export function Reveal({
  children,
  delayMs,
  className,
  as = 'div',
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const el = ref.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px',
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const Component = as as unknown as React.ElementType;

  const mergedStyle =
    delayMs !== undefined ? { ...style, transitionDelay: `${delayMs}ms` } : style;

  return (
    <Component
      ref={ref}
      className={['reveal', className].filter(Boolean).join(' ')}
      data-revealed={revealed}
      style={mergedStyle}
    >
      {children}
    </Component>
  );
}
