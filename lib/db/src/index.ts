import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const DB_UNAVAILABLE_ERROR =
  "DATABASE_URL is not set. DB-backed routes are unavailable in this runtime.";

const missingPool = {
  async connect() {
    throw new Error(DB_UNAVAILABLE_ERROR);
  },
} as unknown as pg.Pool;

const missingDb = new Proxy(
  {},
  {
    get() {
      throw new Error(DB_UNAVAILABLE_ERROR);
    },
  },
) as ReturnType<typeof drizzle<typeof schema>>;

function normalizeDatabaseUrl(url: string): string {
  if (/sslmode=require/i.test(url) && !/uselibpqcompat=/i.test(url)) {
    return `${url}${url.includes("?") ? "&" : "?"}uselibpqcompat=true`;
  }
  return url;
}

function poolOptions(url: string): pg.PoolConfig {
  const connectionString = normalizeDatabaseUrl(url);
  const config: pg.PoolConfig = { connectionString };
  // Neon (and most managed Postgres) require TLS in production.
  if (/neon\.tech|sslmode=require/i.test(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

export const pool = process.env.DATABASE_URL
  ? new Pool(poolOptions(process.env.DATABASE_URL))
  : missingPool;

export const db = process.env.DATABASE_URL
  ? drizzle(pool, { schema })
  : missingDb;

export * from "./schema";
