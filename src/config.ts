export interface AppConfig {
  host: string;
  port: number;
  origin: string;
  dbPath: string;
  adminEmail: string;
  adminPassword: string;
  memberState: string;
  countryCode: string;
  secureCookies: boolean;
}

async function readSecretFile(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  return (await Deno.readTextFile(path)).trim();
}

const ENV_NAMES = [
  "APP_PORT",
  "APP_HOST",
  "APP_DB_PATH",
  "APP_ORIGIN",
  "APP_ADMIN_EMAIL",
  "APP_ADMIN_PASSWORD",
  "APP_ADMIN_PASSWORD_FILE",
  "APP_MEMBER_STATE",
  "APP_COUNTRY_CODE",
] as const;

export async function loadConfig(provided?: Record<string, string>): Promise<AppConfig> {
  const env: Record<string, string> = provided ?? {};
  if (!provided) {
    for (const name of ENV_NAMES) {
      const value = Deno.env.get(name);
      if (value !== undefined) env[name] = value;
    }
  }
  const port = Number(env.APP_PORT ?? "8000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid APP_PORT");
  const host = env.APP_HOST ?? "0.0.0.0";
  const origin = (env.APP_ORIGIN ?? `http://localhost:${port}`).replace(/\/$/, "");
  const countryCode = (env.APP_COUNTRY_CODE ?? "DE").toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("APP_COUNTRY_CODE must be ISO alpha-2");
  const adminPassword = env.APP_ADMIN_PASSWORD ??
    await readSecretFile(env.APP_ADMIN_PASSWORD_FILE) ?? "";
  return {
    host,
    port,
    origin,
    dbPath: env.APP_DB_PATH ?? "./data/petpass.db",
    adminEmail: (env.APP_ADMIN_EMAIL ?? "admin@example.test").toLowerCase(),
    adminPassword,
    memberState: env.APP_MEMBER_STATE ?? "Member State",
    countryCode,
    secureCookies: origin.startsWith("https://"),
  };
}
