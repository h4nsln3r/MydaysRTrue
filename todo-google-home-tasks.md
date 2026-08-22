# TODO: Hej Google (mobil + Home) → Google Tasks → MyDays-uppgifter

När du vill bygga detta: öppna en ny chat i Cursor och klistra in prompten längst ner.

Det här är **medvetet en större uppgift**. App-sidan är ganska liten (engångsuppgifter finns redan). Det tunga är Google OAuth, Tasks-API, datummappning och att inte skapa dubbletter. Bygg v1 smalt.

Relaterad, ännu ogjord: `todo-google-calendar.md`. Samma Google Cloud-projekt och OAuth-klient kan återanvändas. Bygg dem inte beroende av varandra — men dela klient/secrets om kalendern redan finns.

**Nästa steg efter v1:** inköpslista via röst (“lägg till vitlök på inköpslistan”). Samma *idé* som uppgifterna, men **inte samma Google-låda** — se avsnittet längst ner.

---

## Varför den här vägen

Varken Nest eller telefonen kan skicka valfri rösttext rakt in i MyDays.

- Egna Assistant-appar (Conversational Actions) är nedlagda.
- IFTTT kan bara trigga fasta scener (“activate …”), inte “lägg till det jag sa”.
- MyDays är en webbapp, inte en Android-app med App Actions.

Det som **fortfarande fungerar nativt** — samma fras på **mobilen** och på **Google Home/Nest**:

> “Hej Google, lägg till en uppgift att ringa tandläkaren”
> “Hej Google, lägg till en uppgift att hämta paketet på tisdag”

Båda skriver till **samma Google Tasks-konto**. MyDays behöver alltså inte veta om det kom från telefonen eller högtalaren. En synk räcker.

```
Telefon (Hej Google / Gemini)     Nest / Google Home
        │                                    │
        │     röst: "lägg till en uppgift …" │
        └────────────────┬───────────────────┘
                         ▼
              Google Tasks  (titel, valfritt due)
                         │  OAuth + Tasks API
                         ▼
                    MyDays synk
                         │
        ├─ ingen due     → engångsuppgift i veckans backlog
        └─ due = datum   → engångsuppgift på den veckodagen
                           (rätt week_start via weekStartISO)
```

**Telefonen är ett förstahandsflöde**, inte en bonus. I vardagen är det troligen vanligare än högtalaren.

Verifiera en gång manuellt innan kod, på **båda** ställena: säg frasen i mobilen och till Nest, kolla att raden dyker upp i Google Tasks-appen (inte bara som en gammal “påminnelse”). Samma Google-konto måste vara inloggat på telefonen, Nest och den OAuth-koppling MyDays får.

---

## Vad som redan finns i appen

Engångsuppgift = `weekly_tasks` med `single_week_start` (måndagen) + rad i `weekly_task_placements`.

- Server action: `createOneOffWeeklyTaskAction` i `src/app/(app)/tasks-actions.ts`
- `weekday` utelämnad / `null` → veckans uppgiftslista (backlog)
- `weekday` 1–7 → placerad på den dagen
- Datum som `YYYY-MM-DD` i `Europe/Stockholm` (`src/lib/date.ts`: `weekStartISO`, `isoWeekdayFromLocalISO`, `DISPLAY_TIMEZONE`)

v1 ska **återanvända den logiken**, inte hitta på en ny uppgiftstyp. Dra gärna ut inserten till en intern server-helper så både UI och synk anropar samma sak (actionen kräver inloggad cookie-session idag).

---

## v1 — håll det smalt

**In**

- En Google-koppling per user (OAuth, inte “Logga in med Google”).
- En vald Tasks-lista. Röst (“Hej Google, lägg till en uppgift”) hamnar i **standardlistan** i Google Tasks — den går inte att välja per mening. Därför: gör `MyDays` till standardlista i Google Tasks (eller synka just den lista rösten faktiskt skriver till). Annars missar synken det som sagts i telefonen/Nest.
- Manuell knapp **Synka nu** i Inställningar.
- Obesvarade (ej completed) tasks i den listan → en engångs-veckouppgift var. Samma resultat oavsett om det kom från mobil eller Home.

**Mappning**

