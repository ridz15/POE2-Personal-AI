import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";

const snapshotSchema = z.object({
  item_name: z.string().optional(),
  itemName: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  league: z.string().optional(),
  price: z.coerce.number(),
  currency: z.string().default("divine"),
  listings: z.coerce.number().int().optional(),
  listings_count: z.coerce.number().int().optional(),
  listingsCount: z.coerce.number().int().optional(),
  quantity_available: z.coerce.number().int().optional(),
  quantityAvailable: z.coerce.number().int().optional(),
  min_price: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  max_price: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  median_price: z.coerce.number().optional(),
  medianPrice: z.coerce.number().optional(),
  source: z.string().optional(),
  snapshot_time: z.string().optional(),
  snapshotTime: z.string().optional(),
});

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
const insert = db.prepare(`
  INSERT INTO market_snapshots (
    item_name, category, league, price, currency, quantity_available, listings_count,
    min_price, max_price, median_price, source, snapshot_time, raw_json
  ) VALUES (
    @itemName, @category, @league, @price, @currency, @quantityAvailable,
    @listingsCount, @minPrice, @maxPrice, @medianPrice, @source, @snapshotTime, @rawJson
  )
`);

const importRows = db.transaction((values: unknown[], watchedValues: unknown[]) => {
  let snapshotCount = 0;
  let watchedCount = 0;

  for (const value of watchedValues) {
    const watchedItem = watchedItemSchema.parse(value);
    const itemName = watchedItem.item_name ?? watchedItem.itemName ?? watchedItem.name;

    if (!itemName) {
      throw new Error("Watched item row is missing item_name, itemName, or name.");
    }

    insertWatchedItem.run({
      itemName,
      category: watchedItem.category ?? null,
      targetBuyPrice: watchedItem.target_buy_price ?? watchedItem.targetBuyPrice ?? null,
      targetSellPrice: watchedItem.target_sell_price ?? watchedItem.targetSellPrice ?? null,
      notes: watchedItem.notes ?? null,
      active: watchedItem.active ? 1 : 0,
    });
    watchedCount += 1;
  }

  for (const value of values) {
    const snapshot = snapshotSchema.parse(value);
    const itemName = snapshot.item_name ?? snapshot.itemName ?? snapshot.name;

    if (!itemName) {
      throw new Error("Snapshot row is missing item_name, itemName, or name.");
    }

    insert.run({
      itemName,
      category: snapshot.category ?? null,
      league: snapshot.league ?? null,
      price: snapshot.price,
      currency: snapshot.currency,
      quantityAvailable:
        snapshot.quantity_available ?? snapshot.quantityAvailable ?? snapshot.listings ?? null,
      listingsCount:
        snapshot.listings_count ?? snapshot.listingsCount ?? snapshot.listings ?? null,
      minPrice: snapshot.min_price ?? snapshot.minPrice ?? snapshot.price,
      maxPrice: snapshot.max_price ?? snapshot.maxPrice ?? snapshot.price,
      medianPrice: snapshot.median_price ?? snapshot.medianPrice ?? snapshot.price,
      source: snapshot.source ?? "manual-json",
      snapshotTime:
        snapshot.snapshot_time ?? snapshot.snapshotTime ?? new Date().toISOString(),
      rawJson: JSON.stringify(value),
    });
    snapshotCount += 1;
  }

  return { snapshotCount, watchedCount };
});

const imported = importRows(rows, watchedRows);
console.log(
  `Imported ${imported.watchedCount} watched item(s) and ${imported.snapshotCount} market snapshot row(s).`,
);
