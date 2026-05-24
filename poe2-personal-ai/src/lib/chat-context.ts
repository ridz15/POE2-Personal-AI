import {
  getPriceHistoryForItem,
  getWatchedItems,
  type MarketSnapshot,
  type WatchedItem,
} from "@/lib/db";
import { analyzeMarket, type MarketAnalysis } from "@/lib/market-analysis";

export type ChatContextItem = {
  watched_item: WatchedItem;
  latest_snapshot: MarketSnapshot | null;
  analysis: MarketAnalysis;
  price_history: MarketSnapshot[];
};

function riskRank(risk: MarketAnalysis["volatility_risk"]) {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  if (risk === "low") return 1;
  return 0;
}

export function selectChatContext(message: string) {
  const normalized = message.toLowerCase();
  const watchedItems = getWatchedItems();
  const allItems = watchedItems.map((item) => {
    const priceHistory = getPriceHistoryForItem(item.item_name);
    return {
      watched_item: item,
      latest_snapshot: priceHistory.at(-1) ?? null,
      analysis: analyzeMarket(item, priceHistory),
      price_history: priceHistory,
    };
  });

  const mentionedItems = allItems.filter((item) =>
    normalized.includes(item.watched_item.item_name.toLowerCase()),
  );

  if (mentionedItems.length > 0) {
    return {
      mode: "mentioned-item",
      items: mentionedItems,
    };
  }

  if (
    normalized.includes("best opportunity") ||
    normalized.includes("best flip") ||
    normalized.includes("paling worth") ||
    normalized.includes("opportunity") ||
    normalized.includes("peluang")
  ) {
    return {
      mode: "best-opportunity",
      items: [...allItems].sort(
        (a, b) => b.analysis.flip_score - a.analysis.flip_score,
      ),
    };
  }

  if (
    normalized.includes("target buy") ||
    normalized.includes("kena target buy") ||
    normalized.includes("below target")
  ) {
    return {
      mode: "target-buy-hit",
      items: allItems.filter((item) => item.analysis.target_buy_hit),
    };
  }

  if (
    normalized.includes("risk") ||
    normalized.includes("risiko") ||
    normalized.includes("high risk") ||
    normalized.includes("berisiko")
  ) {
    return {
      mode: "risk-review",
      items: [...allItems].sort((a, b) => {
        const riskDelta =
          riskRank(b.analysis.volatility_risk) - riskRank(a.analysis.volatility_risk);

        if (riskDelta !== 0) {
          return riskDelta;
        }

        return a.analysis.confidence_score - b.analysis.confidence_score;
      }),
    };
  }

  return {
    mode: "watchlist-summary",
    items: allItems,
  };
}

export type SelectedChatContext = ReturnType<typeof selectChatContext>;

export type ChatResponsePayload = {
  answer: string;
  relevant_items: string[];
  recommendation: string;
  confidence: number;
  risks: string[];
  missing_data: string[];
  suggested_next_manual_action: string;
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function buildDeterministicChatResponse(
  message: string,
  context: SelectedChatContext,
  reason: string,
): ChatResponsePayload {
  const items = context.items;
  const relevantItems = items.map((item) => item.watched_item.item_name);
  const missingData = [...new Set(items.flatMap((item) => item.analysis.missing_data))];
  const risks = items
    .filter(
      (item) =>
        item.analysis.volatility_risk === "high" ||
        item.analysis.confidence_score < 50,
    )
    .map(
      (item) =>
        `${item.watched_item.item_name}: volatility=${item.analysis.volatility_risk}, confidence=${item.analysis.confidence_score}`,
    );

  if (items.length === 0) {
    return {
      answer:
        "Belum ada item lokal yang cocok untuk pertanyaan ini. Import snapshot dan pastikan watched item aktif terlebih dahulu.",
      relevant_items: [],
      recommendation: "watch",
      confidence: 0,
      risks: ["No matching local watched item context."],
      missing_data: ["watched_items"],
      suggested_next_manual_action:
        "Tambahkan watched item dan import CSV/JSON snapshot sebelum memakai chat analysis.",
    };
  }

  const confidence = average(items.map((item) => item.analysis.confidence_score));
  const best = [...items].sort((a, b) => b.analysis.flip_score - a.analysis.flip_score)[0];
  const targetBuyHits = items.filter((item) => item.analysis.target_buy_hit);
  const highRisk = items.filter((item) => item.analysis.volatility_risk === "high");
  const normalized = message.toLowerCase();

  if (context.mode === "best-opportunity" || normalized.includes("worth")) {
    return {
      answer: `${best.watched_item.item_name} punya flip_score tertinggi di konteks lokal ini: ${best.analysis.flip_score}/100, dengan recommendation ${best.analysis.recommendation}.`,
      relevant_items: [best.watched_item.item_name],
      recommendation: best.analysis.recommendation,
      confidence: best.analysis.confidence_score,
      risks:
        best.analysis.volatility_risk === "high"
          ? [`${best.watched_item.item_name}: high volatility risk.`]
          : [],
      missing_data: best.analysis.missing_data,
      suggested_next_manual_action:
        "Buka detail item dan cek price history manual sebelum mengambil keputusan.",
    };
  }

  if (context.mode === "target-buy-hit") {
    return {
      answer: targetBuyHits.length
        ? `Item yang sudah kena target buy: ${targetBuyHits
            .map((item) => item.watched_item.item_name)
            .join(", ")}.`
        : "Tidak ada watched item lokal yang sedang kena target buy.",
      relevant_items: targetBuyHits.map((item) => item.watched_item.item_name),
      recommendation: targetBuyHits.length ? "review target buy hits" : "watch",
      confidence: targetBuyHits.length
        ? average(targetBuyHits.map((item) => item.analysis.confidence_score))
        : confidence,
      risks: targetBuyHits
        .filter((item) => item.analysis.volatility_risk === "high")
        .map((item) => `${item.watched_item.item_name}: high volatility risk.`),
      missing_data: [...new Set(targetBuyHits.flatMap((item) => item.analysis.missing_data))],
      suggested_next_manual_action:
        "Review spread, volatility, dan history manual sebelum entry.",
    };
  }

  if (context.mode === "risk-review") {
    return {
      answer: highRisk.length
        ? `High risk items: ${highRisk
            .map((item) => item.watched_item.item_name)
            .join(", ")}.`
        : "Tidak ada watched item lokal dengan volatility risk high saat ini.",
      relevant_items: highRisk.map((item) => item.watched_item.item_name),
      recommendation: "review risk before action",
      confidence,
      risks: risks.length ? risks : ["No high risk item in selected local context."],
      missing_data: missingData,
      suggested_next_manual_action:
        "Prioritaskan cek item dengan volatility high atau confidence rendah.",
    };
  }

  const summary = items
    .map(
      (item) =>
        `${item.watched_item.item_name}: ${item.analysis.recommendation}, flip ${item.analysis.flip_score}/100, confidence ${item.analysis.confidence_score}/100`,
    )
    .join("; ");

  return {
    answer: `Ringkasan berdasarkan data lokal: ${summary}. Fallback deterministik dipakai karena ${reason}.`,
    relevant_items: relevantItems,
    recommendation: "manual review",
    confidence,
    risks,
    missing_data: missingData,
    suggested_next_manual_action:
      "Review /snapshots untuk detail price history, spread, confidence, dan reason codes.",
  };
}
