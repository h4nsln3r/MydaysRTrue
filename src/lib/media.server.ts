import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isMediaCompleted,
  yearFromLocalISO,
  type DailyMediaContext,
  type MediaItem,
  type MediaKind,
  type MonthMediaContext,
  type MonthMediaEntry,
  type YearMediaContext,
} from "@/lib/media";

interface ItemRow {
  id: string;
  year: number;
  kind: string;
  title: string;
  author: string | null;
  director: string | null;
  actors: string | null;
  note: string | null;
  rating: number | null;
  total_length: number | null;
  sort_order: number;
}

interface LogStat {
  media_item_id: string;
  position: number;
  local_date: string;
}

async function logStatsForItems(
  userId: string,
  itemIds: string[],
): Promise<Map<string, { bestPosition: number; lastActivityDate: string | null }>> {
  if (itemIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("media_daily_logs")
    .select("media_item_id, position, local_date")
    .eq("user_id", userId)
    .in("media_item_id", itemIds);

  const map = new Map<string, { bestPosition: number; lastActivityDate: string | null }>();
  for (const row of (data ?? []) as LogStat[]) {
    const prev = map.get(row.media_item_id) ?? {
      bestPosition: 0,
      lastActivityDate: null,
    };
    map.set(row.media_item_id, {
      bestPosition: Math.max(prev.bestPosition, row.position),
      lastActivityDate:
        !prev.lastActivityDate || row.local_date > prev.lastActivityDate
          ? row.local_date
          : prev.lastActivityDate,
    });
  }
  return map;
}

function rowToItem(
  r: ItemRow,
  stats: { bestPosition: number; lastActivityDate: string | null },
): MediaItem {
  const item: MediaItem = {
    id: r.id,
    year: r.year,
    kind: r.kind as MediaKind,
    title: r.title,
    author: r.author,
    director: r.director,
    actors: r.actors,
    note: r.note,
    rating: r.rating,
    totalLength: r.total_length,
    sortOrder: r.sort_order,
    bestPosition: stats.bestPosition,
    lastActivityDate: stats.lastActivityDate,
    completed: false,
  };
  item.completed = isMediaCompleted(item);
  return item;
}

export async function getYearMedia(
  userId: string,
  year: number,
): Promise<YearMediaContext> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media_items")
    .select(
      "id, year, kind, title, author, director, actors, note, rating, total_length, sort_order",
    )
    .eq("user_id", userId)
    .eq("year", year)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = data ?? [];
  const stats = await logStatsForItems(
    userId,
    rows.map((r) => r.id),
  );

  return {
    year,
    items: rows.map((r) =>
      rowToItem(r, stats.get(r.id) ?? { bestPosition: 0, lastActivityDate: null }),
    ),
  };
}

export async function getDailyMedia(
  userId: string,
  localDate: string,
): Promise<DailyMediaContext> {
  const year = yearFromLocalISO(localDate);
  const { items } = await getYearMedia(userId, year);
  const activeItems = items.filter((item) => !item.completed);

  const supabase = await createClient();
  const { data: dayRow } = await supabase
    .from("media_daily_logs")
    .select("media_item_id, position, did_consume")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  const dayLog = dayRow
    ? {
        mediaItemId: dayRow.media_item_id,
        position: dayRow.position,
        didConsume: dayRow.did_consume,
      }
    : null;

  const loggedItem = dayRow
    ? items.find((item) => item.id === dayRow.media_item_id) ?? null
    : null;

  return {
    localDate,
    year,
    items: activeItems,
    dayLog,
    loggedItem,
    allCompleted: items.length > 0 && activeItems.length === 0,
  };
}

function monthEndFromStart(monthStart: string): string {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

export async function getMonthMedia(
  userId: string,
  monthStart: string,
): Promise<MonthMediaContext> {
  const monthEnd = monthEndFromStart(monthStart);

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("media_daily_logs")
    .select("local_date, media_item_id, position, did_consume")
    .eq("user_id", userId)
    .gte("local_date", monthStart)
    .lte("local_date", monthEnd)
    .order("local_date", { ascending: true });

  const logRows = logs ?? [];
  if (logRows.length === 0) {
    return { monthStart, entries: [] };
  }

  const itemIds = [...new Set(logRows.map((r) => r.media_item_id))];
  const { data: itemRows } = await supabase
    .from("media_items")
    .select(
      "id, year, kind, title, author, director, actors, note, rating, total_length, sort_order",
    )
    .eq("user_id", userId)
    .in("id", itemIds)
    .is("archived_at", null);

  const stats = await logStatsForItems(userId, itemIds);
  const itemById = new Map(
    (itemRows ?? []).map((r) => [
      r.id,
      rowToItem(r, stats.get(r.id) ?? { bestPosition: 0, lastActivityDate: null }),
    ]),
  );

  const entries: MonthMediaEntry[] = [];
  for (const row of logRows) {
    const item = itemById.get(row.media_item_id);
    if (!item) continue;
    if (!row.did_consume && row.position <= 0) continue;
    entries.push({
      localDate: row.local_date,
      item,
      position: row.position,
      didConsume: row.did_consume,
    });
  }

  return { monthStart, entries };
}
