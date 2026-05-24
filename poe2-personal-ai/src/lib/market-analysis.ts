import type { MarketSnapshot, WatchedItem } from "@/lib/db";

export type MarketAnalysis = {
  item_name: string;
  current_price: number | null;
  previous_price: number | null;
  price_change_percent: number | null;
  trend: "up" | "down" | "stable" | "unknown";
  supply_signal: "scarce" | "balanced" | "abundant" | "unknown";
  liquidity_signal: "low" | "medium" | "high" | "unknown";
  volatility_risk: "low" | "medium" | "high" | "unknown";
  flip_score: number;
  recommendation: "buy" | "watch" | "avoid" | "sell";
  missing_data: string[];
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function priceOf(snapshot: MarketSnapshot | undefined) {
  return snapshot?.median_price ?? snapshot?.price ?? null;
}

export function analyzeMarket(
  watchedItem: Pick<
    WatchedItem,
    "item_name" | "target_buy_price" | "target_sell_price"
  >,
  history: MarketSnapshot[],
): MarketAnalysis {
  const missingData: string[] = [];
  const latest = history.at(-1);
  const previous = history.at(-2);
  const currentPrice = priceOf(latest);
  const previousPrice = priceOf(previous);

  if (!latest || currentPrice === null) {
    missingData.push("current_price");
  }

  if (!previous || previousPrice === null) {
    missingData.push("previous_price");
  }

  const priceChangePercent =
    currentPrice !== null && previousPrice !== null && previousPrice > 0
      ? round(((currentPrice - previousPrice) / previousPrice) * 100)
      : null;

  let trend: MarketAnalysis["trend"] = "unknown";
  if (priceChangePercent !== null) {
    if (priceChangePercent >= 3) {
      trend = "up";
    } else if (priceChangePercent <= -3) {
      trend = "down";
    } else {
      trend = "stable";
    }
  }

  const supplyValue = latest?.quantity_available ?? latest?.listings_count ?? null;
  if (supplyValue === null) {
    missingData.push("quantity_available");
  }

  const supplySignal: MarketAnalysis["supply_signal"] =
    supplyValue === null
      ? "unknown"
      : supplyValue <= 25
        ? "scarce"
        : supplyValue >= 100
          ? "abundant"
          : "balanced";

  const listingsCount = latest?.listings_count ?? null;
  if (listingsCount === null) {
    missingData.push("listings_count");
  }

  const liquiditySignal: MarketAnalysis["liquidity_signal"] =
    listingsCount === null
      ? "unknown"
      : listingsCount >= 100
        ? "high"
        : listingsCount >= 35
          ? "medium"
          : "low";

  const observedPrices = history
    .map(priceOf)
    .filter((value): value is number => typeof value === "number");
  const minObserved = observedPrices.length ? Math.min(...observedPrices) : null;
  const maxObserved = observedPrices.length ? Math.max(...observedPrices) : null;
  const volatilityPercent =
    minObserved !== null && maxObserved !== null && currentPrice !== null && currentPrice > 0
      ? ((maxObserved - minObserved) / currentPrice) * 100
      : null;

  if (volatilityPercent === null) {
    missingData.push("volatility_history");
  }

  const volatilityRisk: MarketAnalysis["volatility_risk"] =
    volatilityPercent === null
      ? "unknown"
      : volatilityPercent >= 25
        ? "high"
        : volatilityPercent >= 10
          ? "medium"
          : "low";

  let score = 45;
  if (trend === "up") score += 15;
  if (trend === "stable") score += 8;
  if (trend === "down") score -= 12;
  if (liquiditySignal === "high") score += 18;
  if (liquiditySignal === "medium") score += 8;
  if (liquiditySignal === "low") score -= 10;
  if (supplySignal === "scarce") score += 8;
  if (supplySignal === "abundant") score -= 5;
  if (volatilityRisk === "low") score += 10;
  if (volatilityRisk === "medium") score -= 3;
  if (volatilityRisk === "high") score -= 15;

  if (
    currentPrice !== null &&
    watchedItem.target_buy_price !== null &&
    currentPrice <= watchedItem.target_buy_price
  ) {
    score += 15;
  }

  if (
    currentPrice !== null &&
    watchedItem.target_sell_price !== null &&
    currentPrice >= watchedItem.target_sell_price
  ) {
    score += 12;
  }

  const flipScore = clamp(Math.round(score), 0, 100);

  let recommendation: MarketAnalysis["recommendation"] = "watch";
  if (currentPrice === null || history.length < 2) {
    recommendation = "watch";
  } else if (
    watchedItem.target_sell_price !== null &&
    currentPrice >= watchedItem.target_sell_price
  ) {
    recommendation = "sell";
  } else if (
    flipScore >= 70 &&
    trend !== "down" &&
    volatilityRisk !== "high" &&
    (watchedItem.target_buy_price === null || currentPrice <= watchedItem.target_buy_price)
  ) {
    recommendation = "buy";
  } else if (flipScore <= 35 || volatilityRisk === "high") {
    recommendation = "avoid";
  }

  return {
    item_name: watchedItem.item_name,
    current_price: currentPrice,
    previous_price: previousPrice,
    price_change_percent: priceChangePercent,
    trend,
    supply_signal: supplySignal,
    liquidity_signal: liquiditySignal,
    volatility_risk: volatilityRisk,
    flip_score: flipScore,
    recommendation,
    missing_data: [...new Set(missingData)],
  };
}
