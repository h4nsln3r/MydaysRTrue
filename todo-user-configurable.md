# TODO: Egna rutiner — appen för många användare

När du vill bygga detta: öppna en ny chat i Cursor och klistra in prompten längst ner.

Det här är **medvetet en större uppgift**. Databasen tål redan massa konton (`user_id` + RLS). Det som saknas är att en *ny* person ska kunna forma sitt eget liv i appen, utan att ärva Hannes mallar, Julia, Totes/Bojeng och Länsförsäkringar.

Bygg i faser. v1 ska göra att registrering känns som *deras* app. Inte skriva om uppgiftsmodellen.

Relaterade filer, **andra spår**:

- `todo-household-sharing.md` — dela utvalda saker med en partner. Bygg inte hushåll här.
- README-roadmap “User-customizable tasks” med en ny tabell `task_definitions` — **föråldrad**. Vanor, vecko- och månadsuppgifter är redan user-ägda rader. Skapa inte ett parallellt system.

---

## Varför

Tekniskt kan vem som helst registrera sig idag. Produkten de får är en kopia av *ett* liv:

- Signup-triggern `handle_new_user` seedar ~15 paket: vanor, gym, cardio, bad, hem (tvätt/handla/städ), musik, “ring mamma”, sport, räkningar, sparande, “gör ekonomin”, utgifter, spel.
- Specialbeteenden sitter på **hårdkodade keys och enums**: `home_tvatta`, `bill_hyra`, `cooked_by = 'julia'`, `MUSIC_BANDS = Totes/Bojeng`, finance-kolumner LF/SBAB/Avanza.
- Veckoprogress visar bara en fast lista `WEEK_PROGRESS_HABIT_KEYS`.
- En ny vana som användaren skapar blir i praktiken en enkel check — inte “vatten” eller “tvätt” — för den rika logiken är knuten till seed + `kind` / `completion_kind`.

Målet: **många användare, var och en med egna uppgifter, vanor och vilka delar av appen som syns.** Hannes konto ska fortsätta se ut som idag.

```
Signup
  ├─ v1: välj startpaket (tomt / hem / hälsa / …)
  ├─ v2: skapa mallar med typ (bock, tvätt, handla, journal, …)
  ├─ v3: slå av hela moduler (gym, gig, rökfritt, …)
  └─ v4: egna listor (konton, band, “vem lagade”)
```

---

## Svar på “tål strukturen oändligt med users?”

Ja, **om ni fortsätter filtrera på `user_id` och inte kopierar liv mellan personer.**

- 10 000 users = 10 000 isolerade ryggsäckar. Postgres/Supabase klarar det.
- Det som *inte* skalar är nya migrationer som `for u in select id from auth.users loop seed_…`. Det är ok som engångsbackfill åt 2 users. Det är dåligt åt 50 000. Nya seeds ska bara köras i `handle_new_user` (eller onboarding), aldrig loopa hela `auth.users` i nya filer.
- Duplicera inte tabeller “för att det ska bli många users”. Samma schema.

Det svåra är produkten, inte radantalet.

---

## Vad som redan finns (bygg vidare — riva inte)

Användare kan **redan**:

- Skapa / arkivera / slå av vanor (`createHabitAction`, intervall, veckodagar) — `/settings/tasks`
- Skapa / arkivera vecko- och månadsmallar + engångsuppgifter (`createWeeklyTaskAction`, `createOneOffWeeklyTaskAction`, `createMonthlyTaskAction`)
- Egna kategorier (namn, ikon, färg) — `CategoryEditor`
- Placera uppgifter i dag/vecka, repeatable + veckomål
- Vattenmål, display name, veckoprogress-ordning (delvis)

Det README kallar “bara on/off på fasta mallar” stämmer inte längre. Luckan är:

1. **Defaults vid signup** är Hannes-livet, påslaget.
2. **Typ på ny mall** väljs nästan inte. `createWeeklyTaskAction` sätter `completion_kind` bara om kategorin heter Utgifter → `expense`. Annars DB-default (`note`). Ingen UI för “det här är tvätt / handla / journal”.
3. **Moduler** (gym, gig, media, rökfritt, kodprojekt, …) går inte att stänga av som yta. De seedas och syns tomma eller med Hannes defaults.
4. **Personliga dictionaries** (banker, band, kock-namn) är kod, inte data.

---

## Produktregler (alla faser)

