import { displayDate, type ReadinessResult } from "./domain.ts";
import { escapeHtml as h } from "./security.ts";
import type { Identification, MedicalRecord, Owner, Passport, Pet, User } from "./types.ts";

export function layout(
  title: string,
  content: string,
  user?: User,
  csrf = "",
  options: { print?: boolean } = {},
): string {
  const nav = user
    ? `<header class="topbar"><a class="brand" href="/"><span class="brand-mark">PP</span><span>PetPass</span></a>
        <nav><a href="/">Overview</a><a href="/pets">Pets</a><a href="/passports">Passports</a>${
      user.role !== "owner" ? '<a href="/owners">Owners</a>' : ""
    }${user.role === "admin" ? '<a href="/admin/users">Users</a>' : ""}${
      ["admin", "auditor"].includes(user.role) ? '<a href="/audit">Audit</a>' : ""
    }</nav><div class="account"><span>${h(user.display_name)}</span><span class="role">${
      h(user.role)
    }</span>
        <form method="post" action="/logout"><input type="hidden" name="csrf" value="${
      h(csrf)
    }"><button class="link-button">Sign out</button></form></div></header>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    h(title)
  } · PetPass</title><meta name="description" content="Secure EU pet passport companion record"><link rel="stylesheet" href="/app.css">${
    options.print ? '<link rel="stylesheet" href="/print.css">' : ""
  }${options.print ? '<script src="/print.js" defer></script>' : ""}</head><body class="${
    options.print ? "print-body" : ""
  }">${nav}<main class="${options.print ? "print-root" : "shell"}">${content}</main></body></html>`;
}

export function alert(message: string, tone: "error" | "info" | "success" = "info"): string {
  return `<div class="alert ${tone}" role="alert">${h(message)}</div>`;
}

export function csrfInput(csrf: string): string {
  return `<input type="hidden" name="csrf" value="${h(csrf)}">`;
}

export function loginPage(error = ""): string {
  return layout(
    "Sign in",
    `<section class="login-shell"><div class="login-panel"><div class="passport-mini"><div class="stars">✦ ✦ ✦<br>✦ &nbsp; ✦<br>✦ ✦ ✦</div><strong>EU PET<br>PASSPORT</strong><small>COMPANION RECORD</small></div>
    <div class="login-card"><p class="eyebrow">Secure clinic workspace</p><h1>Pet travel records.<br><em>Ready when you are.</em></h1><p class="lede">Manage 2026 EU-model passport data, vet attestations, and travel checks.</p>${
      error ? alert(error, "error") : ""
    }<form method="post" action="/login" class="stack"><label>Email<input type="email" name="email" autocomplete="username" required autofocus></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">Sign in</button></form><p class="legal-note">Digital companion record only. Not a substitute for an authorised physical passport.</p></div></section>`,
  );
}

export function dashboardPage(
  user: User,
  counts: ReturnType<import("./db.ts").PetPassDatabase["getCounts"]>,
  passports: Passport[],
  csrf: string,
): string {
  const rows = passports.slice(0, 5).map((passport) => `
    <a class="list-row" href="/passports/${h(passport.id)}"><span class="pet-avatar">${
    h(passport.pet_name[0])
  }</span><span><strong>${h(passport.pet_name)}</strong><small>${h(passport.species)} · ${
    h(passport.owner_name)
  }</small></span><span class="passport-no">${h(passport.country_code)} ${
    h(passport.number)
  }</span><span class="status ${h(passport.status)}">${h(passport.status)}</span></a>`).join("") ||
    '<div class="empty">No passport records yet.</div>';
  return layout(
    "Overview",
    `<section class="hero"><div><p class="eyebrow">EU 2026 MODEL · SECURE RECORD</p><h1>Good records make<br><em>smooth crossings.</em></h1><p>One place for identity, vaccination, treatment, and physical booklet records.</p></div><div class="hero-actions">${
      user.role === "admin" || user.role === "veterinarian"
        ? '<a class="primary button" href="/passports/new">Add passport record</a><a class="secondary button" href="/pets/new">Register pet</a>'
        : '<a class="primary button" href="/passports">View my records</a>'
    }</div></section>
    <section class="stat-grid"><article><span>Pets</span><strong>${counts.pets}</strong><small>registered</small></article><article><span>Passport records</span><strong>${counts.passports}</strong><small>current workspace</small></article><article><span>Owners</span><strong>${counts.owners}</strong><small>linked profiles</small></article><article class="attention"><span>Drafts</span><strong>${counts.due}</strong><small>need completion</small></article></section>
    <section class="content-grid"><div class="panel wide"><div class="panel-head"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>Passport records</h2></div><a href="/passports">View all</a></div>${rows}</div><aside class="panel standard-note"><p class="eyebrow">CURRENT STANDARD</p><h2>Regulation 2026/705</h2><p>Model effective since 22 April 2026. Strict Sections I-XII sequence. Physical booklet remains source of legal truth.</p><span class="model-chip">100 × 152 mm</span><span class="model-chip">EU bilingual model</span></aside></section>`,
    user,
    csrf,
  );
}

