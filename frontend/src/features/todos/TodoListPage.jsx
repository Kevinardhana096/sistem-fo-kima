import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../lib/api";

const TYPE_LABELS = {
    contract_expiring: "Kontrak",
    contract_admin: "Kontrak",
    invoice_attention: "Invoice",
    invoice_setup: "Invoice",
    invoice_reminder: "Invoice",
    route_attention: "Jalur",
    route_setup: "Jalur",
    activation_fee: "Aktivasi",
    payment_overdue: "Invoice",
    invoice_not_uploaded: "Invoice",
    isp_contract: "Kontrak ISP",
    isp_document: "Dokumen ISP",
};

const SEVERITY_LABELS = {
    critical: "Critical",
    warning: "Warning",
    info: "Info",
};

const SEVERITY_CONFIG = {
    critical: { text: "text-[#ff2400]", bg: "bg-[#ff2400]/10", border: "border-[#ff2400]/30", hover: "hover:border-[#ff2400]/40" },
    warning:  { text: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30",  hover: "hover:border-amber-500/40" },
    info:     { text: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-500/30",   hover: "hover:border-blue-500/40" },
};

const TYPE_ICON = {
    contract_expiring: "event_busy",
    contract_admin: "description",
    invoice_attention: "receipt_long",
    invoice_setup: "edit_calendar",
    invoice_reminder: "notification_important",
    route_attention: "route",
    route_setup: "add_road",
    activation_fee: "payments",
    isp_contract: "assignment",
    isp_document: "upload_file",
};

const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

const getStatusKey = (n) => n.resolvedAt ? "resolved" : n.readAt ? "read" : "unread";
const getTypeLabel = (n) => TYPE_LABELS[n.type] || TYPE_LABELS[n.code] || n.type || "Umum";

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
                    <span className={`material-symbols-outlined text-[16px] shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>expand_more</span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className={`absolute ${position === "top" ? "bottom-full mb-3" : "top-full mt-3"} ${align === "right" ? "right-0" : "left-0"} z-50 w-full ${menuWidth} rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                        <div className="max-h-[250px] overflow-y-auto py-1.5 [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gold-accent/30 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
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

export default function TodoListPage({ activeSection, onNavigate, onLogout, currentRole = "admin" }) {
    const [notifications, setNotifications] = useState([]);
    const [search, setSearch] = useState("");
    const [severity, setSeverity] = useState("all");
    const [type, setType] = useState("all");
    const [status, setStatus] = useState("active");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const paginationRef = useRef(null);
    const isScrollingProgrammatically = useRef(false);


    const loadNotifications = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const data = await api.notifications.list({ limit: 200, includeResolved: true });
            setNotifications(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal memuat To Do List.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadNotifications(); }, [loadNotifications]);

    const counts = useMemo(() => notifications.reduce((acc, n) => {
        const key = getStatusKey(n);
        acc.total += 1; acc[key] += 1;
        if (!n.resolvedAt) acc.active += 1;
        return acc;
    }, { total: 0, active: 0, unread: 0, read: 0, resolved: 0 }), [notifications]);

    const typeOptions = useMemo(() => {
        const values = new Map();
        notifications.forEach((n) => { const k = n.type || n.code || "general"; values.set(k, getTypeLabel(n)); });
        return Array.from(values.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [notifications]);

    const filteredNotifications = useMemo(() => {
        const q = search.trim().toLowerCase();
        return notifications.filter((n) => {
            const haystack = [n.title, n.message, n.customerName, n.code, n.type].filter(Boolean).join(" ").toLowerCase();
            const sk = getStatusKey(n);
            return (!q || haystack.includes(q))
                && (severity === "all" || n.severity === severity)
                && (type === "all" || n.type === type || n.code === type)
                && (status === "all" || (status === "active" && !n.resolvedAt) || sk === status);
        });
    }, [notifications, search, severity, status, type]);

    useEffect(() => { setCurrentPage(1); }, [search, severity, status, type, itemsPerPage]);

    const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedNotifications = filteredNotifications.slice(startIndex, startIndex + itemsPerPage);

    const hasFilters = search !== "" || type !== "all" || severity !== "all" || status !== "active";
    const resetFilters = () => {
        setSearch("");
        setType("all");
        setSeverity("all");
        setStatus("active");
    };

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

    const openNotification = async (n) => {
        if (!n.readAt) { await api.notifications.markRead(n.id); await loadNotifications(); }
        if (n.targetPath) { window.history.pushState({}, "", n.targetPath); window.dispatchEvent(new PopStateEvent("popstate")); }
    };
    const markRead = async (n) => { await api.notifications.markRead(n.id); await loadNotifications(); };
    const markResolved = async (n) => { await api.notifications.markResolved(n.id); await loadNotifications(); };

    const STAT_CARDS = [
        { label: "Aktif", value: counts.active, icon: "task_alt", color: "text-gold-accent", bg: "bg-gold-accent/10", border: "border-gold-accent/20" },
        { label: "Belum Dibaca", value: counts.unread, icon: "mark_email_unread", color: "text-[#ff2400]", bg: "bg-[#ff2400]/10", border: "border-[#ff2400]/20" },
        { label: "Dibaca", value: counts.read, icon: "drafts", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
        { label: "Selesai", value: counts.resolved, icon: "check_circle", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
    ];

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            <div className="space-y-3 pb-20 pt-2 md:pt-4">

                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="h-[2px] w-6 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[9px] font-black text-gold-accent uppercase tracking-[0.3em]">Pusat Tindakan</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight leading-tight">
                            Tindak <span className="text-gold-accent italic">Lanjut</span>
                        </h1>
                        <p className="mt-1 max-w-xl text-[11px] font-bold text-white/40">
                            Kelola semua notifikasi operasional yang perlu dibaca atau ditindaklanjuti.
                        </p>
                    </div>
                    <button
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95 group disabled:opacity-50 backdrop-blur-md"
                        onClick={loadNotifications} disabled={isLoading} type="button" title="Refresh"
                    >
                        <span className={`material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500 ${isLoading ? "animate-spin" : ""}`}>sync</span>
                    </button>
                </header>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {STAT_CARDS.map(({ label, value, icon, color, bg, border }) => (
                        <div key={label} className={`relative overflow-hidden glass-card rounded-2xl p-4 group border ${border}`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[8px] font-black uppercase tracking-widest text-white/40">{label}</p>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${bg} border ${border}`}>
                                    <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
                                </div>
                            </div>
                            <p className={`text-2xl font-black ${color}`}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Filter Bar */}
                <div className="glass-card rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 items-center z-50 relative">
                    <div className="relative flex-1 w-full group">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]">search</span>
                        <input
                            type="text"
                            placeholder="Cari pelanggan, pesan, atau kode..."
                            className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-[9px] font-black uppercase tracking-widest text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md"
                            value={search} onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex w-full sm:w-auto items-center gap-2">
                        <div className="grid grid-cols-3 gap-2 flex-1 sm:flex sm:items-center sm:gap-2">
                            {[
                                { z: "z-[60]", icon: "category", val: type, setter: setType, opts: [{ value: "all", label: "Semua Tipe" }, ...typeOptions.map(([v, l]) => ({ value: v, label: l }))] },
                                { z: "z-50",   icon: "warning",  val: severity, setter: setSeverity, opts: [{ value: "all", label: "Semua Severity" }, ...Object.entries(SEVERITY_LABELS).map(([v, l]) => ({ value: v, label: l }))] },
                                { z: "z-40",   icon: "flag",     val: status, setter: setStatus, opts: [{ value: "active", label: "Aktif" }, { value: "unread", label: "Belum Dibaca" }, { value: "read", label: "Dibaca" }, { value: "resolved", label: "Selesai" }, { value: "all", label: "Semua Status" }], align: "right" },
                            ].map(({ z, icon, val, setter, opts, align = "left" }) => (
                                <div key={icon} className={`relative ${z} w-full sm:w-36`}>
                                    <div className="relative group h-9 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                        <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none text-[15px]`}>{icon}</span>
                                        <CustomDropdown value={val} onChange={setter} options={opts} triggerClass="pl-9 pr-3 text-[9px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent" align={align} />
                                    </div>
                                </div>
                            ))}
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
                            <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
                            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Reset</span>
                        </button>
                    </div>
                </div>

                {/* List Section */}
                <div className="glass-card rounded-2xl p-5 cursor-default relative z-40">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <span className="h-4 w-1 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-sm font-black uppercase tracking-widest text-white">Daftar Tindakan</h2>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md">
                            <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Total:</span>
                            <span className="text-sm font-black text-gold-accent">{filteredNotifications.length}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl border border-[#ff2400]/20 bg-[#ff2400]/10 p-3 text-xs font-bold text-[#ff2400]">{error}</div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="h-10 w-10 border-2 border-gold-accent border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Memuat daftar tindakan...</p>
                        </div>
                    ) : filteredNotifications.length > 0 ? (
                        <div className="space-y-2.5">
                            {paginatedNotifications.map((n) => {
                                const cfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
                                const sk = getStatusKey(n);
                                return (
                                    <div key={n.id} className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10 ${cfg.hover} backdrop-blur-md overflow-hidden border border-white/10 ${n.resolvedAt ? "opacity-60" : ""}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cfg.border} ${cfg.bg}`}>
                                                <span className={`material-symbols-outlined text-xl ${cfg.text}`}>{TYPE_ICON[n.type] || "task_alt"}</span>
                                            </div>
                                            <div>
                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                    <h3 className="text-xs font-black text-white tracking-tight">{n.title}</h3>
                                                    {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-gold-accent shadow-gold-glow shrink-0"></span>}
                                                    <span className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] border ${cfg.border} ${cfg.bg} ${cfg.text}`}>
                                                        {SEVERITY_LABELS[n.severity] || n.severity}
                                                    </span>
                                                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white/40">
                                                        {sk === "resolved" ? "Selesai" : sk === "read" ? "Dibaca" : "Belum Dibaca"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-bold text-white/70 mb-1 max-w-xl leading-relaxed">{n.message}</p>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-black uppercase tracking-widest text-white/35">
                                                    <span className="text-gold-accent/70">{getTypeLabel(n)}</span>
                                                    {n.customerName && <span>{n.customerName}</span>}
                                                    <span>Dibuat: {formatDate(n.createdAt)}</span>
                                                    {n.readAt && <span>Dibaca: {formatDate(n.readAt)}</span>}
                                                    {n.resolvedAt && <span>Selesai: {formatDate(n.resolvedAt)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                            <button
                                                className="flex h-8 items-center gap-1.5 rounded-lg border border-gold-accent/20 bg-gold-accent/10 px-3 text-[8px] font-black uppercase tracking-widest text-gold-accent transition-all hover:bg-gold-accent hover:text-black active:scale-95 backdrop-blur-md"
                                                onClick={() => openNotification(n)} type="button"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                {n.actionLabel || "Buka"}
                                            </button>
                                            {!n.readAt && (
                                                <button
                                                    className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white active:scale-95 backdrop-blur-md"
                                                    onClick={() => markRead(n)} type="button"
                                                >Dibaca</button>
                                            )}
                                            {!n.resolvedAt && (
                                                <button
                                                    className="flex h-8 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-[8px] font-black uppercase tracking-widest text-emerald-400 transition-all hover:bg-emerald-500 hover:text-white active:scale-95 backdrop-blur-md"
                                                    onClick={() => markResolved(n)} type="button"
                                                >Selesai</button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative z-[60] w-12 hidden sm:block">
                                            <div className="relative group h-8 rounded-lg bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                                <CustomDropdown
                                                    value={itemsPerPage}
                                                    onChange={(val) => setItemsPerPage(Number(val))}
                                                    options={[10, 20, 50, 100].map(n => ({ value: n, label: String(n) }))}
                                                    triggerClass="text-[10px] font-black uppercase tracking-widest text-white/50 group-hover:text-white"
                                                    position="top"
                                                    hideArrow={true}
                                                    menuWidth="min-w-[60px]"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-white/30 hidden sm:block">
                                            {filteredNotifications.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredNotifications.length)} dari {filteredNotifications.length}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
                                        <button
                                            className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                            type="button" disabled={currentPage <= 1} onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                        >
                                            <span className="material-symbols-outlined text-sm">chevron_left</span> Prev
                                        </button>
                                        
                                        <div 
                                            ref={paginationRef}
                                            onScroll={handlePaginationScroll}
                                            className="flex items-center gap-1.5 w-[164px] justify-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden" 
                                            style={{ scrollbarWidth: 'none' }}
                                        >
                                            <div className="shrink-0 w-7 h-7 snap-center pointer-events-none opacity-0"></div>
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
                                            <div className="shrink-0 w-7 h-7 snap-center pointer-events-none opacity-0"></div>
                                        </div>

                                        <button
                                            className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[8px] font-black uppercase tracking-widest text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 backdrop-blur-md"
                                            type="button" disabled={currentPage >= totalPages} onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                        >
                                            Next <span className="material-symbols-outlined text-sm">chevron_right</span>
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
                                    <span className="material-symbols-outlined text-[44px] text-white/20 transition-colors duration-500 group-hover:text-gold-accent/80">task_alt</span>
                                </div>
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Tidak Ada Tindakan</h3>
                            <p className="text-[11px] font-bold text-white/30 tracking-wide text-center max-w-[240px] leading-relaxed">Tidak ada tindakan yang cocok dengan filter saat ini.</p>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

