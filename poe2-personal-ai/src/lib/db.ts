import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type Db = Database.Database;

let db: Db | null = null;

export type WatchedItem = {
  id: number;
  item_name: string;
  category: string | null;
  notes: string | null;
  target_buy_price: number | null;
  target_sell_price: number | null;
  active: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type MarketSnapshot = {
  id: number;
  item_name: string;
  category: string | null;
  league: string | null;
  price: number;
  currency: string;
  quantity_available: number | null;
  listings_count: number | null;
  min_price: number | null;
  max_price: number | null;
  median_price: number | null;
  source: string | null;
  notes: string | null;
  snapshot_time: string;
  created_at: string;
};

export type LatestWatchedSnapshot = WatchedItem & {
  snapshot_id: number | null;
  price: number | null;
  currency: string | null;
  quantity_available: number | null;
  listings_count: number | null;
  min_price: number | null;
  max_price: number | null;
  median_price: number | null;
  source: string | null;
  notes: string | null;
  snapshot_time: string | null;
};

export function getDb() {
  if (!db) {
    const dataDir = path.join(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(path.join(dataDir, "poe2-personal-ai.sqlite"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeSchema(db);
  }

  return db;
}

export function initializeSchema(database = getDb()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS watched_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL UNIQUE,
      category TEXT,
      notes TEXT,
      target_price REAL,
      target_buy_price REAL,
      target_sell_price REAL,
      max_risk TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT,
      league TEXT,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'divine',
      liquidity TEXT,
      listings INTEGER,
      quantity_available INTEGER,
      listings_count INTEGER,
      min_price REAL,
      max_price REAL,
      median_price REAL,
      source TEXT,
      notes TEXT,
      snapshot_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      raw_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_market_snapshots_item_time
      ON market_snapshots (item_name, snapshot_time);

    CREATE TABLE IF NOT EXISTS poe_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  migrateSchema(database);
}

function migrateSchema(database: Db) {
  const columnsFor = (table: string) =>
    new Set(
      (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );

  const watchedColumns = columnsFor("watched_items");
  const watchedMigrations = [
    ["category", "ALTER TABLE watched_items ADD COLUMN category TEXT"],
    ["target_buy_price", "ALTER TABLE watched_items ADD COLUMN target_buy_price REAL"],
    ["target_sell_price", "ALTER TABLE watched_items ADD COLUMN target_sell_price REAL"],
  ] as const;

  for (const [column, statement] of watchedMigrations) {
    if (!watchedColumns.has(column)) {
      database.exec(statement);
    }
  }

  database.exec(`
    UPDATE watched_items
    SET target_buy_price = COALESCE(target_buy_price, target_price)
    WHERE target_price IS NOT NULL;
  `);

  const snapshotColumns = columnsFor("market_snapshots");
  const snapshotMigrations = [
    ["category", "ALTER TABLE market_snapshots ADD COLUMN category TEXT"],
    [
      "quantity_available",
      "ALTER TABLE market_snapshots ADD COLUMN quantity_available INTEGER",
    ],
    ["listings_count", "ALTER TABLE market_snapshots ADD COLUMN listings_count INTEGER"],
    ["min_price", "ALTER TABLE market_snapshots ADD COLUMN min_price REAL"],
    ["max_price", "ALTER TABLE market_snapshots ADD COLUMN max_price REAL"],
    ["median_price", "ALTER TABLE market_snapshots ADD COLUMN median_price REAL"],
    ["notes", "ALTER TABLE market_snapshots ADD COLUMN notes TEXT"],
  ] as const;

  for (const [column, statement] of snapshotMigrations) {
    if (!snapshotColumns.has(column)) {
      database.exec(statement);
    }
  }

  database.exec(`
    UPDATE market_snapshots
    SET listings_count = COALESCE(listings_count, listings)
    WHERE listings IS NOT NULL;

    UPDATE market_snapshots
    SET median_price = COALESCE(median_price, price),
        min_price = COALESCE(min_price, price),
        max_price = COALESCE(max_price, price)
    WHERE price IS NOT NULL;
  `);
}

export function getWatchedItems() {
  return getDb()
    .prepare(
      `SELECT id, item_name, category, notes, target_buy_price, target_sell_price, active, created_at, updated_at
       FROM watched_items
       ORDER BY active DESC, item_name ASC`,
    )
    .all() as WatchedItem[];
}

export function getRecentSnapshots(limit = 100) {
  return getDb()
    .prepare(
      `SELECT id, item_name, category, league, price, currency, quantity_available, listings_count, min_price, max_price, median_price, source, notes, snapshot_time, created_at
       FROM market_snapshots
       ORDER BY datetime(snapshot_time) DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as MarketSnapshot[];
}

export function getSnapshotSummary() {
  return getDb()
    .prepare(
      `SELECT
        item_name,
        COUNT(*) as sample_count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        AVG(price) as avg_price,
        (SELECT price FROM market_snapshots latest
          WHERE latest.item_name = market_snapshots.item_name
          ORDER BY datetime(snapshot_time) DESC, id DESC
          LIMIT 1) as current_price,
        MAX(snapshot_time) as last_seen
       FROM market_snapshots
       GROUP BY item_name
       ORDER BY datetime(last_seen) DESC, item_name ASC`,
    )
    .all() as Array<{
    item_name: string;
    sample_count: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    current_price: number;
    last_seen: string;
  }>;
}

export function getPriceHistoryForItem(itemName: string) {
  return getDb()
    .prepare(
      `SELECT id, item_name, category, league, price, currency, quantity_available, listings_count, min_price, max_price, median_price, source, notes, snapshot_time, created_at
       FROM market_snapshots
       WHERE item_name = ?
       ORDER BY datetime(snapshot_time) ASC, id ASC`,
    )
    .all(itemName) as MarketSnapshot[];
}

export function getLatestSnapshotsForWatchedItems() {
  return getDb()
    .prepare(
      `SELECT
        watched_items.id,
        watched_items.item_name,
        watched_items.category,
        watched_items.notes,
        watched_items.target_buy_price,
        watched_items.target_sell_price,
        watched_items.active,
        watched_items.created_at,
        watched_items.updated_at,
        latest.id as snapshot_id,
        latest.price,
        latest.currency,
        latest.quantity_available,
        latest.listings_count,
        latest.min_price,
        latest.max_price,
        latest.median_price,
        latest.source,
        latest.notes,
        latest.snapshot_time
       FROM watched_items
       LEFT JOIN market_snapshots latest
         ON latest.id = (
          SELECT id
          FROM market_snapshots
          WHERE market_snapshots.item_name = watched_items.item_name
          ORDER BY datetime(snapshot_time) DESC, id DESC
          LIMIT 1
        )
       ORDER BY watched_items.active DESC, watched_items.item_name ASC`,
    )
    .all() as LatestWatchedSnapshot[];
}

export function getWatchedItemByName(itemName: string) {
  return getDb()
    .prepare(
      `SELECT id, item_name, category, notes, target_buy_price, target_sell_price, active, created_at, updated_at
       FROM watched_items
       WHERE item_name = ?`,
    )
    .get(itemName) as WatchedItem | undefined;
}
