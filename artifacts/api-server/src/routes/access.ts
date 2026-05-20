import { Router } from "express";
import { getClientIp } from "../lib/client-ip";
import { getOperatorByIp, registerOperator } from "../lib/access-store";
import {
  createOperatorSession,
  getOperatorBySession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyOperatorPin,
} from "../lib/session-store";

const router = Router();

router.get("/status", async (req, res) => {
  const sessionName = getOperatorBySession(req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
  if (sessionName) {
    res.json({ state: "ready", operatorName: sessionName, auth: "session" });
    return;
  }

  const operatorName = await getOperatorByIp(getClientIp(req));

  if (operatorName) {
    res.json({ state: "ready", operatorName, auth: "ip" });
    return;
  }

  res.json({ state: "locked", operatorName: null });
});

router.post("/register", async (req, res) => {
  const ip = getClientIp(req);
  const { operatorName, pin } = req.body as { operatorName?: string; pin?: string };

  if (!operatorName || typeof operatorName !== "string" || !operatorName.trim()) {
    res.status(400).json({ error: "operatorName is required" });
    return;
  }

  if (pin && !verifyOperatorPin(pin)) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }

  const name = await registerOperator(ip, operatorName);
  const session = createOperatorSession(ip, name);
  res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  res.json({ state: "ready", operatorName: name, auth: "session" });
});

router.post("/pin-login", async (req, res) => {
  const ip = getClientIp(req);
  const { pin, operatorName } = req.body as { pin?: string; operatorName?: string };

  if (!pin || !verifyOperatorPin(pin)) {
    res.status(401).json({ error: "Invalid PIN" });
    return;
  }

  const name =
    operatorName?.trim() ||
    (await getOperatorByIp(ip)) ||
    "מפעיל";

  await registerOperator(ip, name);
  const session = createOperatorSession(ip, name);
  res.cookie(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  res.json({ state: "ready", operatorName: name, auth: "session" });
});

export default router;
