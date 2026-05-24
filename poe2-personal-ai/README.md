PoE2 Personal AI adalah alat analis manual untuk market Path of Exile 2. Fokusnya adalah import CSV/JSON, analisis deterministik, dan penjelasan AI berbasis data lokal.

Ini bukan trading bot. Tidak ada auto-buy, auto-whisper, browser automation, scraping otomatis, atau otomasi terhadap trade site.

## Fitur

- Next.js App Router.
- SQLite lokal di `data/poe2-personal-ai.sqlite`.
- Tabel: `market_snapshots`, `watched_items`, `poe_entries`, `ai_reports`.
- Halaman `/watched-items` untuk create, edit, delete, target buy/sell, notes, dan status aktif.
- Halaman `/snapshots` berisi compact summary card, tersortir dari `flip_score` tertinggi.
- Halaman detail `/snapshots/[itemName]` untuk harga, target, margin, spread, reason codes, history, notes, dan AI explanation.
- Import manual market snapshot dari JSON dan CSV.
- AI hanya menjelaskan hasil analisis deterministik. AI tidak boleh mengarang harga atau history.

## Setup

Salin `.env.example` menjadi `.env.local`, lalu isi `OPENAI_API_KEY` jika ingin memakai AI explanation.

```bash
npm install
npm run db:init
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Manual Market Workflow

1. Buka `poe.ninja/poe2/economy` atau sumber market lain secara manual.
2. Pilih item yang ingin dipantau di `/watched-items`.
3. Salin data harga secara manual ke CSV dengan kolom yang didukung.
4. Import CSV:

```bash
npm run db:import:csv -- ./samples/market-snapshot.example.csv
```

5. Jalankan analisis:

```bash
npm run market:analyze
```

6. Review `/snapshots`.
7. Buka detail item dari summary card.
8. Gunakan AI explanation hanya setelah analisis deterministik tersedia.

## Import JSON

Format JSON bisa berupa array snapshot langsung, atau object dengan properti `watched_items` dan `snapshots`.

```bash
npm run db:import -- ./samples/market-snapshot.example.json
```

## Import CSV

```bash
npm run db:import:csv -- ./samples/market-snapshot.example.csv
```

Kolom CSV:

```txt
item_name,category,price,currency,quantity_available,listings_count,min_price,max_price,median_price,snapshot_time,source,notes
```

`source` bisa berisi `poe.ninja`, `manual`, atau `trade-search`.

Importer akan menolak row dengan `item_name` kosong, `price` negatif, angka invalid, atau `snapshot_time` invalid. Row invalid dilewati, row valid tetap diimport, lalu summary dicetak di akhir.

## Market Analysis

`flip_score` adalah skor peluang manual dari 0-100. Skor ini mempertimbangkan trend, liquidity, supply, volatility, target buy/sell, margin, dan spread.

`confidence_score` adalah tingkat keyakinan dari 0-100. Skor ini naik jika data history cukup, harga terbaru ada, supply/listings tersedia, dan spread bisa dihitung. Skor turun jika data hilang atau volatilitas tinggi.

`reason_codes` menjelaskan pemicu utama analisis, misalnya:

- `BELOW_TARGET_BUY`: harga terbaru sudah di bawah target beli.
- `ABOVE_TARGET_SELL`: harga terbaru sudah di atas target jual.
- `LOW_SUPPLY`: supply terlihat rendah.
- `HIGH_SPREAD`: spread harga terlalu lebar.
- `TRENDING_UP`: harga naik dari snapshot sebelumnya.
- `TRENDING_DOWN`: harga turun dari snapshot sebelumnya.
- `STABLE_PRICE`: harga relatif stabil.
- `NOT_ENOUGH_HISTORY`: jumlah snapshot belum cukup.
- `GOOD_MARGIN`: target sell memberi margin yang sehat.
- `LOW_CONFIDENCE`: data belum cukup kuat.

## Test Analysis

Semua watched item aktif:

```bash
npm run market:analyze
```

Satu item:

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

Response:

```json
{
  "reports": [
    {
      "item_name": "Perfect Jeweller's Orb",
      "summary": "Manual explanation based on deterministic data.",
      "recommendation": "watch",
      "confidence": 72,
      "key_reasons": ["TRENDING_UP", "GOOD_MARGIN"],
      "risk": "medium",
      "suggested_action": "Review manually before taking any trade action.",
      "missing_data": []
    }
  ]
}
```
