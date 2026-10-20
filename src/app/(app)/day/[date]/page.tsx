import { notFound, redirect } from "next/navigation";
import { todayLocalISO } from "@/lib/date";
import { parsePeriodView } from "@/lib/period-view";
import { DayView } from "../../day-view/DayView";

export const dynamic = "force-dynamic";

interface DayPageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function DayPage({ params, searchParams }: DayPageProps) {
  const { date } = await params;
  const view = parsePeriodView((await searchParams).view);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const today = todayLocalISO();
  if (date === today) redirect(view === "plan" ? "/?view=plan" : "/");

  const upcoming = date > today;

  return (
    <DayView
      date={date}
      today={today}
      view={view}
      upcoming={upcoming}
      showWaterLog
      waterPlusHref={`/water?date=${date}`}
      waterPlusLabel="Lägg till vatten"
    />
  );
}
