import type { AppConfig } from "./config.ts";
import { PetPassDatabase } from "./db.ts";
import {
  assertCountryCode,
  assertIdentification,
  assertPassportNumber,
  isoDate,
  optional,
  optionalIsoDate,
  required,
  validateRecord,
  ValidationError,
} from "./domain.ts";
import {
  clearSessionCookie,
  parseCookies,
  randomToken,
  securityHeaders,
  sessionCookie,
  sha256,
  verifyPassword,
} from "./security.ts";
import type { RecordType, SessionContext, Species, User } from "./types.ts";
import {
  alert,
  dashboardPage,
  emergencyPage,
  layout,
  loginPage,
  passportDetailPage,
  passportFormPage,
  passportsPage,
  petDetailPage,
  petFormPage,
  petsPage,
  profilePage,
  signupPage,
} from "./views.ts";

export interface AppDependencies {
  database: PetPassDatabase;
  config: AppConfig;
}

const attempts = new Map<string, { count: number; reset: number }>();

function response(
  body: string,
  status = 200,
  type = "text/html; charset=utf-8",
  extra?: HeadersInit,
): Response {
  const headers = securityHeaders();
  headers.set("Content-Type", type);
  if (extra) new Headers(extra).forEach((value, key) => headers.append(key, value));
  return new Response(body, { status, headers });
}

function json(value: unknown, status = 200): Response {
  return response(JSON.stringify(value), status, "application/json; charset=utf-8");
}

function redirect(location: string, extra?: HeadersInit): Response {
  const headers = securityHeaders();
  headers.set("Location", location);
  if (extra) new Headers(extra).forEach((value, key) => headers.append(key, value));
  return new Response(null, { status: 303, headers });
}

function notFound(user?: User, csrf = ""): Response {
  return response(
    layout(
      "Not found",
      '<section class="panel error-page"><h1>Page not found</h1><a href="/">Return home</a></section>',
      user,
      csrf,
    ),
    404,
  );
}

function errorResponse(error: unknown, user?: User, csrf = "", status = 400): Response {
  const message = error instanceof Error ? error.message : "Request failed";
  return response(
    layout(
      "Request failed",
      `<section class="panel error-page">${
        alert(message, "error")
      }<a class="secondary button" href="/">Return home</a></section>`,
      user,
      csrf,
    ),
    status,
  );
}

async function formData(req: Request): Promise<FormData> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > 1_000_000) throw new ValidationError("Request body exceeds 1 MB");
  return await req.formData();
}

function checkOrigin(req: Request, config: AppConfig): void {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  const opaqueSameOrigin = origin === "null" && site === "same-origin" &&
    new URL(req.url).host === new URL(config.origin).host;
  if (origin && origin !== config.origin && !opaqueSameOrigin) {
    throw new ValidationError("Cross-origin form submission rejected");
  }
  if (site === "cross-site") throw new ValidationError("Cross-site form submission rejected");
}

function checkCsrf(data: FormData, session: SessionContext): void {
  const token = String(data.get("csrf") ?? "");
  if (!token || token !== session.csrf) {
    throw new ValidationError("CSRF token is invalid or expired");
  }
}

function emailAddress(value: FormDataEntryValue | null): string {
  const email = required(value, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email address is invalid");
  }
  return email;
}

function loginKey(req: Request, email: string): string {
  return `${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}|${email}`;
}

function rateLimited(key: string): boolean {
  const current = attempts.get(key);
  if (!current || current.reset < Date.now()) return false;
  return current.count >= 8;
}

function failLogin(key: string): void {
  const current = attempts.get(key);
  if (!current || current.reset < Date.now()) {
    attempts.set(key, { count: 1, reset: Date.now() + 15 * 60_000 });
  } else current.count++;
}

function routeId(path: string, expression: RegExp): string | undefined {
  return path.match(expression)?.[1];
}

