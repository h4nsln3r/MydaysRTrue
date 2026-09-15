# TODO: Hushåll — dela utvalda uppgifter (tvätt, matlådor, ekonomi)

När du vill bygga detta: öppna en ny chat i Cursor och klistra in prompten längst ner.

Det här är **medvetet en större uppgift**. Appen är idag strikt personlig (`user_id` + RLS `auth.uid() = user_id` överallt). Målet är att två konton kan leva sida vid sida, och att **vissa** saker blir en gemensam sanning. Bygg i faser. v1 ska vara smal och användbar.

Relaterad, annan idé i README: “Sharing (later)” som *mallar man importerar*. Det är **inte** det här. Här är det samma rad, samma bock, samma plan — inte en kopia.

---

## Varför

Julia ska ha MyDays som sin egen app (egna uppgifter, träning, journal, allt privat). Samtidigt är en del av livet gemensamt: tvätt, matlådor, hyra, matinköp.

Idag sitter hushållet hårdkodat *inuti ett konto*:

- `cooked_by` har värdet `'julia'`
- utgifter har `spend_kind` mat / privat / delat, med texten “Delas mellan dig och Julia”
- tvätt är en egen `completion_kind`
- matlådor och räkningar tillhör bara `user_id`

Det funkar för en person som loggar åt båda. Det funkar inte när båda är inloggade.

```
Hannes-konto                         Julia-konto
  egna uppgifter                       egna uppgifter
  gym / journal / sparkonton           gym / journal / sparkonton
                 \                   /
                  \                 /
                   hushåll (opt-in)
                   - Tvätta          ← en rad, båda ser/flyttar/bockar
                   - (v2) kylskåp
                   - (v3) hyra, delade utgifter
```

**Privat som standard. Delat bara när någon aktivt slår på det.**

---

## Svar på “blir databasen för stor?”

Nej — om ni **inte kopierar data per medlem**.

Att “göra databasen redo för massa användare” betyder:

- Många *oberoende* konton i samma Supabase-projekt (så funkar det redan).
- Många hushåll à 2 (senare N) personer.
- Delade saker är **en rad**, inte en rad per person.

Vad som *inte* ska göras: duplicera `weekly_tasks` / placements / completions till varje medlem, eller sätta `household_id` på varje tabell i appen. Det skulle både svälla och läcka.

Tumregel: 10 000 par som delar tvätt = 10 000 hushåll + 20 000 medlemsrader + 10 000 tvätt-mallar. Det är ingenting för Postgres. Det som blir stort är samma sak som idag — dagliga loggar — och de förblir personliga.

Facebook-liknande “lägg till varandra” i framtiden = fler *relationer* (medlemmar / grants), inte fler kopior av uppgiften.

---

## Faser

| Fas | Vad | Inte |
|---|---|---|
| **v1** | Hushåll + inbjudan. Dela *utvalda veckouppgifter* (tvätt först, men UI:t ska funka för vilken veckomall som helst). Samma dag-/veckovy med “delad”-märkning. Båda kan flytta och bocka. Valfri tilldelning. | Matlådor, ekonomi, realtime, vänner-graf, flera hushåll per user i UI |
| **v2** | Gemensamt kylskåp (matlådor: rätt, antal, vem lagade, vem åt) | Personliga måltidsloggar i övrigt |
| **v3** | Delade räkningar + utgifter märkta som delade/mat. Personliga saldon (LF, kort, ISK, krypto, cash) och `spend_kind = private` stannar privata | “Gör ekonomin”-snapshot delas inte |

Samma fil, tre PR:er. Implementera bara den fas prompten säger.

---

## Vad som redan finns

### Konton

- Supabase email/password: `/register`, `/login`
- `profiles` (display_name, water goal) skapas via trigger
- RLS: varje user ser bara sina rader
- Julia kan redan skapa konto — hon får en *isolerad* kopia av appen, inkl. egen seedad `home_tvatta`

### Veckouppgifter (v1 bygger vidare på detta)

