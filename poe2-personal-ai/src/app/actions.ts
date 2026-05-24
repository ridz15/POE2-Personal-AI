"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

function optionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function addWatchedItem(formData: FormData) {
  const itemName = String(formData.get("item_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const maxRisk = String(formData.get("max_risk") ?? "").trim();

  if (!itemName) {
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO watched_items (item_name, notes, target_price, max_risk)
       VALUES (@itemName, @notes, @targetPrice, @maxRisk)
       ON CONFLICT(item_name) DO UPDATE SET
         notes = excluded.notes,
         target_price = excluded.target_price,
         max_risk = excluded.max_risk,
         active = 1,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run({
      itemName,
      notes: notes || null,
      targetPrice: optionalNumber(formData.get("target_price")),
      maxRisk: maxRisk || null,
    });

  revalidatePath("/watched-items");
  revalidatePath("/");
}

export async function toggleWatchedItem(formData: FormData) {
  const id = Number(formData.get("id"));
  const active = Number(formData.get("active")) ? 0 : 1;

  if (!Number.isInteger(id)) {
    return;
  }

  getDb()
    .prepare(
      `UPDATE watched_items
       SET active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(active, id);

  revalidatePath("/watched-items");
  revalidatePath("/");
}

export async function deleteWatchedItem(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id)) {
    return;
  }

  getDb().prepare("DELETE FROM watched_items WHERE id = ?").run(id);

  revalidatePath("/watched-items");
  revalidatePath("/");
}
