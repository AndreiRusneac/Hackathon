# ActID — Script demo (3 minute)

> Demo pentru jurați · Hackathon Cluj 2026 · Tema „Digital Romania"
>
> **Pregătire:** aplicația pornită (`./start.sh`), browser pe
> <http://localhost:5173>, fereastră în mod telefon (mobile-first).
> Deconectat înainte de start. Cod 2FA: `123456`.

---

## Minutul 1 — Problema + Login

**Hook emoțional (primele 15 secunde):**

> „Câți dintre voi au uitat că le expiră buletinul?
> ... Exact. Și exact așa începe o zi pierdută la coadă — sau o amendă."

**Acțiune pe ecran:**

1. Arată ecranul de **login** — branding ROeID, aspect oficial, mobile-first.
2. Autentificare cu `ion.popescu@gmail.com` / `Parola@123`.
3. Pas **2FA** → cod `123456` → intri în Dashboard.
4. Dashboard-ul afișează **imediat** alerta: cartea de identitate a lui Ion
   expiră în 30 de zile, cazierul în 7 zile.

> „ActID nu așteaptă să întrebi. Te anunță înainte."

---

## Minutul 2 — Scenariul diaspora

**Tranziție:**

> „Dar cea mai grea problemă nu e a lui Ion. E a celor 2.5 milioane de
> români plecați — care nu pot ajunge la ghișeul din țară pentru părinți."

**Acțiune pe ecran:**

1. Deconectare → autentificare cu `alex.ionescu@gmail.com` / `Parola@123`
   → 2FA `123456`. Alex locuiește la **Londra**.
2. Pagina **Family** → secțiunea „Delegat mie" → Alex vede actele mamei
   sale, Maria, din Cluj.
3. Evidențiază alerta: **rovinieta Mariei expiră în 10 zile**.
4. Click pe **„Solicită reînnoire"** → cererea pleacă din Londra.

> „Mama din Cluj nu trebuie să facă nimic. Fiul a rezolvat de pe telefon,
> de la 2.000 de kilometri distanță."

---

## Minutul 3 — Blockchain + Funcționar

**Tranziție:**

> „Și de unde știm că nimic din toate astea nu poate fi falsificat?"

**Acțiune pe ecran:**

1. Pagina **Jurnal de Audit** → arată lanțul de blocuri: fiecare acțiune
   (login, vizualizare, delegare, partajare) e un bloc legat de cel anterior
   prin hash SHA-256. Primul e marcat „Bloc geneză".
2. Click pe **„Verifică"** → apare confirmarea verde:
   **„✓ Lanț valid — {n} înregistrări"**.

> „Registru imutabil. Orice modificare a unui bloc rupe lanțul — și se vede."

3. Deconectare → autentificare cu `functionar@spclep.ro` / `Parola@123`
   → 2FA `123456`.
4. Tab-ul de **scanare QR** → funcționarul vede **doar** documentele
   partajate de cetățean, pentru contextul declarat — nimic altceva.

**Închidere (memorabilă):**

> „ActID funcționează **azi**. Portofelul european de identitate vine abia
> în decembrie 2026. Până atunci — și după — noi suntem podul."

---

## Plan B — dacă ceva nu merge

- **Backend pică / nu pornește** → repornește cu `./start.sh`; alternativ
  pornește din `docker-compose up`.
- **Un cont nu se autentifică** → toate folosesc parola `Parola@123` și
  codul 2FA `123456`; verifică tastarea exactă a emailului.
- **„Solicită reînnoire" indisponibil** → rămâi pe povestea delegării:
  esențialul e că Alex *vede și administrează* actele Mariei de la distanță.
- **Pagina de audit goală** → fă întâi câteva acțiuni (login, deschide un
  document), apoi revino — fiecare acțiune adaugă un bloc.

## Cronometraj

| Segment | Durată | Mesaj-cheie |
|---|---|---|
| Hook + Login | 0:00–1:00 | „Te anunță înainte să expire" |
| Diaspora | 1:00–2:00 | „Rezolvi actele părinților de la distanță" |
| Blockchain + Funcționar | 2:00–3:00 | „Imutabil, verificabil, cu acces limitat" |
