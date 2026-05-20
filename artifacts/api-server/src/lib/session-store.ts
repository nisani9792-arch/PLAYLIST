import { randomBytes } from "node:crypto";

export type OperatorSession = {
  token: string;
  operatorName: string;
  ip: string;
  createdAt: number;
  expiresAt: number;
};

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map<string, OperatorSession>();

export function createOperatorSession(ip: string, operatorName: string): OperatorSession {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  const session: OperatorSession = {
    token,
    operatorName: operatorName.trim().slice(0, 80),
    ip,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  return session;
}

export function getOperatorBySession(token: string | undefined): string | null {
  if (!token?.trim()) return null;
  const session = sessions.get(token.trim());
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token.trim());
    return null;
  }
  return session.operatorName;
}

export function revokeSession(token: string | undefined): void {
  if (token?.trim()) sessions.delete(token.trim());
}

export function sessionCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeMs,
    path: "/",
  };
}

export const SESSION_COOKIE_NAME = "jusic_operator_session";

/** Default operator PIN — override via OPERATOR_PIN env in production */
export function verifyOperatorPin(pin: string): boolean {
  const expected = (process.env.OPERATOR_PIN ?? "JUSIC").trim().toUpperCase();
  return pin.trim().toUpperCase() === expected;
}
