import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getDb } from "../src/lib/db";

const snapshotSchema = z.object({
  item_name: z.string().optional(),
  itemName: z.string().optional(),
  name: z.string().optional(),
  league: z.string().optional(),
  price: z.coerce.number(),
  currency: z.string().default("divine"),
  liquidity: z.string().optional(),
  listings: z.coerce.number().int().optional(),
  source: z.string().optional(),
  snapshot_time: z.string().optional(),
  snapshotTime: z.string().optional(),
});

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run db:import -- <path-to-market-snapshot.json>");
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), filePath);
const parsedJson = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
const rows = Array.isArray(parsedJson)
  ? parsedJson
  : Array.isArray((parsedJson as { snapshots?: unknown[] }).snapshots)
    ? (parsedJson as { snapshots: unknown[] }).snapshots
    : Array.isArray((parsedJson as { items?: unknown[] }).items)
      ? (parsedJson as { items: unknown[] }).items
      : [parsedJson];

const db = getDb();
const insert = db.prepare(`
  INSERT INTO market_snapshots (
    item_name, league, price, currency, liquidity, listings, source, snapshot_time, raw_json
  ) VALUES (
    @itemName, @league, @price, @currency, @liquidity, @listings, @source, @snapshotTime, @rawJson
  )
`);

const importRows = db.transaction((values: unknown[]) => {
  let count = 0;

  for (const value of values) {
    const snapshot = snapshotSchema.parse(value);
    const itemName = snapshot.item_name ?? snapshot.itemName ?? snapshot.name;

    if (!itemName) {
      throw new Error("Snapshot row is missing item_name, itemName, or name.");
    }

    insert.run({
      itemName,
      league: snapshot.league ?? null,
      price: snapshot.price,
      currency: snapshot.currency,
      liquidity: snapshot.liquidity ?? null,
      listings: snapshot.listings ?? null,
      source: snapshot.source ?? "manual-json",
      snapshotTime:
        snapshot.snapshot_time ?? snapshot.snapshotTime ?? new Date().toISOString(),
      rawJson: JSON.stringify(value),
    });
    count += 1;
  }

  return count;
});

const imported = importRows(rows);
console.log(`Imported ${imported} market snapshot row(s).`);
