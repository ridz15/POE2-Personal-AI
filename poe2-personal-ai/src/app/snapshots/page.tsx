import Link from "next/link";
import {
  getLatestSnapshotsForWatchedItems,
  getPriceHistoryForItem,
  getRecentSnapshots,
  getWatchedItems,
} from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { analyzeMarket } from "@/lib/market-analysis";
import { AiExplanationButton } from "./ai-explanation-button";

export const dynamic = "force-dynamic";

export default function SnapshotsPage() {
  const watchedItems = getWatchedItems();
  const latestRows = getLatestSnapshotsForWatchedItems();
  const snapshots = getRecentSnapshots(200);
  const analyses = watchedItems.map((item) => ({
    item,
    history: getPriceHistoryForItem(item.item_name),
  }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-accent hover:text-accent-strong">
              Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Price Snapshots</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Ringkasan dan log snapshot harga yang diimpor manual dari file JSON.
            </p>
          </div>
          <Link
            href="/watched-items"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            Kelola watched items
          </Link>
        </header>

        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Latest snapshot per watched item</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">Supply</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Snapshot time</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{row.item_name}</td>
                  <td className="px-4 py-4 text-muted">{row.category ?? "-"}</td>
                  <td className="px-4 py-4 font-mono text-accent">
                    {formatPrice(row.median_price ?? row.price, row.currency ?? "divine")}
                  </td>
                  <td className="px-4 py-4 font-mono">{row.quantity_available ?? "-"}</td>
                  <td className="px-4 py-4 font-mono">{row.listings_count ?? "-"}</td>
                  <td className="px-4 py-4 text-muted">
                    {formatDateTime(row.snapshot_time)}
                  </td>
                </tr>
              ))}
              {latestRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>
                    Belum ada watched item. Tambahkan item di halaman Watched Items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="grid gap-5">
          <div>
            <h2 className="text-xl font-semibold">Analysis result</h2>
            <p className="mt-2 text-sm text-muted">
              Perhitungan ini deterministik dari snapshot lokal sebelum AI dipanggil.
            </p>
          </div>
          {analyses.map(({ item, history }) => {
            const analysis = analyzeMarket(item, history);

            return (
              <div
                key={item.id}
                className="rounded-lg border border-line bg-panel p-5"
              >
                <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold">{item.item_name}</h3>
                      <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                        {item.category ?? "uncategorized"}
                      </span>
                      <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                        {item.active ? "active" : "inactive"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Signal label="Current" value={formatPrice(analysis.current_price)} />
                      <Signal label="Previous" value={formatPrice(analysis.previous_price)} />
                      <Signal
                        label="Change"
                        value={
                          analysis.price_change_percent === null
                            ? "-"
                            : `${analysis.price_change_percent}%`
                        }
                      />
                      <Signal label="Trend" value={analysis.trend} />
                      <Signal label="Supply" value={analysis.supply_signal} />
                      <Signal label="Liquidity" value={analysis.liquidity_signal} />
                      <Signal label="Volatility" value={analysis.volatility_risk} />
                      <Signal label="Flip score" value={`${analysis.flip_score}/100`} />
                    </div>
                    <p className="mt-4 text-sm text-muted">
                      Recommendation:{" "}
                      <span className="font-semibold text-accent">
                        {analysis.recommendation}
                      </span>
                      {analysis.missing_data.length
                        ? ` | Missing data: ${analysis.missing_data.join(", ")}`
                        : ""}
                    </p>
                  </div>
                  <AiExplanationButton itemName={item.item_name} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Price history table</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">Median</th>
                <th className="px-4 py-3 font-medium">Range</th>
                <th className="px-4 py-3 font-medium">Supply</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{snapshot.item_name}</td>
                  <td className="px-4 py-4 text-muted">
                    {snapshot.category ?? "-"}
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
                    {formatDateTime(snapshot.snapshot_time)}
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={8}>
                    Tidak ada snapshot untuk ditampilkan.
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

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel-soft p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
