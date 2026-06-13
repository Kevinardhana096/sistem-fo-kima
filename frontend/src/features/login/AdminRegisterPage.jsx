import { useMemo, useState } from "react";
import { sendInitialNotificationEmails, signUpInternalUser } from "@/lib/supabase";

const REGISTER_ROLES = {
    super_admin: {
        key: "super_admin",
        label: "Super Admin",
        defaultDisplayName: "Super Administrator",
        emailLabel: "Email Super Admin",
        emailPlaceholder: "superadmin@kima.co.id",
    },
    admin: {
        key: "admin",
        label: "Admin",
        defaultDisplayName: "Administrator",
        emailLabel: "Email Admin",
        emailPlaceholder: "admin@kima.co.id",
    },
    teknisi: {
        key: "teknisi",
        label: "Teknisi",
        defaultDisplayName: "Teknisi",
        emailLabel: "Email Teknisi",
        emailPlaceholder: "teknisi@kima.co.id",
    },
};

function getRegisterRole(role) {
    return REGISTER_ROLES[role] ?? REGISTER_ROLES.admin;
}

function normalizeEmail(email) {
    return String(email ?? "").trim().toLowerCase();
}

async function verifyRegisterSecret(secretKey) {
    const response = await fetch("/api/register-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey }),
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Secret key tidak valid.");
    }

    return true;
}

