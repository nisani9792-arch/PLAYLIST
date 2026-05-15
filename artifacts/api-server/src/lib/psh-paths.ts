import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Bundled dist/index.mjs lives in dist/; artifact root is one level up. */
function artifactRootFromModule(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** All candidate locations for PSH.pdf / psh-catalog.json (first match wins). */
export async function resolvePshDataCandidates(): Promise<string[]> {
  const artifactRoot = artifactRootFromModule();
  const cwd = process.cwd();
  const names = ["PSH.pdf", "psh-catalog.json"] as const;

  const dirs = [
    process.env.PSH_PDF_PATH?.trim()
      ? path.dirname(process.env.PSH_PDF_PATH.trim())
      : null,
    path.join(artifactRoot, "data"),
    path.join(artifactRoot, "dist", "data"),
    path.join(cwd, "artifacts", "api-server", "data"),
    path.join(cwd, "artifacts", "api-server", "dist", "data"),
    cwd,
  ].filter((d): d is string => Boolean(d));

  const uniqueDirs = [...new Set(dirs)];
  const out: string[] = [];

  for (const dir of uniqueDirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      if (await fileExists(full)) out.push(full);
    }
  }

  if (process.env.PSH_PDF_PATH?.trim()) {
    const envPdf = process.env.PSH_PDF_PATH.trim();
    if (await fileExists(envPdf)) out.unshift(envPdf);
  }

  return [...new Set(out)];
}

export async function resolvePshCatalogJsonPath(): Promise<string | null> {
  const candidates = await resolvePshDataCandidates();
  return candidates.find((p) => p.endsWith("psh-catalog.json")) ?? null;
}

export async function resolvePshPdfPath(): Promise<string | null> {
  const env = process.env.PSH_PDF_PATH?.trim();
  if (env && (await fileExists(env))) return env;

  const candidates = await resolvePshDataCandidates();
  return candidates.find((p) => p.endsWith("PSH.pdf")) ?? null;
}
