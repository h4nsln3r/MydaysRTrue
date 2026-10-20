import { formatTripDayTitle } from "@/lib/leave";
import { getAuthUser } from "@/lib/auth.server";
import navStyles from "@/components/DayNav/DayNav.module.scss";
import styles from "../dashboard.module.scss";
import { getCachedLeaveDayContext } from "./cached";

export async function TripHeading({ date }: { date: string }) {
  const user = await getAuthUser();
  const { tripDay } = await getCachedLeaveDayContext(user.id, date);
  if (!tripDay) return null;

  return (
    <h2 className={[navStyles.heading, styles.tripDay].join(" ")}>
      {formatTripDayTitle(tripDay.title, tripDay.dayIndex, tripDay.dayCount)}
    </h2>
  );
}
