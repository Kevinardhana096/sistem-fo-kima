use std::io::{self, BufRead};

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use sqlx::mysql::MySqlPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let email = std::env::args()
        .nth(1)
        .ok_or("email admin wajib diberikan")?
        .trim()
        .to_lowercase();
    if email.is_empty() {
        return Err("email admin tidak boleh kosong".into());
    }

    let mut password = String::new();
    io::stdin().lock().read_line(&mut password)?;
    let password = password.trim_end_matches(['\r', '\n']);
    if password.len() < 12
        || !password.chars().any(|value| value.is_ascii_uppercase())
        || !password.chars().any(|value| value.is_ascii_lowercase())
        || !password.chars().any(|value| value.is_ascii_digit())
        || !password.chars().any(|value| !value.is_ascii_alphanumeric())
    {
        return Err(
            "password minimal 12 karakter dan harus memuat huruf besar, huruf kecil, angka, serta simbol"
                .into(),
        );
    }

    let database_url = std::env::var("DATABASE_URL")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| "gagal menghasilkan hash password")?
        .to_string();

    let result = sqlx::query(
        "UPDATE users SET password_hash = ?, must_change_password = 0, \
         session_version = session_version + 1, failed_login_attempts = 0, \
         locked_until = NULL \
         WHERE email = ? AND role = 'admin' AND is_active = 1",
    )
    .bind(password_hash)
    .bind(&email)
    .execute(&pool)
    .await?;

    if result.rows_affected() != 1 {
        return Err("akun admin aktif tidak ditemukan atau tidak unik".into());
    }

    println!("Password admin berhasil direset dan seluruh sesi lama dibatalkan.");
    Ok(())
}
