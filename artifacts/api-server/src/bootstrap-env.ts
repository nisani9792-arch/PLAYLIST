import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Must be imported before any module that reads `process.env` at load time (`@workspace/db`, etc.).
const here = path.dirname(fileURLToPath(import.meta.url));
const apiServerRoot = path.join(here, "..");
const repoRoot = path.join(here, "..", "..", "..");
// First path wins per key unless `override`; nested project `.env` overrides repo-level values.
dotenv.config({ path: path.join(apiServerRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({
  path: path.join(repoRoot, "\u05d4\u05d7\u05ea\u05de\u05d5\u05ea", ".env"),
  override: true,
});
dotenv.config();
