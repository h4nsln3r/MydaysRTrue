# TODO: Koppla Google Kalender → semester/ledighet

När du vill bygga detta: öppna en ny chat i Cursor och klistra in prompten nedan.

---

## Prompt (klistra in)

```
Bygg Google Kalender-koppling i MydaysRTrue (Next.js App Router + Supabase).

### Mål
Användaren är redan inloggad med e-post/lösenord via Supabase. Vi ska INTE byta till "Logga in med Google".
Istället: knyt Google Kalender till det befintliga kontot (OAuth-koppling), hämta relevanta events och skapa/uppdatera leave_periods så Jobb start/slut hoppas över automatiskt.

### Befintlig leave-funktion (bygg vidare på den)
- Tabell: leave_periods (migration 0061_leave_periods.sql)
  - kind: 'vacation' | 'day_off'
  - start_date, end_date, note, archived_at
- Lib: src/lib/leave.ts, src/lib/leave.server.ts
- Actions: src/app/(app)/leave-actions.ts
- UI: src/components/LeaveYearCalendar/LeaveYearCalendar.tsx på /year
- Jobb döljs via shouldShowWork / onLeave i day-plan, work-actions, DayActivitiesCard

### Auth i projektet idag
- Supabase email/password (login/register)
- OAuth callback finns redan: src/app/auth/callback/route.ts (exchangeCodeForSession)
- Settings: src/app/(app)/settings/page.tsx

### Krav
1. Google Cloud: Calendar API + OAuth web client (dokumentera vilka env-variabler som behövs).
2. Ny tabell t.ex. google_calendar_connections:
   - user_id, refresh_token (krypterat om möjligt), calendar_id, connected_at, scopes
   - RLS: endast egen rad
3. UI: "Koppla Google Kalender" / "Koppla från" (Inställningar och/eller årssidan under Semester & ledighet).
4. OAuth-flöde som länkar till INLOGGAD user (inte skapar nytt auth-konto). Spara refresh token.
5. Import/synk:
   - Hämta events (t.ex. heldag / titel som innehåller Semester, Ledig, Vacation, Day off — gör mappningen tydlig och konfigurerbar om rimligt)
   - Skapa leave_periods (undvik dubbletter vid om-synk; markera gärna importerade rader med source/google_event_id om du utökar schemat)
   - Manuell "Synka nu" räcker i v1; bakgrundssynk kan vänta
6. Följ befintliga mönster: server actions, supabase migrations, RLS, svenska UI-texter, SCSS modules.
7. Kör inte destructive git-kommandon. Committa bara om jag ber om det.

### Viktigt
- Gratis inom Google Calendar API-kvot — ingen betaltjänst (Nylas etc.) behövs.
- Koppling ≠ inloggning: behåll befintlig Supabase-session.
- Visa tydligt anslutningsstatus och fel om token gått ut / behöver återkopplas.
```

---

## Kort backlog (checklista)

- [ ] Google Cloud-projekt + Calendar API + OAuth-klient
- [ ] Env-variabler dokumenterade (`.env.example`)
- [ ] Migration `google_calendar_connections` (+ ev. `google_event_id` på leave)
- [ ] Koppla / koppla från-UI
- [ ] OAuth callback som sparar token till inloggad user
- [ ] Synka events → `leave_periods`
- [ ] Visa synkade dagar i årskalendern (redan via leave)
