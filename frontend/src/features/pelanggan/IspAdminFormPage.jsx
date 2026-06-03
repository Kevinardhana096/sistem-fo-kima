import { useEffect, useState, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import api, { getApiErrorDetails } from "../../lib/api";
import { uploadFileForRecord } from "../../lib/files";
import DateInput from "../../components/shared/DateInput";

const GlassFieldInput = ({ label, type = "text", value, onChange, placeholder = "", icon, error = "" }) => {
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
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={placeholder}
                        type={type}
                        value={value}
                    />
                )}
            </div>
            {error && <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">{error}</p>}
        </div>
    );
};

const FileUploadCard = ({ label, fileName, onFileSelected, onClear, uploadPathParts = [], icon = "upload_file", error = "" }) => (
    <div className="space-y-1.5">
        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">{label}</label>
        <div className={`relative overflow-hidden rounded-xl border border-dashed bg-black/20 p-4 transition-all hover:border-gold-accent/40 backdrop-blur-md ${error ? "border-rose-500/70 ring-2 ring-rose-500/10" : "border-white/10"}`}>
            <input
                className="absolute inset-0 z-10 cursor-pointer opacity-0"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    uploadFileForRecord(file, uploadPathParts).then((fileUrl) => onFileSelected(file, fileUrl));
                    event.target.value = "";
                }}
                type="file"
            />
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gold-accent backdrop-blur-md">
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-black uppercase tracking-widest text-white">{fileName || "Pilih Berkas"}</p>
                    <p className="mt-0.5 text-[9px] font-bold tracking-wide text-white/40">Opsional. Klik area ini untuk upload.</p>
                </div>
                {fileName && (
                    <button
                        className="relative z-20 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onClear();
                        }}
                        type="button"
                    >
                        Hapus
                    </button>
                )}
            </div>
        </div>
        {error && <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">{error}</p>}
    </div>
);

