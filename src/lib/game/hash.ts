import crypto from "crypto";

export function getSHA256Hash(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}