export function ownersPage(owners: Owner[], csrf: string, error = ""): string {
  const rows =
    owners.map((owner) =>
      `<tr><td><strong>${h(owner.first_name)} ${h(owner.last_name)}</strong><small>${
        h(owner.email)
      }</small></td><td>${h(owner.city)}, ${h(owner.country)}</td><td>${
        h(owner.phone || "—")
      }</td></tr>`
    ).join("") || '<tr><td colspan="3" class="empty">No owners yet.</td></tr>';
  return `<div class="page-head"><div><p class="eyebrow">SECTION I</p><h1>Owners</h1><p>Contact profiles linked to pet records.</p></div></div>${
    error ? alert(error, "error") : ""
  }<section class="split"><div class="panel"><table><thead><tr><th>Owner</th><th>Location</th><th>Phone</th></tr></thead><tbody>${rows}</tbody></table></div><aside class="panel"><h2>Add owner</h2><form method="post" action="/owners" class="form-grid">${
    csrfInput(csrf)
  }<label>First name<input name="first_name" required maxlength="100"></label><label>Last name<input name="last_name" required maxlength="100"></label><label class="full">Address<input name="address" required maxlength="200"></label><label>Postcode<input name="postal_code" required maxlength="30"></label><label>City<input name="city" required maxlength="100"></label><label>Country<input name="country" required maxlength="100"></label><label>Phone<input name="phone" maxlength="50"></label><label class="full">Email<input type="email" name="email" required maxlength="200"></label><button class="primary full">Save owner</button></form></aside></section>`;
}

export function petsPage(pets: Pet[]): string {
  const cards =
    pets.map((pet) =>
      `<a class="pet-card" href="/pets/${h(pet.id)}"><span class="pet-avatar large">${
        h(pet.name[0])
      }</span><span><strong>${h(pet.name)}</strong><small>${h(pet.breed)} ${
        h(pet.species)
      }</small><em>${h(pet.owner_name)}</em></span><span class="arrow">→</span></a>`
    ).join("") || '<div class="empty panel">No pets registered.</div>';
  return `<div class="page-head"><div><p class="eyebrow">ANIMAL REGISTER</p><h1>Pets</h1><p>Dogs, cats, and ferrets in this workspace.</p></div><a class="primary button" href="/pets/new">Register pet</a></div><section class="card-grid">${cards}</section>`;
}

export function petFormPage(owners: Owner[], csrf: string, error = ""): string {
  const options = owners.map((owner) =>
    `<option value="${h(owner.id)}">${h(owner.first_name)} ${h(owner.last_name)} · ${
      h(owner.email)
    }</option>`
  ).join("");
  return `<div class="page-head"><div><p class="eyebrow">SECTION II</p><h1>Register pet</h1><p>Identity details stated by owner.</p></div></div>${
    error ? alert(error, "error") : ""
  }<section class="panel form-panel"><form method="post" action="/pets" class="form-grid">${
    csrfInput(csrf)
  }<label class="full">Owner<select name="owner_id" required><option value="">Select owner</option>${options}</select></label><label>Name<input name="name" required maxlength="100"></label><label>Species<select name="species" required><option value="dog">Dog</option><option value="cat">Cat</option><option value="ferret">Ferret</option></select></label><label>Breed<input name="breed" required maxlength="100"></label><label>Sex<input name="sex" required maxlength="30"></label><label>Date of birth<input type="date" name="birth_date" required></label><label>Colour<input name="colour" required maxlength="100"></label><label class="full">Notable features<textarea name="features" maxlength="500"></textarea></label><button class="primary full">Register pet</button></form></section>`;
}

