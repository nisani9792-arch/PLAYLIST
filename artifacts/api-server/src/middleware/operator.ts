import type { NextFunction, Request, Response } from "express";
import { getOperatorByIp } from "../lib/access-store";
import { getClientIp } from "../lib/client-ip";

export type RequestWithOperator = Request & { operatorName?: string };

const HEADER = "x-buildplay-operator";

export function attachOperator(
  req: RequestWithOperator,
  _res: Response,
  next: NextFunction,
): void {
  const headerName = req.headers[HEADER];
  const fromHeader =
    typeof headerName === "string" ? headerName.trim().slice(0, 80) : "";

  void (async () => {
    const ip = getClientIp(req);
    const fromIp = await getOperatorByIp(ip);
    req.operatorName = fromHeader || fromIp || undefined;
    next();
  })();
}
