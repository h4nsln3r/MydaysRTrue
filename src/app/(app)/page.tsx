import { todayLocalISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayView } from "./day-view/DayView";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function DashboardPage({ searchParams }: HomePageProps) {
  const view = parsePeriodView((await searchParams).view);
  const today = todayLocalISO();

  return (
    <DayView
      date={today}
      today={today}
      view={view}
      waterPlusHref="/water"
      waterPlusLabel="Open water page"
    />
  );
}
