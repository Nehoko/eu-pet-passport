export interface AppConfig {
  host: string;
  port: number;
  origin: string;
  dbPath: string;
  countryCode: string;
  secureCookies: boolean;
}

const ENV_NAMES = [
  "APP_PORT",
  "APP_HOST",
  "APP_DB_PATH",
  "APP_ORIGIN",
  "APP_COUNTRY_CODE",
] as const;

export function loadConfig(provided?: Record<string, string>): AppConfig {
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
  return {
    host,
    port,
    origin,
    dbPath: env.APP_DB_PATH ?? "./data/petpass.db",
    countryCode,
    secureCookies: origin.startsWith("https://"),
  };
}
