import type { NextFunction, Request, Response } from "express";
import { getOperatorByIp } from "../lib/access-store";
import { getClientIp } from "../lib/client-ip";

export type RequestWithOperator = Request & { operatorName?: string };

export function attachOperator(
  req: RequestWithOperator,
  _res: Response,
  next: NextFunction,
): void {
  void (async () => {
    try {
      const ip = getClientIp(req);
      req.operatorName = (await getOperatorByIp(ip)) ?? undefined;
    } catch {
      req.operatorName = undefined;
    }
    next();
  })();
}