| Google Task | MyDays |
|---|---|
| `title` | `weekly_tasks.title` (samma 80-tecken-tak som actionen) |
| ingen `due` | `week_start` = innevarande måndag, `weekday` = null (backlog) |
| `due` idag eller framåt | `week_start` = måndagen för det datumet, `weekday` = 1–7 |
| `due` i dåtid | innevarande veckas backlog (inte en gammal vecka) |
| `notes` | valfritt i `weekly_tasks.notes` |
| kategori / ikon | defaults, samma som “Lägg till uppgift” utan kategori |

**Efter import**

- Spara `google_task_id` så samma rad aldrig importeras två gånger.
- Markera Google-raden som completed (eller flytta till en “Importerade”-lista). Radera inte från Google i v1.

**Utanför v1**

- Bakgrundssynk / cron / push från Google
- Röstkommandon som inte går via Tasks
- Inköpslista (“lägg till vitlök …”) — eget steg, se nedan
- Månadsuppgifter, vanor, återkommande mallar
- Tvåvägssynk (bocka av i MyDays → bocka av i Google)
- Kalender-events som källa

---

## Arkitektur (v1)

1. **Google Cloud**
   - Samma projekt som tänkt för Kalender om det finns.
   - Aktivera **Google Tasks API**.
   - OAuth 2.0 Web client. Scopes: `https://www.googleapis.com/auth/tasks` (eller readonly + separat complete-anrop — skriv vad ni väljer).
   - Redirect t.ex. `/api/google/tasks/callback` (inte blanda med Supabase `src/app/auth/callback/route.ts`).

2. **Databas**
   - `google_tasks_connections`: `user_id`, `refresh_token` (kryptera om rimligt), `tasklist_id`, `tasklist_title`, `connected_at`, `scopes`, `last_synced_at`, `last_error`.
   - RLS: bara egen rad.
   - `weekly_tasks.google_task_id` (nullable, unique per user) **eller** en liten `google_task_imports`-tabell. Unikt index så om-synk är idempotent.

3. **OAuth**
   - Användaren är redan inloggad med e-post/lösenord.
   - “Koppla Google Tasks” startar consent i **befintlig** session och sparar refresh token på den usern.
   - Skapa inte ett nytt Supabase-konto via Google.

4. **Synk (server action “Synka nu”)**
   - Refresh access token.
   - Lista tasks i vald lista (`showCompleted=false`).
   - För varje ny `id`: skapa engångsuppgift enligt tabellen ovan.
   - Hoppa över id som redan finns.
   - Markera Google-task completed.
   - Uppdatera `last_synced_at` / `last_error`.
   - `due` från Tasks API är ofta midnatt UTC — konvertera till kalenderdatum i `Europe/Stockholm`, annars hamnar “tisdag” på fel dag.

5. **UI**
   - Inställningar: Koppla / koppla från, vilken lista, senast synkad, fel (token utgången → “Koppla igen”), knappen Synka nu.
   - Kort hjälptext med röstexempel på svenska, tydligt för **både telefon och Home**, plus att samma Google-konto måste användas och att listan ska vara den rösten skriver till.

