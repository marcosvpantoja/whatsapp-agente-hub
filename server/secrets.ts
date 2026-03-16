import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env.js";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  if (!env.SETTINGS_ENCRYPTION_KEY) {
    throw new Error("SETTINGS_ENCRYPTION_KEY nao configurada.");
  }

  return createHash("sha256").update(env.SETTINGS_ENCRYPTION_KEY, "utf8").digest();
}

export function encryptSecret(value: string) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return Buffer.concat([initializationVector, authenticationTag, encrypted]).toString("base64");
}

export function decryptSecret(value: string) {
  const payload = Buffer.from(value, "base64");
  const initializationVector = payload.subarray(0, 12);
  const authenticationTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv(algorithm, getEncryptionKey(), initializationVector);

  decipher.setAuthTag(authenticationTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