export function petDetailPage(pet: Pet, passports: Passport[]): string {
  const records =
    passports.map((passport) =>
      `<a class="list-row" href="/passports/${h(passport.id)}"><span><strong>${
        h(passport.country_code)
      } ${h(passport.number)}</strong><small>${
        h(passport.model_version)
      }</small></span><span class="status ${h(passport.status)}">${h(passport.status)}</span></a>`
    ).join("") || '<div class="empty">No passport record.</div>';
  return `<div class="page-head"><div><p class="eyebrow">${h(pet.species.toUpperCase())}</p><h1>${
    h(pet.name)
  }</h1><p>${h(pet.breed)} · ${h(pet.colour)} · born ${
    h(displayDate(pet.birth_date))
  }</p></div><a class="primary button" href="/passports/new?pet=${
    h(pet.id)
  }">Add passport record</a></div><section class="split"><div class="panel detail-list"><h2>Animal description</h2><dl><dt>Owner</dt><dd>${
    h(pet.owner_name)
  }</dd><dt>Sex</dt><dd>${h(pet.sex)}</dd><dt>Features</dt><dd>${
    h(pet.features || "None recorded")
  }</dd></dl></div><div class="panel"><h2>Passport records</h2>${records}</div></section>`;
}

export function passportsPage(passports: Passport[]): string {
  const rows =
    passports.map((passport) =>
      `<a class="passport-card" href="/passports/${
        h(passport.id)
      }"><span class="passport-cover"><span class="tiny-stars">✦ ✦ ✦</span><strong>EU<br>PET<br>PASSPORT</strong><small>${
        h(passport.country_code)
      } ${h(passport.number)}</small></span><span><p class="eyebrow">${
        h(passport.model_version)
      }</p><h2>${h(passport.pet_name)}</h2><p>${h(passport.species)} · ${
        h(passport.owner_name)
      }</p><span class="status ${h(passport.status)}">${h(passport.status)}</span></span></a>`
    ).join("") || '<div class="empty panel">No passport records.</div>';
  return `<div class="page-head"><div><p class="eyebrow">PHYSICAL BOOKLET REGISTER</p><h1>Passport records</h1><p>Digital record copies linked to physical EU booklets.</p></div><a class="primary button" href="/passports/new">Add record</a></div><div class="passport-grid">${rows}</div>`;
}

export function passportFormPage(
  pets: Pet[],
  csrf: string,
  countryCode: string,
  selectedPet = "",
  error = "",
): string {
  const options = pets.map((pet) =>
    `<option value="${h(pet.id)}" ${pet.id === selectedPet ? "selected" : ""}>${h(pet.name)} · ${
      h(pet.owner_name)
    }</option>`
  ).join("");
  return `<div class="page-head"><div><p class="eyebrow">2026 MODEL</p><h1>Add physical passport record</h1><p>Enter number from authority-controlled paper booklet. App never generates official numbers.</p></div></div>${
    error ? alert(error, "error") : ""
  }<section class="panel form-panel">${
    alert("This creates a digital companion record, not an official travel document.")
  }<form method="post" action="/passports" class="form-grid">${
    csrfInput(csrf)
  }<label class="full">Pet<select name="pet_id" required><option value="">Select pet</option>${options}</select></label><label>Issuing country code<input name="country_code" value="${
    h(countryCode)
  }" required maxlength="2" pattern="[A-Za-z]{2}"></label><label>Physical booklet number<input name="number" required maxlength="32" placeholder="00 123456"></label><button class="primary full">Create draft record</button></form></section>`;
}

