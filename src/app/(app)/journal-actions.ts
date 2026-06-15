"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY_LEN = 2000;

function validateBody(body: string): ActionResult & { value?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Skriv något i anteckningen." };
  if (trimmed.length > MAX_BODY_LEN) {
    return { ok: false, error: `Max ${MAX_BODY_LEN} tecken.` };
  }
  return { ok: true, value: trimmed };
}

export async function addJournalEntryAction(input: {
  localDate: string;
  body: string;
}): Promise<ActionResult> {
  if (!ISO_DATE_RE.test(input.localDate)) {
    return { ok: false, error: "Ogiltigt datum." };
  }

  const validated = validateBody(input.body);
  if (!validated.ok) return validated;
  const body = validated.value!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase.from("journal_entries").insert({
    user_id: user.id,
    local_date: input.localDate,
    body,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateJournalEntryAction(input: {
  id: string;
  body: string;
}): Promise<ActionResult> {
  if (!input.id) return { ok: false, error: "Saknar id." };

  const validated = validateBody(input.body);
  if (!validated.ok) return validated;
  const body = validated.value!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("journal_entries")
    .update({ body })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteJournalEntryAction(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Saknar id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inte inloggad." };

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
