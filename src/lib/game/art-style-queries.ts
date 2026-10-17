import { ArtStyle } from "@/lib/db/models/art-style";
import type { ArtOrigin } from "@/lib/game/art-style";

export async function saveArtStyle(style: string, origin: ArtOrigin): Promise<void> {
  await ArtStyle.create({ style, ...origin });
}

export async function getRandomSavedArtStyle(): Promise<string | null> {
  const [doc] = await ArtStyle.aggregate<{ style: string }>([
    { $sample: { size: 1 } },
    { $project: { style: 1 } },
  ]);
  return doc?.style ?? null;
}
