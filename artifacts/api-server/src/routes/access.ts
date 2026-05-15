import { Router } from "express";
import { getClientIp } from "../lib/client-ip";
import { getOperatorByIp, registerOperator } from "../lib/access-store";

const router = Router();

router.get("/status", async (req, res) => {
  const operatorName = await getOperatorByIp(getClientIp(req));

  if (operatorName) {
    res.json({ state: "ready", operatorName });
    return;
  }

  res.json({ state: "locked", operatorName: null });
});

router.post("/register", async (req, res) => {
  const ip = getClientIp(req);
  const { operatorName } = req.body as { operatorName?: string };

  if (!operatorName || typeof operatorName !== "string" || !operatorName.trim()) {
    res.status(400).json({ error: "operatorName is required" });
    return;
  }

  const name = await registerOperator(ip, operatorName);
  res.json({ state: "ready", operatorName: name });
});

export default router;