- Mall: `weekly_tasks` (`user_id`, `key` t.ex. `home_tvatta`, `completion_kind`)
- Plan + bock: `weekly_task_placements` (`user_id`, `task_id`, `week_start`, `weekday`, `done_at`, …)
- Unikt idag: `(user_id, task_id, week_start)` på placements — **det här är fällan**. Två users som “delar” med nuvarande modell får två placements. Delat = **en** placement-rad som båda får uppdatera.
- Tvätt: `completion_kind = 'laundry'`, bokning + följd-tvätt via `laundry_booked_from_id` (`0085_laundry_booked_from.sql`)
- Seed: `seed_default_weekly_home_dev` i `0015_weekly_home_dev.sql` / `0087_repeatable_home_projekt.sql`
- Actions: `src/app/(app)/tasks-actions.ts`
- Queries: `src/lib/tasks.server.ts` (nästan allt filtrerar `.eq("user_id", userId)`)
- Typer/UI: `src/lib/tasks.ts`, dagkort, veckoplan, `src/app/(app)/settings/page.tsx` + weekly task-editors

### Hårdkodad Julia (ersätt när hushåll finns)

- `cooked_by`: `'self' | 'julia' | …` i `src/lib/habits.ts`, migration `0031_meal_cooking.sql`
- `SPEND_KIND_HINT.shared`: “Delas mellan dig och Julia” i `src/lib/tasks.ts`

### v2 / v3 ytor (rör dem inte i v1)

- Matlådor: `meal_box_stock` (`0041_meal_box_stock.sql`), `src/lib/meal-box.server.ts`, `/profile/meal-boxes`
- Räkningar / ekonomi: `monthly_tasks` + `monthly_finance_snapshots` (`0034_monthly_finance.sql`), `spend_kind` på placements (`0086_spend_kind.sql`), `src/components/ExpensesSummary/ExpensesSummary.tsx` (hälften av delat)

---

## Produktregler (alla faser)

1. **Eget konto först.** Ny user får vanliga seeds (vanor, tvätt, räkningar, …) som *sina*. Inget delas automatiskt vid registrering.
2. **Inbjudan.** En i paret skapar/har ett hushåll och bjuder in den andra (kod eller länk). Mottagaren måste vara inloggad (eller registrera sig, sen acceptera).
3. **Opt-in per mall.** “Dela Tvätta med hushållet” — inte “dela hela HOME”.
4. **En sanning.** Delad mall = en `weekly_tasks`-rad. Placering och `done_at` är gemensamma. När Hannes bockar ser Julia det (efter refresh).
5. **Samma vy.** Inga extra “Hushåll”-flikar i v1. Delade rader ligger i dag/vecka med tydlig märkning (🤝 / “Delad” + ev. tilldelad person).
6. **Tilldelning valfri.** `assigned_user_id` null = vem som helst. Satt = “Julia gör den här”. Båda får fortfarande flytta/bocka i v1 (tilldelning är signal, inte lås).
7. **Resten osynligt.** Gym, vatten, humör, journal, media, egna uppgifter, personliga saldon — partnern ska inte kunna gissa sig till dem via API heller (RLS).
8. **v1 UI: ett hushåll, två personer.** Schemat ska ändå tillåta N medlemmar och (senare) att en user är med i flera hushåll. Ingen `unique(user_id)` på `household_members`. Ingen `members <= 2`-check i DB. Begränsa i UI/actions i v1.

---

## v1 — håll det smalt

**In**

