import { useEffect, useState, useRef } from "react";
import { logger } from "@/lib/logger";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AppShell from "../../components/layout/AppShell";
import api, { getApiErrorDetails } from "../../lib/api";
import { uploadFileForRecord } from "../../lib/files";

const KIMA_CENTER = [-5.0929568, 119.5018379];

const ISP_ENTRY_POINT_ICON = L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:999px;background:#d4a937;border:3px solid white;box-shadow:0 0 18px rgba(212,169,55,.65);display:flex;align-items:center;justify-content:center;color:#111827;font-size:10px;font-weight:900;">FO</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});

function EntryPointMapClickHandler({ onPick }) {
    useMapEvents({
        click(event) {
            onPick(event.latlng.lat, event.latlng.lng);
        },
    });
    return null;
}

function EntryPointMapPicker({ points, selectedIndex, onSelectIndex, onPickCoordinate }) {
    const selectedPoint = points[selectedIndex] ?? null;
    const center = selectedPoint?.latitude && selectedPoint?.longitude
        ? [Number(selectedPoint.latitude), Number(selectedPoint.longitude)]
        : KIMA_CENTER;

    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex flex-col gap-2 border-b border-white/10 bg-black/30 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gold-accent/70">Peta Titik ISP</p>
                    <p className="mt-1 text-[10px] font-bold text-white/40">Pilih baris titik, lalu klik peta untuk mengatur koordinatnya.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {points.map((point, index) => (
                        <button
                            key={point.id ?? `map-point-${index}`}
                            className={`rounded-lg border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${selectedIndex === index ? "border-gold-accent/40 bg-gold-accent/20 text-gold-accent" : "border-white/10 bg-white/5 text-white/45 hover:text-white"}`}
                            onClick={() => onSelectIndex(index)}
                            type="button"
                        >
                            {point.label || `Titik #${index + 1}`}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-[360px]">
                <MapContainer center={center} className="h-full w-full" scrollWheelZoom zoom={15}>
                    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <EntryPointMapClickHandler onPick={onPickCoordinate} />
                    {points.map((point, index) => {
                        const lat = Number(point.latitude);
                        const lng = Number(point.longitude);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        return (
                            <Marker
                                key={point.id ?? `entry-marker-${index}`}
                                draggable
                                eventHandlers={{
                                    click: () => onSelectIndex(index),
                                    dragend: (event) => {
                                        const position = event.target.getLatLng();
                                        onSelectIndex(index);
                                        onPickCoordinate(position.lat, position.lng, index);
                                    },
                                }}
                                icon={ISP_ENTRY_POINT_ICON}
                                position={[lat, lng]}
                            />
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}

const GlassFieldInput = ({ label, type = "text", value, onChange, placeholder = "", icon, error = "" }) => {
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
                <input
                    className={`w-full h-9 rounded-xl bg-black/20 border backdrop-blur-md ${error ? "border-rose-500/70 ring-2 ring-rose-500/10" : "border-white/10 focus:border-gold-accent/40 focus:ring-2 focus:ring-gold-accent/10"} ${icon ? "pl-9" : "px-3"} pr-3 text-[10px] font-bold placeholder:text-white/20 outline-none transition-all focus:bg-black/40 shadow-inner-glass ${type === "date" ? "text-white/40 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer" : "text-white"} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    onChange={(event) => onChange(event.target.value)}
                    onInput={(event) => type === "date" && onChange(event.target.value)}
                    onKeyDown={(e) => type === "date" && e.key !== "Tab" && e.preventDefault()}
                    onClick={(e) => type === "date" && e.target.showPicker && e.target.showPicker()}
                    placeholder={placeholder}
                    type={type}
                    value={value}
                />
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

const createEntryPointDraft = () => ({
    id: null,
    label: "",
    latitude: "",
    longitude: "",
    status: "aktif",
    description: "",
    capacityNote: "",
    fiberType: "",
    coreCapacity: "",
    isDefault: false,
});

const normalizeEntryPointDraft = (point = {}) => ({
    id: point.id ?? null,
    label: point.label ?? "",
    latitude: point.latitude ?? "",
    longitude: point.longitude ?? "",
    status: point.status ?? "aktif",
    description: point.description ?? "",
    capacityNote: point.capacityNote ?? point.capacity_note ?? "",
    fiberType: point.fiberType ?? point.fiber_type ?? "",
    coreCapacity: point.coreCapacity ?? point.core_capacity ?? "",
    isDefault: Boolean(point.isDefault ?? point.is_default),
});

const validateEntryPointDrafts = (entryPoints = []) => {
    const errors = {};
    entryPoints.forEach((point, index) => {
        const hasAnyValue = [
            point.label,
            point.latitude,
            point.longitude,
            point.description,
            point.capacityNote,
            point.fiberType,
            point.coreCapacity,
        ].some((value) => String(value ?? "").trim());
        if (!hasAnyValue) return;

        const label = String(point.label ?? "").trim();
        const latitude = Number(String(point.latitude ?? "").replace(",", "."));
        const longitude = Number(String(point.longitude ?? "").replace(",", "."));
        const coreCapacity = String(point.coreCapacity ?? "").trim() ? Number(point.coreCapacity) : null;

        if (!label) errors[`entryPoints.${index}.label`] = "Nama titik wajib diisi.";
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
            errors[`entryPoints.${index}.latitude`] = "Latitude harus antara -90 sampai 90.";
        }
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
            errors[`entryPoints.${index}.longitude`] = "Longitude harus antara -180 sampai 180.";
        }
        if (coreCapacity !== null && (!Number.isFinite(coreCapacity) || coreCapacity < 0)) {
            errors[`entryPoints.${index}.coreCapacity`] = "Kapasitas core tidak boleh negatif.";
        }
    });
    return errors;
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
        entryPoints: [],
    });
    const [submitError, setSubmitError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedEntryPointIndex, setSelectedEntryPointIndex] = useState(0);
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
            entryPoints: Array.isArray(initialData.entryPoints)
                ? initialData.entryPoints.map(normalizeEntryPointDraft)
                : [],
        }));
    }, [initialData]);

    const updateEntryPoint = (index, updates) => {
        setForm((previous) => ({
            ...previous,
            entryPoints: previous.entryPoints.map((point, pointIndex) => (
                pointIndex === index ? { ...point, ...updates } : point
            )),
        }));
        setFieldErrors((errors) => {
            const nextErrors = { ...errors };
            Object.keys(updates).forEach((key) => {
                delete nextErrors[`entryPoints.${index}.${key}`];
            });
            return nextErrors;
        });
    };

    const setDefaultEntryPoint = (index) => {
        setForm((previous) => ({
            ...previous,
            entryPoints: previous.entryPoints.map((point, pointIndex) => ({
                ...point,
                isDefault: pointIndex === index,
            })),
        }));
    };

    const removeEntryPoint = (index) => {
        setForm((previous) => ({
            ...previous,
            entryPoints: previous.entryPoints.filter((_, pointIndex) => pointIndex !== index),
        }));
        setSelectedEntryPointIndex((previous) => Math.max(0, Math.min(previous, form.entryPoints.length - 2)));
    };

    const pickEntryPointCoordinate = (latitude, longitude, targetIndex = selectedEntryPointIndex) => {
        updateEntryPoint(targetIndex, {
            latitude: latitude.toFixed(6),
            longitude: longitude.toFixed(6),
        });
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
        const entryPointErrors = validateEntryPointDrafts(form.entryPoints);
        if (Object.keys(entryPointErrors).length > 0) {
            setSubmitError("Periksa kembali data titik masuk FO yang ditandai.");
            setFieldErrors(entryPointErrors);
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
            };

            const result = isEditMode && initialData?.id
                ? await api.isps.update(initialData.id, payload)
                : await api.isps.create(payload);

            if (result?.id) {
                const savedEntryPoints = await api.ispEntryPoints.replaceForIsp(result.id, form.entryPoints);
                result.entryPoints = savedEntryPoints;
            }

            if (onSaved) await onSaved(result);
        } catch (error) {
            logger.error(error);
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

                        <div className="glass-card backdrop-blur-xl rounded-2xl p-5 border-white/20 shadow-glass-depth relative z-10">
                            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="h-5 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-widest">Titik Masuk FO</h3>
                                        <p className="mt-1 text-[10px] font-bold tracking-wide text-white/40">Opsional. Tambahkan satu atau beberapa titik masuk ISP ke wilayah KIMA.</p>
                                    </div>
                                </div>
                                <button
                                    className="h-9 rounded-xl border border-gold-accent/30 bg-gold-accent/10 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-gold-accent transition-all hover:bg-gold-accent hover:text-black"
                                    onClick={() => setForm((previous) => {
                                        setSelectedEntryPointIndex(previous.entryPoints.length);
                                        return { ...previous, entryPoints: [...previous.entryPoints, createEntryPointDraft()] };
                                    })}
                                    type="button"
                                >
                                    Tambah Titik
                                </button>
                            </div>

                            {form.entryPoints.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-[10px] font-bold uppercase tracking-widest text-white/35 backdrop-blur-md">
                                    Belum ada titik masuk FO. Tambahkan titik lalu klik peta untuk menentukan koordinatnya.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <EntryPointMapPicker
                                        points={form.entryPoints}
                                        selectedIndex={selectedEntryPointIndex}
                                        onSelectIndex={setSelectedEntryPointIndex}
                                        onPickCoordinate={pickEntryPointCoordinate}
                                    />
                                    {form.entryPoints.map((point, index) => (
                                        <div key={point.id ?? `entry-${index}`} className={`rounded-2xl border bg-black/20 p-4 backdrop-blur-md ${selectedEntryPointIndex === index ? "border-gold-accent/40 shadow-gold-glow" : "border-white/10"}`}>
                                            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Titik #{index + 1}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        className={`rounded-lg border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${selectedEntryPointIndex === index ? "border-blue-400/40 bg-blue-500/20 text-blue-300" : "border-white/10 bg-white/5 text-white/40 hover:text-white"}`}
                                                        onClick={() => setSelectedEntryPointIndex(index)}
                                                        type="button"
                                                    >
                                                        Pilih di Peta
                                                    </button>
                                                    <button
                                                        className={`rounded-lg border px-3 py-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${point.isDefault ? "border-gold-accent/40 bg-gold-accent/20 text-gold-accent" : "border-white/10 bg-white/5 text-white/40 hover:text-white"}`}
                                                        onClick={() => setDefaultEntryPoint(index)}
                                                        type="button"
                                                    >
                                                        Default
                                                    </button>
                                                    <button
                                                        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-rose-400 transition-all hover:bg-rose-500 hover:text-white"
                                                        onClick={() => removeEntryPoint(index)}
                                                        type="button"
                                                    >
                                                        Hapus
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                <GlassFieldInput label="Nama Titik" icon="place" placeholder={`Titik Masuk #${index + 1}`} value={point.label} error={fieldErrors[`entryPoints.${index}.label`]} onChange={(value) => updateEntryPoint(index, { label: value })} />
                                                <GlassFieldInput label="Latitude" icon="my_location" placeholder="-5.0929" value={point.latitude} error={fieldErrors[`entryPoints.${index}.latitude`]} onChange={(value) => updateEntryPoint(index, { latitude: value })} />
                                                <GlassFieldInput label="Longitude" icon="explore" placeholder="119.5018" value={point.longitude} error={fieldErrors[`entryPoints.${index}.longitude`]} onChange={(value) => updateEntryPoint(index, { longitude: value })} />
                                                <GlassCustomSelect
                                                    label="Status"
                                                    icon="toggle_on"
                                                    value={point.status}
                                                    onChange={(value) => updateEntryPoint(index, { status: value })}
                                                    options={[
                                                        { value: "aktif", label: "AKTIF" },
                                                        { value: "draft", label: "DRAFT" },
                                                        { value: "nonaktif", label: "NONAKTIF" },
                                                    ]}
                                                />
                                                <GlassFieldInput label="Jenis Kabel" icon="cable" placeholder="Opsional" value={point.fiberType} onChange={(value) => updateEntryPoint(index, { fiberType: value })} />
                                                <GlassFieldInput label="Kapasitas Core" icon="hub" placeholder="Opsional" type="number" value={point.coreCapacity} error={fieldErrors[`entryPoints.${index}.coreCapacity`]} onChange={(value) => updateEntryPoint(index, { coreCapacity: value })} />
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <GlassFieldInput label="Catatan Kapasitas" icon="notes" placeholder="Opsional" value={point.capacityNote} onChange={(value) => updateEntryPoint(index, { capacityNote: value })} />
                                                <GlassFieldInput label="Keterangan" icon="description" placeholder="Opsional" value={point.description} onChange={(value) => updateEntryPoint(index, { description: value })} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

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
