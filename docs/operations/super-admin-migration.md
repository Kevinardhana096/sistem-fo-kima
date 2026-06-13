# Migrasi Super Admin

Perubahan role admin menjadi dua tingkat membutuhkan langkah operasional di Supabase, karena akun lama tersimpan di `auth.users.raw_user_meta_data`.

## Tujuan

- `super_admin`: tetap memiliki akses penuh dan menerima semua notifikasi operasional.
- `admin`: hanya menerima notifikasi masa/perpanjangan kontrak pelanggan.

## Urutan eksekusi yang disarankan

1. Review daftar akun admin lama di Supabase SQL Editor:

   ```sql
   SELECT id, email, raw_user_meta_data ->> 'role' AS role, raw_user_meta_data ->> 'display_name' AS display_name
   FROM auth.users
   WHERE raw_user_meta_data ->> 'role' = 'admin'
   ORDER BY email;
   ```

2. Edit `scripts/maintenance/promote-admins-to-super-admin.sql` dan isi array `selected_admin_emails` hanya dengan email admin yang harus tetap menjadi penerima semua notifikasi.

3. Jalankan `scripts/maintenance/promote-admins-to-super-admin.sql` di Supabase SQL Editor dengan akses owner/service-role.

4. Terapkan ulang policy/RPC yang sudah mendukung `super_admin`:
   - `scripts/rls/setup-supabase-rls-policies.sql`
   - `scripts/auth/rpc-create-isp-account.sql`
   - `scripts/auth/rpc-upsert-isp-account.sql`
   - Jika modul terkait sudah aktif di environment, jalankan ulang juga:
     - `scripts/maintenance/add-notification-states.sql`
     - `scripts/maintenance/add-notification-email-deliveries.sql`
     - `scripts/maintenance/add-activity-logs.sql`

5. Verifikasi hasil migrasi:

   ```sql
   SELECT email, raw_user_meta_data ->> 'role' AS role
   FROM auth.users
   WHERE raw_user_meta_data ->> 'role' IN ('super_admin', 'admin')
   ORDER BY role, email;
   ```

## Catatan penting

Jangan memigrasikan semua akun `admin` secara otomatis tanpa review. Setelah fitur ini aktif, akun yang tetap `admin` hanya menerima notifikasi `contract_renewal`, sedangkan akun `super_admin` menerima semua notifikasi.
