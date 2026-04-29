import { useMemo, useState } from "react";
import heroImage from "../../assets/hero.png";
import { FieldInput } from "../../components/shared/AppShared";

function normalizeWhatsAppNumber(rawNumber) {
    const trimmed = String(rawNumber ?? "").trim();
    if (!trimmed) return "";
    return trimmed.replace(/[\s()+-]/g, "");
}

function buildWhatsAppLink(rawNumber) {
    const normalized = normalizeWhatsAppNumber(rawNumber);
    if (!normalized) return "";
    return `https://wa.me/${normalized}`;
}

export default function LoginPage({ onLoginSuccess }) {
    const [activePanel, setActivePanel] = useState("login");
    const [form, setForm] = useState({
        identifier: "",
        password: "",
    });
    const [error, setError] = useState("");

    const adminWhatsAppNumber = import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER ?? "";
    const adminWhatsAppLink = useMemo(
        () => buildWhatsAppLink(adminWhatsAppNumber),
        [adminWhatsAppNumber],
    );
    const canOpenWhatsApp = Boolean(adminWhatsAppLink);

    return (
        <div
            className="min-h-screen bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
        >
            <div className="min-h-screen bg-slate-950/40 px-4 py-10">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
                    <div className="w-full overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
                        <div className="relative">
                            <div
                                className={`flex w-[200%] transition-transform duration-500 ease-in-out ${activePanel === "login" ? "translate-x-0" : "-translate-x-1/2"}`}
                            >
                                <section className="grid w-1/2 grid-cols-1 md:grid-cols-2">
                                    <div className="flex flex-col items-center justify-center gap-4 border-b border-slate-100 bg-surface-container-lowest p-10 md:border-b-0 md:border-r">
                                        <img
                                            alt="Logo perusahaan"
                                            className="h-28 w-28 rounded-3xl object-contain"
                                            src={heroImage}
                                        />
                                        <div className="text-center">
                                            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                                                Sistem Arsip
                                            </p>
                                            <h1 className="mt-2 text-2xl font-extrabold text-on-surface">
                                                Login
                                            </h1>
                                        </div>
                                    </div>

                                    <div className="p-10">
                                        <form
                                            className="space-y-5"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                setError("");

                                                if (!form.identifier.trim()) {
                                                    setError("Email/Username wajib diisi.");
                                                    return;
                                                }

                                                if (!form.password) {
                                                    setError("Password wajib diisi.");
                                                    return;
                                                }

                                                if (onLoginSuccess) {
                                                    onLoginSuccess({
                                                        identifier: form.identifier.trim(),
                                                        password: form.password,
                                                    });
                                                }
                                            }}
                                        >
                                            {error && (
                                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                                    {error}
                                                </div>
                                            )}

                                            <FieldInput
                                                label="Email / Username"
                                                placeholder="email atau username"
                                                value={form.identifier}
                                                onChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        identifier: value,
                                                    }))
                                                }
                                            />

                                            <div>
                                                <FieldInput
                                                    label="Password"
                                                    placeholder="Masukkan password"
                                                    type="password"
                                                    value={form.password}
                                                    onChange={(value) =>
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            password: value,
                                                        }))
                                                    }
                                                />
                                                <button
                                                    className="mt-2 text-xs font-bold text-primary hover:underline"
                                                    onClick={() => {
                                                        setError("");
                                                        setActivePanel("forgot");
                                                    }}
                                                    type="button"
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>

                                            <button
                                                className="w-full rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95"
                                                type="submit"
                                            >
                                                Masuk
                                            </button>
                                        </form>
                                    </div>
                                </section>

                                <section className="grid w-1/2 grid-cols-1 md:grid-cols-2">
                                    <div className="flex flex-col justify-center gap-4 border-b border-slate-100 bg-surface-container-lowest p-10 md:border-b-0 md:border-r">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                                                Forgot Password
                                            </p>
                                            <h2 className="mt-2 text-2xl font-extrabold text-on-surface">
                                                Hubungi Admin
                                            </h2>
                                        </div>

                                        <p className="text-sm font-medium text-on-surface-variant">
                                            Untuk reset password, silakan hubungi admin.
                                        </p>

                                        <a
                                            className={`inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-opacity ${canOpenWhatsApp ? "bg-primary hover:opacity-95" : "bg-slate-300 cursor-not-allowed"}`}
                                            href={canOpenWhatsApp ? adminWhatsAppLink : undefined}
                                            rel={canOpenWhatsApp ? "noreferrer" : undefined}
                                            target={canOpenWhatsApp ? "_blank" : undefined}
                                            aria-disabled={!canOpenWhatsApp}
                                            onClick={(event) => {
                                                if (!canOpenWhatsApp) {
                                                    event.preventDefault();
                                                }
                                            }}
                                        >
                                            WhatsApp Admin
                                        </a>

                                        <button
                                            className="text-left text-xs font-bold text-primary hover:underline"
                                            onClick={() => {
                                                setActivePanel("login");
                                            }}
                                            type="button"
                                        >
                                            Kembali ke login
                                        </button>
                                    </div>

                                    <div className="flex flex-col items-center justify-center gap-4 p-10">
                                        <img
                                            alt="Logo perusahaan"
                                            className="h-28 w-28 rounded-3xl object-contain"
                                            src={heroImage}
                                        />
                                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                                            Support
                                        </p>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
