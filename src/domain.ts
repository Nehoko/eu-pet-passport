import type { RecordType } from "./types.ts";

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

export function optionalIsoDate(value: FormDataEntryValue | null, label: string): string {
  const text = optional(value, 10);
  return text ? isoDate(text, label) : "";
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
