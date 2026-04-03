import mongoose from "mongoose";

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI environment variable is not defined");
  }

  const cached = globalThis.mongooseCache;

  if (cached?.conn) {
    return cached.conn;
  }

  if (!globalThis.mongooseCache) {
    globalThis.mongooseCache = { conn: null, promise: null };
  }

  if (!globalThis.mongooseCache.promise) {
    globalThis.mongooseCache.promise = mongoose.connect(uri);
  }

  const conn = await globalThis.mongooseCache.promise;
  globalThis.mongooseCache.conn = conn;
  return conn;
}
