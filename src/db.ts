import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./security.ts";
import type {
  Identification,
  MedicalRecord,
  Owner,
  Passport,
  Pet,
  RecordType,
  SessionContext,
  User,
} from "./types.ts";

function now(): string {
  return new Date().toISOString();
}

export class PetPassDatabase {
  readonly raw: DatabaseSync;

  constructor(path: string) {
    this.raw = new DatabaseSync(path);
    this.raw.exec("PRAGMA foreign_keys = ON");
    this.raw.exec("PRAGMA journal_mode = WAL");
    this.raw.exec("PRAGMA synchronous = FULL");
    this.raw.exec("PRAGMA busy_timeout = 5000");
    try {
      this.migrate();
    } catch (error) {
      this.raw.close();
      throw error;
    }
  }

  close(): void {
    this.raw.close();
  }

  private migrate(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS sessions (
        token_digest TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS owners (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        address TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS pets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES owners(id),
        name TEXT NOT NULL,
        species TEXT NOT NULL CHECK(species IN ('dog','cat','ferret')),
        breed TEXT NOT NULL,
        sex TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        colour TEXT NOT NULL,
        features TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS passports (
        id TEXT PRIMARY KEY,
        pet_id TEXT NOT NULL REFERENCES pets(id),
        country_code TEXT NOT NULL,
        number TEXT NOT NULL,
        model_version TEXT NOT NULL DEFAULT 'EU-2026/705',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','recorded','void')),
        issuing_vet_id TEXT REFERENCES users(id),
        issuing_vet_name_copy TEXT NOT NULL DEFAULT '',
        issued_on_copy TEXT,
        issued_at TEXT,
        void_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(country_code, number)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS identifications (
        id TEXT PRIMARY KEY,
        passport_id TEXT NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('microchip','tattoo')),
        code TEXT NOT NULL,
        marked_on TEXT NOT NULL,
        location TEXT NOT NULL,
        verified_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS medical_records (
        id TEXT PRIMARY KEY,
        passport_id TEXT NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('rabies','titration','echinococcus','antiparasite','vaccination','clinical','legalisation','other')),
        data_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'signed' CHECK(status IN ('signed','void')),
        created_by TEXT NOT NULL REFERENCES users(id),
        signed_by TEXT NOT NULL REFERENCES users(id),
        signed_at TEXT NOT NULL,
        supersedes_id TEXT REFERENCES medical_records(id),
        void_reason TEXT,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        actor_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        event_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS pets_owner_idx ON pets(owner_id);
      CREATE INDEX IF NOT EXISTS passports_pet_idx ON passports(pet_id);
      CREATE INDEX IF NOT EXISTS medical_passport_idx ON medical_records(passport_id, created_at);
      CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events(created_at);

      INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
    `);

    // Version 2 deployments use a separate volume. Do not destructively rewrite a clinic-edition
    // database if an operator accidentally points this image at the old volume.
    const userColumns = this.raw.prepare("PRAGMA table_info(users)").all() as Array<{
      name: string;
    }>;
    if (userColumns.some((column) => column.name === "role" || column.name === "vet_verified")) {
      throw new Error(
        "Clinic-edition database detected. Use the separate petpass_v2_data volume.",
      );
    }
    const passportColumns = this.raw.prepare("PRAGMA table_info(passports)").all() as Array<{
      name: string;
    }>;
    if (!passportColumns.some((column) => column.name === "issuing_vet_name_copy")) {
      this.raw.exec(
        "ALTER TABLE passports ADD COLUMN issuing_vet_name_copy TEXT NOT NULL DEFAULT ''",
      );
    }
    if (!passportColumns.some((column) => column.name === "issued_on_copy")) {
      this.raw.exec("ALTER TABLE passports ADD COLUMN issued_on_copy TEXT");
    }
    this.raw.exec(
      "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (2, datetime('now'))",
    );
  }

  private transaction<T>(fn: () => T): T {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.raw.exec("COMMIT");
      return value;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }

  private audit(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown> = {},
  ): void {
    const createdAt = now();
    const previous = this.raw.prepare(
      "SELECT event_hash FROM audit_events ORDER BY created_at DESC, rowid DESC LIMIT 1",
    ).get() as { event_hash?: string } | undefined;
    const previousHash = previous?.event_hash ?? "GENESIS";
    const detailsJson = JSON.stringify(details);
    const payload = [
      previousHash,
      actorId ?? "system",
      action,
      entityType,
      entityId,
      detailsJson,
      createdAt,
    ]
      .join("|");
    const eventHash = createHash("sha256").update(payload).digest("hex");
    this.raw.prepare(`
      INSERT INTO audit_events
        (id, actor_id, action, entity_type, entity_id, details_json, previous_hash, event_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      actorId,
      action,
      entityType,
      entityId,
      detailsJson,
      previousHash,
      eventHash,
      createdAt,
    );
  }

  createAccount(input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }): string {
    const digest = hashPassword(input.password);
    const id = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO users
          (id, email, display_name, password_salt, password_hash, password_iterations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.email.toLowerCase(),
        `${input.firstName} ${input.lastName}`,
        digest.salt,
        digest.hash,
        digest.iterations,
        timestamp,
        timestamp,
      );
      this.raw.prepare(`
        INSERT INTO owners
          (id, first_name, last_name, address, postal_code, city, country, phone, email, created_at, updated_at)
        VALUES (?, ?, ?, '', '', '', '', '', ?, ?, ?)
      `).run(
        ownerId,
        input.firstName,
        input.lastName,
        input.email.toLowerCase(),
        timestamp,
        timestamp,
      );
      this.audit(id, "account.created", "user", id, {
        email: input.email.toLowerCase(),
      });
    });
    return id;
  }

