import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  isMediaCompleted,
  yearFromLocalISO,
  type DailyMediaContext,
  type MediaItem,
  type MediaKind,
  type YearMediaContext,
} from "@/lib/media";

interface ItemRow {
  id: string;
  year: number;
  kind: string;
  title: string;
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
    .select("id, year, kind, title, note, rating, total_length, sort_order")
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

  const dayLog =
    dayRow && activeItems.some((item) => item.id === dayRow.media_item_id)
      ? {
          mediaItemId: dayRow.media_item_id,
          position: dayRow.position,
          didConsume: dayRow.did_consume,
        }
      : null;

  return {
    localDate,
    year,
    items: activeItems,
    dayLog,
    allCompleted: items.length > 0 && activeItems.length === 0,
  };
}