- Tabeller för hushåll, medlemmar, inbjudningar.
- Inställningar: skapa hushåll (namn valfritt, default “Hushåll”), visa medlemmar, bjud in, lämna / avböj.
- Inbjudningskod (kort, t.ex. 8 tecken) som räcker utan e-postserver. Länk `/household/join?code=` som kräver inloggning.
- På veckomallar som ägaren äger: toggle **Dela med hushållet**. Första mall att bry sig om i copy/test: **Tvätta** (`home_tvatta`). Toggle ska funka för valfri veckomall (städa, handla, engångsuppgift, …).
- Delade uppgifter syns i partnerns dag- och veckovy med märkning.
- Båda kan dra till annan dag, lägga i backlog, bocka, använda tvätt-flödet (boka tid / antal tvättar).
- Valfri tilldelning per *placement* (den här veckans instans), inte bara på mallen. “Julia den här veckan, ingen nästa.”
- När en mall delas: arkivera partnerns *egna* mall med samma `key` om den finns (annars får de två Tvätta). Flytta inte partnerns historiska placements in i den delade raden i v1 — historik stannar privat. Från och med delningen är den delade mallen den som planeras.
- Hårdkodad “Julia”-copy som syns i v1-ytor (t.ex. spend-hint om den syns) får gärna bli “hushållet” / partnerns `display_name`, men ät inte v2-matlagning i samma PR.

**Utanför v1**

- Matlådor / gemensamt lager
- Räkningar, “gör ekonomin”, sparkonton, 50/50-översikt mellan två inloggningar
- Supabase Realtime (refresh efter action räcker; den andra ser det vid nästa navigation/refresh)
- Vännerlista, flera hushåll i UI, push-notiser “din tur att tvätta”
- Lås så bara tilldelad får bocka
- Konflikt-UI (sista skrivningen vinner i v1)
- Dela vanor / journal / media

---

## Arkitektur (v1)

### 1. Datamodell — redo för många, utan att svälla

Något i den här stilen (namn får justeras, idén inte):

```
households
  id uuid pk
  name text
  created_by uuid → auth.users
  created_at

household_members
  household_id uuid → households on delete cascade
  user_id uuid → auth.users on delete cascade
  role text check (role in ('owner', 'member'))
  joined_at
  primary key (household_id, user_id)
  -- INTE unique(user_id): en user ska kunna vara i flera hushåll senare

household_invites
  id uuid pk
  household_id uuid → households on delete cascade
  invited_by uuid → auth.users
  code text unique not null   -- kort, slump, t.ex. 8 tecken [A-Z0-9]
  expires_at timestamptz
  accepted_at timestamptz
  accepted_by uuid
  revoked_at timestamptz
```

Index: `household_members(user_id)`, `household_invites(code)` where öppen.

**Dela en veckouppgift** — rekommenderad väg (en sanning, ingen kopia):

```
weekly_tasks.household_id uuid null → households
weekly_task_placements.assigned_user_id uuid null → auth.users
weekly_task_placements.updated_by uuid null → auth.users  -- vem som senast flyttade/bockade, bra för “sista skrivning”
```

- `weekly_tasks.user_id` = ursprunglig ägare (skaparen). Behålls för seeds, unikt `(user_id, key)`, och så osparade mallar fortsätter funka.
- `household_id is not null` = mallen är delad med det hushållet. Alla medlemmar får SELECT/UPDATE på den raden och dess placements.
- Insert av *ny* delad mall: fortfarande `user_id = auth.uid()`, plus `household_id`.

**Placements för delade mallar**

Idag äger placementen en user (`user_id` + unique `user_id, task_id, week_start`). För delade mallar måste medlemmarna mutera **samma** rad.

Gör så här, konkret:

- `user_id` på placement = vem som skapade raden (eller ägaren av mallen). Inte “vem raden syns för”.
- Synlighet styrs av mallen: om task.household_id är satt, ser alla medlemmar placementen.
- RLS på placements: `task_id` tillhör mig **eller** tillhör en mall vars `household_id` jag är medlem i.
- Unique-villkoret `(user_id, task_id, week_start)` får **inte** tvinga en rad per medlem. För delade mallar: unique på `(task_id, week_start)` för icke-repeatable, *eller* behåll id-baserad unique och se till att koden återanvänder befintlig placement i stället för att inserta en ny per user. Repeatable tvätt/handla kan ha flera placements per vecka redan — följ befintlig logik, duplicera den inte per medlem.
- Alla queries som hämtar veckan med `.eq("user_id", me)` på placements **missar delade rader**. Byt till: egna placements **plus** placements vars `task_id` är en delad mall i mitt hushåll. Helst en helper i `tasks.server.ts` så det inte sprids i 50 filer.