const GlassCustomSelect = ({ label, value, onChange, options, icon, disabled = false, helperText = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        if (disabled) return undefined;
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [disabled]);

    return (
        <div className={`space-y-1.5 relative ${isOpen ? "z-50" : "z-10"}`} ref={containerRef}>
            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                {label}
            </label>
            <div className="relative">
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`w-full h-9 rounded-xl bg-black/20 border flex items-center pl-9 pr-8 text-[10px] font-bold transition-all shadow-inner-glass relative z-20 backdrop-blur-md ${disabled ? "cursor-not-allowed border-white/10 text-white/50" : "cursor-pointer"} ${isOpen ? "border-gold-accent/60 bg-black/40 shadow-gold-glow" : "border-white/10 text-white/70 hover:border-white/30"}`}
                >
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 transition-all duration-300" style={{ fontSize: "14px", color: isOpen ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                        {icon}
                    </span>
                    <span className="truncate uppercase tracking-widest">{selectedOption.label}</span>
                    <span className={`material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 transition-transform duration-300 ${isOpen ? "rotate-180 text-gold-accent" : "text-white/20"}`} style={{ fontSize: "14px" }}>
                        expand_more
                    </span>
                </div>

                {isOpen && !disabled && (
                    <div className="absolute top-full left-0 right-0 mt-2 p-1.5 rounded-xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-glass-depth z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
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
            {helperText && <p className="text-[9px] font-bold tracking-wide text-white/40">{helperText}</p>}
        </div>
    );
};

const getTodayLocalIso = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const deriveOperationalStatus = (contractPeriodStart, fallbackStatus = "aktif") => {
    if (!contractPeriodStart) return fallbackStatus;
    return contractPeriodStart <= getTodayLocalIso() ? "aktif" : "belum_beroperasi";
};

const mapPackageName = (value) => String(value || "").toLowerCase() === "shared" ? "Shared" : "Core";

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
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [entryPoints, setEntryPoints] = useState([]);
    const isEditMode = mode === "edit";

    useEffect(() => {
        if (!initialData) return;
        const contractPeriodStart = initialData.contractPeriodStart ?? initialData.contract_period_start ?? "";
        const initialStatus = initialData.status ?? "aktif";
        setForm((prev) => ({
            ...prev,
            name: initialData.name ?? "",
            status: deriveOperationalStatus(contractPeriodStart, initialStatus),
            logoUrl: initialData.logoUrl ?? initialData.logo_url ?? "",
            userEmail: initialData.userEmail ?? initialData.user_id ?? "",
            userPassword: "",
            contractReference: initialData.contractReference ?? initialData.contract_reference ?? "",
            contractStartDate: initialData.contractStartDate ?? initialData.contract_start_date ?? "",
            contractPeriodStart,
            contractPeriodEnd: initialData.contractPeriodEnd ?? initialData.contract_period_end ?? "",
            bakFileName: initialData.bakFileName ?? initialData.bak_file_name ?? "",
            bakFileDataUrl: initialData.bakFileUrl ?? initialData.bak_file_url ?? "",
            contractFileName: initialData.contractFileName ?? initialData.contract_file_name ?? "",
            contractFileDataUrl: initialData.contractFileUrl ?? initialData.contract_file_url ?? "",
            packageName: mapPackageName(initialData.packageName ?? initialData.paket),
            packageQuantity: initialData.packageQuantity ?? initialData.jumlah ?? "",
        }));
    }, [initialData]);

    const handleAddEntryPoint = () => {
        setEntryPoints((previous) => [
            ...previous,
            {
                id: `entry-${Date.now()}`,
                label: "",
                latitude: "",
                longitude: "",
            },
        ]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFieldErrors({});
        if (!form.name.trim()) {
            setSubmitError("Nama ISP wajib diisi.");
            setFieldErrors({ name: "Field ini wajib diisi." });
            return;
        }
        if (form.contractPeriodStart && form.contractPeriodEnd && form.contractPeriodStart > form.contractPeriodEnd) {
            setSubmitError("Periode berjalan akhir tidak boleh lebih awal dari tanggal mulai.");
            setFieldErrors({ contractPeriodStart: "Periksa tanggal mulai.", contractPeriodEnd: "Periksa tanggal akhir." });
            return;
        }
        const invalidEntryPoint = entryPoints.find((point) => {
            const label = String(point?.label ?? "").trim();
            const latitude = String(point?.latitude ?? "").trim();
            const longitude = String(point?.longitude ?? "").trim();
            return (latitude || longitude) && !label;
        });
        if (invalidEntryPoint) {
            setSubmitError("Nama titik wajib diisi.");
            return;
        }


        setIsSubmitting(true);
        setSubmitError("");
        try {
            const payload = {
                name: form.name.trim(),
                status: deriveOperationalStatus(form.contractPeriodStart, form.status),
                contractReference: form.contractReference.trim() || undefined,
                contractStartDate: form.contractStartDate || null,
                contractPeriodStart: form.contractPeriodStart || null,
                contractPeriodEnd: form.contractPeriodEnd || null,
                bakFileDataUrl: form.bakFileDataUrl || undefined,
                bakFileName: form.bakFileName || undefined,
                contractFileDataUrl: form.contractFileDataUrl || undefined,
                contractFileName: form.contractFileName || undefined,
                logoUrl: form.logoFileDataUrl || (isEditMode ? form.logoUrl : undefined) || undefined,
                packageName: form.packageName.trim(),
                packageQuantity: form.packageQuantity,
                userEmail: form.userEmail.trim() || undefined,
                userPassword: form.userPassword.trim() || undefined,
                entryPoints: entryPoints.map((point) => ({
                    ...point,
                    label: String(point.label ?? "").trim(),
                    latitude: String(point.latitude ?? "").trim(),
                    longitude: String(point.longitude ?? "").trim(),
                })),
            };

            const result = isEditMode && initialData?.id
                ? await api.isps.update(initialData.id, payload)
                : await api.isps.create(payload);



            if (onSaved) await onSaved(result);
        } catch (error) {
            console.error(error);
            const errorDetails = getApiErrorDetails(error, `Gagal ${isEditMode ? "memperbarui" : "menyimpan"} data ISP.`);
            setSubmitError(errorDetails.message);
            const mappedFieldErrors = Object.fromEntries(
                errorDetails.fields.map((field) => [
                    field,
                    errorDetails.fieldMessages?.[field] || "Periksa field ini.",
                ])
            );
            setFieldErrors(mappedFieldErrors);
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

            <form className="mx-auto max-w-7xl space-y-4 pb-20 pt-2 px-4 md:px-6" onSubmit={handleSubmit}>
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
                            {isEditMode ? "Edit" : "Daftar"} <span className="text-gold-accent italic">Mitra ISP</span>
                        </h1>
                        <p className="mt-1 max-w-xl text-[11px] font-bold text-white/40">
                            Silakan lengkapi formulir di bawah ini untuk {isEditMode ? "memperbarui data" : "mendaftarkan mitra ISP baru"} ke dalam sistem.
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
                                isEditMode ? "Simpan Perubahan" : "Tambah ISP"
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

                <div className="grid grid-cols-1 gap-3 items-start">
                    {/* Left Column - Core Info */}
                    <div className="space-y-3">
                        {/* Section: Identitas ISP */}
                        <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-20">
                            
                            <div className="flex items-center gap-3 mb-4">
                                <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                <h3 className="text-base font-black text-white uppercase tracking-widest">Identitas ISP</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Logo Perusahaan (Opsional)</label>
                                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/10 border-dashed hover:border-gold-accent/40 transition-all group cursor-pointer relative overflow-hidden backdrop-blur-md">
                                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
                                            {(form.logoFileDataUrl || form.logoUrl) ? (
                                                <img 
                                                    src={form.logoFileDataUrl || form.logoUrl} 
                                                    alt="Preview" 
                                                    className="h-full w-full object-contain p-2"
                                                />
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
                                                    if (file) uploadFileForRecord(file, ["isps", initialData?.id ?? "new", "logos"]).then(url => setForm(p => ({ ...p, logoFileDataUrl: url })));
                                                }}
                                                type="file"
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <p className="text-[10px] font-bold text-white uppercase tracking-widest">Pilih Berkas Logo</p>
                                            <p className="text-[9px] text-white/50 font-medium tracking-wide leading-relaxed">Format: PNG/JPG (Maks. 2MB). Gunakan latar transparan untuk hasil terbaik.</p>
                                            {(form.logoFileDataUrl || form.logoUrl) && (
                                                <button 
                                                    className="mt-2 text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 flex items-center gap-1 transition-colors z-20 relative"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setForm(p => ({ ...p, logoFileDataUrl: "", logoUrl: "" }));
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>delete</span>
                                                    Hapus Logo
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <GlassFieldInput
                                        label="Nama Perusahaan ISP"
                                        icon="corporate_fare"
                                        placeholder="Contoh: PT. Internet Cepat Indonesia"
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
                                        disabled={Boolean(form.contractPeriodStart)}
                                        helperText={form.contractPeriodStart ? "Otomatis dari Periode Berjalan Awal" : "Isi Periode Berjalan Awal untuk menghitung otomatis"}
                                        options={[
                                            { value: "aktif", label: "BEROPERASI" },
                                            { value: "belum_beroperasi", label: "BELUM BEROPERASI" },
                                            ...(isEditMode && !form.contractPeriodStart ? [{ value: "expired", label: "BELUM DIPERPANJANG" }] : []),
                                            ...(!form.contractPeriodStart ? [{ value: "berhenti", label: "BERHENTI" }] : [])
                                        ]}
                                    />
                                </div>

                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">Titik Masuk</p>
                                            <p className="mt-1 text-[9px] font-bold text-white/40">Tambah titik akses yang dipakai ISP.</p>
                                        </div>
                                        <button
                                            className="h-8 px-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all"
                                            onClick={handleAddEntryPoint}
                                            type="button"
                                        >
                                            Tambah Titik
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {entryPoints.length === 0 ? (
                                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[9px] font-bold text-white/30">
                                                Belum ada titik masuk.
                                            </div>
                                        ) : entryPoints.map((point, index) => (
                                            <div key={point.id ?? index} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                                                <div className="text-[9px] font-black uppercase tracking-widest text-white/50">Titik #{index + 1}</div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                                    <GlassFieldInput
                                                        label="Nama Titik"
                                                        placeholder="Nama titik"
                                                        value={point.label ?? ""}
                                                        onChange={(val) => setEntryPoints((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, label: val } : item)))}
                                                    />
                                                    <GlassFieldInput
                                                        label="Latitude"
                                                        placeholder="-5.0929"
                                                        value={point.latitude ?? ""}
                                                        onChange={(val) => setEntryPoints((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, latitude: val } : item)))}
                                                    />
                                                    <GlassFieldInput
                                                        label="Longitude"
                                                        placeholder="119.5018"
                                                        value={point.longitude ?? ""}
                                                        onChange={(val) => setEntryPoints((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, longitude: val } : item)))}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/60 ml-1">
                                            Paket (Jumlah Core)
                                        </label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-all duration-300 pointer-events-none" style={{ fontSize: "14px" }}>
                                                hub
                                            </span>
                                            <input
                                                className="w-full h-9 rounded-xl bg-black/20 border border-white/10 pl-9 pr-14 text-[10px] font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-2 focus:ring-gold-accent/10 shadow-inner-glass backdrop-blur-md"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '' || Number(val) >= 0) {
                                                        setForm(p => ({ ...p, packageQuantity: val }));
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault();
                                                }}
                                                placeholder="0"
                                                type="number"
                                                min="0"
                                                value={form.packageQuantity}
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <span className="text-[8px] font-black text-gold-accent uppercase tracking-widest bg-gold-accent/10 px-2 py-1 rounded-md border border-gold-accent/20 shadow-gold-glow backdrop-blur-md">
                                                    CORE
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Section: Kontrak ISP */}
                        {!isEditMode && (
                            <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <h3 className="text-base font-black text-white uppercase tracking-widest">Kontrak ISP</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <GlassFieldInput
                                            label="Awal Kontrak"
                                            icon="calendar_today"
                                            type="date"
                                            value={form.contractStartDate}
                                            error={fieldErrors.contractStartDate}
                                            onChange={(val) => {
                                                setForm(p => ({ ...p, contractStartDate: val }));
                                                setFieldErrors((errors) => ({ ...errors, contractStartDate: "" }));
                                            }}
                                        />
                                        <GlassFieldInput
                                            label="Nomor Kontrak (Opsional)"
                                            icon="tag"
                                            placeholder="Contoh: KTR/ISP/001/2026"
                                            value={form.contractReference}
                                            error={fieldErrors.contractReference}
                                            onChange={(val) => {
                                                setForm(p => ({ ...p, contractReference: val }));
                                                setFieldErrors((errors) => ({ ...errors, contractReference: "" }));
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <GlassFieldInput
                                            label="Periode Berjalan Awal"
                                            icon="event_available"
                                            type="date"
                                            value={form.contractPeriodStart}
                                            error={fieldErrors.contractPeriodStart}
                                            onChange={(val) => {
                                                setForm(p => ({ ...p, contractPeriodStart: val, status: deriveOperationalStatus(val, p.status) }));
                                                setFieldErrors((errors) => ({ ...errors, contractPeriodStart: "" }));
                                            }}
                                        />
                                        <GlassFieldInput
                                            label="Periode Berjalan Akhir"
                                            icon="event_busy"
                                            type="date"
                                            value={form.contractPeriodEnd}
                                            error={fieldErrors.contractPeriodEnd}
                                            onChange={(val) => {
                                                setForm(p => ({ ...p, contractPeriodEnd: val }));
                                                setFieldErrors((errors) => ({ ...errors, contractPeriodEnd: "" }));
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FileUploadCard
                                            label="Upload BAK (Opsional)"
                                            fileName={form.bakFileName}
                                            error={fieldErrors.bakFileDataUrl}
                                            uploadPathParts={["isps", initialData?.id ?? "new", "bak"]}
                                            onFileSelected={(file, dataUrl) => setForm(p => ({ ...p, bakFileName: file.name, bakFileDataUrl: dataUrl }))}
                                            onClear={() => setForm(p => ({ ...p, bakFileName: "", bakFileDataUrl: "" }))}
                                        />
                                        <FileUploadCard
                                            label="Upload Kontrak (Opsional)"
                                            fileName={form.contractFileName}
                                            error={fieldErrors.contractFileDataUrl}
                                            uploadPathParts={["isps", initialData?.id ?? "new", "contracts"]}
                                            onFileSelected={(file, dataUrl) => setForm(p => ({ ...p, contractFileName: file.name, contractFileDataUrl: dataUrl }))}
                                            onClear={() => setForm(p => ({ ...p, contractFileName: "", contractFileDataUrl: "" }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* Section: Akun Akses ISP - Only in Add Mode */}
                        {!isEditMode && (
                            <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-10">
                                
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <h3 className="text-base font-black text-white uppercase tracking-widest">Akun Akses ISP</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <GlassFieldInput
                                        label="Alamat Email Akses"
                                        icon="mail"
                                        placeholder="Contoh: admin@ispmitra.com"
                                        value={form.userEmail}
                                        error={fieldErrors.userEmail}
                                        onChange={(val) => {
                                            setForm(p => ({ ...p, userEmail: val }));
                                            setFieldErrors((errors) => ({ ...errors, userEmail: "" }));
                                        }}
                                    />
                                    <GlassFieldInput
                                        label="Password Akses"
                                        icon="lock"
                                        type="password"
                                        placeholder="••••••••"
                                        value={form.userPassword}
                                        error={fieldErrors.userPassword}
                                        onChange={(val) => {
                                            setForm(p => ({ ...p, userPassword: val }));
                                            setFieldErrors((errors) => ({ ...errors, userPassword: "" }));
                                        }}
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
