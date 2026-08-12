import { strict as assert } from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { PetPassDatabase } from "../src/db.ts";
import { verifyPassword } from "../src/security.ts";

Deno.test("self-service account creates one personal profile", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  try {
    const userId = database.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Owner",
      password: "owner-password-long-enough",
    });
    const account = database.getUserAuth("ADA@example.test")!;
    assert.equal(account.id, userId);
    assert.equal(
      verifyPassword(
        "owner-password-long-enough",
        account.password_salt,
        account.password_hash,
        account.password_iterations,
      ),
      true,
    );
    const columns = database.raw.prepare("PRAGMA table_info(users)").all() as Array<{
      name: string;
    }>;
    assert.equal(columns.some((column) => column.name === "role"), false);
    assert.equal(columns.some((column) => column.name === "vet_verified"), false);
    const owner = database.getOwnerByEmail("ada@example.test")!;
    assert.equal(owner.first_name, "Ada");
    assert.equal(owner.address, "");

    database.updateOwnerProfile(userId, account.email, {
      first_name: "Ada",
      last_name: "Lovelace",
      address: "1 Europe Way",
      postal_code: "10115",
      city: "Berlin",
      country: "Germany",
      phone: "+49 123",
    });
    assert.equal(database.getOwnerByEmail(account.email)?.city, "Berlin");
    assert.equal(database.getUser(userId)?.display_name, "Ada Lovelace");
    assert.equal(database.verifyAuditChain(), true);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("personal edition refuses a clinic-edition database", async () => {
  const directory = await Deno.makeTempDir();
  const path = `${directory}/clinic.db`;
  const legacy = new DatabaseSync(path);
  try {
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        vet_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT
    `);
  } finally {
    legacy.close();
  }
  try {
    assert.throws(
      () => new PetPassDatabase(path),
      /Clinic-edition database detected/,
    );
    const check = new DatabaseSync(path);
    try {
      const columns = check.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
      assert.equal(columns.some((column) => column.name === "role"), true);
      assert.equal(columns.some((column) => column.name === "vet_verified"), true);
    } finally {
      check.close();
    }
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("personal records stay scoped to account owner", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  try {
    const adaId = database.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Owner",
      password: "owner-password-long-enough",
    });
    const alexId = database.createAccount({
      email: "alex@example.test",
      firstName: "Alex",
      lastName: "Other",
      password: "other-password-long-enough",
    });
    const ada = database.getUser(adaId)!;
    const alex = database.getUser(alexId)!;
    const owner = database.getOwnerByEmail(ada.email)!;
    const petId = database.createPet(ada.id, {
      owner_id: owner.id,
      name: "Luna",
      species: "dog",
      breed: "Labrador",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "white chest",
    });
    const passportId = database.createPassport(ada.id, {
      petId,
      countryCode: "DE",
      number: "00 123456",
      modelVersion: "EU physical passport",
      issuingVet: "Dr Example",
      issuedOn: "2025-04-12",
    });
    const passport = database.getPassport(passportId)!;
    assert.equal(passport.status, "recorded");
    assert.equal(passport.model_version, "EU physical passport");
    assert.equal(passport.issuing_vet_name_copy, "Dr Example");
    assert.equal(passport.issued_on_copy, "2025-04-12");
    database.addIdentification(ada.id, {
      passport_id: passportId,
      kind: "microchip",
      code: "276098106540123",
      marked_on: "2025-12-31",
      location: "left neck",
    });
    database.addMedicalRecord(ada.id, passportId, "rabies", {
      product: "Nobivac Rabies",
      batch: "B-1",
      date: "2026-01-01",
      valid_from: "2026-01-22",
      valid_until: "2027-01-01",
      time: "",
      reference: "",
      result: "",
      notes: "",
    });
    assert.equal(database.listPets(ada).length, 1);
    assert.equal(database.listPassports(ada).length, 1);
    assert.equal(database.listPets(alex).length, 0);
    assert.equal(database.listPassports(alex).length, 0);
    assert.equal(database.canAccessPassport(alex, database.getPassport(passportId)!), false);
    assert.equal(database.verifyAuditChain(), true);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("physical passport number remains unique", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  try {
    const userId = database.createAccount({
      email: "ada@example.test",
      firstName: "Ada",
      lastName: "Owner",
      password: "owner-password-long-enough",
    });
    const user = database.getUser(userId)!;
    const owner = database.getOwnerByEmail(user.email)!;
    const petId = database.createPet(user.id, {
      owner_id: owner.id,
      name: "Luna",
      species: "cat",
      breed: "European Shorthair",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "",
    });
    database.createPassport(user.id, { petId, countryCode: "DE", number: "00 123456" });
    assert.throws(() =>
      database.createPassport(user.id, { petId, countryCode: "DE", number: "00 123456" })
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
