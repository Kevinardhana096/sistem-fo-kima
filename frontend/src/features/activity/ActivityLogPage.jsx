import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AppShell from "../../components/layout/AppShell";
import api from "../../lib/api";

const ACTION_LABELS = {
    "customer.created": "Menambahkan pelanggan baru",
    "customer.updated": "Mengubah data pelanggan",
    "customer.status_changed": "Mengubah status pelanggan",
    "customer.deleted": "Menghapus pelanggan",
    "customer.restored": "Memulihkan pelanggan dari Trash",
    "isp.created": "Menambahkan ISP baru",
    "isp.updated": "Mengubah data ISP",
    "isp.deleted": "Menghapus ISP",
    "isp.restored": "Memulihkan ISP dari Trash",
    "contract.restored": "Memulihkan kontrak dari Trash",
    "invoice.restored": "Memulihkan invoice dari Trash",
    "document.restored": "Memulihkan dokumen dari Trash",
    "route.restored": "Memulihkan jalur dari Trash",
};

const ENTITY_LABELS = {
    customer: "Pelanggan",
    isp: "ISP",
    contract: "Kontrak",
    invoice: "Invoice",
    document: "Dokumen",
    route: "Jalur",
};

const ENTITY_CONFIG = {
    customer: { icon: "groups", color: "text-amber-400", bg: "bg-amber-400/10" },
    isp: { icon: "corporate_fare", color: "text-blue-400", bg: "bg-blue-400/10" },
    contract: { icon: "article", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    invoice: { icon: "receipt_long", color: "text-[#ff2400]", bg: "bg-[#ff2400]/10" },
    document: { icon: "description", color: "text-slate-400", bg: "bg-slate-400/10" },
    route: { icon: "route", color: "text-indigo-400", bg: "bg-indigo-400/10" },
};

const formatDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getActionLabel = (action) => ACTION_LABELS[action] || action || "Aktivitas";

const formatValue = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
};

