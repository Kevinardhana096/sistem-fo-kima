-- ============================================================================
-- INSERT DEFAULT ADMIN USER - PRODUCTION (SUPABASE)
-- ============================================================================
-- Tanggal: 2026-05-12
-- Database: Supabase PostgreSQL (Production)
-- Cara Pakai: Copy-paste script ini ke Supabase SQL Editor dan Run
--
-- SECURITY: TEMPLATE. Ganti REPLACE_WITH_BCRYPT_HASH dengan bcrypt hash dari
-- password yang kuat & unik sebelum dijalankan, dan JANGAN commit hash/password
-- aslinya. Rotasi kredensial apa pun yang pernah ter-commit atau dibagikan.
-- ============================================================================

BEGIN;

-- Insert Admin User
INSERT INTO users (
  username,
  email,
  password_hash,
  role,
  display_name,
  is_active,
  created_at,
  updated_at
) VALUES (
  'admin',
  'admin@kima.local',
  -- bcrypt hash dari password admin (jangan simpan password plaintext di sini)
  'REPLACE_WITH_BCRYPT_HASH',
  'admin',
  'Administrator',
  true,
  NOW(),
  NOW()
);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Uncomment untuk verifikasi setelah insert

-- SELECT id, username, email, role, display_name, is_active
-- FROM users
-- WHERE username = 'admin';

-- ============================================================================
-- KREDENSIAL ADMIN
-- ============================================================================
-- Username: admin
-- Email: admin@kima.local
-- Role: admin
-- Password: set saat menjalankan script (jangan dicatat di repo).
-- ============================================================================
