# EU model mapping and references

Reviewed 11 August 2026.

## Current framework

Old Regulation 577/2013 model became obsolete for new-law operation on 22 April 2026. PetPass
defaults to current model from
[Implementing Regulation (EU) 2026/705](https://eur-lex.europa.eu/eli/reg_impl/2026/705/oj/eng),
Annex I. Existing/transition passports can remain valid under current rules; import support should
preserve their model version.

Primary sources:

- [Authentic 2026/705 Official Journal PDF](https://eur-lex.europa.eu/eli/reg_impl/2026/705/oj/eng/pdf),
  model pages 7-21.
- [Compact official visual excerpt](https://www.ruokavirasto.fi/globalassets/yritykset/tuonti-ja-vienti/elaimet-eu-maat/nettisivut_eu-passi_eng_2026.pdf).
- [Delegated Regulation (EU) 2026/131](https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng),
  movement rules.
- [Delegated Regulation (EU) 2026/132](https://eur-lex.europa.eu/eli/reg_del/2026/132/oj/eng),
  issuance and traceability.
- [European Commission intra-EU guidance](https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/travelling-pet-within-eu_en).
- [EU emblem graphics guide](https://style-guide.europa.eu/en/content/-/isg/topic?identifier=annex-a1-graphics-guide-european-emblem).

## Section mapping

| Official section              | App data                                                           |
| ----------------------------- | ------------------------------------------------------------------ |
| I. Details of ownership       | owner profile and ownership snapshot                               |
| II. Description of animal     | name, species, breed, sex, birth date, colour, features            |
| III. Animal identification    | transponder/tattoo code, application/read date, location, verifier |
| IV. Issuing of passport       | physical issue timestamp and authorised vet account                |
| V. Rabies vaccination         | product, batch, vaccination/validity dates, signer                 |
| VI. Rabies antibody titration | lab, report reference, sample date, result, signer                 |
| VII. Anti-Echinococcus        | product, date/time, signer                                         |
| VIII. Other anti-parasite     | product, date/time, signer                                         |
| IX. Other vaccinations        | vaccine, batch, date, validity, signer                             |
| X. Clinical examination       | date, declaration/notes, signer                                    |
| XI. Legalisation              | date, details, signer                                              |
| XII. Others                   | national notes, signer                                             |

## Physical requirements not reproducible by app

- 100 × 152 mm physical booklet.
- Blue cover, EU emblem, Member State and controlled ISO country code + number.
- Official Member State language(s) plus English.
- Unique number on every page; strict section and page sequence.
- Transparent laminate over Section III and specified stickers.
- Wet signatures, stamps, official stock control, destruction rules for incorrect Sections I-IV.
- Optional QR only when pointing to national registration database.

App uses 100 × 152 mm print CSS as visual reference only, adds conspicuous watermark, omits official
QR, and never generates country numbers.

## Travel advisory assumptions

- Scope: non-commercial movement of dogs, cats, ferrets.
- ISO microchip; legacy readable tattoo only if applied before 3 July 2011.
- Identification must precede rabies vaccination entry.
- Primary rabies vaccination at age 12 weeks or more and normally 21-day wait.
- Finland, Ireland, Malta, Northern Ireland, and Norway require dog Echinococcus treatment in 24-120
  hour entry window, subject to current official rules.

This is a screening aid. Authorised veterinarian, carrier, border authority, destination Member
State, and national measures remain authoritative.

## Visual research

UI palette, booklet ratio, numbered section cards, restrained blue panels, and line-based record
layout were derived from official Annex I PDF. Publicly visible Dutch passport photographs were
inspected only as secondary physical-layout reference and are not copied or shipped.
