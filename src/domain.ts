import type { Identification, MedicalRecord, Passport, Pet, RecordType } from "./types.ts";

export class ValidationError extends Error {}

export function required(value: FormDataEntryValue | null, label: string, max = 200): string {
  const text = String(value ?? "").trim();
  if (!text) throw new ValidationError(`${label} is required`);
  if (text.length > max) throw new ValidationError(`${label} is too long`);
  return text;
}

export function optional(value: FormDataEntryValue | null, max = 500): string {
  const text = String(value ?? "").trim();
  if (text.length > max) throw new ValidationError("Value is too long");
  return text;
}

export function isoDate(value: FormDataEntryValue | null, label: string): string {
  const text = required(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new ValidationError(`${label} must be a valid date`);
  }
  return text;
}

export function assertCountryCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new ValidationError("Country code must be ISO alpha-2");
  return code;
}

export function assertPassportNumber(value: string): string {
  const number = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 -]{2,31}$/.test(number)) {
    throw new ValidationError(
      "Physical booklet number must contain 3-32 letters, digits, spaces, or hyphens",
    );
  }
  return number;
}

export function assertIdentification(kind: string, code: string, markedOn: string): void {
  if (kind === "microchip" && !/^\d{15}$/.test(code)) {
    throw new ValidationError("ISO microchip code must contain exactly 15 digits");
  }
  if (kind === "tattoo" && markedOn >= "2011-07-03") {
    throw new ValidationError("Tattoo is valid for EU travel only when applied before 3 July 2011");
  }
}

export function validateRecord(type: RecordType, data: Record<string, string>): void {
  if (!data.date) throw new ValidationError("Record date is required");
  if (data.valid_until && data.valid_until < data.date) {
    throw new ValidationError("Valid-until date cannot precede record date");
  }
  if (data.valid_from && data.valid_from < data.date) {
    throw new ValidationError("Valid-from date cannot precede vaccination date");
  }
  if (type === "rabies" && (!data.product || !data.batch || !data.valid_until)) {
    throw new ValidationError("Rabies entry requires vaccine, batch, and valid-until date");
  }
  if (type === "titration" && (!data.product || !data.reference || !data.result)) {
    throw new ValidationError("Titration entry requires laboratory, report reference, and result");
  }
  if (["echinococcus", "antiparasite", "vaccination"].includes(type) && !data.product) {
    throw new ValidationError("Product or vaccine name is required");
  }
}

export function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export interface ReadinessResult {
  ready: boolean;
  checks: Array<{ level: "pass" | "warning" | "fail"; message: string }>;
  ruleset: string;
}

function daysBetween(start: string, end: string): number {
  return Math.floor(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}

export function travelReadiness(
  passport: Passport,
  pet: Pet,
  ids: Identification[],
  records: MedicalRecord[],
  destination: string,
  travelDate: string,
): ReadinessResult {
  const checks: ReadinessResult["checks"] = [];
  if (ids.length === 0) {
    checks.push({ level: "fail", message: "No verified animal identification" });
  } else checks.push({ level: "pass", message: "Animal identification recorded" });

  const active = records.filter((record) => record.status === "signed");
  const rabies = active.filter((record) => record.type === "rabies").map((record) => ({
    record,
    data: JSON.parse(record.data_json) as Record<string, string>,
  })).sort((a, b) => (b.data.date ?? "").localeCompare(a.data.date ?? ""))[0];
  if (!rabies) {
    checks.push({ level: "fail", message: "No signed rabies vaccination" });
  } else {
    if (rabies.data.valid_until < travelDate) {
      checks.push({
        level: "fail",
        message: `Rabies vaccination expires ${displayDate(rabies.data.valid_until)}`,
      });
    } else {
      checks.push({
        level: "pass",
        message: `Rabies vaccination valid through ${displayDate(rabies.data.valid_until)}`,
      });
    }
    if (daysBetween(rabies.data.date, travelDate) < 21) {
      checks.push({
        level: "warning",
        message: "Primary-vaccination 21-day wait may not be complete",
      });
    }
    if (daysBetween(pet.birth_date, rabies.data.date) < 84) {
      checks.push({ level: "warning", message: "Pet may have been under 12 weeks at vaccination" });
    }
    const latestId = [...ids].sort((a, b) => b.marked_on.localeCompare(a.marked_on))[0];
    if (latestId && latestId.marked_on > rabies.data.date) {
      checks.push({
        level: "fail",
        message: "Identification date follows rabies vaccination date",
      });
    }
  }

  if (["FI", "IE", "MT", "NI", "NO"].includes(destination)) {
    const treatment = active.filter((record) =>
      record.type === "echinococcus"
    ).map((record) => JSON.parse(record.data_json) as Record<string, string>).sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? "")
    )[0];
    if (!treatment) {
      checks.push({
        level: "fail",
        message: "Destination requires signed anti-Echinococcus treatment",
      });
    } else {
      const hours = daysBetween(treatment.date, travelDate) * 24;
      if (hours < 24 || hours > 120) {
        checks.push({
          level: "warning",
          message: "Treatment must be 24-120 hours before scheduled entry; verify exact local time",
        });
      } else {checks.push({
          level: "pass",
          message: "Anti-Echinococcus treatment date is within 24-120 hour window",
        });}
    }
  }

  if (passport.status === "void") {
    checks.push({ level: "fail", message: "Passport record is void" });
  }
  checks.push({
    level: "warning",
    message:
      "Advisory only. Authorised veterinarian and destination authority make final determination.",
  });
  return {
    ready: !checks.some((check) => check.level === "fail"),
    checks,
    ruleset: "EU-2026/131 + EU-2026/705, reviewed 2026-08-11",
  };
}
