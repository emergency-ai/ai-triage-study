"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export interface MarqueeTextProps {
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * Scroll long single-line text when it overflows its container.
 * Matches the dashboard SessionItem marquee behavior in MasTER client.
 */
export function MarqueeText({ children, style }: MarqueeTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (boxRef.current && textRef.current) {
      setIsOverflowing(textRef.current.scrollWidth > boxRef.current.offsetWidth);
    }
  }, [children]);

  return (
    <div
      ref={boxRef}
      style={{
        overflow: "hidden",
        minWidth: 0,
        position: "relative",
        width: "100%",
      }}
    >
      <span
        ref={textRef}
        style={
          isOverflowing
            ? {
                display: "inline-block",
                whiteSpace: "nowrap",
                animation: "marquee 3s linear infinite alternate",
                ...style,
              }
            : { whiteSpace: "nowrap", display: "inline-block", textAlign: "left", ...style }
        }
      >
        {children}
      </span>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% + 100px)); }
        }
      `}</style>
    </div>
  );
}