1. **Befintligt konto orört** om inte usern själv ändrar. Ingen migration som arkiverar Hannes mallar.
2. **Ny user ≠ kopia av Hannes.** Inget “Ring mamma”, Totes, Julia, LF, Pokemon/Duolingo som default.
3. **Opt-in features.** Rika grejer (tvättflöde, handla+summa, ekonomi-snapshot) finns i koden. Usem får dem när de *väljer typ* eller *slår på modul*, inte för att key råkar heta `home_tvatta`.
4. **Privat per konto.** Samma RLS som idag. Den här filen handlar inte om delning.
5. **Tom app ska vara okej.** En user som valt “tom start” ser dag/vecka med vatten (eller helt tomt — se v1) och en tydlig “lägg till uppgift / vana”, inte 14 tomma Hannes-kort.
6. **Specialbeteende styrs av `kind` / `completion_kind` / modulflagga**, inte av magiska `key`-strängar. Keys får finnas för seeds och bakåtkompatibilitet (`home_tvatta` hos Hannes), men ny kod ska inte kräva dem.
7. **Svenska UI-texter**, SCSS modules, server actions, inga `*.server.ts` i client.

---

## Faser

| Fas | Vad | Inte |
|---|---|---|
| **v1** | Startpaket vid signup. `handle_new_user` seedar bara valt paket. Tomma/minimala states. Sluta backfilla alla users i nya migrationer. | Ny uppgiftstyp-modell, hushåll, finance-ombyggnad |
| **v2** | Task builder: välj `completion_kind` / habit-`kind` när man skapar. Tvätt, handla, journal, enkel bock funkar utan seed-key. | Gömma gym-sidan, egna bankkonton |
| **v3** | Moduler på/av (träning, gigs, media, rökfritt, matlådor, ekonomi, …). Layout och nav följer. | Byta finance från kolumner till rader |
| **v4** | Egna listor: sparkonton, band, “vem lagade”. Hårdkodad Julia/Totes/LF för *nya* users borta. | Hushållsdelning (egen todo) |

Samma fil, flera PR:er. Implementera bara den fas prompten säger.

---

## v1 — startpaket (håll det smalt)

Det här är det som låser upp “massa användare” utan att ljuga.

**In**

- Vid **registrering** (efter konto skapats, eller som fält i registret): välj startpaket. Minst:
  - **Tom** — inga vecko-/månadsmallar, inga träningspass, inga “ring mamma”. Max: profil + ev. vattenvana (så startsidan inte är död).
  - **Hem** — generiska mallar: t.ex. städ, tvätt (`completion_kind = laundry`), handla (`shop`). Inga personnamn.
  - **Hälsa** — vatten, måltider, steg, en enkel vana. Inte rökfritt/cannabis om det inte valts.
- Spara valet t.ex. `profiles.starter_pack` (`empty` | `home` | `health` | `full`).
- `handle_new_user` ska **inte** anropa alla `seed_default_*`. Antingen:
  - seeda inget i triggern förutom `profiles`, och kör paket-seed från register-action när valet finns, **eller**
  - triggern seedar bara `empty`, och en onboarding-sida kör resten.
- Paketet **`full`** = dagens beteende (alla seeds). Finns för *befintlig* user / ev. intern flagga. Visa det **inte** som val för nya users i v1 (annars ärver de Hannes igen). Befintliga konton utan kolumn = behandla som `full`.
- Tomma states: dag, vecka, `/settings/tasks` — en mening + knapp till “skapa vana/uppgift” som redan finns (`AddTaskPanel`, `TaskSettingsClient`).
- Nya migrationer: **förbjudet** att `for u in auth.users loop seed_default_…` om seedet är personligt/innehållsfullt. Backfill bara när det är ett schema-fix.
- Copy i *nya* strängar: inget “Julia” som default för users utan den datan. Befintlig Hannes-UI får lämnas i v1 om den bara syns när seedad data finns.

**Utanför v1**

- Välja laundry/shop i create-formuläret (v2)
- Gömma BottomNav-poster / årsgigs (v3)
- Byta `monthly_finance_snapshots`-kolumner (v4)
- Hushåll, Google Tasks, realtime

### Arkitektur v1

1. `profiles.starter_pack text` + ev. `onboarded_at`.
2. Dela `handle_new_user`: profilrad alltid; seeds bakom funktioner som redan finns (`seed_default_weekly_home_dev` osv.) anropas **selektivt**.
3. Register UI: `src/app/(auth)/register/` — paketval, svenska labels, en mening vad som ingår.
4. Om email-confirm är på: spara pack i `user_metadata` vid signup och kör seed vid första login, *eller* onboarding-route som blockerar appen tills valet är gjort. Dokumentera vilken väg ni tar. Första login-vägen är säkrare än att lita på metadata i RLS (metadata är user-redigerbar — använd den inte som behörighet, bara som onboarding-hint).
5. Verifiera: nytt konto med **Tom** har inte `weekly_tasks` med `key = home_tvatta` / `life_ring_mamma_*` / finance-mallar. Hannes befintliga konto oförändrat.