### 2. RLS (det här är säkerheten)

Privat som standard. Inga breda “members can select * from weekly_tasks”.

Mönster (security invoker, ingen `security definer` i `public`):

```sql
-- medlemsskap: se egna rader + andra i samma hushåll (namn i UI)
-- invites: skapare ser sina; den som vet koden kan läsa just den raden för att acceptera
-- weekly_tasks SELECT: user_id = auth.uid()
--                    OR household_id in (select household_id from household_members where user_id = auth.uid())
-- weekly_tasks UPDATE för delad: samma, så båda kan t.ex. byta titel? 
--    v1: båda får uppdatera delad mall + placements.
-- weekly_tasks INSERT: household_id null eller hushåll jag är med i; user_id = auth.uid()
-- VANOR / journal / water / gym / finance snapshots: oförändrat, bara owner.
```

Testa med två inloggningar (eller två JWT i SQL) att Julia **inte** kan `select` Hannes `habit_checks`, `journal_entries`, `monthly_finance_snapshots`.

UPDATE kräver SELECT i Postgres RLS. Partnern måste alltså ha SELECT på den delade raden, annars blir bock tyst 0 rader.

### 3. Queries / actions

- `getWeeklyTasks` / vecko-hämtning: synliga mallar = mina + delade i hushållet (inte arkiverade).
- Mutera placement: tillåt om mallen är min eller delad med mitt hushåll.
- `assigned_user_id` måste vara medlem i samma hushåll (check i action + gärna DB check).
- Partnerns `display_name`: profiles-policy som tillåter SELECT av `id, display_name` för hushållsmedlemmar — **inte** `daily_water_goal_ml` om det går att begränsa (view `household_profiles` med `security_invoker = true` är ok). Annars: spara display_name på `household_members` vid join och uppdatera när profilen ändras.

### 4. UI

- **Inställningar → Hushåll** (ny sektion på `settings/page.tsx` eller `/settings/household`): medlemmar, kod, kopiera länk, lämna, “Dela mallar”.
- **Uppgiftsmallar:** toggle per veckomall. Disabled tills man är med i ett hushåll. Copy: “Båda ser den i dag/vecka. En bock räcker.”
- **Dag / vecka:** badge på delade rader. Om tilldelad: visa namn/initial. Om du är tilldelad: gärna extra tydligt.
- **Tomt läge:** inget hushåll → ingen badge, appen beter sig som idag.
- Svenska texter, SCSS modules, samma kortkänsla som resten.

### 5. Dubbletter vid join

Julia har redan `home_tvatta` från seed. Flöde när Hannes delar Tvätta (eller när Julia accepterar och Tvätta redan är delad):

1. Hitta partnerns aktiva mall med samma `key` och `household_id is null`.
2. `archived_at = now()` på den.
3. Dela inte automatiskt andra keys (`home_stadning`, `dev_code_1`, …).

Engångsuppgifter (`single_week_start`) har ofta `key is null` — dela dem som enskilda rader (toggle på just den uppgiften), inte via key.

### 6. Flyttar / konflikter

En placement-rad. Sista `update` vinner. Inget merge. `updated_by` räcker som spår. Realtime inte v1.

---

## v2 — gemensamt kylskåp (inte nu)

När v1 sitter:

- `meal_box_stock` får `household_id` (nullable). Delat lager = ett kylskåp.
- Personliga måltider (`meal_entries`) förblir personliga: *jag åt lunch*.
- När lunch loggas som matlåda: decrementera **hushållslagret**, inte varsin räknare.
- `cooked_by = 'julia'` ersätts med hushållsmedlem (`cooked_by_user_id`) + befintliga `'bought' | 'restaurant' | 'meal_box' | 'other'`.
- UI: vilken rätt, hur många kvar, vem lagade, vem som tog en låda.
- Ät inte upp v1:s RLS-mönster — återanvänd `household_id in my households`.

