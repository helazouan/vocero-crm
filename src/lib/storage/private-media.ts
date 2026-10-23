import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";
const prefix = Buffer.from("VOCERO-PRIVATE-MEDIA-1\n");
export function privateMedia(data: Buffer) {
  return data.subarray(0, prefix.length).equals(prefix);
}
export function encryptPrivateMedia(data: Buffer) {
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      Buffer.from(getEnv().ENCRYPTION_KEY, "base64"),
      iv,
    );
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([prefix, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptPrivateMedia(data: Buffer) {
  if (!privateMedia(data)) return data;
  const offset = prefix.length,
    decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(getEnv().ENCRYPTION_KEY, "base64"),
      data.subarray(offset, offset + 12),
    );
  decipher.setAuthTag(data.subarray(offset + 12, offset + 28));
  return Buffer.concat([
    decipher.update(data.subarray(offset + 28)),
    decipher.final(),
  ]);
}
