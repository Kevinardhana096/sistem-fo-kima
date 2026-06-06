#!/usr/bin/env node
/* global process */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const vitestCli = resolve(frontendDir, "node_modules", "vitest", "vitest.mjs");

const unsupportedJestFlags = new Set(["--runInBand"]);
const passthroughArgs = process.argv.slice(2).filter((arg) => !unsupportedJestFlags.has(arg));

const child = spawn(process.execPath, [vitestCli, "run", ...passthroughArgs], {
  cwd: frontendDir,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