---

## v3 — delad ekonomi (inte nu)

När v2 sitter:

| Yta | Delas? |
|---|---|
| Räkningar (hyra, el, internet) | Ja, samma mönster som veckomallar: opt-in per `monthly_tasks` |
| Handla / utgift med `spend_kind` mat eller delat | Ja, synliga för hushållet (samma placement som redan är på en delad mall, eller policy på spend_kind — välj en väg och dokumentera) |
| `spend_kind = private` | Nej |
| Sparkonton, “Gör ekonomin”, LF / kort / ISK / krypto / cash | Nej. `monthly_finance_snapshots` förblir `user_id = auth.uid()` |
| 50/50 (“hälften”) | Kvar som idag; båda *ser* samma delade rader så summan stämmer |

Fälla: om bara *mallen* Handla är delad, blir även privata inköp synliga. v3 måste antingen (a) kräva att private-rader stannar på en privat mall, eller (b) filtrera visibility per `spend_kind`. (b) är det användaren vill ha: “handla/utgifter kan vara båda”. Planera för (b).

---

## Senare än v3 (bara riktning)

- Flera medlemmar i UI (barn, inneboende).
- Flera hushåll per user, eller “lägg till vän” + `task_grants(task_id, grantee_user_id)` för att dela *en* uppgift utan att ta in personen i hela hushållet. Bygg inte grants i v1 — `household_id` på mallen räcker, och grants kan komma *bredvid* utan migrering av all data.
- Realtime / notis när partnern bockar.
- Tilldelning som lås.

---

## Risker / fällor

- **Två Tvätta.** Seedas per user. Arkivera partnerns kopia vid delning, annars dubbla rader i bådas vy.
- **Placement `user_id`-filter.** Vanligaste buggen: Julia ser inte Hannes tvätt för att queryn fortfarande är `.eq("user_id", julia)`. RLS släpper igenom raden, koden filtrerar bort den.
- **Unique `(user_id, task_id, week_start)`.** Tvingar en rad per person. Bryt/kringgå för delade mallar.
- **RLS tyst fail.** UPDATE utan SELECT-policy = 0 rader, inget fel.
- **Läckage via profiles eller members.** Partner ska se namn, inte vattenmål, journal, finance snapshots.
- **`security definer` i `public`.** Undvik. Invoker + medlems-SELECT räcker.
- **Dela allt i HOME.** Opt-in per mall. Städning och kodning är inte automatiskt gemensamma.
- **Journal-completion på delad mall.** Om någon delar en `journal`-mall hamnar anteckningen på placementen — då är den delad. Ok om de valt att dela; dokumentera. Dela inte journal-*entries*-tabellen.
- **Score / veckomål.** Delad tvätt som båda “ser” får inte räknas dubbelt i progress. En done_at = ett poäng totalt, synligt hos båda.
- **Leave household.** Delade mallar: stannar hos hushållet och kvarvarande medlem; den som lämnar tappar dem (behåller sina privata). Definiera: sista personen som lämnar → `household_id` nollställs tillbaka till `created_by` eller arkiveras. Välj ett och implementera.
- **Hårdkodad Julia** kvar i matlagning tills v2 — ok, men nya strängar i v1 ska använda display_name.

---

## Prompt (klistra in)

