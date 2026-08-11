import { createApp } from "./src/app.ts";
import { loadConfig } from "./src/config.ts";
import { PetPassDatabase } from "./src/db.ts";
import { backup as backupDatabase } from "node:sqlite";

if (Deno.args[0] === "healthcheck") {
  const target = Deno.args[1] ?? "http://127.0.0.1:8000/health/ready";
  try {
    const result = await fetch(target, { signal: AbortSignal.timeout(4_000) });
    Deno.exit(result.ok ? 0 : 1);
  } catch {
    Deno.exit(1);
  }
}

const config = await loadConfig();
const slash = config.dbPath.lastIndexOf("/");
if (slash > 0) await Deno.mkdir(config.dbPath.slice(0, slash), { recursive: true });

const database = new PetPassDatabase(config.dbPath);

if (Deno.args[0] === "backup") {
  const target = Deno.args[1] ?? `/data/petpass-backup-${new Date().toISOString().slice(0, 10)}.db`;
  await backupDatabase(database.raw, target);
  database.close();
  console.log(`Consistent backup written to ${target}`);
  Deno.exit(0);
}

if (Deno.args[0] === "verify-audit") {
  const valid = database.verifyAuditChain();
  database.close();
  console.log(valid ? "Audit chain valid" : "Audit chain INVALID");
  Deno.exit(valid ? 0 : 2);
}

database.bootstrapAdmin(config.adminEmail, config.adminPassword);
const handler = createApp({ database, config });

console.log(`PetPass listening on ${config.origin}`);
Deno.serve({ hostname: config.host, port: config.port }, handler);
