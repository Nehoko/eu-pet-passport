import { strict as assert } from "node:assert";
import { PetPassDatabase } from "../src/db.ts";

Deno.test("database workflow records physical issue and preserves audit chain", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  try {
    database.bootstrapAdmin("admin@example.test", "admin-password-long-enough");
    const admin = database.getUserAuth("admin@example.test");
    assert.ok(admin);
    const ownerId = database.createOwner(admin.id, {
      first_name: "Ada",
      last_name: "Owner",
      address: "1 Europe Way",
      postal_code: "10115",
      city: "Berlin",
      country: "Germany",
      phone: "+49 123",
      email: "ada@example.test",
    });
    const petId = database.createPet(admin.id, {
      owner_id: ownerId,
      name: "Luna",
      species: "dog",
      breed: "Labrador",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "white chest",
    });
    const passportId = database.createPassport(admin.id, {
      petId,
      countryCode: "DE",
      number: "00 123456",
    });
    database.addIdentification(admin.id, {
      passport_id: passportId,
      kind: "microchip",
      code: "276098106540123",
      marked_on: "2025-12-31",
      location: "left neck",
    });
    database.addMedicalRecord(admin.id, passportId, "rabies", {
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
    database.recordPhysicalIssue(admin.id, passportId);
    assert.equal(database.getPassport(passportId)?.status, "recorded");
    assert.equal(database.verifyAuditChain(), true);
    assert.throws(() =>
      database.addIdentification(admin.id, {
        passport_id: passportId,
        kind: "microchip",
        code: "276098106540124",
        marked_on: "2026-02-01",
        location: "left neck",
      }), /not editable/);
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("passport physical number is unique", async () => {
  const directory = await Deno.makeTempDir();
  const database = new PetPassDatabase(`${directory}/test.db`);
  try {
    database.bootstrapAdmin("admin@example.test", "admin-password-long-enough");
    const admin = database.getUserAuth("admin@example.test")!;
    const ownerId = database.createOwner(admin.id, {
      first_name: "Ada",
      last_name: "Owner",
      address: "1 Europe Way",
      postal_code: "10115",
      city: "Berlin",
      country: "Germany",
      phone: "",
      email: "ada@example.test",
    });
    const petId = database.createPet(admin.id, {
      owner_id: ownerId,
      name: "Luna",
      species: "cat",
      breed: "European Shorthair",
      sex: "female",
      birth_date: "2024-01-01",
      colour: "black",
      features: "",
    });
    database.createPassport(admin.id, { petId, countryCode: "DE", number: "00 123456" });
    assert.throws(() =>
      database.createPassport(admin.id, { petId, countryCode: "DE", number: "00 123456" })
    );
  } finally {
    database.close();
    await Deno.remove(directory, { recursive: true });
  }
});
