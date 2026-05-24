import { getDb } from "../src/lib/db";

export type RawSnapshotRow = Record<string, unknown>;

export type ImportSummary = {
  imported: number;
  skipped: number;
  errors: string[];
};

function readString(row: RawSnapshotRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) {
      const text = String(value).trim();
      if (text !== "") {
        return text;
      }
    }
  }

  return null;
}

function readNumber(row: RawSnapshotRow, keys: string[]) {
  const rawValue = readString(row, keys);
  if (rawValue === null) {
    return null;
  }

  const normalized = rawValue.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function readInteger(row: RawSnapshotRow, keys: string[]) {
  const value = readNumber(row, keys);
  if (value === null || Number.isNaN(value)) {
    return value;
  }

  return Math.trunc(value);
}

function readSnapshotTime(row: RawSnapshotRow) {
  const value = readString(row, ["snapshot_time", "snapshotTime"]);
  if (!value) {
    return new Date().toISOString();
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

export function importSnapshotRows(
  rows: RawSnapshotRow[],
  options: { defaultSource: string },
): ImportSummary {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO market_snapshots (
      item_name, category, price, currency, quantity_available, listings_count,
      min_price, max_price, median_price, snapshot_time, source, notes, raw_json
    ) VALUES (
      @itemName, @category, @price, @currency, @quantityAvailable, @listingsCount,
      @minPrice, @maxPrice, @medianPrice, @snapshotTime, @source, @notes, @rawJson
    )
  `);

  const summary: ImportSummary = { imported: 0, skipped: 0, errors: [] };
  const validRows: Array<Record<string, unknown>> = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const itemName = readString(row, ["item_name", "itemName", "name"]);
    const price = readNumber(row, ["price"]);
    const snapshotTime = readSnapshotTime(row);
    const rowErrors: string[] = [];

    if (!itemName) {
      rowErrors.push("item_name is required");
    }

    if (price === null || Number.isNaN(price)) {
      rowErrors.push("price must be a valid number");
    } else if (price < 0) {
      rowErrors.push("price cannot be negative");
    }

    if (snapshotTime === null) {
      rowErrors.push("snapshot_time is invalid");
    }

    const quantityAvailable = readInteger(row, [
      "quantity_available",
      "quantityAvailable",
    ]);
    const listingsCount = readInteger(row, ["listings_count", "listingsCount", "listings"]);
    const minPrice = readNumber(row, ["min_price", "minPrice"]);
    const maxPrice = readNumber(row, ["max_price", "maxPrice"]);
    const medianPrice = readNumber(row, ["median_price", "medianPrice"]);

    for (const [label, value] of [
      ["quantity_available", quantityAvailable],
      ["listings_count", listingsCount],
      ["min_price", minPrice],
      ["max_price", maxPrice],
      ["median_price", medianPrice],
    ] as const) {
      if (Number.isNaN(value)) {
        rowErrors.push(`${label} must be a valid number when provided`);
      } else if (typeof value === "number" && value < 0) {
        rowErrors.push(`${label} cannot be negative`);
      }
    }

    if (rowErrors.length) {
      summary.skipped += 1;
      summary.errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
      return;
    }

    validRows.push({
      itemName,
      category: readString(row, ["category"]),
      price,
      currency: readString(row, ["currency"]) ?? "divine",
      quantityAvailable,
      listingsCount,
      minPrice: minPrice ?? price,
      maxPrice: maxPrice ?? price,
      medianPrice: medianPrice ?? price,
      snapshotTime,
      source: readString(row, ["source"]) ?? options.defaultSource,
      notes: readString(row, ["notes"]),
      rawJson: JSON.stringify(row),
    });
  });

  const importRows = db.transaction((values: Array<Record<string, unknown>>) => {
    for (const value of values) {
      insert.run(value);
    }
  });

  importRows(validRows);
  summary.imported = validRows.length;

  return summary;
}

export function printImportSummary(summary: ImportSummary) {
  for (const error of summary.errors) {
    console.error(error);
  }

  console.log(
    `Import summary: ${summary.imported} imported, ${summary.skipped} skipped.`,
  );
}
