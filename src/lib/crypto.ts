import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado AES-256-GCM de campos sensibles.
 * Formato almacenado: v1.<iv base64url>.<cifrado+tag base64url>
 * La llave vive solo en la variable de entorno ENCRYPTION_KEY del servidor.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("Falta ENCRYPTION_KEY en las variables de entorno.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64. Genera una con: openssl rand -base64 32");
  }
  return key;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${Buffer.concat([ciphertext, tag]).toString("base64url")}`;
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, ivB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !dataB64) throw new Error("Formato de dato cifrado inválido.");
  const data = Buffer.from(dataB64, "base64url");
  const ciphertext = data.subarray(0, data.length - 16);
  const tag = data.subarray(data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Últimos caracteres de una clave para poder identificarla sin revelarla. */
export function keyHint(plain: string, visible = 5): string {
  const clean = plain.replace(/\s+/g, "");
  return clean.length <= visible ? "•".repeat(clean.length) : clean.slice(-visible);
}
