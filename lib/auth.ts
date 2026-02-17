import { cookies } from "next/headers";
import type { PasswordResetToken, SessionUser, UserRecord } from "@/lib/types";
import { newId, readStore, withStoreLock, writeStore } from "@/lib/store";
import { hashPassword, randomToken, sha256, validatePasswordStrength, verifyPassword } from "@/lib/security";
import { sendPasswordResetMail } from "@/lib/mailer";

export const SESSION_COOKIE = "nalburos_session";
const RESET_TOKEN_TTL_MINUTES = 30;

function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64url");
}

function decodeSession(value: string): SessionUser | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const data = JSON.parse(decoded) as SessionUser;
    return data;
  } catch {
    return null;
  }
}

function findUser(users: UserRecord[], username: string): UserRecord | undefined {
  const normalized = username.trim().toLowerCase();
  return users.find((entry) => entry.username.toLowerCase() === normalized);
}

function findUserByIdentity(users: UserRecord[], identity: string): UserRecord | undefined {
  const normalized = identity.trim().toLowerCase();
  return users.find(
    (entry) => entry.username.toLowerCase() === normalized || (entry.email ?? "").toLowerCase() === normalized
  );
}

async function verifyAndUpgradePassword(user: UserRecord, password: string): Promise<boolean> {
  if (user.passwordHash && user.passwordSalt) {
    return verifyPassword(password, user.passwordSalt, user.passwordHash);
  }
  return user.password === password;
}

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  return withStoreLock(async () => {
    const users = await readStore("users");
    const user = findUser(users, username);
    if (!user) {
      return null;
    }

    const ok = await verifyAndUpgradePassword(user, password);
    if (!ok) {
      return null;
    }

    // Backward-compatible migration: if legacy plain password exists, upgrade to hash immediately.
    if (!user.passwordHash || !user.passwordSalt) {
      const hashed = await hashPassword(password);
      user.passwordHash = hashed.hash;
      user.passwordSalt = hashed.salt;
      user.passwordUpdatedAt = new Date().toISOString();
      delete user.password;
      await writeStore("users", users);
    }

    return {
      username: user.username,
      name: user.name,
      role: user.role
    };
  });
}

export async function requestPasswordReset(identity: string, baseUrl: string, requestedFromIp?: string): Promise<{
  accepted: boolean;
  delivered: boolean;
  devResetLink?: string;
}> {
  return withStoreLock(async () => {
    const users = await readStore("users");
    const user = findUserByIdentity(users, identity);
    if (!user || !user.email) {
      return { accepted: true, delivered: false };
    }

    const tokens = await readStore("password-reset-tokens");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const tokenRow: PasswordResetToken = {
      id: newId("rst"),
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: now.toISOString(),
      requestedFromIp
    };

    const cleaned = tokens.filter((entry) => !entry.usedAt && new Date(entry.expiresAt) > now);
    cleaned.push(tokenRow);
    await writeStore("password-reset-tokens", cleaned);

    const resetLink = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
    const mailResult = await sendPasswordResetMail({ to: user.email, resetLink });

    if (!mailResult.delivered && process.env.NODE_ENV !== "production") {
      return {
        accepted: true,
        delivered: false,
        devResetLink: resetLink
      };
    }

    return {
      accepted: true,
      delivered: mailResult.delivered
    };
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  return withStoreLock(async () => {
    const tokens = await readStore("password-reset-tokens");
    const users = await readStore("users");
    const now = new Date();
    const tokenHash = sha256(token.trim());
    const tokenRow = tokens.find((entry) => entry.tokenHash === tokenHash && !entry.usedAt);

    if (!tokenRow) {
      return { ok: false, error: "Gecersiz sifirlama baglantisi." };
    }
    if (new Date(tokenRow.expiresAt) <= now) {
      return { ok: false, error: "Sifirlama baglantisinin suresi dolmus." };
    }

    const user = users.find((entry) => entry.id === tokenRow.userId);
    if (!user) {
      return { ok: false, error: "Kullanici bulunamadi." };
    }

    const hashed = await hashPassword(newPassword);
    user.passwordHash = hashed.hash;
    user.passwordSalt = hashed.salt;
    user.passwordUpdatedAt = now.toISOString();
    delete user.password;
    tokenRow.usedAt = now.toISOString();

    await writeStore("users", users);
    await writeStore("password-reset-tokens", tokens);

    return { ok: true };
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return decodeSession(raw);
}

export function sessionCookieValue(user: SessionUser): string {
  return encodeSession(user);
}
