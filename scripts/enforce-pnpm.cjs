"use strict";

const fs = require("fs");

for (const name of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.unlinkSync(name);
  } catch {
    /* ignore */
  }
}

const ua = process.env.npm_config_user_agent ?? "";

// On some Windows setups pnpm does not propagate npm_config_user_agent into lifecycle scripts.
// Only reject installs that explicitly identify as npm or Yarn (but not pnpm-driven npm).
if (ua) {
  const lower = ua.toLowerCase();
  const looksLikeYarn = /^yarn\//.test(lower) || lower.includes("yarn/");
  const looksLikeNpm = /\bnpm\/\d/.test(lower);
  const drivenByPnpm = lower.includes("pnpm");

  if (looksLikeYarn || (looksLikeNpm && !drivenByPnpm)) {
    console.error("Use pnpm instead");
    process.exit(1);
  }
}
