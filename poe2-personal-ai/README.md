PoE2 Personal AI adalah fondasi asisten pribadi untuk analisis market Path of Exile 2, workflow crafting, dan riset build non-meta di fase berikutnya.

## Fitur Phase 1

- Next.js App Router.
- SQLite lokal di `data/poe2-personal-ai.sqlite`.
- Tabel: `market_snapshots`, `watched_items`, `poe_entries`, `ai_reports`.
- Halaman `/watched-items` untuk mengelola item pantauan.
- Halaman `/snapshots` untuk melihat ringkasan dan log harga.
- Script import manual untuk file JSON snapshot market.
- Endpoint AI `POST /api/ai/analyze` untuk analisis riwayat harga item.
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

Format JSON bisa berupa array langsung, atau object dengan properti `snapshots` / `items`.

```bash
npm run db:import -- ./samples/market-snapshot.example.json
```

Contoh field yang didukung:

```json
{
  "item_name": "Perfect Jeweller's Orb",
  "league": "Dawn of the Hunt",
  "price": 1.4,
  "currency": "divine",
  "liquidity": "medium",
  "listings": 42,
  "source": "manual-check",
  "snapshot_time": "2026-05-24T14:00:00.000Z"
}
```

## Endpoint AI

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
      "current_price": 1.4,
      "price_trend": "flat",
      "liquidity": "medium",
      "flip_score": 55,
      "risk": "medium",
      "recommendation": "Pantau manual sebelum entry.",
      "reasoning": "Sample masih terbatas."
    }
  ]
}
```
