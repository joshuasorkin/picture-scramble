"use client";

import { useEffect, useState } from "react";
import type { ShareContent } from "@/hooks/useGame";

interface ShareButtonProps {
  onShare: () => ShareContent | null;
}

const LABEL = "Share this puzzle";

export default function ShareButton({ onShare }: ShareButtonProps) {
  const [label, setLabel] = useState(LABEL);

  useEffect(() => {
    if (label === LABEL) return;
    const timer = setTimeout(() => setLabel(LABEL), 2500);
    return () => clearTimeout(timer);
  }, [label]);

  const handleClick = async () => {
    const content = onShare();
    if (!content) return;

    // Phones open the native share sheet; elsewhere copy to the clipboard
    if (navigator.share) {
      try {
        await navigator.share({ text: content.text, url: content.url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${content.text} ${content.url}`);
      setLabel("Link copied!");
    } catch {
      setLabel("Couldn't copy the link");
    }
  };

  return (
    <button id="share-button" type="button" onClick={handleClick}>
      {label}
    </button>
  );
}
