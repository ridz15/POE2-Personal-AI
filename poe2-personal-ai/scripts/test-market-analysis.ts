import { getPriceHistoryForItem, getWatchedItems } from "../src/lib/db";
import { analyzeMarket } from "../src/lib/market-analysis";

const itemName = process.argv.slice(2).join(" ");
const watchedItems = getWatchedItems().filter((item) =>
  itemName ? item.item_name.toLowerCase() === itemName.toLowerCase() : item.active,
);

if (watchedItems.length === 0) {
  console.error("No watched item found. Import sample data first.");
  process.exit(1);
}

const reports = watchedItems.map((item) =>
  analyzeMarket(item, getPriceHistoryForItem(item.item_name)),
);

console.log(JSON.stringify({ reports }, null, 2));