  getUserAuth(email: string):
    | (User & {
      password_salt: string;
      password_hash: string;
      password_iterations: number;
    })
    | undefined {
    return this.raw.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
      | (User & {
        password_salt: string;
        password_hash: string;
        password_iterations: number;
      })
      | undefined;
  }

  getUser(id: string): User | undefined {
    return this.raw.prepare(
      "SELECT id, email, display_name, status FROM users WHERE id = ?",
    ).get(id) as User | undefined;
  }

  createSession(userId: string, tokenDigest: string, csrf: string): void {
    const timestamp = now();
    this.raw.prepare(`
      INSERT INTO sessions(token_digest, user_id, csrf, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tokenDigest, userId, csrf, timestamp, timestamp, Date.now() + 8 * 60 * 60 * 1000);
  }

  getSession(tokenDigest: string): SessionContext | undefined {
    const row = this.raw.prepare(`
      SELECT s.token_digest, s.csrf, s.expires_at, s.last_seen_at,
             u.id, u.email, u.display_name, u.status
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_digest = ?
    `).get(tokenDigest) as
      | (User & {
        token_digest: string;
        csrf: string;
        expires_at: number;
        last_seen_at: string;
      })
      | undefined;
    if (!row || row.status !== "active" || row.expires_at <= Date.now()) {
      if (row) this.deleteSession(tokenDigest);
      return undefined;
    }
    if (Date.now() - Date.parse(row.last_seen_at) > 30 * 60 * 1000) {
      this.deleteSession(tokenDigest);
      return undefined;
    }
    this.raw.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_digest = ?").run(
      now(),
      tokenDigest,
    );
    return {
      user: {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        status: row.status,
      },
      csrf: row.csrf,
      tokenDigest,
    };
  }

  deleteSession(tokenDigest: string): void {
    this.raw.prepare("DELETE FROM sessions WHERE token_digest = ?").run(tokenDigest);
  }

  createOwner(actorId: string, input: Omit<Owner, "id" | "created_at">): string {
    const id = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO owners
          (id, first_name, last_name, address, postal_code, city, country, phone, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.first_name,
        input.last_name,
        input.address,
        input.postal_code,
        input.city,
        input.country,
        input.phone,
        input.email.toLowerCase(),
        timestamp,
        timestamp,
      );
      this.audit(actorId, "owner.created", "owner", id, { country: input.country });
    });
    return id;
  }

  listOwners(): Owner[] {
    return this.raw.prepare("SELECT * FROM owners ORDER BY last_name, first_name")
      .all() as unknown as Owner[];
  }

  getOwnerByEmail(email: string): Owner | undefined {
    return this.raw.prepare(
      "SELECT * FROM owners WHERE lower(email) = lower(?) ORDER BY created_at LIMIT 1",
    ).get(email) as Owner | undefined;
  }

  getOwner(id: string): Owner | undefined {
    return this.raw.prepare("SELECT * FROM owners WHERE id = ?").get(id) as Owner | undefined;
  }

  updateOwnerProfile(
    actorId: string,
    email: string,
    input: Omit<Owner, "id" | "email" | "created_at">,
  ): void {
    const owner = this.getOwnerByEmail(email);
    if (!owner) throw new Error("Account profile not found");
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        UPDATE owners
        SET first_name = ?, last_name = ?, address = ?, postal_code = ?, city = ?,
            country = ?, phone = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.first_name,
        input.last_name,
        input.address,
        input.postal_code,
        input.city,
        input.country,
        input.phone,
        timestamp,
        owner.id,
      );
      this.raw.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(
        `${input.first_name} ${input.last_name}`,
        timestamp,
        actorId,
      );
      this.audit(actorId, "profile.updated", "owner", owner.id);
    });
  }

  createPet(
    actorId: string,
    input: Omit<Pet, "id" | "owner_name" | "created_at" | "updated_at">,
  ): string {
    const id = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO pets
          (id, owner_id, name, species, breed, sex, birth_date, colour, features, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.owner_id,
        input.name,
        input.species,
        input.breed,
        input.sex,
        input.birth_date,
        input.colour,
        input.features,
        timestamp,
        timestamp,
      );
      this.audit(actorId, "pet.created", "pet", id, { species: input.species });
    });
    return id;
  }

  listPets(user: User): Pet[] {
    const base = `
      SELECT p.*, o.first_name || ' ' || o.last_name AS owner_name
      FROM pets p JOIN owners o ON o.id = p.owner_id
    `;
    return this.raw.prepare(`${base} WHERE lower(o.email) = lower(?) ORDER BY p.name`).all(
      user.email,
    ) as unknown as Pet[];
  }

  getPet(id: string): Pet | undefined {
    return this.raw.prepare(`
      SELECT p.*, o.first_name || ' ' || o.last_name AS owner_name
      FROM pets p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?
    `).get(id) as Pet | undefined;
  }

  createPassport(
    actorId: string,
    input: {
      petId: string;
      countryCode: string;
      number: string;
      modelVersion?: string;
      issuingVet?: string;
      issuedOn?: string;
    },
  ): string {
    const id = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO passports(
          id, pet_id, country_code, number, model_version, status,
          issuing_vet_name_copy, issued_on_copy, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'recorded', ?, ?, ?, ?)
      `).run(
        id,
        input.petId,
        input.countryCode,
        input.number,
        input.modelVersion || "EU pet passport",
        input.issuingVet || "",
        input.issuedOn || null,
        timestamp,
        timestamp,
      );
      this.audit(actorId, "passport.created", "passport", id, {
        model: input.modelVersion || "EU pet passport",
        physicalBookletNumber: `${input.countryCode} ${input.number}`,
      });
    });
    return id;
  }

  listPassports(user: User): Passport[] {
    const query = `
      SELECT pp.*, p.name AS pet_name, p.species, p.breed, p.sex, p.birth_date, p.colour,
             p.features, o.id AS owner_id, o.first_name || ' ' || o.last_name AS owner_name,
             o.email AS owner_email, u.display_name AS issuing_vet_name
      FROM passports pp
      JOIN pets p ON p.id = pp.pet_id
      JOIN owners o ON o.id = p.owner_id
      LEFT JOIN users u ON u.id = pp.issuing_vet_id
    `;
    return this.raw.prepare(
      `${query} WHERE lower(o.email) = lower(?) ORDER BY pp.created_at DESC`,
    ).all(
      user.email,
    ) as unknown as Passport[];
  }

  getPassport(id: string): Passport | undefined {
    return this.raw.prepare(`
      SELECT pp.*, p.name AS pet_name, p.species, p.breed, p.sex, p.birth_date, p.colour,
             p.features, o.id AS owner_id, o.first_name || ' ' || o.last_name AS owner_name,
             o.email AS owner_email, u.display_name AS issuing_vet_name
      FROM passports pp
      JOIN pets p ON p.id = pp.pet_id
      JOIN owners o ON o.id = p.owner_id
      LEFT JOIN users u ON u.id = pp.issuing_vet_id
      WHERE pp.id = ?
    `).get(id) as Passport | undefined;
  }

  canAccessPassport(user: User, passport: Passport): boolean {
    return user.email.toLowerCase() === passport.owner_email.toLowerCase();
  }

  addIdentification(
    actorId: string,
    input: Omit<Identification, "id" | "verified_by" | "created_at">,
  ): string {
    const passport = this.getPassport(input.passport_id);
    if (!passport || passport.status === "void") {
      throw new Error("Passport record is not editable");
    }
    const id = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO identifications(id, passport_id, kind, code, marked_on, location, verified_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.passport_id,
        input.kind,
        input.code,
        input.marked_on,
        input.location,
        actorId,
        timestamp,
      );
      this.audit(actorId, "identification.copied", "passport", input.passport_id, {
        kind: input.kind,
        codeSuffix: input.code.slice(-4),
      });
    });
    return id;
  }

  listIdentifications(passportId: string): Identification[] {
    return this.raw.prepare(
      "SELECT * FROM identifications WHERE passport_id = ? ORDER BY created_at",
    ).all(passportId) as unknown as Identification[];
  }

  addMedicalRecord(
    actorId: string,
    passportId: string,
    type: RecordType,
    data: Record<string, string>,
  ): string {
    const id = crypto.randomUUID();
    const timestamp = now();
    this.transaction(() => {
      this.raw.prepare(`
        INSERT INTO medical_records
          (id, passport_id, type, data_json, created_by, signed_by, signed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, passportId, type, JSON.stringify(data), actorId, actorId, timestamp, timestamp);
      this.audit(actorId, "medical_record.copied", "passport", passportId, { type, recordId: id });
    });
    return id;
  }

  listMedicalRecords(passportId: string): MedicalRecord[] {
    return this.raw.prepare(`
      SELECT mr.*, u.display_name AS signer_name
      FROM medical_records mr JOIN users u ON u.id = mr.signed_by
      WHERE mr.passport_id = ? ORDER BY mr.created_at
    `).all(passportId) as unknown as MedicalRecord[];
  }

  getCounts(user: User): { pets: number; passports: number } {
    const pets = this.listPets(user);
    const passports = this.listPassports(user);
    return { pets: pets.length, passports: passports.length };
  }

  listAudit(limit = 100): Array<Record<string, unknown>> {
    return this.raw.prepare(`
      SELECT a.*, u.display_name AS actor_name
      FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?
    `).all(limit) as unknown as Array<Record<string, unknown>>;
  }

  verifyAuditChain(): boolean {
    const events = this.raw.prepare(
      "SELECT * FROM audit_events ORDER BY created_at, rowid",
    ).all() as unknown as Array<Record<string, string | null>>;
    let previousHash = "GENESIS";
    for (const event of events) {
      if (event.previous_hash !== previousHash) return false;
      const payload = [
        previousHash,
        event.actor_id ?? "system",
        event.action,
        event.entity_type,
        event.entity_id,
        event.details_json,
        event.created_at,
      ].join("|");
      const hash = createHash("sha256").update(payload).digest("hex");
      if (hash !== event.event_hash) return false;
      previousHash = hash;
    }
    return true;
  }
}
