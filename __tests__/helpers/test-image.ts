import sharp from "sharp";

/** A small real PNG; each distinct `shade` yields different bytes. */
export function makePng(shade = 0): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: shade, g: 100, b: 200 },
    },
  })
    .png()
    .toBuffer();
}
