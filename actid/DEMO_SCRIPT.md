# ActID — Script demo (3 minute)

> Demo pentru jurați · Hackathon Cluj 2026 · Tema „Digital Romania"
>
> **Pregătire:** aplicația pornită (`./start.sh`), browser pe
> `http://localhost:5173`, fereastră în mod telefon (mobile-first).
> Deconectat înainte de start. Cod 2FA: `123456`.

---

## Minutul 1 — Problema + Login + Notificări

**Hook emoțional (primele 15 secunde):**

> „Câți dintre voi au uitat că le expiră buletinul?
> ... Exact. Și exact așa începe o zi pierdută la coadă — sau o amendă."

**Acțiune pe ecran:**

1. Arată ecranul de **login** — branding ROeID, aspect oficial, mobile-first.
2. Autentificare cu `ion.popescu@gmail.com` / `Parola@123`.
3. Pas **2FA** → cod `123456` → intri în Dashboard.
4. Dashboard-ul arată **imediat** alertele: CI expiră în 30 zile, cazier în 7 zile.

> „ActID nu așteaptă să întrebi. Te anunță înainte."

---

## Minutul 2 — Selective Disclosure EUDI

**Tranziție:**

> „Dar notificările sunt abia începutul. Problema reală e că de fiecare
> dată când arăți buletinul, expui tot — CNP, adresă, totul.
> Cu ActID, alegi exact ce dezvălui."

**Acțiune pe ecran:**

1. Tab **Prezentare EUDI** → selectează CI.
2. Bifează **doar** `Prenume` și `Data nașterii` (lasă CNP-ul debifat).
3. Scop: „Verificare vârstă bar" → click **Generează prezentare EUDI**.
4. Apare QR-ul cu `presentation_id`.

> „CNP-ul lui Ion nu pleacă niciodată. Verifier-ul vede doar hash-uri ale
> atributelor nedivulgate — nu poate nici măcar să ghicească ce ascunde."

5. Deconectare → login ca `functionar@spclep.ro` / `Parola@123` → 2FA `123456`.
6. Portal Funcționar → tab **Prezentare EUDI** → introdu ID-ul prezentării.
7. Apare: **„Prezentare EUDI verificată ✓"** + issuer *„Statul Român — MAI"* + badge *„Emitent de încredere"*.
8. Funcționarul vede **doar** Prenume + Data nașterii — nimic altceva.

> „Semnat criptografic de Statul Român. Funcționarul nu poate falsifica,
> cetățeanul nu poate expune mai mult decât a ales."

---

## Minutul 3 — Diaspora + Blockchain

**Tranziție:**

> „Dar cea mai grea problemă nu e a lui Ion. E a celor 2.5 milioane de
> români plecați — care nu pot ajunge la ghișeul din țară."

**Acțiune pe ecran:**

1. Login ca `alex.ionescu@gmail.com` / `Parola@123` → 2FA `123456`. Alex este la **Londra**.
2. Tab **Familie** → *„Delegat mie"* → vede actele Mariei din Cluj.
3. **Rovinieta Mariei expiră în 10 zile** → click **„Solicită reînnoire"** din Londra.

> „Mama din Cluj nu trebuie să facă nimic. Fiul a rezolvat de pe telefon,
> de la 2.000 de kilometri distanță."

4. Tab **Jurnal de Audit** → lanțul de blocuri SHA-256, fiecare acțiune înlănțuită.
5. Click **„Verifică"** → confirmare verde: **„✓ Lanț valid — {n} înregistrări"**.
6. Intrări vizibile: `CREDENTIAL_ISSUED`, `PRESENTATION_VERIFIED`, `DELEGATION_CREATED`.

**Închidere (memorabilă):**

> „ActID funcționează **azi**. Portofelul european de identitate vine abia
> în 2027. Până atunci — și după — noi suntem podul."

---

## Plan B — dacă ceva nu merge

- **Backend pică** → `./start.sh` sau `docker-compose up`
- **Un cont nu se autentifică** → parola `Parola@123`, 2FA `123456`, email exact
- **Selective disclosure eșuează** → arată direct pagina de securitate wallet (`/securitate`) cu statusul de criptare și emitenții trusted — demonstrează că BD-ul e criptat
- **„Solicită reînnoire" indisponibil** → rămâi pe delegare: esențialul e că Alex *vede* actele Mariei de la distanță
- **Audit gol** → fă câteva acțiuni (login, deschide document, generează o prezentare), revino — fiecare acțiune adaugă un bloc

---

## Cronometraj

| Segment | Durată | Mesaj-cheie |
|---|---|---|
| Hook + Login + Notificări | 0:00–1:00 | „Te anunță înainte să expire" |
| Selective Disclosure EUDI | 1:00–2:00 | „Alegi exact ce dezvălui, semnat de Statul Român" |
| Diaspora + Blockchain | 2:00–3:00 | „Rezolvi actele părinților de la distanță, imutabil" |