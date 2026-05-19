import React, { useCallback, useEffect, useMemo, useState } from "react";
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
                    <div className={`absolute top-full mt-3 ${align === "right" ? "right-0" : "left-0"} z-50 w-full min-w-[160px] max-h-[250px] overflow-y-auto custom-scrollbar rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-200`}>
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
                </>
            )}
        </div>
    );
}

export default function ActivityLogPage({ activeSection, onNavigate, onLogout, currentRole = "admin" }) {
    const [logs, setLogs] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [entityType, setEntityType] = useState("");
    const [action, setAction] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [selectedLog, setSelectedLog] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

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

    const handleApplyFilter = (event) => {
        event.preventDefault();
        loadLogs();
    };

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            <div className="space-y-6 pb-20 pt-2 md:pt-4">
                <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="h-[2px] w-8 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[10px] font-black text-gold-accent uppercase tracking-[0.4em]">Audit Trail</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-on-surface tracking-tight leading-tight">
                            Activity <span className="text-gold-accent italic">Log</span>
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm font-bold text-white/40">
                            Pantau perubahan data pelanggan, ISP, dan pemulihan data dari Trash.
                        </p>
                    </div>
                    <button
                        className="h-12 rounded-xl border border-white/10 bg-white/5 px-6 text-[10px] font-black uppercase tracking-widest text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50 backdrop-blur-md"
                        onClick={loadLogs}
                        disabled={isLoading}
                        type="button"
                    >
                        <span className={`material-symbols-outlined mr-2 align-middle text-base ${isLoading ? "animate-spin" : ""}`}>sync</span>
                        Refresh
                    </button>
                </header>

                <form onSubmit={handleApplyFilter} className="relative z-50 rounded-premium border border-white/10 bg-white/10 p-5 shadow-glass-depth backdrop-blur-xl">
                    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_1fr_0.7fr_0.7fr_auto]">
                        <div className="relative w-full group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none">
                                search
                            </span>
                            <input
                                type="text"
                                placeholder="Cari user, aktivitas, atau nama data..."
                                className="w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>
                        
                        <div className="relative z-[60]">
                            <div className="relative group h-12 rounded-xl bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none">category</span>
                                <CustomDropdown 
                                    value={entityType}
                                    onChange={setEntityType}
                                    options={[
                                        { value: "", label: "Semua Modul" },
                                        ...Object.entries(ENTITY_LABELS).map(([val, lbl]) => ({ value: val, label: lbl }))
                                    ]}
                                    triggerClass="pl-12 pr-4 text-[10px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>

                        <div className="relative z-50">
                            <div className="relative group h-12 rounded-xl bg-white/5 border border-white/10 focus-within:border-gold-accent/40 focus-within:bg-black/40 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none">manage_history</span>
                                <CustomDropdown 
                                    value={action}
                                    onChange={setAction}
                                    options={[
                                        { value: "", label: "Semua Aktivitas" },
                                        ...actionOptions.map(([val, lbl]) => ({ value: val, label: lbl }))
                                    ]}
                                    triggerClass="pl-12 pr-4 text-[10px] uppercase tracking-widest text-white/40 group-focus-within:text-gold-accent"
                                    align="left"
                                />
                            </div>
                        </div>

                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none">calendar_today</span>
                            <input
                                type="date"
                                className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white/40 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                value={dateFrom}
                                onChange={(event) => setDateFrom(event.target.value)}
                            />
                        </div>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none">event</span>
                            <input
                                type="date"
                                className="relative w-full h-12 rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white/40 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                                value={dateTo}
                                onChange={(event) => setDateTo(event.target.value)}
                            />
                        </div>
                        <button
                            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-accent text-black transition-all hover:brightness-110 active:scale-95 shadow-gold-glow"
                            type="submit"
                            title="Terapkan Filter"
                        >
                            <span className="material-symbols-outlined text-xl">filter_alt</span>
                        </button>
                    </div>
                </form>

                <section className="relative z-40 rounded-premium border border-white/10 bg-white/10 p-6 md:p-8 shadow-glass-depth backdrop-blur-xl">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-xl font-black uppercase tracking-widest text-white">Riwayat Aktivitas</h2>
                        </div>
                        <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gold-accent backdrop-blur-md">
                            {logs.length} Log
                        </span>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-xl border border-[#ff2400]/20 bg-[#ff2400]/10 p-4 text-sm font-bold text-[#ff2400]">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-gold-accent border-t-transparent"></div>
                            <p className="text-sm font-bold uppercase tracking-widest text-white/40">Memuat activity log...</p>
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="space-y-4">
                            {logs.map((log) => {
                                const config = ENTITY_CONFIG[log.entity_type] || { icon: "history", color: "text-white/40", bg: "bg-white/5" };
                                return (
                                    <div key={log.id} className="group flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 lg:flex-row lg:items-center lg:justify-between backdrop-blur-md">
                                        <div className="flex items-start gap-5">
                                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/5 ${config.bg}`}>
                                                <span className={`material-symbols-outlined text-2xl ${config.color}`}>{config.icon}</span>
                                            </div>
                                            <div>
                                                <div className="mb-2 flex flex-wrap items-center gap-3">
                                                    <h3 className="text-base font-black text-white">{getActionLabel(log.action)}</h3>
                                                    <span className={`rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] ${config.bg} ${config.color}`}>
                                                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-white/70">{log.entity_name || "-"}</p>
                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-widest text-white/35">
                                                    <span>{formatDateTime(log.created_at)}</span>
                                                    <span>{log.actor_email || "User tidak diketahui"}</span>
                                                    <span>{log.actor_role || "-"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            className="self-end rounded-xl border border-gold-accent/20 bg-gold-accent/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gold-accent transition-all hover:bg-gold-accent hover:text-black lg:self-center backdrop-blur-md"
                                            onClick={() => setSelectedLog(log)}
                                            type="button"
                                        >
                                            Lihat Detail
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
                            <div className="relative mb-8 mt-4 group">
                                <div className="absolute inset-0 scale-125 bg-gold-accent/5 blur-[50px] rounded-full transition-all duration-700 group-hover:bg-gold-accent/10" />
                                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-inner-glass transition-all duration-500 group-hover:scale-105 group-hover:border-gold-accent/30 group-hover:bg-white/10">
                                    <span className="material-symbols-outlined text-[72px] text-white/20 transition-colors duration-500 group-hover:text-gold-accent/80">manage_history</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-3">Belum Ada Log</h3>
                            <p className="text-sm font-bold text-white/30 tracking-wide">Aktivitas baru akan muncul setelah perubahan data dilakukan.</p>
                        </div>
                    )}
                </section>
            </div>

            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0f141e] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent">Detail Activity</p>
                                <h2 className="text-2xl font-black text-white">{getActionLabel(selectedLog.action)}</h2>
                            </div>
                            <button
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white backdrop-blur-md"
                                onClick={() => setSelectedLog(null)}
                                type="button"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 mb-6">
                            {[
                                ["Waktu", formatDateTime(selectedLog.created_at)],
                                ["User", selectedLog.actor_email || "-"],
                                ["Role", selectedLog.actor_role || "-"],
                                ["Modul", ENTITY_LABELS[selectedLog.entity_type] || selectedLog.entity_type],
                                ["Nama Data", selectedLog.entity_name || "-"],
                                ["ID Data", selectedLog.entity_id || "-"],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                                    <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/30">{label}</p>
                                    <p className="text-sm font-bold text-white">{value}</p>
                                </div>
                            ))}
                        </div>

                        {selectedLog.description && (
                            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/30">Deskripsi</p>
                                <p className="text-sm font-bold text-white">{selectedLog.description}</p>
                            </div>
                        )}

                        <ChangeSummary metadata={selectedLog.metadata || {}} />

                        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Metadata</p>
                            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs font-semibold text-white/70">
                                {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
