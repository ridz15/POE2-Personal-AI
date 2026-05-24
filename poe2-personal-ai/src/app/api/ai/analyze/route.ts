import OpenAI from "openai";
import { z } from "zod";
import { getDb, getPriceHistoryForItem, getWatchedItems } from "@/lib/db";
import { analyzeMarket } from "@/lib/market-analysis";

export const runtime = "nodejs";

const requestSchema = z.object({
  item_name: z.string().optional(),
  itemName: z.string().optional(),
});

const reportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    item_name: { type: "string" },
    summary: { type: "string" },
    recommendation: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    key_reasons: {
      type: "array",
      items: { type: "string" },
    },
    risk: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    suggested_action: { type: "string" },
    missing_data: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "item_name",
    "summary",
    "recommendation",
    "confidence",
    "key_reasons",
    "risk",
    "suggested_action",
    "missing_data",
  ],
};

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openai;
}

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json().catch(() => ({})));
  const itemName = body.item_name ?? body.itemName;
  const watchedItems = getWatchedItems();
  const targets = itemName
    ? [itemName]
    : watchedItems
        .filter((item) => item.active)
        .map((item) => item.item_name);

  if (targets.length === 0) {
    return Response.json(
      { error: "No item_name was provided and no active watched items exist." },
      { status: 400 },
    );
  }

  const histories = targets.map((target) => {
    const watchedItem =
      watchedItems.find((item) => item.item_name === target) ?? {
        item_name: target,
        target_buy_price: null,
        target_sell_price: null,
      };
    const priceHistory = getPriceHistoryForItem(target);

    return {
      item_name: target,
      watched_item: watchedItem,
      deterministic_analysis: analyzeMarket(watchedItem, priceHistory),
      latest_snapshot: priceHistory.at(-1) ?? null,
      price_history: priceHistory,
    };
  });

  const missingHistory = histories.filter((history) => history.price_history.length === 0);
  if (missingHistory.length === histories.length) {
    return Response.json(
      { error: "No market snapshot history found for the requested item(s)." },
      { status: 404 },
    );
  }

  const completion = await getOpenAI().responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-5.2",
    input: [
      {
        role: "system",
        content:
          "You explain Path of Exile 2 market analysis for a manual analyst tool. Use deterministic_analysis, latest_snapshot, watched_item targets/notes, and price_history as the only source of truth. Do not invent or alter prices, market history, reason codes, confidence, or recommendation. Do not recommend automated buying, auto-whisper, scraping abuse, or trade bot behavior. If data is not enough, say data is not enough. Return structured JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Analyze watched item price history for market flipping and crafting workflow awareness.",
          output_contract:
            "Return one report per item. Explain the deterministic result in human terms for manual review only.",
          histories,
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "poe2_market_reports",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            reports: {
              type: "array",
              items: reportSchema,
            },
          },
          required: ["reports"],
        },
      },
    },
  });

  const parsed = JSON.parse(completion.output_text) as {
    reports: Array<{
      item_name: string;
      summary: string;
      recommendation: string;
      confidence: number;
      key_reasons: string[];
      risk: string;
      suggested_action: string;
      missing_data: string[];
    }>;
  };

  const insertReport = getDb().prepare(
    `INSERT INTO ai_reports (item_name, report_json)
     VALUES (?, ?)`,
  );

  const saveReports = getDb().transaction((reports: Array<{ item_name: string }>) => {
    for (const report of reports) {
      insertReport.run(report.item_name, JSON.stringify(report));
    }
  });

  saveReports(parsed.reports);

  return Response.json(parsed);
}