function ChangeSummary({ metadata }) {
    const changedFields = Array.isArray(metadata?.changed_fields) ? metadata.changed_fields : [];
    if (changedFields.length === 0) return null;

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Perubahan</p>
            <div className="space-y-2">
                {changedFields.map((field) => (
                    <div key={field} className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gold-accent">{field.replaceAll("_", " ")}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/30">Sebelum</p>
                                <p className="text-sm font-bold text-white/70 whitespace-pre-wrap">{formatValue(metadata?.before?.[field])}</p>
                            </div>
                            <div>
                                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/30">Sesudah</p>
                                <p className="text-sm font-bold text-white whitespace-pre-wrap">{formatValue(metadata?.after?.[field])}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CustomDropdown({ value, options, onChange, align = "left", triggerClass = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0] || { label: value };

    return (
        <div className="relative w-full h-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full h-full items-center justify-between gap-1 appearance-none bg-transparent border-none font-black focus:outline-none ${triggerClass}`}
            >
                <span className="truncate">{selectedOption.label}</span>
                <span className={`material-symbols-outlined text-[16px] shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>expand_more</span>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className={`absolute top-full mt-3 ${align === "right" ? "right-0" : "left-0"} z-50 w-full min-w-[160px] rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                        <div className="max-h-[250px] overflow-y-auto py-1.5 [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gold-accent/30 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-[calc(100%-12px)] mx-1.5 mt-1 mb-1 last:mb-1.5 first:mt-1.5 flex items-center justify-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors rounded-xl text-center ${String(value) === String(opt.value) ? "bg-white/10 text-gold-accent" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                            >
                                <span className="truncate">{opt.label}</span>
                            </button>
                        ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
const getLocalDateString = (d) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().slice(0, 10);
};

const getTodayDate = () => getLocalDateString(new Date());

const getYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
};

export default function ActivityLogPage({ activeSection, onNavigate, onLogout, currentRole = "admin" }) {
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [entityType, setEntityType] = useState("");
    const [action, setAction] = useState("");

    // Default is "all" (Semua Waktu) with empty dates initially
    const [dateMode, setDateMode] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [selectedLog, setSelectedLog] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleDateModeChange = (mode) => {
        setDateMode(mode);
        setCurrentPage(1);
        const today = getTodayDate();
        if (mode === "all") {
            setDateFrom("");
            setDateTo("");
        } else if (mode === "range") {
            setDateFrom(getYesterdayDate());
            setDateTo(today);
        } else if (mode === "till_today") {
            setDateFrom(getYesterdayDate());
            setDateTo(today);
        } else if (mode === "year") {
            setDateFrom(`${selectedYear}-01-01`);
            setDateTo(`${selectedYear}-12-31`);
        }
    };

    const handleYearChange = (year) => {
        setSelectedYear(year);
        setCurrentPage(1);
        if (dateMode === "year") {
            setDateFrom(`${year}-01-01`);
            setDateTo(`${year}-12-31`);
        }
    };

    const actionOptions = useMemo(() => Object.entries(ACTION_LABELS), []);

    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await api.activityLogs.list({
                search: searchQuery,
                entityType,
                action,
                dateFrom,
                dateTo,
                limit: 150,
            });
            setLogs(data);
        } catch (err) {
            console.error("Failed to load activity logs:", err);
            setError(err instanceof Error ? err.message : "Gagal memuat activity log.");
        } finally {
            setIsLoading(false);
        }
    }, [action, dateFrom, dateTo, entityType, searchQuery]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, entityType, action, dateFrom, dateTo]);

    const handleApplyFilter = (event) => {
        event.preventDefault();
        loadLogs();
    };

    const totalPages = Math.max(Math.ceil(logs.length / itemsPerPage), 1);

    const pageNumbers = useMemo(() => {
        const delta = 1;
        const range = [];
        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            range.unshift("...");
        }
        if (currentPage + delta < totalPages - 1) {
            range.push("...");
        }

        range.unshift(1);
        if (totalPages > 1) {
            range.push(totalPages);
        }

        return range;
    }, [currentPage, totalPages]);

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            <div className="space-y-3 pb-20 pt-2 md:pt-4">
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="h-[2px] w-6 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[9px] font-black text-gold-accent uppercase tracking-[0.3em]">Audit Trail</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight leading-tight">
                            Activity <span className="text-gold-accent italic">Log</span>
                        </h1>
                        <p className="mt-1 max-w-xl text-[11px] font-bold text-white/40">
                            Pantau perubahan data pelanggan, ISP, dan pemulihan data dari Trash.
                        </p>
                    </div>
                    <button
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95 group disabled:opacity-50 backdrop-blur-md"
                        onClick={loadLogs}
                        disabled={isLoading}
                        type="button"
                        title="Refresh Data"
                    >
                        <span className={`material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500 ${isLoading ? "animate-spin" : ""}`}>sync</span>
                    </button>
                </header>

                <form onSubmit={handleApplyFilter} className="glass-card rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 items-center z-50 relative">
                    <div className={`flex flex-col sm:flex-row gap-2 w-full ${dateMode === "range" || dateMode === "till_today" ? "lg:flex-row" : ""}`}>
                        <div className={`grid gap-2 w-full ${dateMode === "range" || dateMode === "till_today"
                                ? "lg:grid-cols-[1.2fr_0.8fr_1fr_1.1fr_0.8fr_0.8fr]"
                                : dateMode === "year"
                                    ? "lg:grid-cols-[1.2fr_0.8fr_1fr_1.1fr_0.8fr]"
                                    : "lg:grid-cols-[1.5fr_0.9fr_1.1fr_1.1fr]"
                            }`}>
                        <div className="relative w-full group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Cari user, aktivitas, atau nama data..."
                                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-[9px] font-black uppercase tracking-widest text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>

                        <div className="relative z-[60]">
                            <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">category</span>
                                <CustomDropdown
                                    value={entityType}
                                    onChange={setEntityType}
                                    options={[
                                        { value: "", label: "Semua Modul" },
                                        ...Object.entries(ENTITY_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))
                                    ]}
                                    triggerClass="pl-9 pr-3 text-[9px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>

                        <div className="relative z-50">
                            <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">manage_history</span>
                                <CustomDropdown
                                    value={action}
                                    onChange={setAction}
                                    options={[
                                        { value: "", label: "Semua Aktivitas" },
                                        ...actionOptions.map(([val, lbl]) => ({ value: val, label: lbl }))
                                    ]}
                                    triggerClass="pl-9 pr-3 text-[9px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>

                        <div className="relative z-40">
                            <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">date_range</span>
                                <CustomDropdown
                                    value={dateMode}
                                    onChange={handleDateModeChange}
                                    options={[
                                        { value: "all", label: "Semua Waktu" },
                                        { value: "range", label: "Rentang Kustom" },
                                        { value: "till_today", label: "Sampai Hari Ini" },
                                        { value: "year", label: "Tahun Spesifik" }
                                    ]}
                                    triggerClass="pl-9 pr-3 text-[9px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>

                        {dateMode === "range" && (
                            <>
                                <div className="relative group">
                                    <span className="absolute left-4 top-2 text-[7px] font-black uppercase tracking-widest text-gold-accent/70 pointer-events-none z-10">Dari Tanggal</span>
                                    <input
                                        type="date"
                                        className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-4 pr-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-white outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                        value={dateFrom}
                                        onChange={(event) => setDateFrom(event.target.value)}
                                    />
                                </div>
                                <div className="relative group">
                                    <span className="absolute left-4 top-2 text-[7px] font-black uppercase tracking-widest text-gold-accent/70 pointer-events-none z-10">Sampai Tanggal</span>
                                    <input
                                        type="date"
                                        className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-4 pr-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-white outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                        value={dateTo}
                                        onChange={(event) => setDateTo(event.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        {dateMode === "till_today" && (
                            <>
                                <div className="relative group">
                                    <span className="absolute left-4 top-2 text-[7px] font-black uppercase tracking-widest text-gold-accent/70 pointer-events-none z-10">Pilih Dari Kapan</span>
                                    <input
                                        type="date"
                                        className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-4 pr-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-white outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                        value={dateFrom}
                                        onChange={(event) => setDateFrom(event.target.value)}
                                    />
                                </div>
                                <div className="relative group opacity-60">
                                    <span className="absolute left-4 top-2 text-[7px] font-black uppercase tracking-widest text-white/40 pointer-events-none z-10">Sampai Hari Ini</span>
                                    <input
                                        type="date"
                                        disabled
                                        className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-4 pr-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-white/50 outline-none shadow-inner-glass backdrop-blur-md cursor-not-allowed"
                                        value={dateTo}
                                    />
                                </div>
                            </>
                        )}

                        {dateMode === "year" && (
                            <div className="relative z-40">
                                <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">calendar_today</span>
                                    <CustomDropdown
                                        value={selectedYear}
                                        onChange={handleYearChange}
                                        options={[
                                            String(new Date().getFullYear() - 3),
                                            String(new Date().getFullYear() - 2),
                                            String(new Date().getFullYear() - 1),
                                            String(new Date().getFullYear()),
                                            String(new Date().getFullYear() + 1),
                                        ].map(y => ({ value: y, label: `Tahun ${y}` }))}
                                        triggerClass="pl-9 pr-3 text-[9px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                        align="left"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                    <button
                        className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-gold-accent text-black transition-all hover:brightness-110 active:scale-95 shadow-gold-glow"
                        type="submit"
                        title="Terapkan Filter"
                    >
                        <span className="material-symbols-outlined text-base">filter_alt</span>
                    </button>
                </form>

                <section className="glass-card rounded-2xl p-5 cursor-default relative z-40">
                    <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="h-4 w-1 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">Riwayat Aktivitas</h2>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Total Log:</span>
                            <span className="text-sm font-black text-gold-accent">{logs.length}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl border border-[#ff2400]/20 bg-[#ff2400]/10 p-4 text-sm font-bold text-[#ff2400]">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="h-10 w-10 border-2 border-gold-accent border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Memuat activity log...</p>
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="space-y-2.5">
                            {logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => {
                                const config = ENTITY_CONFIG[log.entity_type] || { icon: "history", color: "text-white/40", bg: "bg-white/5" };
                                const hoverBorderClass = {
                                    customer: "hover:border-amber-500/40",
                                    isp: "hover:border-blue-500/40",
                                    contract: "hover:border-emerald-500/40",
                                    invoice: "hover:border-[#ff2400]/40",
                                    document: "hover:border-white/30",
                                    route: "hover:border-indigo-500/40",
                                }[log.entity_type] || "hover:border-white/20";
                                return (
                                    <div key={log.id} className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10 ${hoverBorderClass} backdrop-blur-md overflow-hidden border border-white/10`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 ${config.bg}`}>
                                                <span className={`material-symbols-outlined text-xl ${config.color}`}>{config.icon}</span>
                                            </div>
                                            <div>
                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                    <h3 className="text-xs font-black text-white tracking-tight">{getActionLabel(log.action)}</h3>
                                                    <span className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] border ${config.color.replace('text-', 'border-')}/40 ${config.bg} ${config.color}`}>
                                                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-bold text-white/70 mb-1">{log.entity_name || "-"}</p>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-black uppercase tracking-widest text-white/35">
                                                    <span className="text-gold-accent/70">{formatDateTime(log.created_at)}</span>
                                                    <span>{log.actor_email || "User tidak diketahui"}</span>
                                                    <span>{log.actor_role || "-"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="self-end flex h-8 items-center gap-1.5 rounded-lg border border-gold-accent/20 bg-gold-accent/10 px-3 text-[8px] font-black uppercase tracking-widest text-gold-accent transition-all hover:bg-gold-accent hover:text-black sm:self-center backdrop-blur-md active:scale-95 shrink-0"
                                            onClick={() => setSelectedLog(log)}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            Lihat Detail
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                        Prev
                                    </button>

                                    <div className="flex items-center gap-1 flex-wrap justify-center">
                                        {pageNumbers.map((page, idx) => {
                                            if (page === "...") {
                                                return (
                                                    <span
                                                        key={`ellipsis-${idx}`}
                                                        className="w-7 h-7 flex items-center justify-center text-[9px] font-black text-white/30 cursor-default"
                                                    >
                                                        ...
                                                    </span>
                                                );
                                            }
                                            const isActive = page === currentPage;
                                            return (
                                                <button
                                                    key={`page-${page}`}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black transition-all ${isActive
                                                            ? "bg-gold-accent text-black shadow-gold-glow"
                                                            : "border border-white/5 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                                                        } backdrop-blur-md`}
                                                    type="button"
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                        type="button"
                                    >
                                        Next
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 sm:py-12 animate-in fade-in zoom-in duration-500">
                            <div className="relative mb-5 mt-2 group">
                                <div className="absolute inset-0 scale-125 bg-gold-accent/5 blur-[40px] rounded-full transition-all duration-700 group-hover:bg-gold-accent/10" />
                                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-inner-glass transition-all duration-500 group-hover:scale-105 group-hover:border-gold-accent/30 group-hover:bg-white/10">
                                    <span className="material-symbols-outlined text-[44px] text-white/20 transition-colors duration-500 group-hover:text-gold-accent/80">manage_history</span>
                                </div>
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Belum Ada Log</h3>
                            <p className="text-[11px] font-bold text-white/30 tracking-wide text-center max-w-[260px] leading-relaxed">Aktivitas baru akan muncul setelah perubahan data dilakukan.</p>
                        </div>
                    )}
                </section>
            </div>

            {selectedLog && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 sm:p-6 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                    {/* Outer: rounded + overflow:hidden clips scrollbar */}
                    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141e] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Inner: scrollable, scrollbar stays inside */}
                        <div className="max-h-[85vh] overflow-y-auto p-5 [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gold-accent/30 [&::-webkit-scrollbar-thumb]:rounded-full">

                            {/* Header */}
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="mb-1 text-[9px] font-black uppercase tracking-[0.3em] text-gold-accent">Detail Activity</p>
                                    <h2 className="text-lg font-black text-white leading-tight">{getActionLabel(selectedLog.action)}</h2>
                                </div>
                                <button
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white backdrop-blur-md transition-all"
                                    onClick={() => setSelectedLog(null)}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>

                            {/* Info Grid */}
                            <div className="grid gap-2 sm:grid-cols-2 mb-4">
                                {[
                                    ["Waktu", formatDateTime(selectedLog.created_at)],
                                    ["User", selectedLog.actor_email || "-"],
                                    ["Role", selectedLog.actor_role || "-"],
                                    ["Modul", ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type],
                                    ["Nama Data", selectedLog.entity_name || "-"],
                                    ["ID Data", selectedLog.entity_id || "-"],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-md">
                                        <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-white/30">{label}</p>
                                        <p className="text-xs font-bold text-white truncate">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Deskripsi */}
                            {selectedLog.description && (
                                <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-md">
                                    <p className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-white/30">Deskripsi</p>
                                    <p className="text-xs font-bold text-white">{selectedLog.description}</p>
                                </div>
                            )}

                            <ChangeSummary metadata={selectedLog.metadata || {}} />

                            {/* Metadata */}
                            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 backdrop-blur-md">
                                <p className="mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Metadata</p>
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] font-semibold text-white/60 [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gold-accent/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                    {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                                </pre>
                            </div>

                        </div>
                    </div>
                </div>,
                document.body
            )}
        </AppShell>
    );
}
