import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type Db = Database.Database;

let db: Db | null = null;

export type WatchedItem = {
  id: number;
  item_name: string;
  notes: string | null;
  target_price: number | null;
  max_risk: string | null;
  active: 0 | 1;
  created_at: string;
  updated_at: string;
};

export type MarketSnapshot = {
  id: number;
  item_name: string;
  league: string | null;
  price: number;
  currency: string;
  liquidity: string | null;
  listings: number | null;
  source: string | null;
  snapshot_time: string;
  created_at: string;
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
      notes TEXT,
      target_price REAL,
      max_risk TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS market_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      league TEXT,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'divine',
      liquidity TEXT,
      listings INTEGER,
      source TEXT,
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
}

export function getWatchedItems() {
  return getDb()
    .prepare(
      `SELECT id, item_name, notes, target_price, max_risk, active, created_at, updated_at
       FROM watched_items
       ORDER BY active DESC, item_name ASC`,
    )
    .all() as WatchedItem[];
}

export function getRecentSnapshots(limit = 100) {
  return getDb()
    .prepare(
      `SELECT id, item_name, league, price, currency, liquidity, listings, source, snapshot_time, created_at
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
      `SELECT item_name, league, price, currency, liquidity, listings, source, snapshot_time, created_at
       FROM market_snapshots
       WHERE item_name = ?
       ORDER BY datetime(snapshot_time) ASC, id ASC`,
    )
    .all(itemName) as MarketSnapshot[];
}
