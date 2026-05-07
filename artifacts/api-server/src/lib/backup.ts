import { execFile } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import cron from "node-cron";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");

/** Keep at most this many daily backups before pruning the oldest. */
const MAX_BACKUPS = Number(process.env.BACKUP_RETAIN_COUNT ?? "7");

/** Full path to pg_dump, or rely on PATH (default: "pg_dump"). */
const PG_DUMP_CMD = (process.env.PG_DUMP_PATH ?? "pg_dump").trim() || "pg_dump";

const PG_DUMP_INSTALL_HINT =
  "Install PostgreSQL client tools and ensure pg_dump is on PATH, or set PG_DUMP_PATH. " +
  "Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y postgresql-client. " +
  "RHEL/CentOS/Fedora: sudo dnf install -y postgresql. " +
  "Alpine: apk add --no-cache postgresql-client. " +
  "macOS (Homebrew): brew install libpq && brew link --force libpq.";

type PgDumpProbe = "pending" | "ok" | "fail";
let pgDumpProbeState: PgDumpProbe = "pending";

async function ensurePgDumpAvailable(): Promise<boolean> {
  if (pgDumpProbeState === "ok") return true;
  if (pgDumpProbeState === "fail") return false;

  try {
    const { stdout } = await execFileAsync(PG_DUMP_CMD, ["--version"], {
      windowsHide: true,
    });
    logger.info({ cmd: PG_DUMP_CMD, version: stdout.trim() }, "pg_dump found for backups");
    pgDumpProbeState = "ok";
    return true;
  } catch (err) {
    logger.error(
      { err, cmd: PG_DUMP_CMD },
      `pg_dump not executable — daily backups will fail until fixed. ${PG_DUMP_INSTALL_HINT}`,
    );
    pgDumpProbeState = "fail";
    return false;
  }
}

async function pruneOldBackups(): Promise<void> {
  const entries = await readdir(BACKUP_DIR);
  const dumps = entries.filter((f) => f.startsWith("backup-") && f.endsWith(".dump"));

  if (dumps.length <= MAX_BACKUPS) return;

  const withStats = await Promise.all(
    dumps.map(async (name) => {
      const s = await stat(path.join(BACKUP_DIR, name));
      return { name, mtime: s.mtimeMs };
    }),
  );
  withStats.sort((a, b) => a.mtime - b.mtime);

  const toDelete = withStats.slice(0, withStats.length - MAX_BACKUPS);
  await Promise.all(
    toDelete.map(async ({ name }) => {
      await rm(path.join(BACKUP_DIR, name));
      logger.info({ name }, "Pruned old backup");
    }),
  );
}

async function runBackup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error("DATABASE_URL not set — skipping backup");
    return;
  }

  const ok = await ensurePgDumpAvailable();
  if (!ok) return;

  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${timestamp}.dump`;
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    await execFileAsync(
      PG_DUMP_CMD,
      ["--format=custom", "--no-password", "-f", filePath, databaseUrl],
      { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
    );
    logger.info({ filePath }, "Database backup completed");

    await pruneOldBackups();
  } catch (err) {
    logger.error({ err, filePath, cmd: PG_DUMP_CMD }, "Database backup failed");
    await rm(filePath, { force: true });
  }
}

/**
 * Schedules a daily database backup at 02:00 AM server-local time.
 *
 * Env:
 *   BACKUP_DIR           — output directory (default: `<cwd>/backups`)
 *   BACKUP_RETAIN_COUNT  — number of backups to keep (default: 7)
 *   BACKUP_CRON          — cron expression (default: `0 2 * * *`)
 *   PG_DUMP_PATH         — absolute path to `pg_dump` if not on PATH (e.g. `/usr/bin/pg_dump`)
 */
export function startBackupCron(): void {
  const expression = process.env.BACKUP_CRON ?? "0 2 * * *";

  if (!cron.validate(expression)) {
    logger.error({ expression }, "Invalid BACKUP_CRON expression — backup cron not started");
    return;
  }

  void ensurePgDumpAvailable().catch((err: unknown) => {
    logger.error({ err }, "Unexpected error while probing pg_dump");
  });

  cron.schedule(expression, () => {
    logger.info("Starting scheduled database backup");
    runBackup().catch((err: unknown) => {
      logger.error({ err }, "Unhandled error in backup cron");
    });
  });

  logger.info(
    { expression, backupDir: BACKUP_DIR, retain: MAX_BACKUPS, pgDumpCmd: PG_DUMP_CMD },
    "Database backup cron scheduled",
  );
}
