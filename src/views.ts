import { displayDate } from "./domain.ts";
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
        <nav><a href="/">Home</a><a href="/pets">My pets</a><a href="/passports">Passport copies</a><a href="/profile">My details</a></nav>
        <div class="account"><span>${h(user.display_name)}</span>
        <form method="post" action="/logout"><input type="hidden" name="csrf" value="${
      h(csrf)
    }"><button class="link-button">Sign out</button></form></div></header>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${
    h(title)
  } · PetPass</title><meta name="description" content="Personal digital copy of a physical pet passport"><link rel="stylesheet" href="/app.css">${
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

function starPoints(centerX: number, centerY: number): string {
  return Array.from({ length: 10 }, (_, point) => {
    const radius = point % 2 === 0 ? 4.8 : 1.9;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    return `${(centerX + Math.cos(angle) * radius).toFixed(2)},${
      (centerY + Math.sin(angle) * radius).toFixed(2)
    }`;
  }).join(" ");
}

const euStars = Array.from({ length: 12 }, (_, star) => {
  const angle = -Math.PI / 2 + star * Math.PI / 6;
  const centerX = 50 + Math.cos(angle) * 35;
  const centerY = 50 + Math.sin(angle) * 35;
  return `<polygon class="eu-star" points="${starPoints(centerX, centerY)}"></polygon>`;
}).join("");

function euEmblem(): string {
  return `<svg class="eu-emblem" viewBox="0 0 100 100" role="img" aria-label="European Union emblem">${euStars}</svg>`;
}

function passportCover(passport?: Passport): string {
  return `<div class="passport-cover large-cover">${euEmblem()}<strong>DIGITAL<br>PET<br>PASSPORT<br>COPY</strong><small>${
    passport ? `${h(passport.country_code)} ${h(passport.number)}` : "PERSONAL RECORD"
  }</small></div>`;
}

export function loginPage(error = ""): string {
  return layout(
    "Sign in",
    `<section class="login-shell"><div class="login-panel">${passportCover()}
    <div class="login-card"><p class="eyebrow">Your pet records</p><h1>Passport details.<br><em>Ready when needed.</em></h1><p class="lede">Keep a private digital copy of your pet's physical passport for quick reference.</p>${
      error ? alert(error, "error") : ""
    }<form method="post" action="/login" class="stack"><label>Email<input type="email" name="email" autocomplete="username" required autofocus></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">Sign in</button></form><p class="login-help">No account? <a href="/signup">Create one</a></p><p class="legal-note">Personal copy only. Not an official passport and not valid for travel.</p></div></section>`,
  );
}

export function signupPage(error = ""): string {
  return layout(
    "Create account",
    `<section class="auth-page"><div class="login-card signup-card"><a class="brand" href="/login"><span class="brand-mark">PP</span><span>PetPass</span></a><p class="eyebrow">Personal account</p><h1>Create your private pet record.</h1><p>Add contact details after signup, then copy information from each physical passport.</p>${
      error ? alert(error, "error") : ""
    }<form method="post" action="/signup" class="form-grid"><label>First name<input name="first_name" required maxlength="100" autocomplete="given-name"></label><label>Last name<input name="last_name" required maxlength="100" autocomplete="family-name"></label><label class="full">Email<input type="email" name="email" required maxlength="200" autocomplete="email"></label><label>Password<input type="password" name="password" required minlength="14" autocomplete="new-password"></label><label>Confirm password<input type="password" name="password_confirmation" required minlength="14" autocomplete="new-password"></label><button class="primary full">Create account</button></form><p class="login-help">Already registered? <a href="/login">Sign in</a></p><p class="legal-note">Passwords need at least 14 characters.</p></div></section>`,
  );
}

function profileComplete(owner: Owner): boolean {
  return Boolean(owner.address && owner.postal_code && owner.city && owner.country);
}

export function dashboardPage(
  user: User,
  owner: Owner,
  counts: ReturnType<import("./db.ts").PetPassDatabase["getCounts"]>,
  passports: Passport[],
  csrf: string,
): string {
  const rows =
    passports.slice(0, 4).map((passport) =>
      `<a class="list-row" href="/passports/${h(passport.id)}"><span class="pet-avatar">${
        h(passport.pet_name[0])
      }</span><span><strong>${h(passport.pet_name)}</strong><small>${
        h(passport.species)
      }</small></span><span class="passport-no">${h(passport.country_code)} ${
        h(passport.number)
      }</span><span class="arrow">→</span></a>`
    ).join("") || '<div class="empty">No passport copies yet.</div>';
  const profileNotice = profileComplete(owner)
    ? ""
    : `<div class="onboarding-alert"><div><strong>Finish your contact details</strong><p>Emergency view needs address and phone information from passport owner section.</p></div><a class="secondary button" href="/profile">Complete details</a></div>`;
  return layout(
    "Home",
    `${profileNotice}<section class="hero personal-hero"><div><p class="eyebrow">PRIVATE DIGITAL COPY</p><h1>${
      h(user.display_name)
    }, keep pet details<br><em>close at hand.</em></h1><p>Copy information from physical passport. Open a clear emergency view whenever a clinic needs it.</p></div><div class="hero-actions"><a class="primary button" href="/pets/new">Add pet</a><a class="secondary button" href="/passports">View passport copies</a></div></section>
    <section class="stat-grid personal-stats"><article><span>My pets</span><strong>${counts.pets}</strong><small>saved</small></article><article><span>Passport copies</span><strong>${counts.passports}</strong><small>available</small></article></section>
    <section class="content-grid"><div class="panel wide"><div class="panel-head"><div><p class="eyebrow">QUICK ACCESS</p><h2>Passport copies</h2></div><a href="/passports">View all</a></div>${rows}</div><aside class="panel standard-note"><p class="eyebrow">IMPORTANT</p><h2>Copy, not replacement</h2><p>Use this app as quick reference in urgent situations. Bring physical passport for travel and official checks.</p></aside></section>`,
    user,
    csrf,
  );
}

export function profilePage(owner: Owner, csrf: string, saved = false): string {
  return `<div class="page-head"><div><p class="eyebrow">PASSPORT OWNER</p><h1>My details</h1><p>Keep these details equal to physical passport.</p></div></div>${
    saved ? alert("Your details were saved.", "success") : ""
  }<section class="panel form-panel"><form method="post" action="/profile" class="form-grid">${
    csrfInput(csrf)
  }<label>First name<input name="first_name" required maxlength="100" value="${
    h(owner.first_name)
  }"></label><label>Last name<input name="last_name" required maxlength="100" value="${
    h(owner.last_name)
  }"></label><label class="full">Address<input name="address" required maxlength="200" value="${
    h(owner.address)
  }"></label><label>Postcode<input name="postal_code" required maxlength="30" value="${
    h(owner.postal_code)
  }"></label><label>City<input name="city" required maxlength="100" value="${
    h(owner.city)
  }"></label><label>Country<input name="country" required maxlength="100" value="${
    h(owner.country)
  }"></label><label>Phone<input name="phone" maxlength="50" value="${
    h(owner.phone)
  }"></label><label class="full">Account email<input type="email" value="${
    h(owner.email)
  }" disabled></label><button class="primary full">Save my details</button></form></section>`;
}

export function petsPage(pets: Pet[]): string {
  const cards =
    pets.map((pet) =>
      `<a class="pet-card" href="/pets/${h(pet.id)}"><span class="pet-avatar large">${
        h(pet.name[0])
      }</span><span><strong>${h(pet.name)}</strong><small>${h(pet.breed)} ${
        h(pet.species)
      }</small></span><span class="arrow">→</span></a>`
    ).join("") || '<div class="empty panel">No pets yet. Add your first pet.</div>';
  return `<div class="page-head"><div><p class="eyebrow">MY PETS</p><h1>Pets</h1><p>Animals whose passport copies you keep here.</p></div><a class="primary button" href="/pets/new">Add pet</a></div><section class="card-grid">${cards}</section>`;
}

export function petFormPage(csrf: string): string {
  return `<div class="page-head"><div><p class="eyebrow">STEP 1</p><h1>Add pet</h1><p>Copy animal description from physical passport.</p></div></div><section class="panel form-panel"><form method="post" action="/pets" class="form-grid">${
    csrfInput(csrf)
  }<label>Name<input name="name" required maxlength="100"></label><label>Species<select name="species" required><option value="dog">Dog</option><option value="cat">Cat</option><option value="ferret">Ferret</option></select></label><label>Breed<input name="breed" required maxlength="100"></label><label>Sex<input name="sex" required maxlength="30"></label><label>Date of birth<input type="date" name="birth_date" required></label><label>Colour<input name="colour" required maxlength="100"></label><label class="full">Notable features<textarea name="features" maxlength="500"></textarea></label><button class="primary full">Save pet</button></form></section>`;
}

export function petDetailPage(pet: Pet, passports: Passport[]): string {
  const records =
    passports.map((passport) =>
      `<a class="list-row" href="/passports/${h(passport.id)}"><span><strong>${
        h(passport.country_code)
      } ${
        h(passport.number)
      }</strong><small>Digital copy</small></span><span class="arrow">→</span></a>`
    ).join("") || '<div class="empty">No passport copy yet.</div>';
  return `<div class="page-head"><div><p class="eyebrow">${h(pet.species.toUpperCase())}</p><h1>${
    h(pet.name)
  }</h1><p>${h(pet.breed)} · ${h(pet.colour)} · born ${
    h(displayDate(pet.birth_date))
  }</p></div><a class="primary button" href="/passports/new?pet=${
    h(pet.id)
  }">Add passport copy</a></div><section class="split"><div class="panel detail-list"><h2>Animal details</h2><dl><dt>Sex</dt><dd>${
    h(pet.sex)
  }</dd><dt>Features</dt><dd>${
    h(pet.features || "None recorded")
  }</dd></dl></div><div class="panel"><h2>Passport copies</h2>${records}</div></section>`;
}

export function passportsPage(passports: Passport[], hasPets: boolean): string {
  const rows =
    passports.map((passport) =>
      `<a class="passport-card" href="/passports/${
        h(passport.id)
      }"><span class="passport-cover">${euEmblem()}<strong>DIGITAL<br>PASSPORT<br>COPY</strong><small>${
        h(passport.country_code)
      } ${h(passport.number)}</small></span><span><p class="eyebrow">PERSONAL COPY</p><h2>${
        h(passport.pet_name)
      }</h2><p>${h(passport.species)} · ${
        h(passport.breed)
      }</p><span class="copy-chip">Emergency view ready</span></span></a>`
    ).join("") || '<div class="empty panel">No passport copies yet.</div>';
  const action = hasPets
    ? '<a class="primary button" href="/passports/new">Add passport copy</a>'
    : '<a class="primary button" href="/pets/new">Add pet first</a>';
  return `<div class="page-head"><div><p class="eyebrow">MY COPIES</p><h1>Passport copies</h1><p>Information transcribed from physical pet passports.</p></div>${action}</div><div class="passport-grid">${rows}</div>`;
}

export function passportFormPage(
  pets: Pet[],
  csrf: string,
  countryCode: string,
  selectedPet = "",
): string {
  if (!pets.length) {
    return `<div class="page-head"><div><p class="eyebrow">STEP 2</p><h1>Add passport copy</h1></div></div><section class="panel empty-state"><h2>Add pet first</h2><p>A passport copy must belong to one of your pets.</p><a class="primary button" href="/pets/new">Add pet</a></section>`;
  }
  const options = pets.map((pet) =>
    `<option value="${h(pet.id)}" ${pet.id === selectedPet ? "selected" : ""}>${
      h(pet.name)
    }</option>`
  ).join("");
  return `<div class="page-head"><div><p class="eyebrow">STEP 2</p><h1>Add passport copy</h1><p>Enter identifying numbers exactly as printed in physical booklet.</p></div></div>${
    alert("Personal digital copy only — not an official passport or travel document.")
  }<section class="panel form-panel"><form method="post" action="/passports" class="form-grid">${
    csrfInput(csrf)
  }<label class="full">Pet<select name="pet_id" required><option value="">Select pet</option>${options}</select></label><label>Issuing country code<input name="country_code" value="${
    h(countryCode)
  }" required maxlength="2" pattern="[A-Za-z]{2}"></label><label>Physical booklet number<input name="number" required maxlength="32" placeholder="00 123456"></label><label>Passport model<input name="model_version" maxlength="100" value="EU pet passport"></label><label>Date physically issued<input type="date" name="issued_on"></label><label class="full">Issuing veterinarian / authority<input name="issuing_vet" maxlength="150" placeholder="Copy name or clinic as printed"></label><button class="primary full">Create passport copy</button></form></section>`;
}

const sectionMap: Record<string, string> = {
  rabies: "Rabies vaccination",
  titration: "Rabies antibody test",
  echinococcus: "Echinococcus treatment",
  antiparasite: "Anti-parasite treatment",
  vaccination: "Other vaccination",
  clinical: "Clinical examination",
  legalisation: "Legalisation",
  other: "Other entry",
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
    }</small></div><span class="copy-chip">Copied</span></article>`;
  }).join("") || '<div class="empty">No health entries copied yet.</div>';
}

export function passportDetailPage(
  passport: Passport,
  owner: Owner,
  ids: Identification[],
  records: MedicalRecord[],
  csrf: string,
): string {
  const idRows =
    ids.map((id) =>
      `<div class="id-row"><span class="copy-chip">${h(id.kind)}</span><strong>${
        h(id.code)
      }</strong><small>${h(displayDate(id.marked_on))} · ${h(id.location)}</small></div>`
    ).join("") || '<div class="empty">No identification copied yet.</div>';
  return `<div class="page-head"><div><p class="eyebrow">PERSONAL DIGITAL COPY</p><h1>${
    h(passport.pet_name)
  }</h1><p>${h(passport.country_code)} ${
    h(passport.number)
  }</p></div><a class="primary button" href="/passports/${
    h(passport.id)
  }/emergency" target="_blank">Open emergency view</a></div>${
    alert(
      "Not an official passport. Verify critical information against physical booklet when available.",
    )
  }
  <section class="passport-summary">${
    passportCover(passport)
  }<div class="panel detail-list"><h2>Quick details</h2><dl><dt>Owner</dt><dd>${
    h(owner.first_name)
  } ${h(owner.last_name)}<br><small>${
    h(owner.phone || "No phone saved")
  }</small></dd><dt>Animal</dt><dd>${h(passport.pet_name)} · ${h(passport.species)} · ${
    h(passport.breed)
  }</dd><dt>Physical issue</dt><dd>${
    passport.issued_on_copy ? h(displayDate(passport.issued_on_copy)) : "Not copied"
  }${
    passport.issuing_vet_name_copy ? `<br><small>${h(passport.issuing_vet_name_copy)}</small>` : ""
  }</dd><dt>Identification</dt><dd>${idRows}</dd></dl></div></section>
  <section class="panel"><div class="panel-head"><div><p class="eyebrow">FROM PHYSICAL BOOKLET</p><h2>Health information</h2></div></div>${
    recordRows(records)
  }</section>
  <section class="edit-zone simple-entry-grid"><details class="panel" open><summary>Add identification</summary><p class="legal-note">Copy microchip or tattoo details exactly.</p><form method="post" action="/passports/${
    h(passport.id)
  }/identifications" class="form-grid">${
    csrfInput(csrf)
  }<label>Type<select name="kind"><option value="microchip">Microchip</option><option value="tattoo">Legacy tattoo</option></select></label><label>Code<input name="code" required maxlength="32"></label><label>Date applied/read<input type="date" name="marked_on" required></label><label>Location<input name="location" required maxlength="100" placeholder="Left neck"></label><button class="secondary full">Add identification</button></form></details>
  <details class="panel"><summary>Add health information</summary><p class="legal-note">Copy one entry exactly as written in physical passport.</p><form method="post" action="/passports/${
    h(passport.id)
  }/records" class="form-grid">${
    csrfInput(csrf)
  }<label class="full">Entry type<select name="type"><option value="rabies">Rabies vaccination</option><option value="titration">Rabies antibody test</option><option value="echinococcus">Echinococcus treatment</option><option value="antiparasite">Anti-parasite treatment</option><option value="vaccination">Other vaccination</option><option value="clinical">Clinical examination</option><option value="legalisation">Legalisation</option><option value="other">Other</option></select></label><label>Product / laboratory<input name="product" maxlength="200"></label><label>Batch<input name="batch" maxlength="100"></label><label>Report reference<input name="reference" maxlength="100"></label><label>Result IU/ml<input name="result" maxlength="30"></label><label>Date<input type="date" name="date" required></label><label>Time<input type="time" name="time"></label><label>Valid from<input type="date" name="valid_from"></label><label>Valid until<input type="date" name="valid_until"></label><label class="full">Notes<textarea name="notes" maxlength="500"></textarea></label><button class="secondary full">Add health information</button></form></details></section>`;
}

function emergencyRecords(records: MedicalRecord[]): string {
  return records.map((record) => {
    const data = JSON.parse(record.data_json) as Record<string, string>;
    return `<article><strong>${h(sectionMap[record.type])}</strong><span>${
      h(data.product || data.notes || "Recorded entry")
    }</span><small>${h(displayDate(data.date))}${data.batch ? ` · batch ${h(data.batch)}` : ""}${
      data.valid_until ? ` · valid until ${h(displayDate(data.valid_until))}` : ""
    }</small></article>`;
  }).join("") || "<p>No health information saved.</p>";
}

export function emergencyPage(
  passport: Passport,
  owner: Owner,
  ids: Identification[],
  records: MedicalRecord[],
): string {
  const identification =
    ids.map((id) =>
      `<div><strong>${h(id.kind)} · ${h(id.code)}</strong><small>${
        h(displayDate(id.marked_on))
      } · ${h(id.location)}</small></div>`
    ).join("") || "<p>No identification saved.</p>";
  return layout(
    `${passport.pet_name} emergency record`,
    `<div class="print-toolbar"><button id="print-button">Print / save PDF</button><p>Single-page personal reference.</p></div><section class="emergency-sheet"><header><div><p>PERSONAL DIGITAL COPY</p><h1>${
      h(passport.pet_name)
    }</h1><strong>${h(passport.country_code)} ${
      h(passport.number)
    }</strong></div>${euEmblem()}</header><div class="emergency-warning">NOT AN OFFICIAL PET PASSPORT · NOT VALID FOR TRAVEL</div><section><h2>Animal</h2><dl><dt>Species / breed</dt><dd>${
      h(passport.species)
    } / ${h(passport.breed)}</dd><dt>Sex</dt><dd>${h(passport.sex)}</dd><dt>Born</dt><dd>${
      h(displayDate(passport.birth_date))
    }</dd><dt>Colour</dt><dd>${h(passport.colour)}</dd><dt>Features</dt><dd>${
      h(passport.features || "—")
    }</dd><dt>Physical issue</dt><dd>${
      passport.issued_on_copy ? h(displayDate(passport.issued_on_copy)) : "—"
    }${
      passport.issuing_vet_name_copy ? ` · ${h(passport.issuing_vet_name_copy)}` : ""
    }</dd></dl></section><section><h2>Identification</h2><div class="emergency-identification">${identification}</div></section><section><h2>Health information copied from booklet</h2><div class="emergency-records">${
      emergencyRecords(records)
    }</div></section><section><h2>Owner contact</h2><dl><dt>Name</dt><dd>${h(owner.first_name)} ${
      h(owner.last_name)
    }</dd><dt>Phone</dt><dd>${h(owner.phone || "—")}</dd><dt>Email</dt><dd>${
      h(owner.email)
    }</dd><dt>Address</dt><dd>${h(owner.address || "—")}, ${h(owner.postal_code)} ${
      h(owner.city)
    }, ${
      h(owner.country)
    }</dd></dl></section><footer>Information entered by account owner. Check physical passport when possible.</footer></section>`,
    undefined,
    "",
    { print: true },
  );
}
