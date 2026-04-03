"use client";

import { useCallback, useRef, useEffect, useState } from "react";

interface TileData {
  char: string;
  x: number;
  index: number;
}

interface TileDragConfig {
  scramble: string;
  containerRef: React.RefObject<SVGSVGElement | null>;
  disabled: boolean;
  mismatches: number[];
  onRackStringChange: (rackString: string) => void;
  onAutoSubmit: (rackString: string) => Promise<boolean>;
}

export function useTileDrag({
  scramble,
  containerRef,
  disabled,
  mismatches,
  onRackStringChange,
  onAutoSubmit,
}: TileDragConfig) {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const tilesRef = useRef<TileData[]>([]);
  const draggingIndexRef = useRef<number | null>(null);
  const mismatchesRef = useRef<number[]>([]);
  const startXRef = useRef(0);
  const clickOffsetRef = useRef(0);

  // Layout calculations
  const tileWidthRef = useRef(0);
  const tileSpacingRef = useRef(0);
  const xOffsetStartRef = useRef(0);
  const leftBoundaryRef = useRef(0);
  const rightBoundaryRef = useRef(0);
  const bevelRadiusRef = useRef(0);
  const rackWidthRef = useRef(0);

  const calcLayout = useCallback(
    (width: number, charCount: number) => {
      const viewportDivision = 11;
      const tileSize = width / viewportDivision;

      const tw = tileSize;
      const ts = tw;
      const xOffset = tileSize / 2;
      const rw = charCount * tw;
      const cw = rw + tw;

      tileWidthRef.current = tw;
      tileSpacingRef.current = ts;
      xOffsetStartRef.current = xOffset;
      bevelRadiusRef.current = tileSize / 4;
      rackWidthRef.current = rw;
      leftBoundaryRef.current = ts / 4;
      rightBoundaryRef.current = rw;

      return { tileWidth: tw, tileSpacing: ts, xOffset, containerWidth: cw };
    },
    []
  );

  // Initialize/recreate tiles when scramble changes
  useEffect(() => {
    if (!scramble) return;

    const container = containerRef.current;
    if (!container) return;

    const parentWidth =
      container.parentElement?.clientWidth ?? window.innerWidth;
    const { xOffset, tileSpacing, containerWidth: cw } = calcLayout(
      parentWidth,
      scramble.length
    );

    const newTiles = [...scramble].map((char, index) => ({
      char,
      x: xOffset + index * tileSpacing,
      index,
    }));

    tilesRef.current = newTiles;
    setTiles(newTiles);
    setContainerWidth(cw);
    setDraggingIndex(null);
    draggingIndexRef.current = null;
    onRackStringChange(scramble);
  }, [scramble, calcLayout, containerRef, onRackStringChange]);

  // Resize handler
  useEffect(() => {
    if (!scramble) return;

    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;

      const parentWidth =
        container.parentElement?.clientWidth ?? window.innerWidth;
      const { xOffset, tileSpacing, containerWidth: cw } = calcLayout(
        parentWidth,
        scramble.length
      );

      const updated = tilesRef.current.map((tile, index) => ({
        ...tile,
        x: xOffset + index * tileSpacing,
      }));
      tilesRef.current = updated;
      setTiles(updated);
      setContainerWidth(cw);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [scramble, calcLayout, containerRef]);

  // Keep mismatchesRef in sync so native touch handlers read current values
  useEffect(() => {
    mismatchesRef.current = mismatches;
  }, [mismatches]);

  const getClientX = (e: TouchEvent | MouseEvent): number => {
    if ("touches" in e && e.touches.length > 0) {
      return e.touches[0]!.clientX;
    }
    return (e as MouseEvent).clientX;
  };

  const getClientXReact = (e: React.TouchEvent | React.MouseEvent): number => {
    if ("touches" in e && e.touches.length > 0) {
      return e.touches[0]!.clientX;
    }
    return (e as React.MouseEvent).clientX;
  };

  const handleDragStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent, index: number) => {
      if (disabled) return;
      // Block drag on locked (correctly-positioned) tiles
      if (mismatches.length > 0 && !mismatches.includes(index)) return;
      e.stopPropagation();

      draggingIndexRef.current = index;
      setDraggingIndex(index);
      startXRef.current = getClientXReact(e);

      const tile = tilesRef.current[index];
      if (tile) {
        const svgRect = containerRef.current?.getBoundingClientRect();
        if (svgRect) {
          const tileScreenX =
            svgRect.left + (tile.x * svgRect.width) / (containerWidth || 1);
          clickOffsetRef.current = startXRef.current - tileScreenX;
        }
      }
    },
    [disabled, mismatches, containerRef, containerWidth]
  );

  // Native touch listeners with { passive: false } to allow preventDefault.
  // Tile identification is handled by React onTouchStart on the <g> element in Tile.tsx.
  // The native touchstart here only prevents scrolling when a tile drag is active.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if the touch target is inside a tile group — if so, prevent scrolling
      // so the drag works. React's onTouchStart on <g> handles the actual drag setup.
      let target = e.target as Element | null;
      while (target && target !== container) {
        if (target instanceof SVGGElement && target.classList.contains("tile")) {
          e.preventDefault();
          return;
        }
        target = target.parentElement;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (draggingIndexRef.current === null || disabled) return;
      e.preventDefault();

      const currentX = getClientX(e);
      const dx = currentX - startXRef.current;

      const tile = tilesRef.current[draggingIndexRef.current];
      if (!tile) return;

      let newX = tile.x + dx;

      if (newX < leftBoundaryRef.current) newX = leftBoundaryRef.current;
      if (newX > rightBoundaryRef.current) newX = rightBoundaryRef.current;

      startXRef.current = currentX;
      tilesRef.current[draggingIndexRef.current] = { ...tile, x: newX };
      setTiles([...tilesRef.current]);
    };

    const handleTouchEnd = () => {
      if (draggingIndexRef.current === null) return;
      doReorder();
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, containerRef, containerWidth]);

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingIndexRef.current === null || disabled) return;
      e.preventDefault();

      const currentX = getClientXReact(e);
      const dx = currentX - startXRef.current;

      const tile = tilesRef.current[draggingIndexRef.current];
      if (!tile) return;

      let newX = tile.x + dx;

      if (newX < leftBoundaryRef.current) newX = leftBoundaryRef.current;
      if (newX > rightBoundaryRef.current) newX = rightBoundaryRef.current;

      startXRef.current = currentX;
      tilesRef.current[draggingIndexRef.current] = { ...tile, x: newX };
      setTiles([...tilesRef.current]);
    },
    [disabled]
  );

  const doReorder = useCallback(async () => {
    if (draggingIndexRef.current === null) return;

    const dragIdx = draggingIndexRef.current;
    const tile = tilesRef.current[dragIdx];
    if (!tile) {
      draggingIndexRef.current = null;
      setDraggingIndex(null);
      return;
    }

    const leftX = tile.x - clickOffsetRef.current;
    let newIndex = Math.floor(leftX / tileSpacingRef.current);
    if (newIndex < dragIdx) newIndex++;
    if (newIndex <= 0) newIndex = 0;
    if (newIndex > tilesRef.current.length - 1)
      newIndex = tilesRef.current.length - 1;

    const hasMismatches = mismatchesRef.current.length > 0;

    if (
      newIndex !== dragIdx &&
      newIndex >= 0 &&
      newIndex < tilesRef.current.length
    ) {
      if (hasMismatches) {
        // Swap mode: only allow swap if target is also a mismatch position
        if (mismatchesRef.current.includes(newIndex)) {
          const temp = tilesRef.current[newIndex]!;
          tilesRef.current[newIndex] = tilesRef.current[dragIdx]!;
          tilesRef.current[dragIdx] = temp;
        }
        // If target is locked, no-op (tile snaps back)
      } else {
        // Original splice-insert behavior when no mismatches
        const [movedTile] = tilesRef.current.splice(dragIdx, 1);
        tilesRef.current.splice(newIndex, 0, movedTile!);
      }
    }

    const rackString = tilesRef.current
      .map((t, index) => {
        t.x = xOffsetStartRef.current + index * tileSpacingRef.current;
        t.index = index;
        return t.char;
      })
      .join("");

    draggingIndexRef.current = null;
    setDraggingIndex(null);

    setTiles([...tilesRef.current]);
    onRackStringChange(rackString);

    await onAutoSubmit(rackString);
  }, [onRackStringChange, onAutoSubmit]);

  const handleDragEnd = useCallback(async () => {
    await doReorder();
  }, [doReorder]);

  return {
    tiles,
    containerWidth,
    tileWidth: tileWidthRef.current,
    bevelRadius: bevelRadiusRef.current,
    rackWidth: rackWidthRef.current,
    tileSpacing: tileSpacingRef.current,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    draggingIndex,
  };
}
