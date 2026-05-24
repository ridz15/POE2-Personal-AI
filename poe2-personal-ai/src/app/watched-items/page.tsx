import Link from "next/link";
import {
  addWatchedItem,
  deleteWatchedItem,
  toggleWatchedItem,
} from "@/app/actions";
import { getWatchedItems } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function WatchedItemsPage() {
  const watchedItems = getWatchedItems();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-accent hover:text-accent-strong">
              Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Watched Items</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Kelola item yang akan dianalisis AI dari riwayat snapshot harga.
            </p>
          </div>
          <Link
            href="/snapshots"
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
          >
            Lihat snapshots
          </Link>
        </header>

        <section className="rounded-lg border border-line bg-panel p-5">
          <h2 className="text-lg font-semibold">Tambah atau update item</h2>
          <form
            action={addWatchedItem}
            className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.7fr_0.7fr] lg:grid-cols-[1.2fr_0.7fr_0.7fr_1.4fr_auto]"
          >
            <label className="grid gap-2 text-sm text-muted">
              Nama item
              <input
                required
                name="item_name"
                placeholder="Contoh: Perfect Jeweller's Orb"
                className="rounded-md border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="grid gap-2 text-sm text-muted">
              Target price
              <input
                name="target_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="rounded-md border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="grid gap-2 text-sm text-muted">
              Max risk
              <input
                name="max_risk"
                placeholder="low / medium / high"
                className="rounded-md border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="grid gap-2 text-sm text-muted">
              Catatan
              <input
                name="notes"
                placeholder="Alasan dipantau, crafting use case, dsb."
                className="rounded-md border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <button className="self-end rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black hover:bg-accent-strong">
              Simpan
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-soft text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {watchedItems.map((item) => (
                <tr key={item.id} className="border-t border-line align-top">
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.item_name}</p>
                    {item.notes ? (
                      <p className="mt-1 max-w-xl text-muted">{item.notes}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 font-mono text-accent">
                    {formatPrice(item.target_price)}
                  </td>
                  <td className="px-4 py-4 text-muted">{item.max_risk ?? "-"}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                      {item.active ? "aktif" : "jeda"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {formatDateTime(item.updated_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleWatchedItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="active" value={item.active} />
                        <button className="rounded-md border border-line px-3 py-1.5 text-xs hover:border-accent hover:text-accent">
                          {item.active ? "Jeda" : "Aktifkan"}
                        </button>
                      </form>
                      <form action={deleteWatchedItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="rounded-md border border-danger px-3 py-1.5 text-xs text-danger hover:bg-danger hover:text-white">
                          Hapus
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {watchedItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={6}>
                    Belum ada item dalam watchlist.
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