const sectionMap: Record<string, string> = {
  rabies: "V · Rabies vaccination",
  titration: "VI · Rabies antibody titration",
  echinococcus: "VII · Anti-Echinococcus",
  antiparasite: "VIII · Other anti-parasite",
  vaccination: "IX · Other vaccination",
  clinical: "X · Clinical examination",
  legalisation: "XI · Legalisation",
  other: "XII · Others",
};

function recordRows(records: MedicalRecord[]): string {
  return records.map((record) => {
    const data = JSON.parse(record.data_json) as Record<string, string>;
    return `<article class="record-row"><div><p class="eyebrow">${
      h(sectionMap[record.type])
    }</p><strong>${h(data.product || data.notes || sectionMap[record.type])}</strong><small>${
      h(displayDate(data.date))
    }${data.time ? ` · ${h(data.time)}` : ""}${data.batch ? ` · batch ${h(data.batch)}` : ""}${
      data.valid_until ? ` · valid until ${h(displayDate(data.valid_until))}` : ""
    }</small></div><div><span class="signed">Signed</span><small>${
      h(record.signer_name)
    }</small></div></article>`;
  }).join("") || '<div class="empty">No signed health entries.</div>';
}

export function passportDetailPage(
  passport: Passport,
  owner: Owner,
  ids: Identification[],
  records: MedicalRecord[],
  user: User,
  csrf: string,
  readiness?: ReadinessResult,
  error = "",
): string {
  const canWrite = user.role === "admin" ||
    (user.role === "veterinarian" && user.vet_verified === 1);
  const idRows =
    ids.map((id) =>
      `<div class="id-row"><span class="status recorded">${h(id.kind)}</span><strong>${
        h(id.code)
      }</strong><small>${h(displayDate(id.marked_on))} · ${h(id.location)}</small></div>`
    ).join("") || '<div class="empty">No verified identification.</div>';
  const checks = readiness
    ? `<section class="panel readiness"><div class="panel-head"><div><p class="eyebrow">ADVISORY RESULT</p><h2>${
      readiness.ready ? "No blocking issue found" : "Action needed"
    }</h2></div><span class="status ${readiness.ready ? "recorded" : "void"}">${
      readiness.ready ? "review" : "not ready"
    }</span></div>${
      readiness.checks.map((check) =>
        `<div class="check ${h(check.level)}"><span></span>${h(check.message)}</div>`
      ).join("")
    }<small>${h(readiness.ruleset)}</small></section>`
    : "";
  const coreDisabled = passport.status === "draft" ? "" : "disabled";
  return `<div class="page-head"><div><p class="eyebrow">${h(passport.model_version)}</p><h1>${
    h(passport.pet_name)
  }</h1><p>${h(passport.country_code)} ${h(passport.number)} · ${
    h(passport.owner_name)
  }</p></div><div class="head-actions"><span class="status ${h(passport.status)}">${
    h(passport.status)
  }</span><a class="secondary button" href="/passports/${
    h(passport.id)
  }/print" target="_blank">Print record copy</a></div></div>${error ? alert(error, "error") : ""}${
    alert(
      "RECORD COPY — NOT VALID AS ORIGINAL PASSPORT. Keep physical authorised booklet with pet.",
    )
  }
  <section class="passport-summary"><div class="passport-cover large-cover"><span class="tiny-stars">✦ ✦ ✦</span><strong>EU<br>PET<br>PASSPORT</strong><small>${
    h(passport.country_code)
  } ${
    h(passport.number)
  }</small></div><div class="panel detail-list"><h2>I–IV · Core identity</h2><dl><dt>Owner</dt><dd>${
    h(owner.first_name)
  } ${h(owner.last_name)}<br><small>${h(owner.address)}, ${h(owner.postal_code)} ${
    h(owner.city)
  }, ${h(owner.country)}</small></dd><dt>Animal</dt><dd>${h(passport.pet_name)} · ${
    h(passport.species)
  } · ${
    h(passport.breed)
  }</dd><dt>Identification</dt><dd>${idRows}</dd><dt>Physical issue</dt><dd>${
    passport.issued_at
      ? `${h(displayDate(passport.issued_at))} · ${h(passport.issuing_vet_name)}`
      : "Not yet recorded"
  }</dd></dl></div></section>
  <section class="content-grid"><div class="panel wide"><div class="panel-head"><div><p class="eyebrow">APPEND-ONLY LOG</p><h2>V–XII · Health entries</h2></div></div>${
    recordRows(records)
  }</div><aside class="panel"><p class="eyebrow">TRAVEL CHECK</p><h2>Check basic readiness</h2><form method="get" action="/passports/${
    h(passport.id)
  }" class="stack"><label>Destination<select name="destination"><option value="DE">EU / standard</option><option value="FI">Finland</option><option value="IE">Ireland</option><option value="MT">Malta</option><option value="NI">Northern Ireland</option><option value="NO">Norway</option></select></label><label>Travel date<input type="date" name="travel_date" required></label><button class="secondary">Run advisory check</button></form><p class="legal-note">Not legal or veterinary advice. Country rules can add requirements.</p></aside></section>${checks}${
    canWrite && passport.status !== "void"
      ? `<section class="split edit-zone"><div class="panel"><p class="eyebrow">SECTION III</p><h2>Verify identification</h2><form method="post" action="/passports/${
        h(passport.id)
      }/identifications" class="form-grid">${
        csrfInput(csrf)
      }<label>Kind<select name="kind" ${coreDisabled}><option value="microchip">Microchip</option><option value="tattoo">Legacy tattoo</option></select></label><label>Code<input name="code" required maxlength="32" ${coreDisabled}></label><label>Date applied/read<input type="date" name="marked_on" required ${coreDisabled}></label><label>Location<input name="location" required maxlength="100" placeholder="Left neck" ${coreDisabled}></label><button class="primary full" ${coreDisabled}>${
        passport.status === "draft" ? "Verify and append" : "Core identity locked"
      }</button></form></div><div class="panel"><p class="eyebrow">SECTIONS V–XII</p><h2>Sign health entry</h2><form method="post" action="/passports/${
        h(passport.id)
      }/records" class="form-grid">${
        csrfInput(csrf)
      }<label class="full">Section<select name="type"><option value="rabies">V · Rabies</option><option value="titration">VI · Titration</option><option value="echinococcus">VII · Echinococcus</option><option value="antiparasite">VIII · Anti-parasite</option><option value="vaccination">IX · Other vaccination</option><option value="clinical">X · Clinical exam</option><option value="legalisation">XI · Legalisation</option><option value="other">XII · Others</option></select></label><label>Product / lab<input name="product" maxlength="200"></label><label>Batch<input name="batch" maxlength="100"></label><label>Report reference<input name="reference" maxlength="100"></label><label>Result IU/ml<input name="result" maxlength="30"></label><label>Date<input type="date" name="date" required></label><label>Time<input type="time" name="time"></label><label>Valid from<input type="date" name="valid_from"></label><label>Valid until<input type="date" name="valid_until"></label><label class="full">Notes<textarea name="notes" maxlength="500"></textarea></label><button class="primary full">Sign and append entry</button></form></div></section><section class="panel record-issue ${
        passport.status === "draft" ? "" : "hidden"
      }"><div><p class="eyebrow">PHYSICAL BOOKLET</p><h2>Record authorised issue</h2><p>Use only after authorised vet physically signs/stamps controlled booklet. This locks Sections I–IV in app.</p></div><form method="post" action="/passports/${
        h(passport.id)
      }/record-issue" class="stack">${
        csrfInput(csrf)
      }<label>Confirm current password<input type="password" name="password" required autocomplete="current-password"></label><button class="danger">Record physical issue & lock</button></form></section>`
      : ""
  }`;
}