```
Bygg hushållsdelning v1 i MydaysRTrue (Next.js App Router + Supabase).
Läs `todo-household-sharing.md` i repo-roten först och följ den.

### Bakgrund
Appen är personlig idag: varje tabell har user_id och RLS auth.uid() = user_id.
Målet: två (senare N) konton i ett hushåll. Privat som standard. Utvalda
veckouppgifter blir EN gemensam rad som båda ser i samma dag-/veckovy.

Inte mall-import (README-roadmap). Inte matlådor. Inte ekonomi. Det är v2/v3
i samma todo-fil.

Produktbeslut som redan är tagna:
- v1 är ett par i UI, men DB ska tåla många users och N medlemmar utan
  unique(user_id) på members och utan att duplicera rader per medlem.
- Samma dag/vecka-vy, “delad”-badge, ingen extra hushållsflik.
- Båda kan flytta och klarmarkera. Tilldelning är valfri (signal, inte lås).
- Sista skrivning vinner. Ingen realtime i v1.
- Inbjudan: skapare bjuder in, mottagaren har redan (eller skapar) eget konto
  med egna seeds. Sedan opt-in per mall (tvätt först).
- Allt annat (gym, journal, humör, water, media, sparkonton) förblir osynligt,
  även via API.

### Mål (endast v1)
- households + household_members + household_invites (kod/länk).
- Inställningar: hushåll, bjud in, medlemmar, lämna.
- Toggle “Dela med hushållet” på veckomallar. Måste funka för Tvätta
  (key home_tvatta, completion_kind laundry) och för valfri annan veckomall.
- En weekly_tasks-rad med household_id; gemensamma placements; assigned_user_id
  nullable på placement.
- Arkivera partnerns egen mall med samma key när en mall delas, så de inte får
  två Tvätta. Historiska placements på den arkiverade mallen lämnas ifred.
- Badge + valfri tilldelning (partnerns display_name) i dag- och veckovy.
- Båda får använda befintligt tvättflöde (boka / antal tvättar).
- Tomt läge utan hushåll = appen som idag.

### Befintlig kod att bygga vidare på
- weekly_tasks / weekly_task_placements: supabase/migrations/0005_tasks.sql
  plus laundry 0015, 0085
- Queries: src/lib/tasks.server.ts — sluta anta att .eq("user_id", me) är hela
  sanningen; inför en helper för “synliga mallar/placements”.
- Actions: src/app/(app)/tasks-actions.ts (placement, complete, laundry)
- Typer: src/lib/tasks.ts
- Settings: src/app/(app)/settings/page.tsx, weekly task-editors
- Auth: src/lib/auth.server.ts, register/login, middleware
- Fälla: unique (user_id, task_id, week_start) på placements. Delad mall = samma
  rad för båda, inte en rad var.

### Krav
1. Migrationer, idempotenta, numrerade. Index på members(user_id) och invite code.
2. RLS: invoker, privat default. Partner ska INTE kunna läsa habit_checks,
   journal_entries, monthly_finance_snapshots, water_logs. Verifiera.
3. Profiles: partner behöver display_name för tilldelning, inte water goal.
4. UI svenska, SCSS modules, befintliga primitives (Card, Button, …).
5. Inga security definer-funktioner i public.
6. Ingen unique(user_id) på household_members. Ingen DB-check max 2 medlemmar.
   v1-UI får begränsa till ett hushåll och en inbjudan.
7. Progress/score: en delad bock får inte räknas två gånger.
8. Lämna hushåll: dokumentera och implementera ett tydligt beteende för delade
   mallar (se todo-filen).
9. Följ server-first, server actions, router.refresh(), inga *.server.ts i client.
10. Kör inte destructive git-kommandon. Committa bara om jag ber om det.

### Utanför den här PR:n
- v2 matlådor / cooked_by-julia-ersättning
- v3 räkningar och spend_kind-synlighet
- Realtime, push, vänner-graf, task_grants
- Google Tasks/Calendar-todofiler

### Databasstorlek
Duplicera inte uppgifter per medlem. household_id på den delade mallen +
medlemskap räcker. Det är det som gör att “många användare” inte sväller.
```

---

## När v1 är ute — prompt-stubbar

**v2:** “Implementera fas v2 i `todo-household-sharing.md`: gemensamt `meal_box_stock` per household_id, decrement vid ät, ersätt cooked_by julia med medlemmar. Rör inte v3.”

**v3:** “Implementera fas v3 i `todo-household-sharing.md`: opt-in delade räkningar; handla/utgifter synliga för hushållet när spend_kind är food/shared, private och finance snapshots stannar personliga. 50/50 behålls.”
