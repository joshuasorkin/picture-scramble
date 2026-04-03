"use client";

interface TileProps {
  char: string;
  x: number;
  y: number;
  width: number;
  bevelRadius: number;
  isMismatch: boolean;
  isLocked?: boolean;
  isDragging: boolean;
  fontSize: number;
  onDragStart: (e: React.TouchEvent | React.MouseEvent) => void;
  hidden?: boolean;
}

export default function Tile({
  char,
  x,
  y,
  width,
  bevelRadius,
  isMismatch,
  isLocked,
  isDragging,
  fontSize,
  onDragStart,
  hidden,
}: TileProps) {
  return (
    <g
      className={`tile ${isMismatch ? "tile-mismatch" : ""} ${isLocked ? "tile-locked" : ""} ${isDragging ? "dragging" : ""}`}
      transform={`translate(${x}, ${y})`}
      style={{ cursor: isLocked ? "default" : isDragging ? "grabbing" : "grab", opacity: hidden ? 0 : 1 }}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
    >
      <rect
        width={width}
        height={width}
        rx={bevelRadius}
        ry={bevelRadius}
      />
      <text
        x={width / 2}
        y={width / 2}
        className="tile-text"
        style={{ fontSize: `${fontSize}px` }}
      >
        {char}
      </text>
    </g>
  );
}
