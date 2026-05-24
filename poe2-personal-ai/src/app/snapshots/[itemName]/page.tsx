import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPriceHistoryForItem,
  getWatchedItemByName,
} from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { analyzeMarket } from "@/lib/market-analysis";
import { AiExplanationButton } from "../ai-explanation-button";

export const dynamic = "force-dynamic";

export default async function ItemSnapshotPage({
  params,
}: {
  params: Promise<{ itemName: string }>;
}) {
  const { itemName: encodedItemName } = await params;
  const itemName = decodeURIComponent(encodedItemName);
  const watchedItem = getWatchedItemByName(itemName);

  if (!watchedItem) {
    notFound();
  }

  const history = getPriceHistoryForItem(watchedItem.item_name);
  const latest = history.at(-1);
  const analysis = analyzeMarket(watchedItem, history);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/snapshots"
              className="text-sm text-accent hover:text-accent-strong"
            >
              Snapshot analyzer
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{watchedItem.item_name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {watchedItem.notes ?? "No watched item notes."}
            </p>
          </div>
          <AiExplanationButton itemName={watchedItem.item_name} />
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Latest price"
            value={formatPrice(analysis.current_price, latest?.currency ?? "divine")}
          />
          <Metric
            label="Previous price"
            value={formatPrice(analysis.previous_price, latest?.currency ?? "divine")}
          />
          <Metric
            label="Price change"
            value={
              analysis.price_change_percent === null
                ? "-"
                : `${analysis.price_change_percent}%`
            }
          />
          <Metric label="Trend" value={analysis.trend} />
          <Metric label="Flip score" value={`${analysis.flip_score}/100`} />
          <Metric
            label="Confidence"
            value={`${analysis.confidence_score}/100`}
          />
          <Metric label="Recommendation" value={analysis.recommendation} />
          <Metric
            label="Target buy"
            value={formatPrice(watchedItem.target_buy_price, latest?.currency ?? "divine")}
          />
          <Metric
            label="Target sell"
            value={formatPrice(watchedItem.target_sell_price, latest?.currency ?? "divine")}
          />
          <Metric
            label="Margin"
            value={analysis.margin_percent === null ? "-" : `${analysis.margin_percent}%`}
          />
          <Metric
            label="Spread"
            value={analysis.spread_percent === null ? "-" : `${analysis.spread_percent}%`}
          />
          <Metric label="Category" value={watchedItem.category ?? "-"} />
        </section>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Reason codes</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {analysis.reason_codes.map((code) => (
              <span
                key={code}
                className="rounded-md border border-line px-2 py-1 text-xs text-muted"
              >
                {code}
              </span>
            ))}
            {analysis.reason_codes.length === 0 ? (
              <span className="text-sm text-muted">No reason codes.</span>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Price history</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Median</th>
                <th className="px-4 py-3 font-medium">Range</th>
                <th className="px-4 py-3 font-medium">Supply</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-line align-top">
                  <td className="px-4 py-4 text-muted">
                    {formatDateTime(snapshot.snapshot_time)}
                  </td>
                  <td className="px-4 py-4 font-mono text-accent">
                    {formatPrice(snapshot.price, snapshot.currency)}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {formatPrice(snapshot.median_price, snapshot.currency)}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {formatPrice(snapshot.min_price, snapshot.currency)} -{" "}
                    {formatPrice(snapshot.max_price, snapshot.currency)}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {snapshot.quantity_available ?? "-"}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {snapshot.listings_count ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {snapshot.source ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {snapshot.notes ?? "-"}
                  </td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={8}>
                    Belum ada snapshot untuk item ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
