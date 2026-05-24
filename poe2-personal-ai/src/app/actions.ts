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
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!itemName) {
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO watched_items (
        item_name, category, notes, target_buy_price, target_sell_price, active
       )
       VALUES (
        @itemName, @category, @notes, @targetBuyPrice, @targetSellPrice, @active
       )
       ON CONFLICT(item_name) DO UPDATE SET
         category = excluded.category,
         notes = excluded.notes,
         target_buy_price = excluded.target_buy_price,
         target_sell_price = excluded.target_sell_price,
         active = 1,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run({
      itemName,
      category: category || null,
      notes: notes || null,
      targetBuyPrice: optionalNumber(formData.get("target_buy_price")),
      targetSellPrice: optionalNumber(formData.get("target_sell_price")),
      active: 1,
    });

  revalidatePath("/watched-items");
  revalidatePath("/snapshots");
  revalidatePath("/");
}

export async function updateWatchedItem(formData: FormData) {
  const id = Number(formData.get("id"));
  const itemName = String(formData.get("item_name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const active = formData.get("active") === "on" ? 1 : 0;

  if (!Number.isInteger(id) || !itemName) {
    return;
  }

  getDb()
    .prepare(
      `UPDATE watched_items
       SET item_name = @itemName,
           category = @category,
           notes = @notes,
           target_buy_price = @targetBuyPrice,
           target_sell_price = @targetSellPrice,
           active = @active,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = @id`,
    )
    .run({
      id,
      itemName,
      category: category || null,
      notes: notes || null,
      targetBuyPrice: optionalNumber(formData.get("target_buy_price")),
      targetSellPrice: optionalNumber(formData.get("target_sell_price")),
      active,
    });

  revalidatePath("/watched-items");
  revalidatePath("/snapshots");
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
  revalidatePath("/snapshots");
  revalidatePath("/");
}

export async function deleteWatchedItem(formData: FormData) {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id)) {
    return;
  }

  getDb().prepare("DELETE FROM watched_items WHERE id = ?").run(id);

  revalidatePath("/watched-items");
  revalidatePath("/snapshots");
  revalidatePath("/");
}
