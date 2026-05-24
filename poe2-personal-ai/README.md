PoE2 Personal AI adalah fondasi asisten pribadi untuk analisis market Path of Exile 2, workflow crafting, dan riset build non-meta di fase berikutnya.

## Fitur Market Snapshot Analyzer v1

- Next.js App Router.
- SQLite lokal di `data/poe2-personal-ai.sqlite`.
- Tabel: `market_snapshots`, `watched_items`, `poe_entries`, `ai_reports`.
- Halaman `/watched-items` untuk create, edit, delete, dan toggle item pantauan.
- Halaman `/snapshots` untuk latest snapshot per watched item, price history, dan hasil analisis.
- Analisis market deterministik sebelum AI dipanggil.
- Script import manual untuk watched items dan snapshot market dari JSON.
- Endpoint AI `POST /api/ai/analyze` untuk menjelaskan hasil analisis, bukan mengarang harga.
- Tidak ada fitur auto-buy, auto-whisper, trade bot, atau full build planner.

## Menjalankan App

Salin `.env.example` menjadi `.env.local`, lalu isi `OPENAI_API_KEY`.

```bash
npm install
npm run db:init
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Import Snapshot Market

Format JSON bisa berupa array snapshot langsung, atau object dengan properti `watched_items` dan `snapshots`.

```bash
npm run db:import -- ./samples/market-snapshot.example.json
```

Contoh field snapshot yang didukung:

```json
{
  "item_name": "Perfect Jeweller's Orb",
  "category": "currency",
  "price": 1.4,
  "currency": "divine",
  "quantity_available": 42,
  "listings_count": 48,
  "min_price": 1.32,
  "max_price": 1.55,
  "median_price": 1.4,
  "source": "manual-check",
  "snapshot_time": "2026-05-24T14:00:00.000Z"
}
```

## Test Market Analysis

Jalankan analisis deterministik untuk semua watched item aktif:

```bash
npm run market:analyze
```

Atau satu item:

```bash
npm run market:analyze -- "Perfect Jeweller's Orb"
```

## Endpoint AI

Pastikan `OPENAI_API_KEY` sudah terisi di `.env.local`.

```bash
curl -X POST http://localhost:3000/api/ai/analyze \
  -H "Content-Type: application/json" \
  -d "{\"item_name\":\"Perfect Jeweller's Orb\"}"
```

Response berisi JSON terstruktur:

```json
{
  "reports": [
    {
      "item_name": "Perfect Jeweller's Orb",
      "summary": "Price is moving up with medium liquidity.",
      "current_price": 1.4,
      "trend": "up",
      "flip_score": 55,
      "recommendation": "watch",
      "reasoning": "Explanation follows deterministic inputs only.",
      "risk": "medium",
      "missing_data": []
    }
  ]
}
```
