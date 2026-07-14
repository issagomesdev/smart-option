#!/usr/bin/env node
// Dispatcher minimo: roda o .ps1 no Windows e o .sh em qualquer outro
// sistema, para "npm run tunnel"/"npm run dev:full" funcionarem sem o
// desenvolvedor precisar saber qual shell usar.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const name = process.argv[2];
if (!name) {
  console.error("Uso: node scripts/run-platform.js <nome-do-script-sem-extensao>");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const result = isWindows
  ? spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, `${name}.ps1`)], { stdio: "inherit" })
  : spawnSync("bash", [path.join(__dirname, `${name}.sh`)], { stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
