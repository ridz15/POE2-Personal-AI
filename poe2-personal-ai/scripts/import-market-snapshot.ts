import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { importSnapshotRows, printImportSummary } from "./market-import-utils";

const watchedItemSchema = z.object({
  item_name: z.string().optional(),
  itemName: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  target_buy_price: z.coerce.number().optional(),
  targetBuyPrice: z.coerce.number().optional(),
  target_sell_price: z.coerce.number().optional(),
  targetSellPrice: z.coerce.number().optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run db:import -- <path-to-market-snapshot.json>");
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), filePath);
const parsedJson = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
const watchedRows = Array.isArray((parsedJson as { watched_items?: unknown[] }).watched_items)
  ? (parsedJson as { watched_items: unknown[] }).watched_items
  : Array.isArray((parsedJson as { watchedItems?: unknown[] }).watchedItems)
    ? (parsedJson as { watchedItems: unknown[] }).watchedItems
    : [];
const rows = Array.isArray(parsedJson)
  ? parsedJson
  : Array.isArray((parsedJson as { snapshots?: unknown[] }).snapshots)
    ? (parsedJson as { snapshots: unknown[] }).snapshots
    : Array.isArray((parsedJson as { items?: unknown[] }).items)
      ? (parsedJson as { items: unknown[] }).items
      : [parsedJson];

const db = getDb();
const insertWatchedItem = db.prepare(`
  INSERT INTO watched_items (
    item_name, category, target_buy_price, target_sell_price, notes, active
  ) VALUES (
    @itemName, @category, @targetBuyPrice, @targetSellPrice, @notes, @active
  )
  ON CONFLICT(item_name) DO UPDATE SET
    category = excluded.category,
    target_buy_price = excluded.target_buy_price,
    target_sell_price = excluded.target_sell_price,
    notes = excluded.notes,
    active = excluded.active,
    updated_at = CURRENT_TIMESTAMP
`);

const importWatchedItems = db.transaction((watchedValues: unknown[]) => {
  let watchedCount = 0;

  for (const value of watchedValues) {
    const rowNumber = watchedCount + 1;
    const parsed = watchedItemSchema.safeParse(value);

    if (!parsed.success) {
      console.error(`Watched item row ${rowNumber}: invalid watched item data.`);
      continue;
    }

    const watchedItem = parsed.data;
    const itemName = watchedItem.item_name ?? watchedItem.itemName ?? watchedItem.name;

    if (!itemName?.trim()) {
      console.error(`Watched item row ${rowNumber}: item_name is required.`);
      continue;
    }

    insertWatchedItem.run({
      itemName: itemName.trim(),
      category: watchedItem.category ?? null,
      targetBuyPrice: watchedItem.target_buy_price ?? watchedItem.targetBuyPrice ?? null,
      targetSellPrice: watchedItem.target_sell_price ?? watchedItem.targetSellPrice ?? null,
      notes: watchedItem.notes ?? null,
      active: watchedItem.active ? 1 : 0,
    });
    watchedCount += 1;
  }

  return watchedCount;
});

const watchedCount = importWatchedItems(watchedRows);
const snapshotSummary = importSnapshotRows(rows as Record<string, unknown>[], {
  defaultSource: "manual-json",
});

console.log(`Imported ${watchedCount} watched item(s).`);
printImportSummary(snapshotSummary);
