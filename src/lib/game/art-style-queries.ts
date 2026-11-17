import { ArtStyle } from "@/lib/db/models/art-style";
import type { ArtOrigin, ImageStyle } from "@/lib/game/art-style";

export async function saveArtStyle(style: string, origin: ArtOrigin): Promise<void> {
  await ArtStyle.create({ style, ...origin });
}

export async function getRandomSavedArtStyle(): Promise<ImageStyle | null> {
  const [doc] = await ArtStyle.aggregate<ImageStyle>([
    { $sample: { size: 1 } },
    { $project: { _id: 0, style: 1, coordinates: 1, year: 1 } },
  ]);
  return doc ?? null;
}
