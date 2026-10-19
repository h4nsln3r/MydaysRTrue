import Link from "next/link";
import { LeaveYearCalendar } from "@/components/LeaveYearCalendar/LeaveYearCalendar";
import { RestaurantsYearBoard } from "@/components/RestaurantsYearBoard/RestaurantsYearBoard";
import { MediaYearBoard } from "@/components/MediaYearBoard/MediaYearBoard";
import { MediaYearProgress } from "@/components/MediaYearProgress/MediaYearProgress";
import { CodingProjectsYearBoard } from "@/components/CodingProjectsYearBoard/CodingProjectsYearBoard";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { getAuthUser } from "@/lib/auth.server";
import { getYearMedia } from "@/lib/media.server";
import { getCodingProjects } from "@/lib/coding.server";
import { getYearLiveEvents } from "@/lib/live-events.server";
import { getYearGigs } from "@/lib/gigs.server";
import { getYearLeave } from "@/lib/leave.server";
import { LiveEventsYearBoard } from "@/components/LiveEventsYearBoard/LiveEventsYearBoard";
import { LiveEventsYearProgress } from "@/components/LiveEventsYearProgress/LiveEventsYearProgress";
import { GigsYearBoard } from "@/components/GigsYearBoard/GigsYearBoard";
import { GigsYearProgress } from "@/components/GigsYearProgress/GigsYearProgress";
import { getYearRestaurantMeals } from "@/lib/meals.server";
import { todayLocalISO } from "@/lib/date";
import { isGigPlayed } from "@/lib/gigs";
import { isLiveEventAttended } from "@/lib/live-events";
import { PeriodInsights } from "@/components/PeriodInsights/PeriodInsights";
import { buildPeriodInsights, insightDaysFromMovement } from "@/lib/insights";
import {
  getYearInsightExtras,
  getYearMovement,
  liveMomentLabel,
} from "@/lib/insights.server";
import { parsePeriodView } from "@/lib/period-view";
import {
  buildYearCompletions,
  filterCompletionsForYear,
} from "@/lib/completions";
import styles from "./year.module.scss";

export const dynamic = "force-dynamic";

interface YearPageProps {
  searchParams: Promise<{ y?: string; view?: string }>;
}

function yearNavHref(year: number, view: "progress" | "plan"): string {
  return `/year?y=${year}&view=${view}`;
}

const YEAR_QS_RE = /^(\d{4})$/;

export default async function YearPage({ searchParams }: YearPageProps) {
  const user = await getAuthUser();

  const params = await searchParams;
  const view = parsePeriodView(params.view);
  const today = todayLocalISO();
  const currentYear = Number(today.slice(0, 4));

  let year = currentYear;
  if (params.y && YEAR_QS_RE.test(params.y)) {
    year = Number(params.y);
  }
  if (year > currentYear) year = currentYear;

  const [yearMedia, yearLive, yearGigs, yearRestaurants, yearLeave, codingProjects, yearMovement, yearExtras] =
    await Promise.all([
      getYearMedia(user.id, year),
      getYearLiveEvents(user.id, year),
      getYearGigs(user.id, year),
      getYearRestaurantMeals(user.id, year),
      getYearLeave(user.id, year),
      getCodingProjects(user.id),
      getYearMovement(user.id, year),
      getYearInsightExtras(user.id, year),
    ]);
  const canGoForward = year < currentYear;
  const yearCompletions = filterCompletionsForYear(
    buildYearCompletions({
      media: yearMedia.items,
      gigs: yearGigs.gigs,
      projects: codingProjects,
    }),
    year,
  );
  const topRestaurant = [...yearRestaurants].sort(
    (a, b) => b.visitCount - a.visitCount,
  )[0];
  const yearInsights = buildPeriodInsights({
    scope: "year",
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    today,
    days: insightDaysFromMovement(yearMovement, yearLeave.periods, today),
    sessions: yearExtras.sessions,
    moments: [
      ...yearLive.events
        .filter((event) => isLiveEventAttended(event))
        .map((event) => ({
          date: event.eventDate,
          label: liveMomentLabel(event.kind, event.title),
        })),
      ...yearGigs.gigs
        .filter((gig) => isGigPlayed(gig))
        .map((gig) => ({
          date: gig.eventDate,
          label: `spelningen ${gig.title}`,
        })),
    ],
    completions: yearCompletions.map((item) => ({
      date: item.date,
      title: item.title,
      subtitle: item.subtitle,
    })),
    leavePeriods: yearLeave.periods,
    topRestaurant: topRestaurant
      ? { name: topRestaurant.name, visits: topRestaurant.visitCount }
      : null,
    spends: yearExtras.spends,
    wealth: yearExtras.wealth,
  });

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.yearNav}>
          <Link
            href={yearNavHref(year - 1, view)}
            className={styles.navBtn}
            aria-label="Föregående år"
          >
            ‹
          </Link>
          <div className={styles.titleCell}>
            <ProgressPlanTabs
              view={view}
              progressHref={yearNavHref(year, "progress")}
              planHref={yearNavHref(year, "plan")}
            />
          </div>
          {canGoForward ? (
            <Link
              href={yearNavHref(year + 1, view)}
              className={styles.navBtn}
              aria-label="Nästa år"
            >
              ›
            </Link>
          ) : (
            <span
              className={[styles.navBtn, styles.navBtnDisabled].join(" ")}
              aria-hidden
            >
              ›
            </span>
          )}
        </div>
      </header>

      {view === "progress" ? <PeriodInsights model={yearInsights} /> : null}

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Semester, ledighet & resor</h2>
          <span className={styles.muted}>hoppar över jobb</span>
        </header>

        <LeaveYearCalendar
          yearLeave={yearLeave}
          completions={yearCompletions}
          readOnly={view === "progress"}
        />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Kodningsprojekt</h2>
          <span className={styles.muted}>projekt du kodar på</span>
        </header>

        <CodingProjectsYearBoard projects={codingProjects} />
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Läsa & titta</h2>
          <span className={styles.muted}>böcker · serier · filmer</span>
        </header>

        {view === "progress" ? (
          <>
            <MediaYearProgress yearMedia={yearMedia} />
            <MediaYearBoard yearMedia={yearMedia} createOnly />
          </>
        ) : (
          <MediaYearBoard yearMedia={yearMedia} />
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Live-upplevelser</h2>
          <span className={styles.muted}>konserter · sport · fester</span>
        </header>

        {view === "progress" ? (
          <>
            <LiveEventsYearProgress yearLive={yearLive} />
            <LiveEventsYearBoard yearLive={yearLive} createOnly />
          </>
        ) : (
          <LiveEventsYearBoard yearLive={yearLive} />
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Spelningar</h2>
          <span className={styles.muted}>Totes · Bojeng</span>
        </header>

        {view === "progress" ? (
          <>
            <GigsYearProgress yearGigs={yearGigs} />
            <GigsYearBoard yearGigs={yearGigs} createOnly />
          </>
        ) : (
          <GigsYearBoard yearGigs={yearGigs} />
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Restauranger</h2>
          <span className={styles.muted}>lunch & middag ute</span>
        </header>

        <RestaurantsYearBoard year={year} restaurants={yearRestaurants} />
      </section>
    </main>
  );
}
