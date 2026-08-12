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

if (Deno.args[0] === "admin-reset") {
  const email = Deno.args[1]?.trim().toLowerCase();
  if (Deno.args.length !== 2 || !email || !email.includes("@")) {
    console.error("Usage: petpass admin-reset <existing-admin-email>");
    Deno.exit(64);
  }
  if (!config.adminPassword) {
    console.error("APP_ADMIN_PASSWORD or APP_ADMIN_PASSWORD_FILE is required");
    Deno.exit(78);
  }
  try {
    const stat = await Deno.stat(config.dbPath);
    if (!stat.isFile) throw new Error("database path is not a file");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cannot open existing database at ${config.dbPath}: ${message}`);
    Deno.exit(66);
  }
  const resetDatabase = new PetPassDatabase(config.dbPath);
  try {
    const result = resetDatabase.resetAdminPassword(email, config.adminPassword);
    console.log(
      `Password reset for ${result.email}; revoked ${result.sessionsRevoked} session(s).`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Admin reset failed: ${message}`);
    Deno.exitCode = 1;
  } finally {
    resetDatabase.close();
  }
  Deno.exit(Deno.exitCode ?? 0);
}

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
