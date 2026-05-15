import { type NextFunction, type Request, type Response } from "express";
import { db, auditLogs } from "@workspace/db";
import { logger } from "../lib/logger";
import type { RequestWithOperator } from "./operator";

type ActionType = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

function resolveActionType(method: string, url: string): ActionType | null {
  const m = method.toUpperCase();
  if (m === "DELETE") return "DELETE";
  if (m === "PUT" || m === "PATCH") return url.includes("/restore") ? "RESTORE" : "UPDATE";
  if (m === "POST") return url.includes("/restore") ? "RESTORE" : "CREATE";
  return null;
}

/**
 * Factory that returns a per-router audit middleware.
 * Logs every mutating request (POST/PUT/PATCH/DELETE) to the audit_logs table.
 * Non-blocking: failures are logged but never propagate to the response.
 */
export function createAuditMiddleware(entityType: string) {
  return (req: RequestWithOperator, res: Response, next: NextFunction): void => {
    const actionType = resolveActionType(req.method, req.url);

    if (!actionType) {
      next();
      return;
    }

    const originalJson = res.json.bind(res) as (body: unknown) => Response;

    res.json = function (body: unknown): Response {
      const responseBody = body as Record<string, unknown> | null;

      const entityId = String(
        req.params["id"] ??
          (responseBody && typeof responseBody === "object" ? responseBody["id"] : undefined) ??
          "unknown",
      );

      db.insert(auditLogs)
        .values({
          actionType,
          entityType,
          entityId,
          userId: null,
          operatorName: req.operatorName ?? null,
          changes: (req.body ?? null) as Record<string, unknown> | null,
        })
        .catch((err: unknown) => {
          logger.error({ err }, "Audit log insert failed");
        });

      return originalJson(body);
    };

    next();
  };
}
