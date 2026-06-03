import { useEffect, useMemo, useState } from "react";
import { signIn } from "@/lib/supabase";

// Dev-only quick login. Credentials are read from local env vars (VITE_DEV_*)
// and are NEVER hardcoded or committed (see frontend/.env.example).
// An account only appears when both its email and password env vars are set,
// and the panel is rendered only in development builds.
const devQuickAccounts = [
    { key: "admin", label: "Admin", description: "Akses penuh", email: import.meta.env.VITE_DEV_ADMIN_EMAIL, password: import.meta.env.VITE_DEV_ADMIN_PASSWORD },
    { key: "teknisi", label: "Teknisi", description: "Operasional lapangan", email: import.meta.env.VITE_DEV_TEKNISI_EMAIL, password: import.meta.env.VITE_DEV_TEKNISI_PASSWORD },
    { key: "isp", label: "ISP", description: "Mitra ISP", email: import.meta.env.VITE_DEV_ISP_EMAIL, password: import.meta.env.VITE_DEV_ISP_PASSWORD },
].filter((account) => account.email && account.password);

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

function getViewportWidth() {
    return typeof window === "undefined" ? 1024 : window.innerWidth;
}

export default function LoginPage({ onLoginSuccess }) {
    const [activePanel, setActivePanel] = useState("login");
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(getViewportWidth);

    useEffect(() => {
        const handleResize = () => setViewportWidth(getViewportWidth());
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const isMobile = viewportWidth < 640;
    const isTablet = viewportWidth >= 640 && viewportWidth < 960;
    const isStacked = viewportWidth < 860;
    const panelPadding = isMobile ? "1.25rem" : isTablet ? "1.5rem" : "2rem";
    const headingSize = isMobile ? "1.1rem" : "1.25rem";
    const cardRadius = isMobile ? "1rem" : "1.25rem";

    const adminWhatsAppNumber = import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER ?? "";
    const adminWhatsAppLink = useMemo(() => buildWhatsAppLink(adminWhatsAppNumber), [adminWhatsAppNumber]);
    const canOpenWhatsApp = Boolean(adminWhatsAppLink);
    const isDevelopment = Boolean(import.meta.env.DEV);

    const submitLogin = async (credentials) => {
        setIsSubmitting(true);
        setError("");
        try {
            const { session, user } = await signIn(credentials.email, credentials.password);
            if (onLoginSuccess) {
                await onLoginSuccess({ session, user });
            }
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Login gagal. Silakan coba lagi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        if (!form.email.trim()) { setError("Email wajib diisi."); return; }
        if (!form.password) { setError("Password wajib diisi."); return; }
        await submitLogin({ email: form.email.trim(), password: form.password });
    };

    const inputStyle = {
        width: "100%",
        fontSize: "0.7rem",
        padding: "0.5rem 0.75rem",
        borderRadius: "0.5rem",
        outline: "none",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "rgba(255,255,255,0.92)",
        transition: "border-color 0.2s ease, background 0.2s ease",
        boxSizing: "border-box",
    };

    return (
        <div
            style={{
                position: "relative",
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "center",
                overflowX: "hidden",
                overflowY: "auto",
                padding: isMobile ? "1rem 0" : "1.5rem 0",
                fontFamily: "'Inter', sans-serif",
                background: "#0a0c12",
            }}
        >
            {/* Background layers */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "url(/kima1.jpeg)", backgroundSize: "cover", backgroundPosition: "center", filter: "brightness(0.68) saturate(0.82) contrast(0.95)" }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(10,12,18,0.70)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, zIndex: 2, background: "radial-gradient(circle at 80% 20%, rgba(212,169,55,0.14) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(0,104,123,0.12) 0%, transparent 45%)", pointerEvents: "none" }} />


            {/* Card wrapper */}
            <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: isStacked ? 480 : 720, margin: isMobile ? "0 1rem" : "0 1.5rem" }}>
                <div
                    style={{
                        position: "relative",
                        display: "grid",
                        gridTemplateColumns: isStacked ? "1fr" : "1fr 1fr",
                        borderRadius: cardRadius,
                        overflow: "hidden",
                        minHeight: isStacked ? "auto" : 440,
                        boxShadow: "0 32px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.12)",
                    }}
                >


                    {/* ─── LEFT: Bantuan Akses (always rendered, revealed when sliding panel moves away) ─── */}
                    <div
                        style={{
                            padding: panelPadding,
                            display: activePanel === "forgot" || !isStacked ? "flex" : "none",
                            flexDirection: "column",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.13)",
                            minHeight: isStacked ? "auto" : "unset",
                            order: isStacked ? 1 : 0,
                        }}
                    >
                        <div style={{ marginBottom: "2rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <div style={{ width: 4, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #f0c040, rgba(212,169,55,0.3))" }} />
                                <h3 style={{ fontSize: headingSize, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 12px rgba(240,192,64,0.25)" }}>Bantuan Akses</h3>
                            </div>
                            <p style={{ color: "rgba(255,255,255,0.9)", marginTop: "0.75rem", fontSize: "0.7rem", lineHeight: 1.6 }}>
                                Pemulihan akun memerlukan verifikasi Administrator TI. Silakan hubungi unit terkait melalui tautan di bawah ini.
                            </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <a
                                href={canOpenWhatsApp ? adminWhatsAppLink : "#"}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "0.625rem",
                                    borderRadius: "0.5rem",
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                    color: "#ffffff",
                                    background: "linear-gradient(135deg, rgba(240,192,64,0.9), rgba(212,169,55,0.95))",
                                    border: "1px solid rgba(240,192,64,0.4)",
                                    boxShadow: "0 8px 24px rgba(212,169,55,0.3)",
                                    textDecoration: "none",
                                    transition: "transform 0.2s ease, background 0.2s ease",
                                }}
                            >
                                Hubungi Admin via WhatsApp
                            </a>
                            <button
                                onClick={() => setActivePanel("login")}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.82)", letterSpacing: "0.08em", textTransform: "uppercase", transition: "color 0.2s ease" }}
                                onMouseEnter={e => e.target.style.color = "#f0c040"}
                                onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.82)"}
                            >
                                ← Kembali ke Halaman Login
                            </button>
                        </div>
                    </div>

                    {/* ─── RIGHT: Login Form (always rendered, fixed size) ─── */}
                    <div
                        style={{
                            padding: panelPadding,
                            display: activePanel === "login" || !isStacked ? "flex" : "none",
                            flexDirection: "column",
                            justifyContent: "center",
                            background: "rgba(255,255,255,0.13)",
                            order: isStacked ? 1 : 0,
                        }}
                    >
                        <div style={{ marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <div style={{ width: 4, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #f0c040, rgba(212,169,55,0.3))" }} />
                                <h3 style={{ fontSize: headingSize, fontWeight: 800, color: "#ffffff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 12px rgba(240,192,64,0.25)" }}>Sign In</h3>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {error && (
                                <div className="animate-shake" style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderRadius: "0.75rem", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "0.875rem 1rem", fontSize: "0.75rem", fontWeight: 600 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)", marginBottom: "0.5rem" }}>Email</label>
                                <input
                                    type="email"
                                    placeholder="nama@kima.co.id"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    style={inputStyle}
                                    onFocus={e => { e.target.style.borderColor = "rgba(240,192,64,0.6)"; e.target.style.background = "rgba(255,255,255,0.11)"; }}
                                    onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.background = "rgba(255,255,255,0.07)"; }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.85)", marginBottom: "0.5rem" }}>Password</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        style={{ ...inputStyle, paddingRight: "2.75rem" }}
                                        onFocus={e => { e.target.style.borderColor = "rgba(240,192,64,0.6)"; e.target.style.background = "rgba(255,255,255,0.11)"; }}
                                        onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.background = "rgba(255,255,255,0.07)"; }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        tabIndex={-1}
                                        style={{
                                            position: "absolute",
                                            right: "0.75rem",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "0.25rem",
                                            display: "flex",
                                            alignItems: "center",
                                            color: "rgba(255,255,255,0.45)",
                                            transition: "color 0.2s",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = "rgba(240,192,64,0.85)"}
                                        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.45)"}
                                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                                    >
                                        {showPassword ? (
                                            /* Eye-off icon */
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            /* Eye icon */
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => setActivePanel("forgot")}
                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.6rem", fontWeight: 700, color: "rgba(240,192,64,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", transition: "color 0.2s" }}
                                        onMouseEnter={e => e.target.style.color = "#f0c040"}
                                        onMouseLeave={e => e.target.style.color = "rgba(240,192,64,0.8)"}
                                    >
                                        Lupa Password?
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                style={{
                                    width: "100%",
                                    padding: "0.625rem",
                                    borderRadius: "0.5rem",
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                    border: "1px solid rgba(240,192,64,0.4)",
                                    background: isSubmitting ? "rgba(240,192,64,0.3)" : "linear-gradient(135deg, rgba(240,192,64,0.88), rgba(212,169,55,0.92))",
                                    color: "#ffffff",
                                    boxShadow: isSubmitting ? "none" : "0 8px 24px rgba(212,169,55,0.28)",
                                    cursor: isSubmitting ? "not-allowed" : "pointer",
                                    opacity: isSubmitting ? 0.6 : 1,
                                    transition: "opacity 0.2s ease",
                                }}
                            >
                                {isSubmitting ? "Memverifikasi..." : "Masuk"}
                            </button>
                        </form>

                        {isDevelopment && devQuickAccounts.length > 0 && (
                            <div style={{ marginTop: "1.25rem", borderRadius: "1rem", padding: "1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                                    <div>
                                        <p style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "#f0c040", margin: 0 }}>Dev Access</p>
                                        <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.82)", margin: "0.25rem 0 0" }}>Quick login untuk uji role</p>
                                    </div>
                                    <span style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f0c040", background: "rgba(240,192,64,0.12)", border: "1px solid rgba(240,192,64,0.22)", borderRadius: "999px", padding: "0.2rem 0.6rem" }}>Dev</span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(3, minmax(0, 1fr))" : "repeat(3, 1fr)", gap: "0.5rem" }}>
                                    {devQuickAccounts.map(account => (
                                        <button
                                            key={account.key}
                                            type="button"
                                            disabled={isSubmitting}
                                            onClick={() => {
                                                setForm({ email: account.email, password: account.password });
                                                setError("");
                                                void submitLogin({ email: account.email, password: account.password });
                                            }}
                                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.625rem", padding: "0.625rem 0.5rem", textAlign: "left", cursor: "pointer", transition: "background 0.2s ease, border-color 0.2s ease", opacity: isSubmitting ? 0.5 : 1 }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(240,192,64,0.1)"; e.currentTarget.style.border = "1px solid rgba(240,192,64,0.28)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; }}
                                        >
                                            <p style={{ fontSize: "0.75rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>{account.label}</p>
                                            <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.82)", margin: "0.2rem 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                            <span style={{ fontSize: "0.55rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.65)", flexShrink: 0 }}>Connect</span>
                            <div style={{ height: 1, flexGrow: 1, background: "rgba(255,255,255,0.2)" }} />
                            <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0 }}>
                                {[
                                    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
                                    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
                                    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
                                ].map((d, i) => (
                                    <a key={i} href="#" style={{ color: "rgba(255,255,255,0.65)", transition: "all 0.2s ease", display: "flex" }}
                                        onMouseEnter={e => { e.currentTarget.style.color = "#f0c040"; e.currentTarget.style.transform = "scale(1.15)"; }}
                                        onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; e.currentTarget.style.transform = "scale(1)"; }}
                                    >
                                        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ─── BRANDING PANEL: Absolute, slides left→right ─── */}
                    <div
                        style={{
                            position: isStacked ? "relative" : "absolute",
                            top: 0,
                            left: 0,
                            height: isStacked ? "auto" : "100%",
                            width: isStacked ? "100%" : "50%",
                            zIndex: 20,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: isStacked ? "1.5rem" : 0,
                            padding: panelPadding,
                            overflow: "hidden",
                            background: "rgba(10,12,18,0.97)",
                            borderRight: isStacked ? "none" : "1px solid rgba(255,255,255,0.08)",
                            borderBottom: isStacked ? "1px solid rgba(255,255,255,0.08)" : "none",
                            transition: isStacked ? "none" : "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                            transform: isStacked ? "none" : activePanel === "login" ? "translateX(0%)" : "translateX(100%)",
                            willChange: isStacked ? "auto" : "transform",
                            order: isStacked ? 0 : 0,
                        }}
                    >
                        {/* Glow accent inside branding */}
                        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(212,169,55,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

                        <div style={{ position: "relative", zIndex: 1 }}>
                            <img alt="Logo PT KIMA" style={{ height: isMobile ? 32 : 40, width: "auto", filter: "brightness(0) invert(1)" }} src="/logo-kima.png" />
                            <div style={{ marginTop: isStacked ? "1rem" : "2.5rem" }}>
                                <h2 style={{ fontSize: isMobile ? "1.1rem" : "1.35rem", fontWeight: 300, color: "#ffffff", lineHeight: 1.35, margin: 0 }}>
                                    Selamat Datang di<br />
                                    <span style={{ fontWeight: 800, color: "#f0c040" }}>Digital Archive</span>
                                </h2>
                                <div style={{ height: 2, width: 32, background: "linear-gradient(90deg, #f0c040, transparent)", borderRadius: 2, marginTop: "1rem" }} />
                                <p style={{ color: "rgba(255,255,255,0.9)", marginTop: "0.75rem", fontSize: "0.7rem", lineHeight: 1.6, maxWidth: isStacked ? "100%" : 240 }}>
                                    Sistem manajemen arsip terintegrasi untuk efisiensi dan keamanan data PT Kawasan Industri Makassar.
                                </p>
                            </div>
                        </div>

                        <div style={{ position: "relative", zIndex: 1 }}>
                            <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.7)", margin: 0 }}>© 2026 PT Kawasan Industri Makassar.</p>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: isMobile ? "0.2em" : "0.45em", color: "rgba(255,255,255,0.55)" }}>
                        Powered by IT Support KIMA
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                @keyframes bgZoom {
                    0%   { transform: scale(1);    }
                    100% { transform: scale(1.08); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 2; }
                input::placeholder { color: rgba(255,255,255,0.38); }
                input:-webkit-autofill {
                    -webkit-box-shadow: 0 0 0 1000px rgba(20,22,30,0.8) inset !important;
                    -webkit-text-fill-color: rgba(255,255,255,0.9) !important;
                    caret-color: rgba(255,255,255,0.9);
                }
            `}</style>
        </div>
    );
}
