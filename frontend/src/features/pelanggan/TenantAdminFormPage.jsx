import { useEffect, useState, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import api, { getApiErrorDetails } from "../../lib/api";
import { uploadFileForRecord } from "../../lib/files";
import DateInput from "../../components/shared/DateInput";

const getTodayLocalIso = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const deriveOperationalStatus = (contractPeriodStart, contractPeriodEnd, fallbackStatus = "aktif") => {
    const todayIso = getTodayLocalIso();
    const periodStart = String(contractPeriodStart ?? "").slice(0, 10);
    const periodEnd = String(contractPeriodEnd ?? "").slice(0, 10);
    const normalizedFallback = String(fallbackStatus ?? "").trim().toLowerCase();

    if (periodStart && periodStart > todayIso) return "belum_beroperasi";
    if (periodEnd && periodEnd < todayIso) return "expired";
    if (["berhenti", "nonaktif"].includes(normalizedFallback)) return normalizedFallback;
    if (["expired", "belum_diperpanjang"].includes(normalizedFallback)) return "expired";
    return "aktif";
};

const GlassFieldInput = ({ label, type = "text", value, onChange, placeholder = "", icon, min, onKeyDown, error = "", onRawChange }) => {
    const inputClass = `w-full h-9 rounded-xl bg-black/20 border backdrop-blur-md ${error ? "border-rose-500/70 ring-2 ring-rose-500/10" : "border-white/10 focus:border-gold-accent/40 focus:ring-2 focus:ring-gold-accent/10"} ${icon ? "pl-9" : "px-3"} pr-3 text-[10px] font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 shadow-inner-glass [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                {label}
            </label>
            <div className="relative group">
                {icon && (
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-all duration-300 pointer-events-none" style={{ fontSize: "14px" }}>
                        {icon}
                    </span>
                )}
                {type === "date" ? (
                    <DateInput
                        value={value}
                        onChange={onChange}
                        className="w-full h-9 rounded-xl bg-black/20 border backdrop-blur-md shadow-inner-glass transition-all focus-within:bg-black/40 focus-within:ring-2 focus-within:ring-gold-accent/10 focus-within:border-gold-accent/40 border-white/10"
                        inputClass={`w-full h-full bg-transparent ${icon ? "pl-9" : "px-3"} pr-9 text-[10px] font-bold text-white placeholder:text-white/20 outline-none ${error ? "border-rose-500/70 ring-2 ring-rose-500/10 rounded-xl" : ""}`}
                    />
                ) : (
                    <input
                        className={inputClass}
                        onChange={(event) => {
                            if (onRawChange) {
                                onRawChange(event);
                            } else if (onChange) {
                                onChange(event.target.value);
                            }
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={placeholder}
                        type={type}
                        value={value}
                        min={min}
                    />
                )}
            </div>
            {error && <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">{error}</p>}
        </div>
    );
};

const GlassCustomSelect = ({ label, value, onChange, options, icon, heightClass = "h-9", iconOnly = false }) => {
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
        <div className={`space-y-1.5 relative ${isOpen ? "z-50" : "z-0"}`} ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`rounded-xl bg-black/20 border flex items-center justify-center transition-all cursor-pointer shadow-inner-glass relative z-20 backdrop-blur-md ${isOpen ? "border-gold-accent/60 bg-black/40 shadow-gold-glow" : "border-white/10 text-white/70 hover:border-white/30"} ${heightClass} ${iconOnly ? "w-11 px-0" : icon ? "w-full pl-9 pr-8 text-[10px] font-black" : "w-full px-3 text-[10px] font-black"}`}
                >
                    {icon && (
                        <span className={`material-symbols-outlined transition-all duration-300 ${iconOnly ? "" : "absolute left-2.5 top-1/2 -translate-y-1/2"}`} style={{ fontSize: "14px", color: isOpen ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                            {icon}
                        </span>
                    )}
                    {!iconOnly && <span className="truncate uppercase tracking-widest">{selectedOption.label}</span>}
                    {!iconOnly && (
                        <span className={`material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 transition-transform duration-300 ${isOpen ? "rotate-180 text-gold-accent" : "text-white/20"}`} style={{ fontSize: "14px" }}>
                            expand_more
                        </span>
                    )}
                </div>

                {isOpen && (
                    <div className={`absolute top-full mt-2 p-1.5 rounded-xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-glass-depth z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${iconOnly ? "right-0 w-40" : "left-0 right-0"}`}>
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all mb-1 last:mb-0 ${value === opt.value ? "bg-gold-accent/10 text-gold-accent border border-gold-accent/20 shadow-gold-glow" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
                            >
                                {opt.label}
                                {value === opt.value && <span className="material-symbols-outlined ml-auto" style={{ fontSize: "14px" }}>check_circle</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

function TenantAdminFormPage({ initialData = null, isps = [], lockedIsp = null, mode = "create", onCancel, onNavigate, onSaved }) {
    const formatRupiahInput = (value) => {
        if (value === null || value === undefined || value === "") return "";
        const numberString = String(value).replace(/[^0-9]/g, "");
        if (!numberString) return "";
        return new Intl.NumberFormat("id-ID").format(Number(numberString));
    };

    const parseRupiahInput = (value) => {
        if (!value) return 0;
        const numberString = String(value).replace(/[^0-9]/g, "");
        return Number(numberString) || 0;
    };

    const updateRupiahField = (event, fieldName) => {
        const input = event.target;
        const rawValue = input.value;
        const selectionStart = input.selectionStart;
        const oldLength = rawValue.length;
        const formatted = formatRupiahInput(rawValue);

        setForm(p => ({ ...p, [fieldName]: formatted }));

        requestAnimationFrame(() => {
            const newLength = formatted.length;
            const lengthDiff = newLength - oldLength;
            let newSelectionStart = selectionStart + lengthDiff;
            newSelectionStart = Math.max(0, Math.min(newSelectionStart, newLength));
            if (typeof input.setSelectionRange === "function") {
                input.setSelectionRange(newSelectionStart, newSelectionStart);
            }
        });
    };

    const handleActivationFeeChange = (event) => updateRupiahField(event, "activationFeeAmount");
    const handleMonthlyAmountChange = (event) => updateRupiahField(event, "monthlyAmount");

    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        paket: "core",
        jumlah: "0",
        ratioLeft: "1",
        ratioRight: "8",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",

        billingPeriodMode: "bulanan",
        billingCustomEvery: "",
        billingCustomUnit: "bulan",
        monthlyAmount: "0",
        activationFeeAmount: "0",
        logoFileDataUrl: "",
    });
    const [selectedIspId, setSelectedIspId] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for Search, Sort and Pagination
    const [ispSearchTerm, setIspSearchTerm] = useState("");
    const [ispSortBy, setIspSortBy] = useState("newest");
    const [ispPage, setIspPage] = useState(1);
    const itemsPerPage = 6;

    const isEditMode = mode === "edit";
    const isLockedToIsp = !isEditMode && Boolean(lockedIsp?.id);

    useEffect(() => {
        if (!initialData) return;
        setForm((p) => ({
            ...p,
            name: initialData.name ?? "",
            status: deriveOperationalStatus(
                initialData.contractPeriodStart ?? initialData.contract_period_start ?? "",
                initialData.contractPeriodEnd ?? initialData.contract_period_end ?? "",
                initialData.rawStatus ?? initialData.status ?? "aktif",
            ),
            logoUrl: initialData.logoUrl ?? initialData.logo_url ?? "",
        }));
    }, [initialData]);

    useEffect(() => {
        if (!isLockedToIsp) return;
        setSelectedIspId(Number(lockedIsp.id));
    }, [isLockedToIsp, lockedIsp]);

    const selectIsp = (ispId) => {
        setSelectedIspId(ispId);
        setFieldErrors((errors) => ({ ...errors, selectedIspId: "" }));
    };

    const filteredIsps = isps.filter(isp =>
        isp.name.toLowerCase().includes(ispSearchTerm.toLowerCase()) ||
        (isp.contractReference && isp.contractReference.toLowerCase().includes(ispSearchTerm.toLowerCase()))
    ).sort((a, b) => {
        if (ispSortBy === "name_asc") return a.name.localeCompare(b.name);
        if (ispSortBy === "name_desc") return b.name.localeCompare(a.name);
        if (ispSortBy === "oldest") return (a.id || 0) - (b.id || 0);
        return (b.id || 0) - (a.id || 0); // newest default
    });

    const totalPages = Math.ceil(filteredIsps.length / itemsPerPage);
    const displayedIsps = filteredIsps.slice((ispPage - 1) * itemsPerPage, ispPage * itemsPerPage);

    useEffect(() => {
        setIspPage(1);
    }, [ispSearchTerm]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFieldErrors({});
        if (!form.name.trim()) {
            setSubmitError("Nama lokasi wajib diisi.");
            setFieldErrors({ name: "Field ini wajib diisi." });
            return;
        }
        if (!isEditMode) {
            if (!selectedIspId) {
                setSubmitError("Lokasi harus terhubung ke satu ISP.");
                setFieldErrors({ selectedIspId: "Pilih salah satu ISP." });
                return;
            }
            if (form.paket === "core" && (!form.jumlah || Math.round(Number(form.jumlah || 0)) < 1)) {
                setSubmitError("Jumlah core minimal 1 untuk paket Core.");
                setFieldErrors({ jumlah: "Minimal 1." });
                return;
            }
            if (form.paket === "shared" && (!form.ratioLeft || !form.ratioRight || Number(form.ratioLeft) < 1 || Number(form.ratioRight) < 1)) {
                setSubmitError("Shared Core ratio tidak valid. Masukkan angka >= 1 di kedua kolom.");
                setFieldErrors({ ratioLeft: "Minimal 1.", ratioRight: "Minimal 1." });
                return;
            }
            if (!form.contractPeriodStart || !form.contractPeriodEnd || form.contractPeriodStart > form.contractPeriodEnd) {
                setSubmitError("Periode kontrak tidak valid.");
                setFieldErrors({ contractPeriodStart: "Periksa tanggal mulai.", contractPeriodEnd: "Periksa tanggal akhir." });
                return;
            }
        }

        setIsSubmitting(true);
        setSubmitError("");

        try {
            const payload = isEditMode
                ? { name: form.name.trim(), status: form.status, logoUrl: form.logoFileDataUrl || form.logoUrl || undefined }
                : {
                    name: form.name.trim(),
                    status: deriveOperationalStatus(form.contractPeriodStart, form.contractPeriodEnd, form.status),
                    logoUrl: form.logoFileDataUrl || undefined,
                    ispIds: [selectedIspId],
                    contractStartDate: form.contractStartDate || form.contractPeriodStart,
                    contractPeriodStart: form.contractPeriodStart,
                    contractPeriodEnd: form.contractPeriodEnd,
                    paket: form.paket,
                    jumlah: form.paket === "core" ? Math.round(Number(form.jumlah || 0)) : 0,
                    contractSharingRatio: form.paket === "shared" ? `${form.ratioLeft || 1}:${form.ratioRight || 8}` : undefined,
                    billingPeriodMode: form.billingPeriodMode,
                    billingCustomEvery: form.billingPeriodMode === "custom" ? Number(form.billingCustomEvery) : undefined,
                    billingCustomUnit: form.billingPeriodMode === "custom" ? form.billingCustomUnit : undefined,
                    monthlyAmount: Math.round(parseRupiahInput(form.monthlyAmount || 0)),
                    activationFeeAmount: Math.round(parseRupiahInput(form.activationFeeAmount || 0)),
                };

            const result = isEditMode && initialData?.id
                ? await api.customers.update(initialData.id, payload)
                : await api.customers.create(payload);

            if (onSaved) await onSaved(result);
        } catch (requestError) {
            console.error(requestError);
            const errorDetails = getApiErrorDetails(requestError, `Gagal ${isEditMode ? "memperbarui" : "menyimpan"} data lokasi.`);
            setSubmitError(errorDetails.message);
            setFieldErrors(Object.fromEntries(errorDetails.fields.map((field) => [field, "Periksa field ini."])));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            {/* Background Glows */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-gold-accent/5 blur-[100px] backdrop-blur-md" />
            </div>

            <form className="relative z-10 mx-auto max-w-7xl space-y-4 pb-20 pt-2 px-4 md:px-6" onSubmit={handleSubmit}>
                {/* Header Section */}
                <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end mb-4 px-2">
                    <div>
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-gold-accent/10 border border-gold-accent/20 backdrop-blur-md mb-2">
                            <span className="w-2 h-2 rounded-full bg-gold-accent animate-pulse shadow-gold-glow" />
                            <p className="text-[9px] font-black text-gold-accent uppercase tracking-[0.4em]">
                                {isEditMode ? "Modul Pengeditan" : "Modul Pendaftaran"}
                            </p>
                        </div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
                            {isEditMode ? "Edit" : "Daftar Lokasi Baru"}
                        </h1>
                        <p className="mt-1 max-w-xl text-[11px] font-bold text-white/40">
                            Silakan lengkapi data administratif dan konfigurasi layanan untuk {isEditMode ? "memperbarui lokasi" : "mendaftarkan titik lokasi"}.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-glass-depth backdrop-blur-md"
                            onClick={onCancel}
                            type="button"
                        >
                            Batal
                        </button>
                        <button
                            className="h-9 px-6 rounded-xl btn-premium text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-gold-glow active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                            disabled={isSubmitting}
                            type="submit"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                    Memproses...
                                </span>
                            ) : (
                                isEditMode ? "Simpan Perubahan" : "Tambah Lokasi"
                            )}
                        </button>
                    </div>
                </header>

                {submitError && (
                    <div className="mx-2 p-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm font-bold backdrop-blur-md animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>warning</span>
                            {submitError}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left Column - Core Info */}
                    <div className={`${isEditMode ? "lg:col-span-12" : "lg:col-span-8"} space-y-4`}>
                        {/* Section: Identitas Lokasi */}
                        <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-40">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                <h3 className="text-base font-black text-white uppercase tracking-widest">Identitas Lokasi</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <GlassFieldInput
                                    label="Nama Lokasi"
                                    icon="location_on"
                                    placeholder="Contoh: Gedung A - Lantai 2"
                                    value={form.name}
                                    error={fieldErrors.name}
                                    onChange={(val) => {
                                        setForm(p => ({ ...p, name: val }));
                                        setFieldErrors((errors) => ({ ...errors, name: "" }));
                                    }}
                                />
                                <GlassCustomSelect
                                    label="Status Operasional"
                                    icon="verified_user"
                                    value={form.status}
                                    onChange={(val) => setForm(p => ({ ...p, status: val }))}
                                    options={[
                                        { value: "aktif", label: "BEROPERASI" },
                                        { value: "belum_beroperasi", label: "BELUM BEROPERASI" },
                                        ...(isEditMode ? [{ value: "expired", label: "MASA BERLAKU HABIS" }] : []),
                                        { value: "berhenti", label: "BERHENTI" }
                                    ]}
                                />
                            </div>

                            {/* Logo Upload */}
                            <div className="mt-4 space-y-1.5">
                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Logo Perusahaan (Opsional)</label>
                                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/10 border-dashed hover:border-gold-accent/40 transition-all group cursor-pointer relative overflow-hidden backdrop-blur-md">
                                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                                        {(form.logoFileDataUrl || form.logoUrl) ? (
                                            <img src={form.logoFileDataUrl || form.logoUrl} alt="Preview" className="h-full w-full object-contain p-2" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-white/20">
                                                <span className="material-symbols-outlined mb-1" style={{ fontSize: "20px" }}>image</span>
                                                <span className="text-[7px] font-black uppercase tracking-widest">No Logo</span>
                                            </div>
                                        )}
                                        <input
                                            accept="image/png,image/jpeg,image/webp"
                                            className="absolute inset-0 cursor-pointer opacity-0 z-10"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) uploadFileForRecord(file, ["customers", initialData?.id ?? "new", "logos"]).then(url => setForm(p => ({ ...p, logoFileDataUrl: url })));
                                                e.target.value = "";
                                            }}
                                            type="file"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Pilih Berkas Logo</p>
                                        <p className="text-[9px] text-white/50 font-medium tracking-wide leading-relaxed">Format: PNG/JPG (Maks. 2MB). Logo akan digunakan sebagai marker di peta jalur FO.</p>
                                        {(form.logoFileDataUrl || form.logoUrl) && (
                                            <button
                                                className="mt-2 text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 flex items-center gap-1 transition-colors z-20 relative"
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setForm(p => ({ ...p, logoFileDataUrl: "", logoUrl: "" })); }}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>delete</span>
                                                Hapus Logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!isEditMode && (
                            <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-30">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <h3 className="text-base font-black text-white uppercase tracking-widest">Layanan & Kontrak</h3>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <GlassCustomSelect
                                            label="Jenis Paket"
                                            icon="inventory_2"
                                            value={form.paket}
                                            onChange={(val) => setForm(p => ({ ...p, paket: val }))}
                                            options={[
                                                { value: "core", label: "CORE" },
                                                { value: "shared", label: "SHARING CORE" }
                                            ]}
                                        />
                                        {form.paket === "core" ? (
                                            <GlassFieldInput
                                                label="Jumlah Core"
                                                icon="hub"
                                                type="number"
                                                min="1"
                                                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                placeholder="1"
                                                value={form.jumlah}
                                                error={fieldErrors.jumlah}
                                                onChange={(val) => { if (val === '' || Number(val) >= 1) setForm(p => ({ ...p, jumlah: val })); setFieldErrors((errors) => ({ ...errors, jumlah: "" })); }}
                                            />
                                        ) : (
                                            <div className="space-y-1.5">
                                                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Ratio Shared</label>
                                                <div className="flex items-center gap-4">
                                                    <div className="relative flex-1">
                                                        <input className="w-full h-9 rounded-xl bg-black/20 border border-white/10 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/40 shadow-inner-glass text-center backdrop-blur-md" type="number" min="1" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }} value={form.ratioLeft} onChange={(e) => { if (e.target.value === '' || Number(e.target.value) >= 1) setForm(p => ({ ...p, ratioLeft: e.target.value })); }} />
                                                    </div>
                                                    <span className="text-[15px] font-black text-white/20">:</span>
                                                    <div className="relative flex-1">
                                                        <input className="w-full h-9 rounded-xl bg-black/20 border border-white/10 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/40 shadow-inner-glass text-center backdrop-blur-md" type="number" min="1" onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }} value={form.ratioRight} onChange={(e) => { if (e.target.value === '' || Number(e.target.value) >= 1) setForm(p => ({ ...p, ratioRight: e.target.value })); }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <GlassFieldInput label="Awal Kontrak (Ops)" icon="calendar_today" type="date" value={form.contractStartDate} onChange={(val) => setForm(p => ({ ...p, contractStartDate: val }))} />
                                        <GlassFieldInput label="Mulai Periode" icon="event_available" type="date" value={form.contractPeriodStart} error={fieldErrors.contractPeriodStart} onChange={(val) => { setForm(p => ({ ...p, contractPeriodStart: val, status: deriveOperationalStatus(val, p.contractPeriodEnd, p.status) })); setFieldErrors((errors) => ({ ...errors, contractPeriodStart: "" })); }} />
                                        <GlassFieldInput label="Akhir Periode" icon="event_busy" type="date" value={form.contractPeriodEnd} error={fieldErrors.contractPeriodEnd} onChange={(val) => { setForm(p => ({ ...p, contractPeriodEnd: val, status: deriveOperationalStatus(p.contractPeriodStart, val, p.status) })); setFieldErrors((errors) => ({ ...errors, contractPeriodEnd: "" })); }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ISP Selection Section */}
                        {!isEditMode && (
                            <div className={`glass-card backdrop-blur-xl rounded-2xl p-5 shadow-glass-depth relative z-20 ${fieldErrors.selectedIspId ? "border-rose-500/70 ring-2 ring-rose-500/10" : "border-white/20"}`}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                        <h3 className="text-base font-black text-white uppercase tracking-widest">Pilih Mitra ISP</h3>
                                    </div>
                                    <div className="flex flex-col md:flex-row items-center gap-3">
                                        <div className="relative group w-full md:w-64">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors" style={{ fontSize: "14px" }}>search</span>
                                            <input
                                                type="text"
                                                placeholder="Cari ISP..."
                                                className="w-full h-9 pl-9 pr-3 rounded-xl bg-black/40 border border-white/10 text-[10px] font-bold text-white outline-none focus:border-gold-accent/40 transition-all shadow-inner-glass"
                                                value={ispSearchTerm}
                                                onChange={(e) => setIspSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-none">
                                            <GlassCustomSelect
                                                value={ispSortBy}
                                                onChange={setIspSortBy}
                                                icon="sort"
                                                heightClass="h-9"
                                                iconOnly={true}
                                                options={[
                                                    { value: "newest", label: "TERBARU" },
                                                    { value: "oldest", label: "TERLAMA" },
                                                    { value: "name_asc", label: "NAMA A-Z" },
                                                    { value: "name_desc", label: "NAMA Z-A" }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {fieldErrors.selectedIspId && (
                                    <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-rose-400">{fieldErrors.selectedIspId}</p>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {displayedIsps.map((isp) => (
                                        <div
                                            key={isp.id}
                                            onClick={() => selectIsp(isp.id)}
                                            className={`relative overflow-hidden group cursor-pointer rounded-xl border transition-all duration-300 p-3 ${selectedIspId === isp.id ? "bg-gold-accent/10 border-gold-accent shadow-gold-glow" : "bg-white/5 border-white/10 hover:border-white/30"}`}
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-all ${selectedIspId === isp.id ? "bg-gold-accent text-slate-900" : "bg-white/5 text-white/20"}`}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{selectedIspId === isp.id ? "check_circle" : "corporate_fare"}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-[10px] font-black uppercase tracking-widest truncate transition-colors ${selectedIspId === isp.id ? "text-gold-accent" : "text-white"}`}>{isp.name}</p>
                                                    <p className="text-[8px] mt-0.5 font-bold text-white/40 uppercase tracking-tighter truncate">{isp.contractReference || "Tanpa referensi"}</p>
                                                </div>
                                            </div>
                                            {selectedIspId === isp.id && (
                                                <div className="absolute top-0 right-0 p-2">
                                                    <div className="h-2 w-2 rounded-full bg-gold-accent animate-ping" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Halaman {ispPage} / {totalPages}</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={ispPage === 1}
                                                onClick={() => setIspPage(p => p - 1)}
                                                className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-all backdrop-blur-md"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_left</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={ispPage === totalPages}
                                                onClick={() => setIspPage(p => p + 1)}
                                                className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-all backdrop-blur-md"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Billing */}
                    {!isEditMode && (
                        <div className="lg:col-span-4 space-y-4">
                            <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <h3 className="text-base font-black text-white uppercase tracking-widest">Billing & Biaya</h3>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Siklus Penagihan</label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {["bulanan", "3bulanan", "custom"].map((modeValue) => (
                                                <button
                                                    key={modeValue}
                                                    type="button"
                                                    onClick={() => setForm(p => ({ ...p, billingPeriodMode: modeValue }))}
                                                    className={`h-8 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${form.billingPeriodMode === modeValue ? "bg-gold-accent text-slate-900 shadow-gold-glow" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white border border-white/5"}`}
                                                >
                                                    {modeValue === "bulanan" ? "Bulan" : modeValue === "3bulanan" ? "3 Bln" : "Kustom"}
                                                </button>
                                            ))}
                                        </div>

                                        {form.billingPeriodMode === "custom" && (
                                            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in slide-in-from-top-4 duration-500 shadow-inner-glass">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Konfigurasi Periode</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-[2] relative group">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gold-accent/40 uppercase tracking-widest pointer-events-none group-focus-within:text-gold-accent transition-colors">SETIAP</span>
                                                        <input
                                                            className="w-full h-8 pl-14 pr-3 rounded-lg bg-black/20 border border-white/10 text-[9px] font-bold text-white outline-none focus:border-gold-accent/40 focus:bg-black/40 transition-all shadow-inner-glass [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none backdrop-blur-md"
                                                            min="1"
                                                            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                                                            type="number"
                                                            placeholder="0"
                                                            value={form.billingCustomEvery}
                                                            onChange={(e) => { if (e.target.value === '' || Number(e.target.value) >= 1) setForm(p => ({ ...p, billingCustomEvery: e.target.value })); }}
                                                        />
                                                    </div>
                                                    <div className="flex-[3]">
                                                        <GlassCustomSelect
                                                            value={form.billingCustomUnit}
                                                            onChange={(val) => setForm(p => ({ ...p, billingCustomUnit: val }))}
                                                            heightClass="h-8"
                                                            options={[
                                                                { value: "hari", label: "HARI" },
                                                                { value: "bulan", label: "BULAN" },
                                                                { value: "tahun", label: "TAHUN" }
                                                            ]}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <GlassFieldInput
                                        label="Nominal Paket Bulanan (IDR)"
                                        icon="paid"
                                        type="text"
                                        placeholder="0"
                                        value={form.monthlyAmount}
                                        onRawChange={handleMonthlyAmountChange}
                                    />

                                    <GlassFieldInput
                                        label="Biaya Aktivasi (IDR)"
                                        icon="payments"
                                        type="text"
                                        placeholder="0"
                                        value={form.activationFeeAmount}
                                        onRawChange={handleActivationFeeChange}
                                    />

                                    <div className="p-3 rounded-xl bg-gold-accent/5 border border-gold-accent/20 backdrop-blur-md">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="material-symbols-outlined text-gold-accent" style={{ fontSize: "14px" }}>info</span>
                                            <p className="text-[10px] font-black text-gold-accent uppercase tracking-widest">Informasi Sistem</p>
                                        </div>
                                        <p className="text-[10px] text-white/40 font-medium leading-relaxed">
                                            Invoice dan kontrak pertama akan dibuat secara otomatis setelah data disimpan.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </AppShell>
    );
}

export default TenantAdminFormPage;
