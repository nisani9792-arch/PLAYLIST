import type { NextFunction, Request, Response } from "express";
import { getOperatorByIp } from "../lib/access-store";
import { getClientIp } from "../lib/client-ip";
import { getOperatorBySession, SESSION_COOKIE_NAME } from "../lib/session-store";

export type RequestWithOperator = Request & { operatorName?: string };

export function attachOperator(
  req: RequestWithOperator,
  _res: Response,
  next: NextFunction,
): void {
  void (async () => {
    try {
      const sessionToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
      const fromSession = getOperatorBySession(sessionToken);
      if (fromSession) {
        req.operatorName = fromSession;
        next();
        return;
      }

      const ip = getClientIp(req);
      req.operatorName = (await getOperatorByIp(ip)) ?? undefined;
    } catch {
      req.operatorName = undefined;
    }
    next();
  })();
}
