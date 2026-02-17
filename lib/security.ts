import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export async function hashPassword(password: string, salt = generateSalt()): Promise<{
  salt: string;
  hash: string;
}> {
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return {
    salt,
    hash: derived.toString("hex")
  };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== derived.length) {
    return false;
  }
  return timingSafeEqual(stored, derived);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Sifre en az 8 karakter olmali.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Sifre en az 1 buyuk harf icermeli.";
  }
  if (!/[a-z]/.test(password)) {
    return "Sifre en az 1 kucuk harf icermeli.";
  }
  if (!/[0-9]/.test(password)) {
    return "Sifre en az 1 rakam icermeli.";
  }
  return null;
}
