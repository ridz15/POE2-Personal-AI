import Link from "next/link";
import { getRecentSnapshots, getSnapshotSummary } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function SnapshotsPage() {
  const summaries = getSnapshotSummary();
  const snapshots = getRecentSnapshots(200);

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
            <h2 className="text-lg font-semibold">Ringkasan per item</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Sample</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">Min</th>
                <th className="px-4 py-3 font-medium">Max</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.item_name} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{summary.item_name}</td>
                  <td className="px-4 py-4 font-mono">{summary.sample_count}</td>
                  <td className="px-4 py-4 font-mono text-accent">
                    {formatPrice(summary.current_price)}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {formatPrice(summary.min_price)}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {formatPrice(summary.max_price)}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {formatDateTime(summary.last_seen)}
                  </td>
                </tr>
              ))}
              {summaries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>
                    Belum ada data harga. Import file JSON dengan perintah
                    db:import.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Snapshot terbaru</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">League</th>
                <th className="px-4 py-3 font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">Liquidity</th>
                <th className="px-4 py-3 font-medium">Listings</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{snapshot.item_name}</td>
                  <td className="px-4 py-4 text-muted">
                    {snapshot.league ?? "-"}
                  </td>
                  <td className="px-4 py-4 font-mono text-accent">
                    {formatPrice(snapshot.price, snapshot.currency)}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {snapshot.liquidity ?? "-"}
                  </td>
                  <td className="px-4 py-4 font-mono">
                    {snapshot.listings ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {formatDateTime(snapshot.snapshot_time)}
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>
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
