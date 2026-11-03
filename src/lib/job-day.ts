// Why a day in the month job row is empty: logged work, leave, holiday, or weekend.

import {
  LEAVE_KIND_ICON,
  leavePeriodLabel,
  type LeavePeriod,
} from "@/lib/leave";
import type { PublicHoliday } from "@/lib/holidays";
import {
  WORK_KIND_ICON,
  WORK_KIND_LABEL,
  type WorkKind,
} from "@/lib/work";

export type JobDayMode = "icon" | "word" | "holiday" | "missing" | "blank";

export interface JobDayMark {
  mark: string | null;
  mode: JobDayMode;
  title: string;
}

function withContext(
  base: string,
  holiday: PublicHoliday | null,
  weekend: boolean,
): string {
  const parts = [base];
  if (holiday && holiday.name !== base) parts.push(holiday.name);
  else if (weekend && base !== "Helg") parts.push("helg");
  return parts.join(" · ");
}

/**
 * What the month job cell should show.
 * A logged workday wins. Otherwise the reason for not working:
 * semester/ledig/resa, then sjuk, then helgdag, then helg.
 */
export function jobDayMark(input: {
  isFuture: boolean;
  weekday: number;
  workKind: WorkKind | null;
  leave: LeavePeriod | null;
  holiday: PublicHoliday | null;
}): JobDayMark {
  const weekend = input.weekday >= 6;
  const worked =
    input.workKind === "home" || input.workKind === "office"
      ? input.workKind
      : null;

  if (worked) {
    return {
      mark: WORK_KIND_ICON[worked],
      mode: "icon",
      title: withContext(WORK_KIND_LABEL[worked], input.holiday, weekend),
    };
  }
  if (input.leave) {
    return {
      mark: LEAVE_KIND_ICON[input.leave.kind],
      mode: "icon",
      title: withContext(leavePeriodLabel(input.leave), input.holiday, weekend),
    };
  }
  if (input.workKind === "sick" || input.workKind === "off") {
    return {
      mark: WORK_KIND_ICON[input.workKind],
      mode: "icon",
      title: withContext(
        WORK_KIND_LABEL[input.workKind],
        input.holiday,
        weekend,
      ),
    };
  }
  if (input.holiday) {
    return {
      mark: input.holiday.short,
      mode: "holiday",
      title: input.holiday.name,
    };
  }
  if (weekend) {
    return { mark: "Helg", mode: "word", title: "Helg" };
  }
  if (!input.isFuture) {
    return { mark: "·", mode: "missing", title: "Ej ifylld" };
  }
  return { mark: null, mode: "blank", title: "Kommande" };
}
