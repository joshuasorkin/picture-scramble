"use client";

import { useRef, useCallback, useEffect } from "react";
import { useTileDrag } from "@/hooks/useTileDrag";
import { useRackDrag } from "@/hooks/useRackDrag";
import Tile from "./Tile";

interface TileRackProps {
  scramble: string;
  mismatches: number[];
  onRackStringChange: (rackString: string) => void;
  onSubmit: (rackString: string) => void;
  onAutoSubmit: (rackString: string) => Promise<boolean>;
  disabled: boolean;
  imageRef: React.RefObject<HTMLImageElement | null>;
}

export default function TileRack({
  scramble,
  mismatches,
  onRackStringChange,
  onSubmit,
  onAutoSubmit,
  disabled,
  imageRef,
}: TileRackProps) {
  const containerRef = useRef<SVGSVGElement>(null);
  const rackStringRef = useRef("");
  const bounceApplied = useRef(false);

  const handleRackStringChange = useCallback(
    (rs: string) => {
      rackStringRef.current = rs;
      onRackStringChange(rs);
    },
    [onRackStringChange]
  );

  const {
    tiles,
    containerWidth,
    tileWidth,
    bevelRadius,
    rackWidth,
    tileSpacing,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    draggingIndex,
  } = useTileDrag({
    scramble,
    containerRef,
    disabled,
    mismatches,
    onRackStringChange: handleRackStringChange,
    onAutoSubmit,
  });

  const handlePullSubmit = useCallback(() => {
    onSubmit(rackStringRef.current);
  }, [onSubmit]);

  const { handleTabDragStart } = useRackDrag({
    rackRef: containerRef,
    imageRef,
    onSubmit: handlePullSubmit,
    disabled,
  });

  // Bounce animation on mount
  useEffect(() => {
    if (scramble && !bounceApplied.current) {
      const el = containerRef.current;
      if (el) {
        el.style.animation = "none";
        void el.getBoundingClientRect();
        el.style.animation = "bounce 1s ease-in-out";
        bounceApplied.current = true;
      }
    }
  }, [scramble]);

  // Reset bounce ref when scramble changes
  useEffect(() => {
    bounceApplied.current = false;
  }, [scramble]);

  if (!scramble) return null;

  const containerHeight = tileSpacing * 2 || 100;
  const dragTabHeight = tileSpacing || 50;
  const dragTabWidth = tileSpacing / 2 || 25;
  const fontSize = tileWidth / 2 || 14;

  return (
    <svg
      ref={containerRef}
      id="rack-container"
      width={containerWidth}
      height={containerHeight}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Rack background */}
      <rect
        id="rack"
        x={dragTabWidth}
        y={0}
        width={rackWidth}
        height={dragTabHeight}
        className="rack"
      />

      {/* Drag tab (pull to submit) */}
      <rect
        id="drag-tab-bottom"
        x={dragTabWidth}
        y={dragTabHeight}
        width={rackWidth}
        height={tileWidth}
        className="rack"
        onTouchStart={handleTabDragStart}
        onMouseDown={handleTabDragStart}
        style={{ cursor: "ns-resize" }}
      />

      {/* All tiles in array order — no DOM reordering to preserve touch tracking */}
      {tiles.map((tile, i) => (
        <Tile
          key={`tile-${tile.index}`}
          char={tile.char}
          x={tile.x}
          y={0}
          width={tileWidth}
          bevelRadius={bevelRadius}
          isMismatch={mismatches.includes(tile.index)}
          isLocked={mismatches.length > 0 && !mismatches.includes(tile.index)}
          isDragging={i === draggingIndex}
          fontSize={fontSize}
          onDragStart={(e) => handleDragStart(e, i)}
          hidden={i === draggingIndex}
        />
      ))}

      {/* Visual copy of dragged tile rendered last so it appears on top */}
      {draggingIndex !== null && tiles[draggingIndex] && (
        <Tile
          key="tile-dragging-overlay"
          char={tiles[draggingIndex].char}
          x={tiles[draggingIndex].x}
          y={0}
          width={tileWidth}
          bevelRadius={bevelRadius}
          isMismatch={mismatches.includes(tiles[draggingIndex].index)}
          isLocked={false}
          isDragging={true}
          fontSize={fontSize}
          onDragStart={() => {}}
        />
      )}
    </svg>
  );
}
