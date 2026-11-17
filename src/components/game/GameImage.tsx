"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { createRevealOrder, revealTarget } from "@/lib/game/reveal";
import VictoryMessage from "./VictoryMessage";

const REVEAL_MS = 2000;
// Longest wait for both pictures before giving up and swapping at once
const REVEAL_LOAD_TIMEOUT_MS = 1500;

interface GameImageProps {
  src: string;
  isVictory: boolean;
  compliment: string;
  onVictoryClick: () => void;
  // Reveal the next picture pixel by pixel instead of swapping it in
  revealNext: boolean;
}

// Load a picture so its pixels can be read from a canvas (needs CORS headers)
function loadReadableImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  return Promise.race([
    img.decode().then(() => img),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Image load timed out")), REVEAL_LOAD_TIMEOUT_MS)
    ),
  ]);
}

const GameImage = forwardRef<HTMLImageElement, GameImageProps>(
  function GameImage({ src, isVictory, compliment, onVictoryClick, revealNext }, ref) {
    const [spinning, setSpinning] = useState(false);
    const [spun, setSpun] = useState(false);
    // Picture the <img> shows; lags `src` while the reveal is being set up
    const [shownSrc, setShownSrc] = useState(src);
    const [revealing, setRevealing] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const shownSrcRef = useRef(src);
    const revealNextRef = useRef(revealNext);
    revealNextRef.current = revealNext;

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

    // A new picture: reveal it over the old one, or swap it in at once
    useEffect(() => {
      const from = shownSrcRef.current;
      if (src === from) return;

      let cancelled = false;
      let frame = 0;
      const show = (url: string) => {
        shownSrcRef.current = url;
        setShownSrc(url);
      };
      const swap = () => {
        setRevealing(false);
        show(src);
      };

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!revealNextRef.current || reducedMotion) {
        swap();
        return;
      }

      Promise.all([loadReadableImage(from), loadReadableImage(src)])
        .then(([oldImg, newImg]) => {
          const canvas = canvasRef.current;
          if (cancelled || !canvas) return;
          const width = newImg.naturalWidth;
          const height = newImg.naturalHeight;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx || width === 0 || height === 0) return swap();

          // Throws a SecurityError if the pictures lack CORS headers
          ctx.drawImage(newImg, 0, 0, width, height);
          const next = new Uint32Array(ctx.getImageData(0, 0, width, height).data.buffer);
          ctx.drawImage(oldImg, 0, 0, width, height);
          const shown = ctx.getImageData(0, 0, width, height);
          const shownPx = new Uint32Array(shown.data.buffer);

          // Canvas now covers the <img> with the old picture, so switch it underneath
          setRevealing(true);
          show(src);

          const total = width * height;
          const order = createRevealOrder(
            width,
            height,
            Math.floor(Math.random() * total),
            Math.random
          );
          let done = 0;
          let startedAt: number | null = null;
          const tick = (now: number) => {
            if (cancelled) return;
            startedAt ??= now;
            const target = revealTarget(total, now - startedAt, REVEAL_MS);
            for (; done < target; done++) {
              const p = order.next();
              shownPx[p] = next[p]!;
            }
            ctx.putImageData(shown, 0, 0);
            if (done < total) {
              frame = requestAnimationFrame(tick);
            } else {
              setRevealing(false);
            }
          };
          frame = requestAnimationFrame(tick);
        })
        .catch((error) => {
          console.error("Picture reveal failed, swapping instead:", error);
          if (!cancelled) swap();
        });

      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        setRevealing(false);
      };
    }, [src]);

    return (
      <div id="image-container" style={{ overflow: spinning ? "visible" : "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={setRefs}
          id="game-image"
          src={shownSrc}
          alt="Scramble Clue"
          style={{
            transition: spinning ? "transform 2s" : "none",
            transform: spinning ? "rotate(360deg)" : "none",
          }}
          onClick={spun ? onVictoryClick : undefined}
        />
        <canvas
          ref={canvasRef}
          id="reveal-canvas"
          aria-hidden="true"
          style={{ display: revealing ? "block" : "none" }}
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
