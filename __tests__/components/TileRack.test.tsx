import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Tile from "@/components/game/Tile";

describe("Tile", () => {
  it("renders the character", () => {
    const { container } = render(
      <svg>
        <Tile
          char="A"
          x={0}
          y={0}
          width={40}
          bevelRadius={10}
          isMismatch={false}
          isDragging={false}
          fontSize={20}
          onDragStart={vi.fn()}
        />
      </svg>
    );

    const text = container.querySelector(".tile-text");
    expect(text).toBeTruthy();
    expect(text?.textContent).toBe("A");
  });

  it("applies mismatch class when isMismatch is true", () => {
    const { container } = render(
      <svg>
        <Tile
          char="B"
          x={0}
          y={0}
          width={40}
          bevelRadius={10}
          isMismatch={true}
          isDragging={false}
          fontSize={20}
          onDragStart={vi.fn()}
        />
      </svg>
    );

    const tile = container.querySelector(".tile-mismatch");
    expect(tile).toBeTruthy();
  });

  it("does not apply mismatch class when isMismatch is false", () => {
    const { container } = render(
      <svg>
        <Tile
          char="C"
          x={0}
          y={0}
          width={40}
          bevelRadius={10}
          isMismatch={false}
          isDragging={false}
          fontSize={20}
          onDragStart={vi.fn()}
        />
      </svg>
    );

    const tile = container.querySelector(".tile-mismatch");
    expect(tile).toBeNull();
  });
});
