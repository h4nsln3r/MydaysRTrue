import Link from "next/link";
import { MediaYearBoard } from "@/components/MediaYearBoard/MediaYearBoard";
import { MediaYearProgress } from "@/components/MediaYearProgress/MediaYearProgress";
import { PeriodNavTitle } from "@/components/PeriodBadge/PeriodBadge";
import { ProgressPlanTabs } from "@/components/ProgressPlanTabs/ProgressPlanTabs";
import { getAuthUser } from "@/lib/auth.server";
import { getYearMedia } from "@/lib/media.server";
import { parsePeriodView } from "@/lib/period-view";
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
  const currentYear = new Date().getFullYear();

  let year = currentYear;
  if (params.y && YEAR_QS_RE.test(params.y)) {
    year = Number(params.y);
  }
  if (year > currentYear) year = currentYear;

  const yearMedia = await getYearMedia(user.id, year);
  const isCurrent = year === currentYear;
  const canGoForward = year < currentYear;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {isCurrent ? "Det här året" : "Tidigare år"}
        </p>
        <div className={styles.yearNav}>
          <Link
            href={yearNavHref(year - 1, view)}
            className={styles.navBtn}
            aria-label="Föregående år"
          >
            ‹
          </Link>
          <h1 className={styles.h1}>
            <PeriodNavTitle kind="year" date={`${year}-01-01`}>
              {year}
            </PeriodNavTitle>
          </h1>
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

      <ProgressPlanTabs
        view={view}
        progressHref={yearNavHref(year, "progress")}
        planHref={yearNavHref(year, "plan")}
      />

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.h2}>Läsa & titta</h2>
          <span className={styles.muted}>böcker · serier · filmer</span>
        </header>

        {view === "progress" ? (
          <MediaYearProgress
            yearMedia={yearMedia}
            planHref={yearNavHref(year, "plan")}
          />
        ) : (
          <MediaYearBoard yearMedia={yearMedia} />
        )}
      </section>
    </main>
  );
}