---

## v2 — skapa rutiner med rätt typ (inte nu)

När v1 sitter kan en tom user lägga till “Tvätta”, men den beter sig som en note-bock. v2 kopplar *skapandet* till den rika logiken som redan finns.

**In**

- I `/settings/tasks` och ev. `AddTaskPanel` när man skapar **permanent** veckomall:
  - typ: `simple` | `note` | `shop` | `expense` | `laundry` | `journal` (music valfritt i v2 — bandlistan är fortfarande hårdkodad).
- Månad: `simple` | `amount` | ev. `finance` bara om ekonomi-modulen är på (annars göm finance-typen till v3/v4).
- Vana: minst `tri_state` (ja/halv/nej). De tunga slagen (`water`, `meal`, `steps`, …) är **moduler** — antingen “slå på inbyggd vatten-tracker” (en per user) eller vänta till v3. Skapa inte en andra vatten-habit-kind som krockar med `water_logs`.
- Repeatable + veckomål redan finns — visa det för alla mallar, inte bara keys i `REPEATABLE_WEEKLY_TASK_KEYS`. Ny kod: `is_repeatable` på raden, inte `key in ('home_handla', …)`.
- Tvätt/handla-UI i dag/vecka ska triggas på `completion_kind`, vilket det till stor del redan gör. Jaga kvarvarande `key === 'home_tvatta'` och liknande. `bill_hyra`-scorebonus är ett exempel på key-magi som inte ska krävas för nya users.
- Användaren kan byta typ på *egen* mall som inte har historik, eller varna om placements finns.

**Inte v2:** nya tabellen `task_definitions`. Inte en “recurrence engine” som materialiserar daily/weekly/monthly till en modell. Intervall på vanor och placements på vecka **finns**. En union-modell är ett separat, enormt refactor — gör det inte i smyg.

---

## v3 — konfigurera hur appen ser ut (inte nu)

En person som inte spelar live, inte loggar rökfritt och inte har gym ska inte möta de korten.

**In**

- `user_modules` eller boolean-kolumner på `profiles`: t.ex. `gym`, `cardio`, `sport`, `bathing`, `media`, `gigs`, `live_events`, `coding`, `games`, `smoke_free`, `meal_boxes`, `finance`, `journal` (journal kanske alltid på — välj).
- Default för paket: Tom = nästan allt av; Hälsa = water/meals/steps; Hem = tasks + meal_boxes; `full` (Hannes) = allt på.
- Bottom nav, dagkort, veckoprogress, årssidor filtrerar på flaggorna. Återanvänd `week-progress-layout` som redan kan ordna rader — utöka “vilka rader som får finnas”.
- Settings: en “Delar av appen”-lista med on/off. Av = sluta seeda/visa, **radera inte historik**.

**Inte v3:** dynamiska nav-appar från databasen, teman per user, i18n.

---

## v4 — egna dictionaries (inte nu)

Hårdkodat som måste bli data för att främlingar ska trivas:

| Idag | Mål |
|---|---|
| `monthly_finance_snapshots` kolumner LF/kort/ISK/SBAB/Avanza/krypto/cash | Konton som rader (`user_id`, namn, grupp) |
| `MUSIC_BANDS` Totes/Bojeng | User-lista, samma mönster som `user_games` / `user_sports` (0088, 0089) |
| `cooked_by: julia` | Namn från hushåll (se household-todo) eller en liten “personer i köket”-lista |
| `SPEND_KIND_HINT` “…Julia” | “hushållet” / partnernamn / “delat” |
| `mobile_games` chess/duolingo/pokemon | Redan på väg mot `user_games` — följ det, inte tre booleaner |

Gör v4 **efter** att nya users inte ens ser de ytorna (v3), så Hannes kan behålla sina kolumner tills ni migrerar hans snapshot-rader.

---

## Drift när det faktiskt blir många konton

Inte v1-krav, men skriv inte kod som omöjliggör det:

- Inga full-table seeds i migrationer.
- Behåll index `(user_id, …)` på loggar.
- Email-confirm på i prod (redan stöds i register-action).
- Öppen register = spam. Senare: invite-only, rate limit, eller stäng `/register`. Inte den här PR:n.
- Signup-seed ska vara **litet**. 15 paket × 20 rader × 100k signups är ok; tunga backfills på natten är det inte.

---

## Risker / fällor

