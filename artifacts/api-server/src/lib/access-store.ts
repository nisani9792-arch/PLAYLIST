import { eq } from "drizzle-orm";
import { db, accessOperators } from "@workspace/db";
import { logger } from "./logger";

const memoryByIp = new Map<string, { operatorName: string }>();

export async function getOperatorByIp(ip: string): Promise<string | null> {
  const mem = memoryByIp.get(ip);
  if (mem) return mem.operatorName;

  try {
    const [row] = await db
      .select({ operatorName: accessOperators.operatorName })
      .from(accessOperators)
      .where(eq(accessOperators.ip, ip))
      .limit(1);
    if (row?.operatorName) {
      memoryByIp.set(ip, { operatorName: row.operatorName });
      return row.operatorName;
    }
  } catch (err) {
    logger.warn({ err, ip }, "access_operators lookup failed — using memory only");
  }

  return null;
}

export async function registerOperator(ip: string, operatorName: string): Promise<string> {
  const name = operatorName.trim().slice(0, 80);
  if (!name) throw new Error("operator name required");

  memoryByIp.set(ip, { operatorName: name });
  const now = new Date();

  try {
    await db
      .insert(accessOperators)
      .values({ ip, operatorName: name, firstSeenAt: now, lastSeenAt: now })
      .onConflictDoUpdate({
        target: accessOperators.ip,
        set: { operatorName: name, lastSeenAt: now },
      });
  } catch (err) {
    logger.warn({ err, ip }, "access_operators upsert failed — kept in memory");
  }

  return name;
}

export async function touchOperator(ip: string): Promise<void> {
  const name = await getOperatorByIp(ip);
  if (!name) return;

  const now = new Date();
  try {
    await db
      .update(accessOperators)
      .set({ lastSeenAt: now })
      .where(eq(accessOperators.ip, ip));
  } catch {
    /* memory-only mode */
  }
}
