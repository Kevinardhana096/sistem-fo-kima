import { useEffect, useState, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import { API_BASE_URL, fetchJson, readFileAsDataUrl } from "../../app/utils";

const GlassFieldInput = ({ label, type = "text", value, onChange, placeholder = "", icon }) => {
    return (
        <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                {label}
            </label>
            <div className="relative group">
                {icon && (
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl text-white/20 group-focus-within:text-gold-accent transition-all duration-300 pointer-events-none">
                        {icon}
                    </span>
                )}
                <input
                    className={`w-full h-14 rounded-2xl bg-black/20 border border-white/10 ${icon ? "pl-14" : "px-6"} pr-6 text-sm font-bold placeholder:text-white/10 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5 shadow-inner-glass ${type === "date" ? "text-white/40 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" : "text-white"} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(e) => type === "date" && e.preventDefault()}
                    onClick={(e) => type === "date" && e.target.showPicker && e.target.showPicker()}
                    placeholder={placeholder}
                    type={type}
                    value={value}
                />
            </div>
        </div>
    );
};

const GlassCustomSelect = ({ label, value, onChange, options, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="space-y-3" ref={containerRef}>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                {label}
            </label>
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full h-14 rounded-2xl bg-black/20 border flex items-center pl-14 pr-12 text-sm font-bold transition-all cursor-pointer shadow-inner-glass relative z-20 ${isOpen ? "border-gold-accent/60 bg-black/40 shadow-gold-glow" : "border-white/10 text-white/70 hover:border-white/30"}`}
                >
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl transition-all duration-300" style={{ color: isOpen ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                        {icon}
                    </span>
                    <span className="truncate uppercase tracking-widest">{selectedOption.label}</span>
                    <span className={`material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 transition-transform duration-300 ${isOpen ? "rotate-180 text-gold-accent" : "text-white/20"}`}>
                        expand_more
                    </span>
                </div>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 p-2 rounded-2xl bg-black/60 backdrop-blur-3xl border border-white/10 shadow-glass-depth z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest cursor-pointer transition-all mb-1 last:mb-0 ${value === opt.value ? "bg-gold-accent/10 text-gold-accent border border-gold-accent/20 shadow-gold-glow" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
                            >
                                {opt.label}
                                {value === opt.value && <span className="material-symbols-outlined ml-auto text-sm">check_circle</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

function IspAdminFormPage({ initialData = null, mode = "create", onCancel, onNavigate, onSaved }) {
    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        userEmail: "",
        userPassword: "",
        contractReference: "",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",
        bakFileName: "",
        bakFileDataUrl: "",
        contractFileName: "",
        contractFileDataUrl: "",
        logoFileDataUrl: "",
        packageName: "Core",
        packageQuantity: "",
    });
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditMode = mode === "edit";

    useEffect(() => {
        if (!initialData) return;
        setForm((prev) => ({
            ...prev,
            name: initialData.name ?? "",
            status: initialData.status ?? "aktif",
            logoUrl: initialData.logoUrl ?? "",
        }));
    }, [initialData]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) {
            setSubmitError("Nama ISP wajib diisi.");
            return;
        }
        if (!isEditMode && !form.userEmail.trim()) {
            setSubmitError("Email wajib diisi.");
            return;
        }
        if (!isEditMode && !form.userPassword) {
            setSubmitError("Password wajib diisi.");
            return;
        }
        if (!isEditMode && form.contractPeriodStart && form.contractPeriodEnd && form.contractPeriodStart > form.contractPeriodEnd) {
            setSubmitError("Periode berjalan akhir tidak boleh lebih awal dari tanggal mulai.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");
        try {
            const endpoint = isEditMode && initialData?.id
                ? `${API_BASE_URL}/api/isps/${initialData.id}`
                : `${API_BASE_URL}/api/isps`;
            
            const payload = isEditMode
                ? {
                    name: form.name.trim(),
                    status: form.status,
                    logoUrl: form.logoFileDataUrl || form.logoUrl || undefined,
                }
                : {
                    name: form.name.trim(),
                    status: form.status,
                    contractReference: form.contractReference.trim() || undefined,
                    contractStartDate: form.contractStartDate || null,
                    contractPeriodStart: form.contractPeriodStart || null,
                    contractPeriodEnd: form.contractPeriodEnd || null,
                    bakFileDataUrl: form.bakFileDataUrl || undefined,
                    bakFileName: form.bakFileName || undefined,
                    contractFileDataUrl: form.contractFileDataUrl || undefined,
                    contractFileName: form.contractFileName || undefined,
                    logoUrl: form.logoFileDataUrl || undefined,
                    userEmail: form.userEmail.trim(),
                    userPassword: form.userPassword,
                    packageName: form.packageName.trim(),
                    packageQuantity: form.packageQuantity,
                };

            const result = await fetchJson(endpoint, {
                method: isEditMode ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (onSaved) await onSaved(result);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : "Terjadi kesalahan.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            {/* Background Glows */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-gold-accent/5 blur-[120px]" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gold-accent/5 blur-[100px]" />
            </div>

            <form className="mx-auto max-w-7xl space-y-10 pb-20 pt-4 px-6" onSubmit={handleSubmit}>
                {/* Header Section */}
                <header className="flex flex-col justify-between gap-8 md:flex-row md:items-end mb-6 px-2">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-gold-accent/10 border border-gold-accent/20">
                            <span className="w-2 h-2 rounded-full bg-gold-accent animate-pulse shadow-gold-glow" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-accent">
                                {isEditMode ? "Modul Pengeditan" : "Modul Pendaftaran"}
                            </span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white leading-none">
                            {isEditMode ? "Edit" : "Daftar"} <span className="text-gold-accent italic">Mitra ISP</span>
                        </h1>
                        <p className="max-w-2xl text-base font-medium leading-relaxed text-white/60">
                            Silakan lengkapi formulir di bawah ini untuk {isEditMode ? "memperbarui data" : "mendaftarkan mitra ISP baru"} ke dalam sistem.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            className="h-12 px-6 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-glass-depth"
                            onClick={onCancel} 
                            type="button"
                        >
                            Batal
                        </button>
                        <button 
                            className="h-12 px-8 rounded-xl btn-premium text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-gold-glow active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none" 
                            disabled={isSubmitting} 
                            type="submit"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                    Memproses...
                                </span>
                            ) : (
                                isEditMode ? "Simpan Perubahan" : "Tambah ISP"
                            )}
                        </button>
                    </div>
                </header>

                {submitError && (
                    <div className="mx-2 p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-bold backdrop-blur-md animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined">warning</span>
                            {submitError}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-8 items-start">
                    {/* Left Column - Core Info */}
                    <div className="space-y-8">
                        {/* Section: Identitas ISP */}
                        <div className="glass-card rounded-premium p-8 border-white/20 shadow-glass-depth relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
                            
                            <div className="flex items-center gap-3 mb-8">
                                <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">Identitas ISP</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Logo Perusahaan (Opsional)</label>
                                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-black/20 border border-white/10 border-dashed hover:border-gold-accent/40 transition-all group cursor-pointer relative overflow-hidden">
                                        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                            {(form.logoFileDataUrl || form.logoUrl) ? (
                                                <img 
                                                    src={form.logoFileDataUrl || form.logoUrl} 
                                                    alt="Preview" 
                                                    className="h-full w-full object-contain p-2"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-white/20">
                                                    <span className="material-symbols-outlined text-4xl mb-1">image</span>
                                                    <span className="text-[8px] font-black uppercase tracking-widest">No Logo</span>
                                                </div>
                                            )}
                                            <input
                                                accept="image/png,image/jpeg,image/webp"
                                                className="absolute inset-0 cursor-pointer opacity-0 z-10"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) readFileAsDataUrl(file).then(url => setForm(p => ({ ...p, logoFileDataUrl: url })));
                                                }}
                                                type="file"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <p className="text-sm font-bold text-white uppercase tracking-widest">Pilih Berkas Logo</p>
                                            <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest leading-relaxed">Format: PNG/JPG (Maks. 2MB). Gunakan latar transparan untuk hasil terbaik.</p>
                                            {(form.logoFileDataUrl || form.logoUrl) && (
                                                <button 
                                                    className="mt-2 text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 flex items-center gap-1 transition-colors z-20 relative"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setForm(p => ({ ...p, logoFileDataUrl: "", logoUrl: "" }));
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                    Hapus Logo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <GlassFieldInput 
                                        label="Nama Perusahaan ISP" 
                                        icon="corporate_fare"
                                        placeholder="Contoh: PT. Internet Cepat Indonesia"
                                        value={form.name} 
                                        onChange={(val) => setForm(p => ({ ...p, name: val }))} 
                                    />
                                    
                                    <GlassCustomSelect 
                                        label="Status Operasional" 
                                        icon="verified_user"
                                        value={form.status} 
                                        onChange={(val) => setForm(p => ({ ...p, status: val }))} 
                                        options={[
                                            { value: "aktif", label: "BEROPERASI" }, 
                                            ...(isEditMode ? [{ value: "expired", label: "MASA BERLAKU HABIS" }] : []),
                                            { value: "berhenti", label: "BERHENTI" }
                                        ]} 
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                                            Paket (Jumlah Core)
                                        </label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl text-white/20 group-focus-within:text-gold-accent transition-all duration-300 pointer-events-none">
                                                hub
                                            </span>
                                            <input
                                                className="w-full h-14 rounded-2xl bg-black/20 border border-white/10 pl-14 pr-20 text-sm font-bold text-white placeholder:text-white/10 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5 shadow-inner-glass"
                                                onChange={(e) => setForm(p => ({ ...p, packageQuantity: e.target.value }))}
                                                placeholder="0"
                                                type="number"
                                                value={form.packageQuantity}
                                            />
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <span className="text-[10px] font-black text-gold-accent uppercase tracking-widest bg-gold-accent/10 px-3 py-1 rounded-lg border border-gold-accent/20 shadow-gold-glow">
                                                    CORE
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Section: Akun Akses */}
                        {!isEditMode && (
                            <div className="glass-card rounded-premium p-8 border-white/20 shadow-glass-depth">
                                <div className="flex items-center gap-3 mb-8">
                                    <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <h3 className="text-xl font-black text-white uppercase tracking-widest">Akun Akses</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <GlassFieldInput
                                        label="Alamat Email Utama"
                                        icon="mail"
                                        placeholder="admin@isp.com"
                                        type="email"
                                        value={form.userEmail}
                                        onChange={(val) => setForm(p => ({ ...p, userEmail: val }))}
                                    />
                                    <GlassFieldInput
                                        label="Kata Sandi Akses"
                                        icon="lock"
                                        placeholder="Min. 8 Karakter"
                                        type="password"
                                        value={form.userPassword}
                                        onChange={(val) => setForm(p => ({ ...p, userPassword: val }))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </form>
        </AppShell>
    );
}

export default IspAdminFormPage;
