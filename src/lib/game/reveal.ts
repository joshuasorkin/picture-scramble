// Order in which pixels are swapped when one picture is revealed over another:
// start at one pixel, then repeatedly pick a random not-yet-revealed pixel
// that touches (incl. diagonally) one already revealed. The pixels waiting to
// be picked (the frontier) are kept in an array with O(1) swap-removal, so
// every pick costs the same however much of the picture is done.

const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];

export interface RevealOrder {
  // Next pixel index (y * width + x), or -1 once every pixel has been given
  next(): number;
}

// random() returns a number in [0, 1), like Math.random
export function createRevealOrder(
  width: number,
  height: number,
  start: number,
  random: () => number
): RevealOrder {
  const total = width * height;
  // 0 = untouched, 1 = in frontier, 2 = revealed
  const mark = new Uint8Array(total);
  const frontier = new Int32Array(total);
  let size = 0;

  if (total > 0) {
    frontier[size++] = start;
    mark[start] = 1;
  }

  return {
    next() {
      if (size === 0) return -1;
      const k = Math.floor(random() * size);
      // Indexes below are always in range (k < size <= total, d < 8)
      const p = frontier[k]!;
      frontier[k] = frontier[--size]!;
      mark[p] = 2;

      const px = p % width;
      const py = (p - px) / width;
      for (let d = 0; d < 8; d++) {
        const x = px + DX[d]!;
        const y = py + DY[d]!;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const i = y * width + x;
        if (mark[i] === 0) {
          mark[i] = 1;
          frontier[size++] = i;
        }
      }
      return p;
    },
  };
}

// Pixels that should be revealed after `elapsedMs` of a `durationMs` reveal.
// Tied to time rather than frames, so a slow device takes bigger steps
// instead of stretching the reveal out.
export function revealTarget(total: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return total;
  if (elapsedMs <= 0) return 0;
  return Math.floor((total * elapsedMs) / durationMs);
}