- **`task_definitions`.** README lockar till en ny modell. Det är ett års refactor. Inte den här todon.
- **Hannes data.** En “gör defaults generiska”-migration som updaterar *befintliga* rader är fel. Bara nya users + ny kodvägar.
- **Trigger vs email-confirm.** `handle_new_user` körs när auth-usern skapas, innan onboarding. Pack måste överleva confirm. Testa båda lägena (session direkt vs “kolla mejlen”).
- **Key-magi.** `REPEATABLE_WEEKLY_TASK_KEYS`, `bill_hyra` score, `FEST_TASK_KEY`, `life_ring_mamma`. Bakåtkompatibelt för Hannes; nya mallar ska använda kolumner (`is_repeatable`, `completion_kind`).
- **En water-habit.** `kind = water` är kopplad till `water_logs`. Låt inte create-habit spawna en andra vatten-tracker.
- **Kategori-namn som typ.** `weeklyCompletionKindForCategory` mappar “Utgifter” → expense. Det döljer valet och kraschar om någon byter kategorinamn. v2: typ på uppgiften, inte på kategorinamnet.
- **Tom startsida.** Utan vatten och utan vanor ser `/` tom ut. v1 måste ha tom-state, inte bara “inget seedat”.
- **Hushåll.** Dela inte tvätt automatiskt i den här PR:n.
- **`user_metadata` i RLS.** Aldrig. Pack är `profiles`-kolumn.

---

## Prompt (klistra in)

```
Bygg v1 av “egna rutiner / många användare” i MydaysRTrue
(Next.js App Router + Supabase). Läs `todo-user-configurable.md` först.

### Bakgrund
Databasen är redan multi-tenant (user_id + RLS). Problemet är att
handle_new_user seedar Hannes liv till varje nytt konto (tvätt, ring mamma,
Totes, LF, rökfritt, gym, …). Användare kan redan skapa vanor och mallar i
/settings/tasks och AddTaskPanel. Bygg inte en ny task_definitions-tabell.
Bygg inte hushåll (todo-household-sharing.md). Bygg inte v2–v4 i den här PR:n.

### Mål (endast v1)
- Nytt konto väljer startpaket: Tom, Hem, Hälsa.
- Tom = inga Hannes-mallar. Gärna vattenvana så dagen inte är död, plus
  tom-states som pekar på skapa vana/uppgift.
- Hem = generiska hem-mallar (städ/tvätt/handla) utan personnamn.
- Hälsa = vatten/måltider/steg (eller motsvarande som redan finns som
  seed-funktioner), inte hela rökfritt+spel+musik-paketet.
- profiles.starter_pack. Befintliga users utan värde = full (dagens seeds).
  Visa inte “full” som val för nya users.
- handle_new_user seedar inte längre allt åt alla. Selektivt efter paket.
  Funkar med email-confirm (pack får inte försvinna).
- Inga nya migrationer som loopar auth.users och seedar innehåll.
- Hannes befintliga data oförändrad. Verifiera med: nytt Tom-konto saknar
  home_tvatta / life_ring_mamma_* / finance-mallar.

### Befintlig kod
- Trigger: public.handle_new_user i senaste migrationerna (t.ex. 0088)
- Seeds: seed_default_habits, seed_default_weekly_home_dev,
  seed_default_monthly_bills, … — återanvänd, anropa inte alla
- Register: src/app/(auth)/register/
- Skapa uppgifter: src/app/(app)/settings/tasks/TaskSettingsClient.tsx,
  src/components/AddTaskPanel/AddTaskPanel.tsx,
  createHabitAction / createWeeklyTaskAction / createMonthlyTaskAction
- Startsida: src/app/(app)/page.tsx, day/[date]

### Krav
1. Migration för starter_pack (och ev. onboarded_at). RLS oförändrat i övrigt.
2. Register-UI svenska, SCSS modules.
3. Tydliga tom-states på dag/vecka/settings om paketet är tomt.
4. Följ server-first, server actions, router.refresh().
5. Kör inte destructive git-kommandon. Committa bara om jag ber om det.

### Utanför den här PR:n
- v2 completion_kind i create-UI
- v3 modul-on/off
- v4 egna banker/band/kock-namn
- Hushåll, Google-todofiler
```

---

## När v1 är ute — prompt-stubbar

**v2:** “Implementera fas v2 i `todo-user-configurable.md`: välj completion_kind vid skapa vecko-/månadsmall; vanor minst tri_state; sluta förlita ny logik på magiska keys. Ingen task_definitions-tabell.”

**v3:** “Implementera fas v3 i `todo-user-configurable.md`: user_modules on/off, filtrera dag/vecka/år/nav. Radera inte historik när en modul stängs.”

**v4:** “Implementera fas v4 i `todo-user-configurable.md`: user-ägda finance-konton, bandlista, cooked_by-namn. Migrera Hannes data; inga Julia/Totes/LF som default för nya users.”
