import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface ImageStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

let storage: ImageStorage | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not defined`);
  }
  return value;
}

export function getImageStorage(): ImageStorage {
  if (!storage) {
    const bucket = requireEnv("R2_BUCKET");
    const baseUrl = requireEnv("IMAGE_BASE_URL").replace(/\/+$/, "");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });

    storage = {
      async put(key, body, contentType) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            // Keys are content hashes, so an object never changes
            CacheControl: "public, max-age=31536000, immutable",
          })
        );
      },
      async delete(key) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      },
      publicUrl(key) {
        return `${baseUrl}/${key}`;
      },
    };
  }
  return storage;
}
