import { strict as assert } from "node:assert";
import {
  assertIdentification,
  assertPassportNumber,
  displayDate,
  travelReadiness,
  validateRecord,
} from "../src/domain.ts";
import type { Identification, MedicalRecord, Passport, Pet } from "../src/types.ts";

Deno.test("EU identity rules enforce 15-digit chip and pre-2011 tattoo", () => {
  assert.doesNotThrow(() => assertIdentification("microchip", "276098106540123", "2026-01-01"));
  assert.throws(() => assertIdentification("microchip", "1234", "2026-01-01"), /15 digits/);
  assert.doesNotThrow(() => assertIdentification("tattoo", "ABC-123", "2011-07-02"));
  assert.throws(() => assertIdentification("tattoo", "ABC-123", "2011-07-03"), /before 3 July/);
});

Deno.test("passport and medical record validation catches boundary errors", () => {
  assert.equal(assertPassportNumber("ab 123-9"), "AB 123-9");
  assert.throws(() => assertPassportNumber("!!"), /3-32/);
  assert.doesNotThrow(() =>
    validateRecord("rabies", {
      product: "Nobivac Rabies",
      batch: "B-1",
      date: "2026-01-01",
      valid_until: "2027-01-01",
    })
  );
  assert.throws(() =>
    validateRecord("rabies", {
      product: "Nobivac Rabies",
      batch: "B-1",
      date: "2026-01-01",
      valid_until: "2025-01-01",
    })
  );
  assert.equal(displayDate("2026-08-11"), "11/08/2026");
});

Deno.test("travel readiness finds identification, rabies, and Echinococcus rules", () => {
  const passport = {
    id: "passport",
    pet_id: "pet",
    country_code: "DE",
    number: "00 123456",
    model_version: "EU-2026/705",
    status: "recorded",
    issuing_vet_id: "vet",
    issued_at: "2026-01-01",
    void_reason: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    pet_name: "Luna",
    species: "dog",
    breed: "Labrador",
    sex: "female",
    birth_date: "2024-01-01",
    colour: "black",
    features: "white chest",
    owner_id: "owner",
    owner_name: "Ada Owner",
    owner_email: "ada@example.test",
    issuing_vet_name: "Dr Vet",
  } satisfies Passport;
  const pet = {
    id: "pet",
    owner_id: "owner",
    owner_name: "Ada Owner",
    name: "Luna",
    species: "dog",
    breed: "Labrador",
    sex: "female",
    birth_date: "2024-01-01",
    colour: "black",
    features: "white chest",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  } satisfies Pet;
  const ids = [{
    id: "id",
    passport_id: "passport",
    kind: "microchip",
    code: "276098106540123",
    marked_on: "2025-12-31",
    location: "left neck",
    verified_by: "vet",
    created_at: "2025-12-31",
  }] satisfies Identification[];
  const rabies = {
    id: "record",
    passport_id: "passport",
    type: "rabies",
    data_json: JSON.stringify({
      product: "Nobivac Rabies",
      batch: "B-1",
      date: "2026-01-01",
      valid_until: "2027-01-01",
    }),
    status: "signed",
    created_by: "vet",
    signed_by: "vet",
    signer_name: "Dr Vet",
    signed_at: "2026-01-01",
    supersedes_id: null,
    void_reason: null,
    created_at: "2026-01-01",
  } satisfies MedicalRecord;
  const standard = travelReadiness(passport, pet, ids, [rabies], "DE", "2026-08-11");
  assert.equal(standard.ready, true);
  const finland = travelReadiness(passport, pet, ids, [rabies], "FI", "2026-08-11");
  assert.equal(finland.ready, false);
  assert.ok(finland.checks.some((check) => check.message.includes("Echinococcus")));
});