6. **Env** (dokumentera i `.env.example`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_TASKS_REDIRECT_URI`
   - Ev. krypteringsnyckel för refresh tokens

Appen måste vara nåbar på **HTTPS** för OAuth (prod). Localhost-redirect funkar för dev.

---

## Telefon vs Home (samma backend)

Ingen extra kodväg för mobilen. Allt landar i Tasks.

| Yta | Hur man säger | Att tänka på |
|---|---|---|
| **Android-telefon** | “Hej Google …” / Gemini | Förstahandsflöde. Samma Google-konto som OAuth i MyDays. Assistant/Gemini ska få skapa Tasks. |
| **Google Home / Nest** | “Hej Google …” | Samma konto via Voice Match, annars hamnar uppgiften på fel person. |
| **iPhone** | Inte system-“Hej Google” | Google-appen kan funka, men Siri är native. Inte v1-krav; Android + Nest räcker. |

Hjälptexten i Inställningar ska nämna båda röstytorna och att listan i Google Tasks måste vara den rösten använder (standardlistan).

---

## Risker / fällor

- **Reminders ≠ Tasks.** Vissa fraser skapar påminnelser. Dokumentera den fras som faktiskt skapar en Task, både i telefonen och på Nest.
- **Fel lista.** Rösten skriver till standardlistan. Om MyDays synkar en annan lista syns ingenting. UI ska varna om vald lista troligen inte är den rösten använder.
- **Fel Google-konto.** Telefon, Nest och MyDays-OAuth måste vara samma konto.
- **Timezone på `due`.** Mappa alltid till Stockholm-datum.
- **Dubbletter** om synk körs två gånger — unique `google_task_id` är ett måste.
- **Framtida veckor.** `single_week_start` på en senare måndag är okej; lägg inte framtida tasks i *nuvarande* vecka.
- **Token expiry / revoked consent.** Visa det i UI, tvinga inte tyst fail.
- **En user.** Det här är en personlig app; bygg inte multi-account-delning.
- **IFTTT/webhooks.** Inte v1. Extra yta, och de kan inte längre skicka med fritext från Google Home.

---

## Prompt (klistra in)

```
Bygg Google Tasks-koppling i MydaysRTrue så röstade uppgifter från telefonen
(“Hej Google” / Gemini) och från Google Home hamnar som samma sorts
engångsuppgifter i appen (Next.js App Router + Supabase).

### Bakgrund (läs först)
Läs `todo-google-home-tasks.md` i repo-roten. Kort: varken Nest eller mobilen
kan anropa appen direkt. Användaren säger “Hej Google, lägg till en uppgift …”
på telefonen eller högtalaren → Google Tasks → MyDays synkar listan till en
engångs-veckouppift. En synk, två röstytor. Telefonen är förstahandsflöde.

Relaterad ogjord fil: `todo-google-calendar.md`. Återanvänd samma Google Cloud-
projekt / OAuth-klient om den finns, men gör inte den här uppgiften beroende av
kalendern.

### Mål (v1)
- Koppla Google Tasks till det befintliga Supabase-kontot (OAuth).
- INTE byta inloggning till “Logga in med Google”.
- Manuell “Synka nu”: olästa tasks i en vald lista blir engångsuppgifter.
- Ingen due → veckans backlog (placement.weekday = null).
- Due idag/framåt → den veckan + veckodagen.
- Due i dåtid → innevarande veckas backlog.
- Idempotent via google_task_id. Markera Google-raden completed efter import.
- Ingen bakgrundssynk, ingen tvåvägssynk, inga månadsuppgifter i v1.
- Ingen inköpslista i den här PR:n. “lägg till vitlök på inköpslistan” är nästa
  steg (Keep, inte Tasks) — se todo-filen.

### Befintlig uppgiftsfunktion (bygg vidare på den)
- Action: `createOneOffWeeklyTaskAction` i `src/app/(app)/tasks-actions.ts`
  - weekly_tasks.insert med single_week_start
  - weekly_task_placements.insert med weekday eller null
- Datum: `src/lib/date.ts` (DISPLAY_TIMEZONE Europe/Stockholm, weekStartISO,
  isoWeekdayFromLocalISO, todayLocalISO). Due från Google är ofta UTC-midnatt
  — konvertera till Stockholm-kalenderdatum.
- UI som skapar samma sak idag: `src/components/AddTaskPanel/AddTaskPanel.tsx`
- Dra ut skapandet till en intern server-helper som både actionen och synken
  anropar, så ni inte duplicerar insert-logiken.

### Auth i projektet idag
- Supabase email/password (login/register)
- Befintlig auth-callback: `src/app/auth/callback/route.ts` — rör den inte för
  Google Tasks; gör en egen redirect-route
- Settings: `src/app/(app)/settings/page.tsx`

### Krav
1. Google Cloud: Tasks API + OAuth web client. Dokumentera env i `.env.example`.
2. Migration t.ex. `google_tasks_connections` + `google_task_id` på weekly_tasks
   (eller egen imports-tabell). Unique (user_id, google_task_id). RLS: bara egen rad.
3. UI i Inställningar: Koppla / koppla från, välj Tasks-lista (den rösten skriver
   till = Googles standardlista; förval MyDays om den görs till standard), status,
   fel, “Synka nu”. Rösthjälp på svenska för både telefon och Home. Samma Google-
   konto på telefon, Nest och OAuth.
4. OAuth som länkar till INLOGGAD user. Spara refresh token.
5. Synk enligt mappningen i todo-filen. Hoppa över redan importerade id.
6. Följ befintliga mönster: server actions, supabase migrations, RLS, svenska
   UI-texter, SCSS modules.
7. Kör inte destructive git-kommandon. Committa bara om jag ber om det.

### Viktigt
- Gratis inom Google Tasks API-kvot — ingen IFTTT/Zapier/Nylas i v1.
- Koppling ≠ inloggning: behåll befintlig Supabase-session.
- Visa tydligt anslutningsstatus och fel om token gått ut.
- Verifiera timezone-mappningen med ett due-datum nära midnatt.
```

---

## Kort backlog (checklista)

- [ ] Google Cloud-projekt + Tasks API + OAuth-klient (dela med Kalender om den finns)
- [ ] Env-variabler dokumenterade (`.env.example`)
- [ ] Migration `google_tasks_connections` + unikt `google_task_id`
- [ ] Koppla / koppla från + välj lista-UI i Inställningar
- [ ] OAuth callback som sparar token till inloggad user
- [ ] Intern helper för engångsuppgift (återanvänd av UI + synk)
- [ ] Synka nu: Tasks → backlog eller veckodag
- [ ] Idempotens + markera Google-task completed
- [ ] Stockholm-datum från Google `due` (UTC-fällan)
- [ ] Rösthjälp i UI (telefon + Home) + varning om lista ≠ röstens standardlista
- [ ] Manuell smoke: Hej Google i **mobilen** → Tasks-appen → Synka nu → veckoplanen
- [ ] Manuell smoke: samma sak via **Nest** (samma Google-konto / Voice Match)

### Senare (inte v1)

- [ ] Bakgrundssynk (cron / periodisk poll)
- [ ] Dela OAuth-tabell med Google Kalender
- [ ] Tvåvägssynk (klar i MyDays → klar i Google)
- [ ] Inköpslista i appen + röst (“vitlök på inköpslistan”) — se avsnittet nedan

---

## Nästa steg: inköpslista (efter uppgifts-v1)

Ja, det kan fungera med **samma mönster** (röst → Google-låda → MyDays), men **inte med samma Google Tasks-synk**.

“Hej Google, lägg till en uppgift …” och “Hej Google, lägg till vitlök på inköpslistan” är två olika Google-kommandon:

| Du säger | Google lägger det i | MyDays bör göra |
|---|---|---|
| lägg till en *uppgift* (att ringa …) | **Google Tasks** | engångsuppgift (v1 ovan) |
| lägg till *vitlök på inköpslistan* | **Google Keep** (inköpslista) | ny inköpslista i appen |

De ska inte blandas. Vitlök ska inte bli en engångsuppgift i veckoplanen. I appen finns redan veckouppgiften **Handla** (`home_handla`) — den är “jag handlade, butik + summa”, inte en varulista.

```
Telefon / Nest: "lägg till vitlök på inköpslistan"
        │
        ▼
Google Keep  (checklista "Shopping list" / Inköpslista)
        │  (officiellt Keep-API är i praktiken Workspace,
        │   inte en given väg för ett vanligt Gmail-konto)
        ▼
MyDays inköpslista  (ny sak — rader att bocka av)
```

**Därför är det ett eget steg**, efter att Tasks-kopplingen funkar.

### Två vägar (välj när ni bygger)

1. **Naturlig fras, krångligare teknik (Keep)**  
   “lägg till vitlök på inköpslistan” funkar redan på telefon och Nest. Problemet: officiella Keep API:t är gjort för Workspace, inte personligt Gmail. Inofficiella klienter (gkeepapi m.fl.) funkar hemma men är sköra och inget att bygga en v1 på.

2. **Samma OAuth som uppgifterna, sämre fras (Tasks-lista “Inköp”)**  
   Återanvänd Tasks-kopplingen, synka en *andra* lista som heter t.ex. `Inköp`. Då får ni en officiell API. Rösten blir mer i stil med “lägg till vitlök som en uppgift” / i listan Inköp — **inte** den inbyggda inköpslista-frasen. Enkelt att bygga, sämre att säga i köket.

Rekommendation: bygg **först en riktig inköpslista i MyDays** (tabell, UI, bocka av, inte veckoplanen). Röst-inbox väljs sen: Keep om det går att läsa officiellt, annars Tasks-listan `Inköp` som pragmatisk v1. Inte inofficiell Keep-inloggning.

### Vad som behövs i appen (skiss)

- Ny tabell t.ex. `shopping_items`: `user_id`, `title`, `done_at`, `sort_order`, ev. `google_item_id`
- Enkel yta (dag/vecka eller egen sida): lägg till, bocka av, rensa klara
- Inte samma sak som `completion_kind = shop` på Handla
- Röstsynk är ett tillägg ovanpå listan, samma “Synka nu”-idé som Tasks

Bygg inte inköpslistan i samma PR som uppgifts-v1.
