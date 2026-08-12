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

async function sessionFromCookie(database: PetPassDatabase, cookie: string) {
  const token = decodeURIComponent(cookie.split("=")[1]);
  return database.getSession(await sha256(token))!;
}

Deno.test("personal edition covers signup, profile, pet, passport, and isolation", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  const config: AppConfig = {
    host: "0.0.0.0",
    port: 8000,
    origin: "http://localhost:8000",
    dbPath: `${directory}/test.db`,
    countryCode: "DE",
    secureCookies: false,
  };
  try {
    const app = createApp({ database, config });

    const loginHtml = await (await app(request("/login"))).text();
    assert.match(loginHtml, /Create one/);
    assert.match(loginHtml, /Personal copy only/);
    assert.equal(loginHtml.match(/class="eu-star"/g)?.length, 12);
    assert.doesNotMatch(loginHtml, /administrator|veterinarian|auditor/i);
    assert.equal((await app(request("/api/v1/passports/missing"))).status, 401);

    const signup = await app(request("/signup", "POST", {
      first_name: "Ada",
      last_name: "Owner",
      email: "ada@example.test",
      password: "owner-password-long-enough",
      password_confirmation: "owner-password-long-enough",
    }));
    assert.equal(signup.status, 303);
    const adaCookie = signup.headers.get("set-cookie")!.split(";")[0];
    const adaSession = await sessionFromCookie(database, adaCookie);

    const dashboardHtml = await (await app(request("/", "GET", undefined, adaCookie))).text();
    assert.match(dashboardHtml, /Finish your contact details/);
    assert.match(dashboardHtml, /Add pet/);
    assert.doesNotMatch(dashboardHtml, /role|admin|audit|travel check|Register pet/i);

    const profile = await app(request("/profile", "POST", {
      csrf: adaSession.csrf,
      first_name: "Ada",
      last_name: "Owner",
      address: "1 Europe Way",
      postal_code: "10115",
      city: "Berlin",
      country: "Germany",
      phone: "+49 123",
    }, adaCookie));
    assert.equal(profile.status, 303);
    const savedProfileHtml = await (
      await app(request("/profile?saved=1", "GET", undefined, adaCookie))
    ).text();
    assert.match(savedProfileHtml, /Your details were saved/);

    const pet = await app(request("/pets", "POST", {
      csrf: adaSession.csrf,
      name: "Luna",
      species: "dog",
      breed: "Labrador",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "white chest",
      owner_id: "attacker-controlled-value",
    }, adaCookie));
    assert.equal(pet.status, 303);
    const ada = database.getUserAuth("ada@example.test")!;
    const petId = database.listPets(ada)[0].id;
    assert.equal(database.listPets(ada)[0].owner_id, database.getOwnerByEmail(ada.email)!.id);

    const passportResponse = await app(request("/passports", "POST", {
      csrf: adaSession.csrf,
      pet_id: petId,
      country_code: "DE",
      number: "00 123456",
      model_version: "EU physical passport",
      issued_on: "2025-04-12",
      issuing_vet: "Dr Example, Example Clinic",
    }, adaCookie));
    assert.equal(passportResponse.status, 303);
    const passportId = database.listPassports(ada)[0].id;

    const identification = await app(request(`/passports/${passportId}/identifications`, "POST", {
      csrf: adaSession.csrf,
      kind: "microchip",
      code: "276098106540123",
      marked_on: "2024-01-01",
      location: "left neck",
    }, adaCookie));
    assert.equal(identification.status, 303);

    const rabies = await app(request(`/passports/${passportId}/records`, "POST", {
      csrf: adaSession.csrf,
      type: "rabies",
      product: "Nobivac Rabies",
      batch: "B-1",
      reference: "",
      result: "",
      date: "2026-01-01",
      time: "",
      valid_from: "2026-01-22",
      valid_until: "2027-01-01",
      notes: "Copied from page V",
    }, adaCookie));
    assert.equal(rabies.status, 303);

    const detailHtml = await (
      await app(request(`/passports/${passportId}`, "GET", undefined, adaCookie))
    ).text();
    assert.match(detailHtml, /Open emergency view/);
    assert.match(detailHtml, /Add identification/);
    assert.match(detailHtml, /Add health information/);
    assert.match(detailHtml, /Nobivac Rabies/);
    assert.match(detailHtml, /Dr Example, Example Clinic/);
    assert.match(detailHtml, /12\/04\/2025/);
    assert.doesNotMatch(detailHtml, /Record physical issue|Sign and append|travel readiness/i);

    const emergency = await app(
      request(`/passports/${passportId}/emergency`, "GET", undefined, adaCookie),
    );
    const emergencyHtml = await emergency.text();
    assert.equal(emergency.status, 200);
    assert.match(emergencyHtml, /NOT AN OFFICIAL PET PASSPORT/);
    assert.match(emergencyHtml, /276098106540123/);
    assert.match(emergencyHtml, /Nobivac Rabies/);
    assert.match(emergencyHtml, /Dr Example, Example Clinic/);
    assert.match(emergencyHtml, /12\/04\/2025/);
    assert.doesNotMatch(emergencyHtml, /13 out of 13/);

    const secondSignup = await app(request("/signup", "POST", {
      first_name: "Alex",
      last_name: "Other",
      email: "alex@example.test",
      password: "other-password-long-enough",
      password_confirmation: "other-password-long-enough",
    }));
    const alexCookie = secondSignup.headers.get("set-cookie")!.split(";")[0];
    const alexSession = await sessionFromCookie(database, alexCookie);
    assert.doesNotMatch(
      await (await app(request("/pets", "GET", undefined, alexCookie))).text(),
      /Luna/,
    );
    assert.equal(
      (await app(request(`/passports/${passportId}`, "GET", undefined, alexCookie))).status,
      404,
    );
    assert.equal(
      (await app(request(`/passports/${passportId}/records`, "POST", {
        csrf: alexSession.csrf,
        type: "other",
        date: "2026-01-01",
      }, alexCookie))).status,
      404,
    );
    assert.equal((await app(request("/admin/users", "GET", undefined, adaCookie))).status, 404);
    assert.equal((await app(request("/audit", "GET", undefined, adaCookie))).status, 404);
    assert.equal(database.verifyAuditChain(), true);

    const duplicate = await app(request("/signup", "POST", {
      first_name: "Duplicate",
      last_name: "Owner",
      email: "ada@example.test",
      password: "duplicate-password-long-enough",
      password_confirmation: "duplicate-password-long-enough",
    }));
    assert.equal(duplicate.status, 400);
    assert.match(await duplicate.text(), /already exists/);

    const crossSite = request("/signup", "POST", {
      first_name: "Cross",
      last_name: "Site",
      email: "cross@example.test",
      password: "cross-site-password-long-enough",
      password_confirmation: "cross-site-password-long-enough",
    });
    crossSite.headers.set("Origin", "null");
    crossSite.headers.set("Sec-Fetch-Site", "cross-site");
    assert.equal((await app(crossSite)).status, 400);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
