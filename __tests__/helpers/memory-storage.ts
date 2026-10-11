import type { ImageStorage } from "@/lib/storage/r2";

/** In-memory stand-in for the R2 bucket. */
export function createMemoryStorage() {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  const storage: ImageStorage = {
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async delete(key) {
      objects.delete(key);
    },
    publicUrl(key) {
      return `https://img.test/${key}`;
    },
  };

  return { storage, objects };
}
