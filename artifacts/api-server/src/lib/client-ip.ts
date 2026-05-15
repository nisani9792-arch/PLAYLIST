import type { Request } from "express";

/** Client IP for access-operator lookup (Render sets X-Forwarded-For). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() ?? req.ip;
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
