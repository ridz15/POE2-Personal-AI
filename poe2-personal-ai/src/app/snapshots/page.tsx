import Link from "next/link";
import { getPriceHistoryForItem, getWatchedItems } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { analyzeMarket } from "@/lib/market-analysis";

export const dynamic = "force-dynamic";

export default function SnapshotsPage() {
  const cards = getWatchedItems()
    .map((item) => {
      const history = getPriceHistoryForItem(item.item_name);
      const latest = history.at(-1);
      const analysis = analyzeMarket(item, history);

      return { item, latest, analysis };
    })
    .sort((a, b) => b.analysis.flip_score - a.analysis.flip_score);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-accent hover:text-accent-strong">
              Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Market Snapshot Analyzer</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Summary manual market data, sorted by highest flip score first.
            </p>
          </div>
          <Link
            href="/watched-items"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            Kelola watched items
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ item, latest, analysis }) => (
            <Link
              key={item.id}
              href={`/snapshots/${encodeURIComponent(item.item_name)}`}
              className="rounded-lg border border-line bg-panel p-5 transition hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{item.item_name}</h2>
                  <p className="mt-1 text-xs uppercase text-muted">
                    {item.category ?? "uncategorized"}
                  </p>
                </div>
                <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                  {analysis.recommendation}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric
                  label="Latest"
                  value={formatPrice(
                    analysis.current_price,
                    latest?.currency ?? "divine",
                  )}
                />
                <Metric label="Trend" value={analysis.trend} />
                <Metric label="Flip" value={`${analysis.flip_score}/100`} />
                <Metric
                  label="Confidence"
                  value={`${analysis.confidence_score}/100`}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {analysis.reason_codes.slice(0, 4).map((code) => (
                  <span
                    key={code}
                    className="rounded-md border border-line px-2 py-1 text-xs text-muted"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {cards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">
              Belum ada watched item. Tambahkan item dahulu, lalu import snapshot
              CSV atau JSON.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel-soft p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}
