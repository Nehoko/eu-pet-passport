export type Species = "dog" | "cat" | "ferret";
export type RecordType =
  | "rabies"
  | "titration"
  | "echinococcus"
  | "antiparasite"
  | "vaccination"
  | "clinical"
  | "legalisation"
  | "other";

export interface User {
  id: string;
  email: string;
  display_name: string;
  status: "active" | "disabled";
}

export interface Owner {
  id: string;
  first_name: string;
  last_name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  species: Species;
  breed: string;
  sex: string;
  birth_date: string;
  colour: string;
  features: string;
  created_at: string;
  updated_at: string;
}

export interface Passport {
  id: string;
  pet_id: string;
  country_code: string;
  number: string;
  model_version: string;
  status: "draft" | "recorded" | "void";
  issuing_vet_id: string | null;
  issuing_vet_name_copy: string;
  issued_on_copy: string | null;
  issued_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
  pet_name: string;
  species: Species;
  breed: string;
  sex: string;
  birth_date: string;
  colour: string;
  features: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  issuing_vet_name: string | null;
}

export interface Identification {
  id: string;
  passport_id: string;
  kind: "microchip" | "tattoo";
  code: string;
  marked_on: string;
  location: string;
  verified_by: string;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  passport_id: string;
  type: RecordType;
  data_json: string;
  status: "signed" | "void";
  created_by: string;
  signed_by: string;
  signer_name: string;
  signed_at: string;
  supersedes_id: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface SessionContext {
  user: User;
  csrf: string;
  tokenDigest: string;
}
