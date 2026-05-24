import Link from "next/link";
import { getRecentSnapshots, getSnapshotSummary, getWatchedItems } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function Home() {
  const watchedItems = getWatchedItems();
  const snapshotSummary = getSnapshotSummary();
  const recentSnapshots = getRecentSnapshots(5);
  const activeWatchedCount = watchedItems.filter((item) => item.active).length;
  const totalSnapshotCount = snapshotSummary.reduce(
    (total, item) => total + item.sample_count,
    0,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-accent">
              Personal PoE2 AI
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Market analysis workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Fondasi untuk memantau item, mengimpor snapshot harga manual, dan
              meminta analisis AI berbasis riwayat harga. Tidak ada fitur
              auto-buy, auto-whisper, atau trade bot.
            </p>
          </div>
          <nav className="flex flex-wrap gap-3">
            <Link
              href="/watched-items"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-strong"
            >
              Watched Items
            </Link>
            <Link
              href="/snapshots"
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent"
            >
              Price Snapshots
            </Link>
            <Link
              href="/ai-chat"
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent"
            >
              AI Chat
            </Link>
          </nav>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Active watched items" value={activeWatchedCount} />
          <Metric label="Tracked market rows" value={totalSnapshotCount} />
          <Metric label="Unique priced items" value={snapshotSummary.length} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-semibold">Prioritas watchlist</h2>
            <div className="mt-4 space-y-3">
              {watchedItems.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-line bg-panel-soft p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.item_name}</p>
                    <span className="text-xs text-muted">
                      {item.active ? "aktif" : "jeda"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    Buy: {formatPrice(item.target_buy_price)} | Sell:{" "}
                    {formatPrice(item.target_sell_price)}
                  </p>
                </div>
              ))}
              {watchedItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
                  Belum ada item. Tambahkan item dari halaman Watched Items.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="text-lg font-semibold">Snapshot terbaru</h2>
            <div className="mt-4 overflow-hidden rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-soft text-muted">
                  <tr>
                    <th className="px-3 py-3 font-medium">Item</th>
                    <th className="px-3 py-3 font-medium">Harga</th>
                    <th className="px-3 py-3 font-medium">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSnapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-t border-line">
                      <td className="px-3 py-3">{snapshot.item_name}</td>
                      <td className="px-3 py-3 font-mono text-accent">
                        {formatPrice(snapshot.price, snapshot.currency)}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {formatDateTime(snapshot.snapshot_time)}
                      </td>
                    </tr>
                  ))}
                  {recentSnapshots.length === 0 ? (
                    <tr>
                      <td className="px-3 py-5 text-muted" colSpan={3}>
                        Belum ada snapshot. Jalankan import JSON manual terlebih
                        dahulu.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold text-accent">
        {value}
      </p>
    </div>
  );
}
