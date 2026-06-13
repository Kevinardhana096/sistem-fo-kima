# Email Notifications

Email notifikasi dikirim dari Supabase Edge Function `send-notification-emails`.
Function ini membaca notifikasi operasional aktif, menentukan penerima sesuai role,
mengirim email via provider transactional email, lalu mencatat hasilnya di
`public.notification_email_deliveries` agar notifikasi yang sama tidak dikirim
berulang ke user yang sama.

## Setup

1. Jalankan SQL:
   `scripts/maintenance/add-notification-email-deliveries.sql`
2. Deploy Edge Function:
   `supabase functions deploy send-notification-emails`
3. Set secrets:
   `EMAIL_PROVIDER`
   `EMAIL_FROM`
   `APP_BASE_URL`
   `EMAIL_JOB_SECRET`
   `BREVO_API_KEY` atau `RESEND_API_KEY`

Contoh Brevo:

```bash
supabase secrets set EMAIL_PROVIDER=brevo
supabase secrets set BREVO_API_KEY=...
supabase secrets set EMAIL_FROM="KIMA <email-sender-yang-terverifikasi-di-brevo@example.com>"
supabase secrets set APP_BASE_URL="https://domain-aplikasi.example.com"
supabase secrets set EMAIL_JOB_SECRET="nilai-random-panjang"
```

Contoh Resend:

```bash
supabase secrets set EMAIL_PROVIDER=resend
supabase secrets set RESEND_API_KEY=...
supabase secrets set EMAIL_FROM="KIMA <notifikasi@example.com>"
supabase secrets set APP_BASE_URL="https://domain-aplikasi.example.com"
supabase secrets set EMAIL_JOB_SECRET="nilai-random-panjang"
```

## Pemanggilan Manual

Dry-run mencatat `dry_run` tanpa mengirim email:

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/send-notification-emails" \
  -H "Content-Type: application/json" \
  -H "x-email-job-secret: EMAIL_JOB_SECRET" \
  -d '{"dryRun":true,"limit":25}'
```

Kirim email:

```bash
curl -X POST "https://PROJECT_REF.supabase.co/functions/v1/send-notification-emails" \
  -H "Content-Type: application/json" \
  -H "x-email-job-secret: EMAIL_JOB_SECRET" \
  -d '{"limit":100}'
```

## Pemanggilan Setelah Register

Halaman register memicu function yang sama setelah akun Supabase Auth berhasil
dibuat. Mode ini memakai JWT user yang baru dibuat, bukan `EMAIL_JOB_SECRET`,
dan function membatasi pengiriman hanya untuk `recipientUserId`/`recipientEmail`
yang sama dengan JWT tersebut. Dengan begitu register tidak dapat memicu batch
email ke semua user.

Contoh payload self-service:

```json
{
  "trigger": "register",
  "recipientUserId": "auth-user-id",
  "recipientEmail": "user@example.com",
  "limit": 100
}
```

Jika Supabase Auth mewajibkan email confirmation dan tidak mengembalikan session
setelah `signUp`, pemicu langsung dari frontend tidak bisa berjalan karena belum
ada JWT user. Akun tetap berhasil dibuat, dan email notifikasi akan dikirim oleh
cron berikutnya setelah user aktif/sesuai konfigurasi Auth.

## Aturan Role

- `admin`: menerima semua notifikasi operasional.
- `teknisi`: hanya menerima notifikasi jalur/map (`route_setup`).
- `isp`: hanya menerima notifikasi yang terkait `isp_id` yang terhubung melalui
  `public.isp_user_accounts`.

Notifikasi masa kontrak tenant ikut dikirim untuk kondisi kontrak expired,
H-1 bulan, H-2 bulan, dan H-3 bulan sesuai status upload surat perpanjangan
dan tanggapan perpanjangan.

## Jadwal

Jadwalkan dari Supabase Cron setiap 10-15 menit. Gunakan header
`x-email-job-secret` agar function hanya bisa dipanggil oleh job internal.
Template SQL tersedia di:
`scripts/maintenance/schedule-notification-email-job.sql`
