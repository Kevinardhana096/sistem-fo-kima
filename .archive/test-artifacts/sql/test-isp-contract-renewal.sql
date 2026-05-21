-- Test data untuk perpanjangan kontrak ISP
-- Tanggal hari ini: 2026-05-21

-- 1. Kontrak yang akan berakhir 3 bulan lagi (2026-08-21) - harus trigger peringatan pertama
INSERT INTO isp_contract_rows (isp_id, contract_reference, period_start, period_end, renewal_status)
VALUES (64, 'ISP-CONTRACT-001', '2025-08-21', '2026-08-21', 'active');

-- 2. Kontrak yang akan berakhir 2 bulan lagi (2026-07-21) dengan surat perpanjangan - harus trigger peringatan kedua
INSERT INTO isp_contract_rows (isp_id, contract_reference, period_start, period_end, renewal_status, renewal_file_url, renewal_file_name)
VALUES (64, 'ISP-CONTRACT-002', '2025-07-21', '2026-07-21', 'active', 'https://example.com/renewal.pdf', 'surat_perpanjangan.pdf');

-- 3. Kontrak yang akan berakhir 1 bulan lagi (2026-06-21) dengan surat perpanjangan - harus trigger peringatan ketiga
INSERT INTO isp_contract_rows (isp_id, contract_reference, period_start, period_end, renewal_status, renewal_file_url, renewal_file_name)
VALUES (64, 'ISP-CONTRACT-003', '2025-06-21', '2026-06-21', 'active', 'https://example.com/renewal.pdf', 'surat_perpanjangan.pdf');

-- 4. Kontrak yang sudah lewat masa berakhir (2026-04-21) - status harus jadi "belum diperpanjang"
INSERT INTO isp_contract_rows (isp_id, contract_reference, period_start, period_end, renewal_status, renewal_file_url, renewal_file_name)
VALUES (64, 'ISP-CONTRACT-004', '2025-04-21', '2026-04-21', 'active', 'https://example.com/renewal.pdf', 'surat_perpanjangan.pdf');

-- Verifikasi data yang diinsert
SELECT id, isp_id, contract_reference, period_start, period_end, renewal_status, renewal_file_url, response_file_url
FROM isp_contract_rows
WHERE isp_id = 64 AND deleted_at IS NULL
ORDER BY period_end DESC;