export function createApp(
  { database, config }: AppDependencies,
): (req: Request) => Promise<Response> {
  const cookieName = config.secureCookies ? "__Host-petpass_session" : "petpass_session";

  async function sessionFor(req: Request): Promise<SessionContext | undefined> {
    const token = parseCookies(req.headers.get("cookie"))[cookieName];
    if (!token) return undefined;
    return database.getSession(await sha256(token));
  }

  async function startSession(userId: string): Promise<Response> {
    const token = randomToken();
    database.createSession(userId, await sha256(token), randomToken(24));
    return redirect("/", {
      "Set-Cookie": sessionCookie(cookieName, token, config.secureCookies),
    });
  }

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path === "/health/live") return json({ status: "ok" });
      if (path === "/health/ready") {
        database.raw.prepare("SELECT 1").get();
        return json({ status: "ready", database: "ok", edition: "personal-copy" });
      }
      if (path === "/app.css" || path === "/print.css" || path === "/print.js") {
        const file = path === "/app.css"
          ? "../public/app.css"
          : path === "/print.css"
          ? "../public/print.css"
          : "../public/print.js";
        const asset = await Deno.readTextFile(new URL(file, import.meta.url));
        const type = path.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : "text/css; charset=utf-8";
        return response(asset, 200, type, { "Cache-Control": "public, max-age=3600" });
      }

      const session = await sessionFor(req);

      if (req.method === "GET" && path === "/login") {
        if (session) return redirect("/");
        return response(loginPage());
      }

      if (req.method === "POST" && path === "/login") {
        checkOrigin(req, config);
        const data = await formData(req);
        const email = emailAddress(data.get("email"));
        const password = required(data.get("password"), "Password", 1000);
        const key = loginKey(req, email);
        if (rateLimited(key)) {
          return response(loginPage("Too many attempts. Try again in 15 minutes."), 429);
        }
        const user = database.getUserAuth(email);
        if (
          !user || user.status !== "active" ||
          !verifyPassword(
            password,
            user.password_salt,
            user.password_hash,
            user.password_iterations,
          )
        ) {
          failLogin(key);
          return response(loginPage("Email or password is incorrect."), 401);
        }
        attempts.delete(key);
        return await startSession(user.id);
      }

      if (req.method === "GET" && path === "/signup") {
        if (session) return redirect("/");
        return response(signupPage());
      }

      if (req.method === "POST" && path === "/signup") {
        checkOrigin(req, config);
        try {
          const data = await formData(req);
          const firstName = required(data.get("first_name"), "First name", 100);
          const lastName = required(data.get("last_name"), "Last name", 100);
          const email = emailAddress(data.get("email"));
          const password = required(data.get("password"), "Password", 1000);
          const confirmation = required(
            data.get("password_confirmation"),
            "Password confirmation",
            1000,
          );
          if (password.length < 14) {
            throw new ValidationError("Password must contain at least 14 characters");
          }
          if (password !== confirmation) throw new ValidationError("Passwords do not match");
          if (database.getUserAuth(email) || database.getOwnerByEmail(email)) {
            throw new ValidationError("An account with this email already exists");
          }
          const userId = database.createAccount({ email, firstName, lastName, password });
          return await startSession(userId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Account creation failed";
          return response(signupPage(message), 400);
        }
      }

      if (!session) {
        if (path.startsWith("/api/")) return json({ error: "authentication_required" }, 401);
        return redirect("/login");
      }

      const { user, csrf } = session;
      if (req.method === "POST") checkOrigin(req, config);

      if (req.method === "POST" && path === "/logout") {
        const data = await formData(req);
        checkCsrf(data, session);
        database.deleteSession(session.tokenDigest);
        return redirect("/login", {
          "Set-Cookie": clearSessionCookie(cookieName, config.secureCookies),
        });
      }

      if (req.method === "GET" && path === "/") {
        const owner = database.getOwnerByEmail(user.email);
        if (!owner) return errorResponse(new Error("Account profile not found"), user, csrf, 500);
        return response(
          dashboardPage(
            user,
            owner,
            database.getCounts(user),
            database.listPassports(user),
            csrf,
          ),
        );
      }

      if (req.method === "GET" && path === "/profile") {
        const owner = database.getOwnerByEmail(user.email);
        if (!owner) return notFound(user, csrf);
        return response(
          layout(
            "My details",
            profilePage(owner, csrf, url.searchParams.get("saved") === "1"),
            user,
            csrf,
          ),
        );
      }
      if (req.method === "POST" && path === "/profile") {
        const data = await formData(req);
        checkCsrf(data, session);
        database.updateOwnerProfile(user.id, user.email, {
          first_name: required(data.get("first_name"), "First name", 100),
          last_name: required(data.get("last_name"), "Last name", 100),
          address: required(data.get("address"), "Address", 200),
          postal_code: required(data.get("postal_code"), "Postcode", 30),
          city: required(data.get("city"), "City", 100),
          country: required(data.get("country"), "Country", 100),
          phone: optional(data.get("phone"), 50),
        });
        return redirect("/profile?saved=1");
      }

      if (req.method === "GET" && path === "/pets") {
        return response(layout("My pets", petsPage(database.listPets(user)), user, csrf));
      }
      if (req.method === "GET" && path === "/pets/new") {
        return response(layout("Add pet", petFormPage(csrf), user, csrf));
      }
      if (req.method === "POST" && path === "/pets") {
        const data = await formData(req);
        checkCsrf(data, session);
        const owner = database.getOwnerByEmail(user.email);
        if (!owner) return notFound(user, csrf);
        const species = required(data.get("species"), "Species", 20) as Species;
        if (!["dog", "cat", "ferret"].includes(species)) {
          throw new ValidationError("Species is not supported");
        }
        const id = database.createPet(user.id, {
          owner_id: owner.id,
          name: required(data.get("name"), "Name", 100),
          species,
          breed: required(data.get("breed"), "Breed", 100),
          sex: required(data.get("sex"), "Sex", 30),
          birth_date: isoDate(data.get("birth_date"), "Date of birth"),
          colour: required(data.get("colour"), "Colour", 100),
          features: optional(data.get("features"), 500),
        });
        return redirect(`/pets/${id}`);
      }
      const petId = routeId(path, /^\/pets\/([0-9a-f-]+)$/);
      if (req.method === "GET" && petId) {
        const pet = database.listPets(user).find((item) => item.id === petId);
        if (!pet) return notFound(user, csrf);
        const passports = database.listPassports(user).filter((passport) =>
          passport.pet_id === petId
        );
        return response(layout(pet.name, petDetailPage(pet, passports), user, csrf));
      }

      if (req.method === "GET" && path === "/passports") {
        const pets = database.listPets(user);
        return response(
          layout(
            "My passport copies",
            passportsPage(database.listPassports(user), pets.length > 0),
            user,
            csrf,
          ),
        );
      }
      if (req.method === "GET" && path === "/passports/new") {
        return response(layout(
          "Add passport copy",
          passportFormPage(
            database.listPets(user),
            csrf,
            config.countryCode,
            url.searchParams.get("pet") ?? "",
          ),
          user,
          csrf,
        ));
      }
      if (req.method === "POST" && path === "/passports") {
        const data = await formData(req);
        checkCsrf(data, session);
        const petId = required(data.get("pet_id"), "Pet", 50);
        if (!database.listPets(user).some((pet) => pet.id === petId)) return notFound(user, csrf);
        const id = database.createPassport(user.id, {
          petId,
          countryCode: assertCountryCode(required(data.get("country_code"), "Country code", 2)),
          number: assertPassportNumber(required(data.get("number"), "Physical booklet number", 32)),
          modelVersion: optional(data.get("model_version"), 100),
          issuingVet: optional(data.get("issuing_vet"), 150),
          issuedOn: optionalIsoDate(data.get("issued_on"), "Physical issue date"),
        });
        return redirect(`/passports/${id}`);
      }

      const emergencyId = routeId(path, /^\/passports\/([0-9a-f-]+)\/(?:print|emergency)$/);
      if (req.method === "GET" && emergencyId) {
        const passport = database.getPassport(emergencyId);
        if (!passport || !database.canAccessPassport(user, passport)) return notFound(user, csrf);
        const owner = database.getOwner(passport.owner_id);
        if (!owner) return notFound(user, csrf);
        return response(emergencyPage(
          passport,
          owner,
          database.listIdentifications(emergencyId),
          database.listMedicalRecords(emergencyId),
        ));
      }

      const passportId = routeId(path, /^\/passports\/([0-9a-f-]+)$/);
      if (req.method === "GET" && passportId) {
        const passport = database.getPassport(passportId);
        if (!passport || !database.canAccessPassport(user, passport)) return notFound(user, csrf);
        const owner = database.getOwner(passport.owner_id);
        if (!owner) return notFound(user, csrf);
        return response(layout(
          passport.pet_name,
          passportDetailPage(
            passport,
            owner,
            database.listIdentifications(passportId),
            database.listMedicalRecords(passportId),
            csrf,
          ),
          user,
          csrf,
        ));
      }

      const identificationId = routeId(path, /^\/passports\/([0-9a-f-]+)\/identifications$/);
      if (req.method === "POST" && identificationId) {
        const passport = database.getPassport(identificationId);
        if (!passport || !database.canAccessPassport(user, passport)) return notFound(user, csrf);
        const data = await formData(req);
        checkCsrf(data, session);
        const kind = required(data.get("kind"), "Identification kind", 20);
        if (!["microchip", "tattoo"].includes(kind)) {
          throw new ValidationError("Invalid identification kind");
        }
        const code = required(data.get("code"), "Identification code", 32).replaceAll(" ", "");
        const markedOn = isoDate(data.get("marked_on"), "Application or reading date");
        assertIdentification(kind, code, markedOn);
        database.addIdentification(user.id, {
          passport_id: identificationId,
          kind: kind as "microchip" | "tattoo",
          code,
          marked_on: markedOn,
          location: required(data.get("location"), "Location", 100),
        });
        return redirect(`/passports/${identificationId}`);
      }

      const recordId = routeId(path, /^\/passports\/([0-9a-f-]+)\/records$/);
      if (req.method === "POST" && recordId) {
        const passport = database.getPassport(recordId);
        if (!passport || !database.canAccessPassport(user, passport)) return notFound(user, csrf);
        const data = await formData(req);
        checkCsrf(data, session);
        const type = required(data.get("type"), "Entry type", 30) as RecordType;
        if (
          ![
            "rabies",
            "titration",
            "echinococcus",
            "antiparasite",
            "vaccination",
            "clinical",
            "legalisation",
            "other",
          ].includes(type)
        ) throw new ValidationError("Invalid entry type");
        const values: Record<string, string> = {
          product: optional(data.get("product"), 200),
          batch: optional(data.get("batch"), 100),
          reference: optional(data.get("reference"), 100),
          result: optional(data.get("result"), 30),
          date: isoDate(data.get("date"), "Record date"),
          time: optional(data.get("time"), 5),
          valid_from: optional(data.get("valid_from"), 10),
          valid_until: optional(data.get("valid_until"), 10),
          notes: optional(data.get("notes"), 500),
        };
        validateRecord(type, values);
        database.addMedicalRecord(user.id, recordId, type, values);
        return redirect(`/passports/${recordId}`);
      }

      const apiId = routeId(path, /^\/api\/v1\/passports\/([0-9a-f-]+)$/);
      if (req.method === "GET" && apiId) {
        const passport = database.getPassport(apiId);
        if (!passport || !database.canAccessPassport(user, passport)) {
          return json({ error: "not_found" }, 404);
        }
        return json({
          passport,
          identifications: database.listIdentifications(apiId),
          medicalRecords: database.listMedicalRecords(apiId).map((record) => ({
            ...record,
            data: JSON.parse(record.data_json),
            data_json: undefined,
          })),
          disclaimer: "Personal digital copy; not an official pet passport",
        });
      }

      return notFound(user, csrf);
    } catch (error) {
      if (error instanceof ValidationError) {
        const current = await sessionFor(req);
        return errorResponse(error, current?.user, current?.csrf, 400);
      }
      console.error("request_failed", {
        path,
        message: error instanceof Error ? error.message : String(error),
      });
      const current = await sessionFor(req);
      return errorResponse(
        new Error("Request failed safely. Check server logs."),
        current?.user,
        current?.csrf,
        500,
      );
    }
  };
}
