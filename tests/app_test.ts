import { strict as assert } from "node:assert";
import { createApp } from "../src/app.ts";
import type { AppConfig } from "../src/config.ts";
import { PetPassDatabase } from "../src/db.ts";
import { sha256 } from "../src/security.ts";

function request(
  path: string,
  method = "GET",
  data?: Record<string, string>,
  cookie?: string,
): Request {
  const headers = new Headers({ Origin: "http://localhost:8000" });
  if (cookie) headers.set("Cookie", cookie);
  let body: URLSearchParams | undefined;
  if (data) {
    body = new URLSearchParams(data);
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }
  return new Request(`http://localhost:8000${path}`, { method, headers, body });
}

Deno.test("HTTP integration covers auth, CSRF, RBAC, and core forms", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  const config: AppConfig = {
    host: "0.0.0.0",
    port: 8000,
    origin: "http://localhost:8000",
    dbPath: `${directory}/test.db`,
    adminEmail: "admin@example.test",
    adminPassword: "admin-password-long-enough",
    memberState: "Germany",
    countryCode: "DE",
    secureCookies: false,
  };
  try {
    database.bootstrapAdmin(config.adminEmail, config.adminPassword);
    const app = createApp({ database, config });

    assert.equal((await app(request("/api/v1/passports/missing"))).status, 401);
    const login = await app(request("/login", "POST", {
      email: config.adminEmail,
      password: config.adminPassword,
    }));
    assert.equal(login.status, 303);
    const setCookie = login.headers.get("set-cookie")!;
    const cookie = setCookie.split(";")[0];
    const token = decodeURIComponent(cookie.split("=")[1]);
    const session = database.getSession(await sha256(token));
    assert.ok(session);

    const dashboard = await app(request("/", "GET", undefined, cookie));
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Good records make/);

    const rejected = await app(request("/owners", "POST", {
      first_name: "Ada",
      last_name: "Owner",
    }, cookie));
    assert.equal(rejected.status, 400);

    const owner = await app(request("/owners", "POST", {
      csrf: session.csrf,
      first_name: "Ada",
      last_name: "Owner",
      address: "1 Europe Way",
      postal_code: "10115",
      city: "Berlin",
      country: "Germany",
      phone: "+49 123",
      email: "ada@example.test",
    }, cookie));
    assert.equal(owner.status, 303);
    const ownerId = database.listOwners()[0].id;

    const pet = await app(request("/pets", "POST", {
      csrf: session.csrf,
      owner_id: ownerId,
      name: "Luna",
      species: "dog",
      breed: "Labrador",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "white chest",
    }, cookie));
    assert.equal(pet.status, 303);
    const petId = database.listPets()[0].id;

    const passportResponse = await app(request("/passports", "POST", {
      csrf: session.csrf,
      pet_id: petId,
      country_code: "DE",
      number: "00 123456",
    }, cookie));
    assert.equal(passportResponse.status, 303);
    const passportId = database.listPassports()[0].id;

    const print = await app(request(`/passports/${passportId}/print`, "GET", undefined, cookie));
    const printHtml = await print.text();
    assert.equal(print.status, 200);
    assert.match(printHtml, /I\. DETAILS OF OWNERSHIP/);
    assert.match(printHtml, /XII\. OTHERS/);
    assert.match(printHtml, /NOT VALID AS ORIGINAL PASSPORT/);

    database.createUser(database.getUserAuth(config.adminEmail)!.id, {
      email: "owner@example.test",
      displayName: "Owner User",
      password: "owner-password-long-enough",
      role: "owner",
      vetVerified: false,
    });
    const ownerLogin = await app(request("/login", "POST", {
      email: "owner@example.test",
      password: "owner-password-long-enough",
    }));
    const ownerCookie = ownerLogin.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await app(request("/owners", "GET", undefined, ownerCookie))).status, 403);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
