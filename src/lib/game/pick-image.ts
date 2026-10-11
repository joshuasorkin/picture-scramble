import type { ImageObject } from "@/lib/db/models/image";

/**
 * Choose which of a word's images to show. Uploaded images take priority
 * over AI-generated ones; within the chosen group the pick is random.
 */
export function pickImage(
  objects: ImageObject[],
  random: () => number = Math.random
): ImageObject | null {
  if (objects.length === 0) return null;

  const uploaded = objects.filter((o) => o.uploaded);
  const pool = uploaded.length > 0 ? uploaded : objects;

  return pool[Math.floor(random() * pool.length)] ?? null;
}
