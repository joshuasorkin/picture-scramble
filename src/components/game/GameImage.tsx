"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import VictoryMessage from "./VictoryMessage";

interface GameImageProps {
  src: string;
  isVictory: boolean;
  compliment: string;
  onVictoryClick: () => void;
}

const GameImage = forwardRef<HTMLImageElement, GameImageProps>(
  function GameImage({ src, isVictory, compliment, onVictoryClick }, ref) {
    const [spinning, setSpinning] = useState(false);
    const [spun, setSpun] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    // Combine refs
    const setRefs = (el: HTMLImageElement | null) => {
      imgRef.current = el;
      if (typeof ref === "function") {
        ref(el);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLImageElement | null>).current = el;
      }
    };

    useEffect(() => {
      if (isVictory) {
        setSpinning(true);
        const timer = setTimeout(() => {
          setSpinning(false);
          setSpun(true);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        setSpinning(false);
        setSpun(false);
      }
    }, [isVictory]);

    return (
      <div id="image-container" style={{ overflow: spinning ? "visible" : "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={setRefs}
          id="game-image"
          src={src}
          alt="Scramble Clue"
          style={{
            transition: spinning ? "transform 2s" : "none",
            transform: spinning ? "rotate(360deg)" : "none",
          }}
          onClick={spun ? onVictoryClick : undefined}
        />
        {isVictory && spun && (
          <VictoryMessage
            compliment={compliment}
            visible={true}
            onClick={onVictoryClick}
          />
        )}
      </div>
    );
  }
);

export default GameImage;
