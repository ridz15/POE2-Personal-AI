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
  target_buy_hit: boolean;
  target_sell_hit: boolean;
  margin_percent: number | null;
  spread_percent: number | null;
  flip_score: number;
  confidence_score: number;
  recommendation: "buy" | "watch" | "avoid" | "sell";
  reason_codes: string[];
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
  const targetBuyHit =
    currentPrice !== null &&
    watchedItem.target_buy_price !== null &&
    currentPrice <= watchedItem.target_buy_price;
  const targetSellHit =
    currentPrice !== null &&
    watchedItem.target_sell_price !== null &&
    currentPrice >= watchedItem.target_sell_price;
  const marginPercent =
    watchedItem.target_buy_price !== null &&
    watchedItem.target_sell_price !== null &&
    watchedItem.target_buy_price > 0
      ? round(
          ((watchedItem.target_sell_price - watchedItem.target_buy_price) /
            watchedItem.target_buy_price) *
            100,
        )
      : null;
  const latestMin = latest?.min_price ?? null;
  const latestMax = latest?.max_price ?? null;
  const latestMedian = latest?.median_price ?? latest?.price ?? null;
  const spreadPercent =
    latestMin !== null && latestMax !== null && latestMedian !== null && latestMedian > 0
      ? round(((latestMax - latestMin) / latestMedian) * 100)
      : null;

  if (!latest || currentPrice === null) {
    missingData.push("current_price");
  }

  if (!previous || previousPrice === null) {
    missingData.push("previous_price");
  }

  if (marginPercent === null) {
    missingData.push("target_margin");
  }

  if (spreadPercent === null) {
    missingData.push("market_spread");
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

  if (targetBuyHit) {
    score += 15;
  }

  if (targetSellHit) {
    score += 12;
  }

  if (marginPercent !== null && marginPercent >= 20) score += 8;
  if (spreadPercent !== null && spreadPercent >= 20) score -= 10;

  const flipScore = clamp(Math.round(score), 0, 100);

  let recommendation: MarketAnalysis["recommendation"] = "watch";
  if (currentPrice === null || history.length < 2) {
    recommendation = "watch";
  } else if (targetSellHit) {
    recommendation = "sell";
  } else if (
    flipScore >= 70 &&
    trend !== "down" &&
    volatilityRisk !== "high" &&
    (watchedItem.target_buy_price === null || targetBuyHit)
  ) {
    recommendation = "buy";
  } else if (flipScore <= 35 || volatilityRisk === "high") {
    recommendation = "avoid";
  }

  const reasonCodes: string[] = [];
  if (targetBuyHit) reasonCodes.push("BELOW_TARGET_BUY");
  if (targetSellHit) reasonCodes.push("ABOVE_TARGET_SELL");
  if (supplySignal === "scarce") reasonCodes.push("LOW_SUPPLY");
  if (spreadPercent !== null && spreadPercent >= 20) reasonCodes.push("HIGH_SPREAD");
  if (trend === "up") reasonCodes.push("TRENDING_UP");
  if (trend === "down") reasonCodes.push("TRENDING_DOWN");
  if (trend === "stable") reasonCodes.push("STABLE_PRICE");
  if (history.length < 3) reasonCodes.push("NOT_ENOUGH_HISTORY");
  if (marginPercent !== null && marginPercent >= 20) reasonCodes.push("GOOD_MARGIN");

  let confidence = 45;
  confidence += Math.min(history.length, 5) * 8;
  if (currentPrice !== null) confidence += 10;
  if (previousPrice !== null) confidence += 8;
  if (liquiditySignal !== "unknown") confidence += 8;
  if (supplySignal !== "unknown") confidence += 6;
  if (spreadPercent !== null) confidence += 6;
  if (volatilityRisk === "high") confidence -= 12;
  confidence -= missingData.length * 6;

  const confidenceScore = clamp(Math.round(confidence), 0, 100);
  if (confidenceScore < 45) reasonCodes.push("LOW_CONFIDENCE");

  return {
    item_name: watchedItem.item_name,
    current_price: currentPrice,
    previous_price: previousPrice,
    price_change_percent: priceChangePercent,
    trend,
    supply_signal: supplySignal,
    liquidity_signal: liquiditySignal,
    volatility_risk: volatilityRisk,
    target_buy_hit: targetBuyHit,
    target_sell_hit: targetSellHit,
    margin_percent: marginPercent,
    spread_percent: spreadPercent,
    flip_score: flipScore,
    confidence_score: confidenceScore,
    recommendation,
    reason_codes: [...new Set(reasonCodes)],
    missing_data: [...new Set(missingData)],
  };
}
