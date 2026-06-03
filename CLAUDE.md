# CLAUDE.md — Sistem FO KIMA

Aturan kerja ini menjadi referensi implementasi untuk kontributor dan agent yang mengubah kode atau dokumentasi teknis.

## Prinsip Inti

- Arsitektur utama adalah frontend React + Vite yang mengakses Supabase secara langsung.
- Jangan menambahkan backend NestJS/Prisma baru untuk alur utama tanpa keputusan arsitektur yang eksplisit.
- Gunakan Supabase Auth, RLS, PostgreSQL, dan Storage sesuai pola yang sudah ada di repo.
- Script SQL produksi dijalankan manual di Supabase SQL Editor setelah direview.
- Jangan mengubah data production tanpa memahami dampak idempotency, relasi, dan constraint yang berlaku.

## Rujukan Utama

- [README.md](README.md) untuk overview project dan arsitektur.
- [DEV_GUIDE.md](DEV_GUIDE.md) untuk setup development lokal.
- [prd/PRD-sistem-arsip-kima.md](prd/PRD-sistem-arsip-kima.md) untuk aturan bisnis dan model data.
- [docs/INDEX.md](docs/INDEX.md) untuk peta dokumentasi.
- [scripts/README.md](scripts/README.md) untuk indeks script operasional.

## Konvensi Implementasi

- Gunakan nama field dan enum yang sesuai schema Supabase aktual.
- Pertahankan pemetaan camelCase UI ke snake_case database melalui lapisan akses data yang sudah ada.
- Jangan menyimpan rahasia di log, commit, atau dokumentasi publik.
- Jika ada dokumen teknis yang bertentangan dengan PRD atau README, ikuti dokumen kanonik yang paling baru.

## Status

- Dokumen ini kanonik dan harus dijaga tetap selaras dengan README, PRD, dan DEV_GUIDE.
