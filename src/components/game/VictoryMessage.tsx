"use client";

import { useEffect, useRef } from "react";

interface VictoryMessageProps {
  compliment: string;
  visible: boolean;
  onClick: () => void;
}

export default function VictoryMessage({
  compliment,
  visible,
  onClick,
}: VictoryMessageProps) {
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const el = textRef.current;
    if (!el) return;
    const container = el.parentElement;
    if (!container) return;

    const maxW = container.clientWidth * 0.85;
    const maxH = container.clientHeight * 0.85;

    // Binary search for the largest font size that fits
    let lo = 8;
    let hi = 120;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    el.style.fontSize = `${lo}px`;
  }, [visible, compliment]);

  if (!visible) return null;

  return (
    <div
      id="victory-message"
      onClick={onClick}
    >
      <div ref={textRef} className="victory-text-inner">
        {compliment}
        {"\n"}Click to continue...
      </div>
    </div>
  );
}
