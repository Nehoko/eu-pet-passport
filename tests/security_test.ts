import { strict as assert } from "node:assert";
import { hashPassword, parseCookies, randomToken, verifyPassword } from "../src/security.ts";

Deno.test("password hashing verifies correct value and rejects wrong value", () => {
  const digest = hashPassword("correct horse battery staple");
  assert.equal(
    verifyPassword("correct horse battery staple", digest.salt, digest.hash, digest.iterations),
    true,
  );
  assert.equal(
    verifyPassword("wrong password value", digest.salt, digest.hash, digest.iterations),
    false,
  );
  assert.equal(digest.iterations, 600_000);
});

Deno.test("password policy rejects short password", () => {
  assert.throws(() => hashPassword("too-short"), /at least 14/);
});

Deno.test("opaque tokens and cookies parse safely", () => {
  assert.ok(randomToken().length >= 40);
  assert.deepEqual(parseCookies("one=1; session=abc%20123"), { one: "1", session: "abc 123" });
});