export function usersPage(users: User[], csrf: string, error = ""): string {
  const rows = users.map((user) =>
    `<tr><td><strong>${h(user.display_name)}</strong><small>${
      h(user.email)
    }</small></td><td><span class="role">${h(user.role)}</span></td><td>${
      user.role === "veterinarian"
        ? (user.vet_verified ? '<span class="signed">Verified</span>' : "Unverified")
        : "—"
    }</td><td>${h(user.status)}</td></tr>`
  ).join("");
  return `<div class="page-head"><div><p class="eyebrow">ACCESS CONTROL</p><h1>Users</h1><p>No public signup. Admin grants least-privilege roles.</p></div></div>${
    error ? alert(error, "error") : ""
  }<section class="split"><div class="panel"><table><thead><tr><th>User</th><th>Role</th><th>Vet authority</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div><aside class="panel"><h2>Create user</h2><form method="post" action="/admin/users" class="stack">${
    csrfInput(csrf)
  }<label>Name<input name="display_name" required maxlength="100"></label><label>Email<input type="email" name="email" required maxlength="200"></label><label>Temporary password<input type="password" name="password" required minlength="14" autocomplete="new-password"></label><label>Role<select name="role"><option value="owner">Owner</option><option value="veterinarian">Veterinarian</option><option value="auditor">Auditor</option><option value="admin">Admin</option></select></label><label class="check-label"><input type="checkbox" name="vet_verified" value="1"> Authority-verified veterinarian</label><button class="primary">Create account</button></form></aside></section>`;
}

