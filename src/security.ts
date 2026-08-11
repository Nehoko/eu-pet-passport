import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 600_000;

export interface PasswordDigest {
  salt: string;
  hash: string;
  iterations: number;
}

export function hashPassword(password: string, iterations = ITERATIONS): PasswordDigest {
  if (password.length < 14) throw new Error("Password must contain at least 14 characters");
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return { salt: salt.toString("base64"), hash: hash.toString("base64"), iterations };
}

export function verifyPassword(
  password: string,
  salt: string,
  expected: string,
  iterations: number,
): boolean {
  const actual = pbkdf2Sync(password, Buffer.from(salt, "base64"), iterations, 32, "sha256");
  const expectedBytes = Buffer.from(expected, "base64");
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function parseCookies(value: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of (value ?? "").split(";")) {
    const index = item.indexOf("=");
    if (index < 0) continue;
    cookies[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
  }
  return cookies;
}

export function sessionCookie(name: string, token: string, secure: boolean): string {
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${
    secure ? "; Secure" : ""
  }`;
}

export function clearSessionCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function securityHeaders(): Headers {
  return new Headers({
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cache-Control": "no-store",
  });
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
