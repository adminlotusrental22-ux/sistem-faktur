# Lotus Rental 22 — Invoice Rental, Tour & Transportasi

Form invoice multi-layanan dengan dasar tarif harian, paket, perjalanan, orang, dan unit sekali. Tarif dan biaya tambahan dapat diedit. Alur: buat PDF → preview → kirim email.

## Lokal

npm install
npm run dev

Buka http://127.0.0.1:3000/. Mode demo lokal tidak menghubungi GAS atau mengirim email. Isi data dan layanan yang ingin dicoba, lalu pilih Buat & Preview PDF.

## Pemeriksaan

npm run lint
npm run build
node scripts/check-gas.cjs
npx tsx scripts/check-billing.ts

Panduan deployment GAS versi 3 dan pengujian operasional: PANDUAN-UPDATE.md. API Gemini tidak diperlukan untuk sistem invoice ini.
