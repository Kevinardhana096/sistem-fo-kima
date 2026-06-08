import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import AppShell from "../../components/layout/AppShell";
import api from "../../lib/api";
import DateInput from "../../components/shared/DateInput";

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

function CustomDropdown({ value, options, onChange, align = "left", position = "bottom", triggerClass = "", hideArrow = false, menuWidth = "min-w-[160px]" }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0] || { label: value };

    return (
        <div className="relative w-full h-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full h-full items-center ${hideArrow ? "justify-center" : "justify-between"} gap-1 appearance-none bg-transparent border-none font-black focus:outline-none ${triggerClass}`}
            >
                <span className="truncate">{selectedOption.label}</span>
                {!hideArrow && (
                    <span className={`material-symbols-outlined shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} style={{ fontSize: "18px" }}>expand_more</span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className={`absolute ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${align === "right" ? "right-0" : "left-0"} z-50 min-w-full ${menuWidth} rounded-xl bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                        <div className="max-h-[200px] overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full flex items-center justify-start px-3 py-1.5 mb-0.5 last:mb-0 text-[8px] font-black uppercase tracking-widest transition-colors rounded-lg text-left ${String(value) === String(opt.value) ? "bg-gold-accent/10 text-gold-accent" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
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

    // Default is "all" (Semua Waktu) with empty dates initially
    const [dateMode, setDateMode] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const paginationRef = useRef(null);
    const isScrollingProgrammatically = useRef(false);

    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedLogIds, setSelectedLogIds] = useState(() => new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isDeletingLogs, setIsDeletingLogs] = useState(false);
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



    const loadLogs = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await api.activityLogs.list({
                search: searchQuery,
                entityType,
                dateFrom,
                dateTo,
                limit: 150,
            });
            setLogs(data);
            const existingIds = new Set(data.map((log) => Number(log.id)));
            setSelectedLogIds((previous) => new Set([...previous].filter((id) => existingIds.has(Number(id)))));
        } catch (err) {
            console.error("Failed to load activity logs:", err);
            setError(err instanceof Error ? err.message : "Gagal memuat activity log.");
        } finally {
            setIsLoading(false);
        }
    }, [dateFrom, dateTo, entityType, searchQuery]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, entityType, dateFrom, dateTo]);

    const hasFilters = searchQuery !== "" || entityType !== "" || dateMode !== "all";

    const resetFilters = () => {
        setSearchQuery("");
        setEntityType("");
        setDateMode("all");
        setDateFrom("");
        setDateTo("");
        setSelectedYear(String(new Date().getFullYear()));
    };

    const totalPages = Math.max(Math.ceil(logs.length / itemsPerPage), 1);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const visibleLogs = useMemo(
        () => logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
        [currentPage, itemsPerPage, logs],
    );
    const selectedCount = selectedLogIds.size;
    const visibleSelectableIds = useMemo(
        () => visibleLogs.map((log) => Number(log.id)).filter(Number.isFinite),
        [visibleLogs],
    );
    const areVisibleLogsSelected = visibleSelectableIds.length > 0
        && visibleSelectableIds.every((id) => selectedLogIds.has(id));

    const handlePaginationScroll = useCallback((e) => {
        if (isScrollingProgrammatically.current) return;
        const scrollLeft = e.target.scrollLeft;
        const page = Math.round(scrollLeft / 34) + 1;
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
        }
    }, [currentPage, totalPages]);

    const handlePageChange = useCallback((page) => {
        isScrollingProgrammatically.current = true;
        setCurrentPage(page);
        if (paginationRef.current) {
            paginationRef.current.scrollTo({ left: (page - 1) * 34, behavior: 'smooth' });
        }
        setTimeout(() => { isScrollingProgrammatically.current = false; }, 400);
    }, []);

    const pageNumbers = useMemo(() => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
        return pages;
    }, [totalPages]);

    const toggleLogSelection = (logId) => {
        const normalizedId = Number(logId);
        if (!Number.isFinite(normalizedId)) return;
        setSelectedLogIds((previous) => {
            const next = new Set(previous);
            if (next.has(normalizedId)) {
                next.delete(normalizedId);
            } else {
                next.add(normalizedId);
            }
            return next;
        });
    };

    const toggleVisibleSelection = () => {
        setSelectedLogIds((previous) => {
            const next = new Set(previous);
            if (areVisibleLogsSelected) {
                visibleSelectableIds.forEach((id) => next.delete(id));
            } else {
                visibleSelectableIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const handleDeleteSelectedLogs = async () => {
        if (selectedCount === 0) return;
        if (!window.confirm(`Hapus ${selectedCount} log aktivitas terpilih? Tindakan ini tidak dapat dibatalkan.`)) return;

        setIsDeletingLogs(true);
        setError("");
        try {
            await api.activityLogs.deleteMany([...selectedLogIds]);
            if (selectedLog && selectedLogIds.has(Number(selectedLog.id))) {
                setSelectedLog(null);
            }
            setSelectedLogIds(new Set());
            await loadLogs();
        } catch (err) {
            console.error("Failed to delete selected activity logs:", err);
            setError(err instanceof Error ? err.message : "Gagal menghapus log terpilih.");
        } finally {
            setIsDeletingLogs(false);
        }
    };

    const handleDeleteAllLogs = async () => {
        if (logs.length === 0) return;
        if (!window.confirm("Hapus SEMUA log aktivitas? Tindakan ini tidak dapat dibatalkan.")) return;

        setIsDeletingLogs(true);
        setError("");
        try {
            await api.activityLogs.deleteAll();
            setSelectedLog(null);
            setSelectedLogIds(new Set());
            await loadLogs();
        } catch (err) {
            console.error("Failed to delete all activity logs:", err);
            setError(err instanceof Error ? err.message : "Gagal menghapus semua log aktivitas.");
        } finally {
            setIsDeletingLogs(false);
        }
    };

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
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95 group disabled:opacity-50 backdrop-blur-md"
                            onClick={loadLogs}
                            disabled={isLoading}
                            type="button"
                            title="Refresh Data"
                        >
                            <span className={`material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500 ${isLoading ? "animate-spin" : ""}`}>sync</span>
                        </button>
                    </div>
                </header>

                <div className="glass-card rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 items-center z-50 relative">
                    <div className="flex flex-col sm:flex-row gap-2 w-full flex-1">
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <div className="relative w-full flex-1 group">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none" style={{ fontSize: "18px" }}>
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Cari user, aktivitas, atau nama data..."
                                className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-[8px] font-black uppercase tracking-widest text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>

                        <div className="relative z-[60]">
                            <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none" style={{ fontSize: "18px" }}>category</span>
                                <CustomDropdown
                                    value={entityType}
                                    onChange={setEntityType}
                                    options={[
                                        { value: "", label: "Semua Modul" },
                                        ...Object.entries(ENTITY_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))
                                    ]}
                                    triggerClass="pl-9 pr-3 text-[8px] font-black uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>




                    </div>
                    </div>
                    <button
                        onClick={resetFilters}
                        disabled={!hasFilters}
                        className={`h-9 px-3 shrink-0 rounded-lg border transition-all backdrop-blur-md flex items-center gap-1.5 ${
                            hasFilters 
                                ? "border-[#ff2400]/20 bg-[#ff2400]/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white" 
                                : "border-white/5 bg-white/5 text-white/20 opacity-50 cursor-not-allowed"
                        }`}
                        type="button"
                        title="Reset Filter"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>filter_alt_off</span>
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Reset</span>
                    </button>
                </div>

                <section className="glass-card rounded-2xl p-5 cursor-default relative z-40">
                    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-1 bg-gold-accent rounded-full shadow-gold-glow"></span>
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Riwayat Aktivitas</h2>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedCount > 0 && (
                                <button
                                    onClick={handleDeleteSelectedLogs}
                                    disabled={isLoading || isDeletingLogs}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] transition-all hover:bg-[#ff2400] hover:text-white active:scale-95 backdrop-blur-md animate-in fade-in group shadow-sm"
                                    title={`Hapus Permanen ${selectedCount} terpilih`}
                                    type="button"
                                >
                                    <span className={`material-symbols-outlined ${isDeletingLogs ? "animate-spin" : ""}`} style={{ fontSize: "14px" }}>
                                        {isDeletingLogs ? "sync" : "delete_forever"}
                                    </span>
                                </button>
                            )}
                            {logs.length > 0 && (
                                <button
                                    onClick={toggleVisibleSelection}
                                    disabled={isLoading || isDeletingLogs || visibleSelectableIds.length === 0}
                                    className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[8px] font-black uppercase tracking-widest transition-all backdrop-blur-md ${
                                        selectedCount > 0
                                            ? "border-gold-accent/40 bg-gold-accent/20 text-gold-accent hover:bg-gold-accent hover:text-black"
                                            : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                                    }`}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                        {areVisibleLogsSelected ? "deselect" : "select_all"}
                                    </span>
                                    {selectedCount > 0 ? `${selectedCount} Terpilih` : "Pilih"}
                                </button>
                            )}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md">
                                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Total Log:</span>
                                <span className="text-sm font-black text-gold-accent">{logs.length}</span>
                            </div>
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
                            {visibleLogs.map((log) => {
                                const config = ENTITY_CONFIG[log.entity_type] || { icon: "history", color: "text-white/40", bg: "bg-white/5" };
                                const hoverBorderClass = {
                                    customer: "hover:border-amber-500/40",
                                    isp: "hover:border-blue-500/40",
                                    contract: "hover:border-emerald-500/40",
                                    invoice: "hover:border-[#ff2400]/40",
                                    document: "hover:border-white/30",
                                    route: "hover:border-indigo-500/40",
                                }[log.entity_type] || "hover:border-white/20";
                                const isSelected = selectedLogIds.has(Number(log.id));
                                return (
                                    <div key={log.id} className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10 ${hoverBorderClass} backdrop-blur-md overflow-hidden border ${isSelected ? "border-gold-accent/50 bg-gold-accent/10" : "border-white/10"}`}>
                                        <div className="flex items-center gap-3">
                                            <button
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all backdrop-blur-md ${
                                                    isSelected
                                                        ? "border-gold-accent/50 bg-gold-accent/15 text-gold-accent"
                                                        : "border-white/10 bg-white/5 text-white/35 hover:bg-white/10 hover:text-white"
                                                }`}
                                                disabled={isDeletingLogs}
                                                onClick={() => toggleLogSelection(log.id)}
                                                title={isSelected ? "Batalkan pilihan" : "Pilih log"}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                                    {isSelected ? "check_box" : "check_box_outline_blank"}
                                                </span>
                                            </button>
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
                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                                            Lihat Detail
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Pagination controls */}
                            {totalPages > 1 && (
                                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative z-[60] w-12 hidden sm:block">
                                            <div className="relative group h-8 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                                <CustomDropdown
                                                    value={itemsPerPage}
                                                    onChange={(val) => setItemsPerPage(Number(val))}
                                                    options={[10, 20, 50, 100].map(n => ({ value: n, label: String(n) }))}
                                                    triggerClass="text-[8px] font-black uppercase tracking-widest text-white/50 group-hover:text-white"
                                                    position="top"
                                                    hideArrow={true}
                                                    menuWidth="min-w-[60px]"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-white/30 hidden sm:block">
                                            {logs.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, logs.length)} dari {logs.length}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                                        <button
                                            className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                            type="button" disabled={currentPage <= 1} onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_left</span> Prev
                                        </button>
                                        
                                        <div 
                                            ref={paginationRef}
                                            onScroll={handlePaginationScroll}
                                            className="flex items-center gap-1.5 w-[96px] justify-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden" 
                                            style={{ scrollbarWidth: 'none' }}
                                        >
                                            <div className="shrink-0 w-7 h-7 snap-center pointer-events-none opacity-0"></div>

                                            {pageNumbers.map((page) => {
                                                const distance = Math.abs(currentPage - page);
                                                const isActive = distance === 0;
                                                
                                                let scaleClass = "scale-100 opacity-100 z-10";
                                                let bgClass = "bg-white/5 border border-white/5 text-white/50 hover:bg-white/10 hover:text-white";
                                                
                                                if (distance === 1) {
                                                    scaleClass = "scale-90 opacity-80 z-0";
                                                    bgClass = "bg-white/5 border border-white/5 text-white/40 hover:bg-white/10 hover:text-white";
                                                } else if (distance >= 2) {
                                                    scaleClass = "scale-75 opacity-40 z-0";
                                                    bgClass = "bg-white/5 border border-white/5 text-white/30";
                                                }

                                                if (isActive) {
                                                    bgClass = "bg-gold-accent text-black shadow-gold-glow";
                                                }

                                                return (
                                                    <button
                                                        key={`page-${page}`}
                                                        onClick={() => handlePageChange(page)}
                                                        className={`snap-center shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black transition-all duration-300 ease-out transform ${scaleClass} ${bgClass} backdrop-blur-md`}
                                                        type="button"
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}

                                            <div className="shrink-0 w-7 h-7 snap-center pointer-events-none opacity-0"></div>
                                        </div>

                                        <button
                                            className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                            type="button" disabled={currentPage >= totalPages} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                        >
                                            Next <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_right</span>
                                        </button>
                                    </div>
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
