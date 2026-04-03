"use client";

import { useCallback, useRef, useEffect } from "react";

interface RackDragConfig {
  rackRef: React.RefObject<SVGSVGElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  onSubmit: () => void;
  disabled: boolean;
}

export function useRackDrag({
  rackRef,
  imageRef,
  onSubmit,
  disabled,
}: RackDragConfig) {
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTabDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;

    const rack = rackRef.current;
    const image = imageRef.current;

    // Check overlap before snapping back
    if (rack && image) {
      const rackRect = rack.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();

      if (rackRect.top < imageRect.bottom) {
        onSubmit();
      }
    }

    // Snap back to original position
    if (rack) {
      rack.style.transition = "transform 0.3s";
      rack.style.transform = "translateY(0)";
    }

    isDraggingRef.current = false;
  }, [rackRef, imageRef, onSubmit]);

  const handleTabDragMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!isDraggingRef.current || disabled) return;
      e.preventDefault();

      const currentY =
        "touches" in e ? e.touches[0]!.clientY : (e as MouseEvent).clientY;
      const diffY = currentY - startYRef.current;

      const rack = rackRef.current;
      if (rack) {
        rack.style.transform = `translateY(${diffY}px)`;
      }
    },
    [disabled, rackRef]
  );

  // Attach document-level listeners for move/end since the rack moves
  // outside the SVG bounds during a drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleTabDragMove(e);
    const handleMouseUp = () => handleTabDragEnd();
    const handleTouchMove = (e: TouchEvent) => handleTabDragMove(e);
    const handleTouchEnd = () => handleTabDragEnd();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTabDragMove, handleTabDragEnd]);

  const handleTabDragStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const clientY =
        "touches" in e ? e.touches[0]!.clientY : (e as React.MouseEvent).clientY;
      startYRef.current = clientY;
      isDraggingRef.current = true;

      const rack = rackRef.current;
      if (rack) {
        rack.style.transition = "none";
      }
    },
    [disabled, rackRef]
  );

  return {
    handleTabDragStart,
  };
}