export function auditPage(events: Array<Record<string, unknown>>, chainOk: boolean): string {
  const rows = events.map((event) =>
    `<tr><td>${h(String(event.created_at).replace("T", " ").slice(0, 19))}</td><td>${
      h(event.actor_name ?? "System")
    }</td><td><code>${h(event.action)}</code></td><td>${h(event.entity_type)}<small>${
      h(event.entity_id)
    }</small></td><td><code>${h(String(event.event_hash).slice(0, 12))}…</code></td></tr>`
  ).join("");
  return `<div class="page-head"><div><p class="eyebrow">TAMPER-EVIDENT LOG</p><h1>Audit trail</h1><p>Hash-chained record of security and data mutations.</p></div><span class="status ${
    chainOk ? "recorded" : "void"
  }">${
    chainOk ? "chain verified" : "chain broken"
  }</span></div><section class="panel table-scroll"><table><thead><tr><th>Time UTC</th><th>Actor</th><th>Action</th><th>Entity</th><th>Hash</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function printPage(
  number: string,
  section: string,
  body: string,
  index: number,
  total: number,
): string {
  return `<section class="passport-page"><div class="copy-watermark">RECORD COPY · NOT VALID AS ORIGINAL PASSPORT</div><header>${
    h(section)
  }</header><div class="passport-page-body">${body}</div><footer><span>${
    h(number)
  }</span><span>${index} out of ${total}</span></footer></section>`;
}

function printRecords(records: MedicalRecord[], types: string[]): string {
  const matching = records.filter((record) => types.includes(record.type));
  if (!matching.length) return '<p class="blank-entry">No entry recorded</p>';
  return matching.map((record) => {
    const data = JSON.parse(record.data_json) as Record<string, string>;
    return `<div class="print-entry"><strong>${
      h(data.product || data.notes || sectionMap[record.type])
    }</strong><dl><dt>Date</dt><dd>${h(displayDate(data.date))}${
      data.time ? ` ${h(data.time)}` : ""
    }</dd>${data.batch ? `<dt>Batch</dt><dd>${h(data.batch)}</dd>` : ""}${
      data.reference ? `<dt>Reference</dt><dd>${h(data.reference)}</dd>` : ""
    }${data.result ? `<dt>Result</dt><dd>${h(data.result)} IU/ml</dd>` : ""}${
      data.valid_from ? `<dt>Valid from</dt><dd>${h(displayDate(data.valid_from))}</dd>` : ""
    }${
      data.valid_until ? `<dt>Valid until</dt><dd>${h(displayDate(data.valid_until))}</dd>` : ""
    }<dt>Signed by</dt><dd>${h(record.signer_name)} · ${
      h(displayDate(record.signed_at))
    }</dd></dl></div>`;
  }).join("");
}

export function passportPrintPage(
  passport: Passport,
  owner: Owner,
  ids: Identification[],
  records: MedicalRecord[],
): string {
  const number = `${passport.country_code} ${passport.number}`;
  const total = 13;
  const pages = [
    `<section class="print-cover"><div class="print-stars">✦ ✦ ✦<br>✦ ✦ ✦<br>✦ ✦ ✦</div><p>European Union<br>[${
      h(passport.country_code)
    }]</p><h1>PET<br>PASSPORT</h1><strong>${
      h(number)
    }</strong><small>RECORD COPY · NOT VALID FOR TRAVEL</small></section>`,
    printPage(
      number,
      "I. DETAILS OF OWNERSHIP",
      `<dl><dt>Name</dt><dd>${h(owner.first_name)} ${h(owner.last_name)}</dd><dt>Address</dt><dd>${
        h(owner.address)
      }<br>${h(owner.postal_code)} ${h(owner.city)}<br>${
        h(owner.country)
      }</dd><dt>Tel / email</dt><dd>${h(owner.phone || "—")}<br>${
        h(owner.email)
      }</dd><dt>Signature</dt><dd>See authorised physical booklet</dd></dl>`,
      2,
      total,
    ),
    printPage(
      number,
      "II. DESCRIPTION OF ANIMAL",
      `<div class="photo-placeholder">PICTURE OF ANIMAL<br><small>optional · see physical booklet</small></div><dl><dt>Name</dt><dd>${
        h(passport.pet_name)
      }</dd><dt>Species / breed</dt><dd>${h(passport.species)} / ${
        h(passport.breed)
      }</dd><dt>Sex</dt><dd>${h(passport.sex)}</dd><dt>Date of birth</dt><dd>${
        h(displayDate(passport.birth_date))
      }</dd><dt>Colour</dt><dd>${h(passport.colour)}</dd><dt>Features</dt><dd>${
        h(passport.features || "—")
      }</dd></dl>`,
      3,
      total,
    ),
    printPage(
      number,
      "III. ANIMAL IDENTIFICATION",
      ids.map((id) =>
        `<div class="print-entry"><dl><dt>Type</dt><dd>${h(id.kind)}</dd><dt>Code</dt><dd>${
          h(id.code)
        }</dd><dt>Date applied/read</dt><dd>${
          h(displayDate(id.marked_on))
        }</dd><dt>Location</dt><dd>${h(id.location)}</dd></dl></div>`
      ).join("") || '<p class="blank-entry">No verified entry</p>',
      4,
      total,
    ),
    printPage(
      number,
      "IV. ISSUING OF THE PASSPORT",
      `<dl><dt>Authorised veterinarian</dt><dd>${
        h(passport.issuing_vet_name || "Not recorded")
      }</dd><dt>Date of physical issue</dt><dd>${
        h(displayDate(passport.issued_at))
      }</dd><dt>Stamp & signature</dt><dd>See authorised physical booklet</dd></dl>`,
      5,
      total,
    ),
    printPage(number, "V. VACCINATION AGAINST RABIES", printRecords(records, ["rabies"]), 6, total),
    printPage(
      number,
      "VI. RABIES ANTIBODY TITRATION TEST",
      printRecords(records, ["titration"]),
      7,
      total,
    ),
    printPage(
      number,
      "VII. ANTI-ECHINOCOCCUS TREATMENT",
      printRecords(records, ["echinococcus"]),
      8,
      total,
    ),
    printPage(
      number,
      "VIII. OTHER ANTI-PARASITE TREATMENTS",
      printRecords(records, ["antiparasite"]),
      9,
      total,
    ),
    printPage(number, "IX. OTHER VACCINATIONS", printRecords(records, ["vaccination"]), 10, total),
    printPage(number, "X. CLINICAL EXAMINATION", printRecords(records, ["clinical"]), 11, total),
    printPage(number, "XI. LEGALISATION", printRecords(records, ["legalisation"]), 12, total),
    printPage(number, "XII. OTHERS", printRecords(records, ["other"]), 13, total),
  ];
  return layout(
    "Passport record copy",
    `<div class="print-toolbar"><button id="print-button">Print / save PDF</button><p>Browser print: 100 × 152 mm, margins none.</p></div>${
      pages.join("")
    }`,
    undefined,
    "",
    { print: true },
  );
}
