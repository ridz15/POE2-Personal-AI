import OpenAI from "openai";
import { z } from "zod";
import { getDb, getPriceHistoryForItem, getWatchedItems } from "@/lib/db";

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
    current_price: { type: "number" },
    price_trend: { type: "string", enum: ["up", "down", "flat", "volatile", "unknown"] },
    liquidity: { type: "string", enum: ["high", "medium", "low", "unknown"] },
    flip_score: { type: "number", minimum: 0, maximum: 100 },
    risk: { type: "string", enum: ["low", "medium", "high", "unknown"] },
    recommendation: { type: "string" },
    reasoning: { type: "string" },
  },
  required: [
    "item_name",
    "current_price",
    "price_trend",
    "liquidity",
    "flip_score",
    "risk",
    "recommendation",
    "reasoning",
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
  const targets = itemName
    ? [itemName]
    : getWatchedItems()
        .filter((item) => item.active)
        .map((item) => item.item_name);

  if (targets.length === 0) {
    return Response.json(
      { error: "No item_name was provided and no active watched items exist." },
      { status: 400 },
    );
  }

  const histories = targets.map((target) => ({
    item_name: target,
    price_history: getPriceHistoryForItem(target),
  }));

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
          "You analyze Path of Exile 2 market history for a personal assistant. Return cautious structured JSON only. Do not recommend automation, auto-buying, auto-whispering, scraping abuse, or trade bot behavior.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Analyze watched item price history for market flipping and crafting workflow awareness.",
          output_contract:
            "Return one report per item. The recommendation must be manual decision support only.",
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
    reports: Array<{ item_name: string }>;
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
