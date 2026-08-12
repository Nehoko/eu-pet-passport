import { strict as assert } from "node:assert";
import {
  assertIdentification,
  assertPassportNumber,
  displayDate,
  validateRecord,
} from "../src/domain.ts";

Deno.test("EU identity rules enforce 15-digit chip and pre-2011 tattoo", () => {
  assert.doesNotThrow(() => assertIdentification("microchip", "276098106540123", "2026-01-01"));
  assert.throws(() => assertIdentification("microchip", "1234", "2026-01-01"), /15 digits/);
  assert.doesNotThrow(() => assertIdentification("tattoo", "ABC-123", "2011-07-02"));
  assert.throws(() => assertIdentification("tattoo", "ABC-123", "2011-07-03"), /before 3 July/);
});

Deno.test("passport and copied medical data validation catches boundary errors", () => {
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