export default function AdminRegisterPage({ onBackToLogin }) {
    const [accessGranted, setAccessGranted] = useState(false);
    const [secretKey, setSecretKey] = useState("");
    const [isVerifyingSecret, setIsVerifyingSecret] = useState(false);
    const [form, setForm] = useState({
        role: REGISTER_ROLES.admin.key,
        displayName: "Administrator",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [status, setStatus] = useState({ type: "", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const passwordHelp = useMemo(() => {
        if (!form.password) return "Minimal 8 karakter.";
        if (form.password.length < 8) return "Password terlalu pendek.";
        if (form.confirmPassword && form.password !== form.confirmPassword) return "Konfirmasi password belum sama.";
        return "Password siap digunakan.";
    }, [form.confirmPassword, form.password]);

    const selectedRole = getRegisterRole(form.role);

    const handleSecretSubmit = async (event) => {
        event.preventDefault();

        const trimmedSecretKey = secretKey.trim();
        if (!trimmedSecretKey) {
            setStatus({ type: "error", message: "Secret key wajib diisi." });
            return;
        }

        setIsVerifyingSecret(true);
        setStatus({ type: "", message: "" });

        try {
            await verifyRegisterSecret(trimmedSecretKey);
            setAccessGranted(true);
            setSecretKey("");
            setStatus({ type: "", message: "" });
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Secret key tidak valid.",
            });
        } finally {
            setIsVerifyingSecret(false);
        }
    };

    const updateField = (key, value) => {
        setForm((previous) => {
            if (key === "role") {
                const nextRole = getRegisterRole(value);
                const previousRole = getRegisterRole(previous.role);
                const shouldUseRoleDefaultName = previous.displayName.trim() === previousRole.defaultDisplayName;

                return {
                    ...previous,
                    role: nextRole.key,
                    displayName: shouldUseRoleDefaultName ? nextRole.defaultDisplayName : previous.displayName,
                };
            }

            return { ...previous, [key]: value };
        });
        setStatus({ type: "", message: "" });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const email = normalizeEmail(form.email);
        const role = getRegisterRole(form.role);
        const displayName = form.displayName.trim() || role.defaultDisplayName;

        if (!email) {
            setStatus({ type: "error", message: `${role.emailLabel} wajib diisi.` });
            return;
        }

        if (form.password.length < 8) {
            setStatus({ type: "error", message: "Password minimal 8 karakter." });
            return;
        }

        if (form.password !== form.confirmPassword) {
            setStatus({ type: "error", message: "Konfirmasi password tidak sama." });
            return;
        }

        setIsSubmitting(true);
        try {
            const signUpResult = await signUpInternalUser({ email, password: form.password, displayName, role: role.key });
            let notificationMessage = " Email notifikasi awal belum dikirim karena belum ada notifikasi operasional aktif untuk role ini.";

            try {
                const emailResult = await sendInitialNotificationEmails({
                    recipientUserId: signUpResult?.user?.id,
                    recipientEmail: email,
                    accessToken: signUpResult?.session?.access_token,
                });
                const sentCount = Number(emailResult?.sentCount ?? 0);
                const attemptedCount = Number(emailResult?.attemptedCount ?? 0);

                if (sentCount > 0) {
                    notificationMessage = ` ${sentCount} email notifikasi awal berhasil dikirim sesuai role.`;
                } else if (attemptedCount > 0) {
                    notificationMessage = " Email notifikasi awal sudah diproses, tetapi belum ada yang berhasil terkirim. Periksa log pengiriman email.";
                }
            } catch (notificationError) {
                const detail = notificationError instanceof Error ? notificationError.message : "pemicu email gagal dijalankan";
                notificationMessage = ` Akun dibuat, tetapi email notifikasi awal belum terkirim: ${detail}`;
            }

            setStatus({
                type: "success",
                message: `Akun ${role.label.toLowerCase()} berhasil dibuat dan sudah dapat digunakan.${notificationMessage}`,
            });
            setForm({
                role: role.key,
                displayName,
                email: "",
                password: "",
                confirmPassword: "",
            });
        } catch (error) {
            setStatus({
                type: "error",
                message: error instanceof Error ? error.message : `Gagal membuat akun ${role.label.toLowerCase()}.`,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0c12] font-inter text-white">
            <div className="absolute inset-0 bg-[url('/kima1.jpeg')] bg-cover bg-center opacity-60 saturate-75" />
            <div className="absolute inset-0 bg-[rgba(10,12,18,0.76)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(212,169,55,0.14)_0%,transparent_45%),radial-gradient(circle_at_20%_80%,rgba(0,104,123,0.12)_0%,transparent_45%)]" />

            <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
                <section className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.12] bg-[rgba(15,20,30,0.82)] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-gold-accent">
                                Internal Access
                            </p>
                            <h1 className="text-2xl font-black tracking-tight text-white">
                                {accessGranted ? "Register Pengguna" : "Akses Register"}
                            </h1>
                            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/65">
                                {accessGranted
                                    ? "Buat akun Supabase Auth dengan role super admin, admin, atau teknisi untuk Sistem FO KIMA."
                                    : "Masukkan secret key internal untuk membuka form registrasi pengguna."}
                            </p>
                        </div>
                        <img alt="Logo PT KIMA" className="h-10 w-auto brightness-0 invert" src="/logo-kima.png" />
                    </div>

                    {status.message && (
                        <div
                            className={`mb-5 rounded-xl border px-4 py-3 text-xs font-bold leading-relaxed ${
                                status.type === "success"
                                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                    : "border-red-400/25 bg-red-500/10 text-red-200"
                            }`}
                        >
                            {status.message}
                        </div>
                    )}

                    {!accessGranted ? (
                        <form className="space-y-4" onSubmit={handleSecretSubmit}>
                            <label className="block">
                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                    Secret Key
                                </span>
                                <input
                                    autoComplete="off"
                                    autoFocus
                                    className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                    onChange={(event) => {
                                        setSecretKey(event.target.value);
                                        setStatus({ type: "", message: "" });
                                    }}
                                    placeholder="Masukkan secret key"
                                    type="password"
                                    value={secretKey}
                                />
                            </label>

                            <button
                                className="mt-2 flex w-full items-center justify-center rounded-lg border border-gold-accent/40 bg-gold-accent px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-gold-glow transition-[opacity,transform,box-shadow] duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                                disabled={isVerifyingSecret}
                                type="submit"
                            >
                                {isVerifyingSecret ? "Memeriksa..." : "Lanjut Register"}
                            </button>
                        </form>
                    ) : (
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                Role
                            </span>
                            <select
                                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                onChange={(event) => updateField("role", event.target.value)}
                                value={form.role}
                            >
                                {Object.values(REGISTER_ROLES).map((roleOption) => (
                                    <option className="bg-[#151923] text-white" key={roleOption.key} value={roleOption.key}>
                                        {roleOption.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                Nama Tampilan
                            </span>
                            <input
                                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                onChange={(event) => updateField("displayName", event.target.value)}
                                placeholder="username"
                                type="text"
                                value={form.displayName}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                {selectedRole.emailLabel}
                            </span>
                            <input
                                autoComplete="email"
                                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                onChange={(event) => updateField("email", event.target.value)}
                                placeholder={selectedRole.emailPlaceholder}
                                type="email"
                                value={form.email}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                Password
                            </span>
                            <input
                                autoComplete="new-password"
                                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                onChange={(event) => updateField("password", event.target.value)}
                                placeholder="Minimal 8 karakter"
                                type="password"
                                value={form.password}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                                Konfirmasi Password
                            </span>
                            <input
                                autoComplete="new-password"
                                className="w-full rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm font-semibold text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30 focus:border-gold-accent/60 focus:bg-white/10 focus:ring-2 focus:ring-gold-accent/10"
                                onChange={(event) => updateField("confirmPassword", event.target.value)}
                                placeholder="Ulangi password"
                                type="password"
                                value={form.confirmPassword}
                            />
                            <span className="mt-2 block text-[10px] font-bold text-white/45">{passwordHelp}</span>
                        </label>

                        <button
                            className="mt-2 flex w-full items-center justify-center rounded-lg border border-gold-accent/40 bg-gold-accent px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-gold-glow transition-[opacity,transform,box-shadow] duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={isSubmitting}
                            type="submit"
                        >
                            {isSubmitting ? "Membuat akun..." : `Buat ${selectedRole.label}`}
                        </button>
                    </form>
                    )}

                    <button
                        className="mt-5 w-full text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/55 transition-colors duration-200 hover:text-gold-accent"
                        onClick={onBackToLogin}
                        type="button"
                    >
                        Kembali ke Login
                    </button>
                </section>
            </main>
        </div>
    );
}
