import fs from "node:fs";
import path from "node:path";
import { importSnapshotRows, printImportSummary } from "./market-import-utils";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: npm run db:import:csv -- <path-to-market-snapshot.csv>");
  process.exit(1);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && isQuoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === "," && !isQuoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content: string) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

const absolutePath = path.resolve(process.cwd(), filePath);
const rows = parseCsv(fs.readFileSync(absolutePath, "utf8"));
const summary = importSnapshotRows(rows, { defaultSource: "manual-csv" });
printImportSummary(summary);
