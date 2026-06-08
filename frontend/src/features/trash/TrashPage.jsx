import React, { useCallback, useState, useEffect } from "react";
import AppShell from "../../components/layout/AppShell";
import { formatDate } from "../../app/utils";
import api from "../../lib/api";

const TYPE_CONFIG = {
    ISP: { icon: "corporate_fare", color: "text-blue-400", bg: "bg-blue-400/10" },
    Jalur: { icon: "route", color: "text-indigo-400", bg: "bg-indigo-400/10" },
    Lokasi: { icon: "location_on", color: "text-amber-400", bg: "bg-amber-400/10" },
    Kontrak: { icon: "article", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    "Versi Kontrak": { icon: "history_edu", color: "text-lime-400", bg: "bg-lime-400/10" },
    Invoice: { icon: "receipt_long", color: "text-[#ff2400]", bg: "bg-[#ff2400]/10" },
    Dokumen: { icon: "description", color: "text-slate-400", bg: "bg-slate-400/10" },
};

const TABLE_MAP = {
    ISP: 'isps',
    Lokasi: 'customers',
    Kontrak: 'contracts',
    "Versi Kontrak": 'contract_versions',
    Invoice: 'invoices',
    Dokumen: 'documents',
    Jalur: 'customer_route_versions',
};

function CustomDropdown({ value, options, onChange, align = "right", triggerClass = "" }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0] || { label: value };

    return (
        <div className="relative w-full h-full">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex w-full h-full items-center justify-between gap-1 appearance-none bg-transparent border-none font-black focus:outline-none ${triggerClass}`}
            >
                <span>{selectedOption.label}</span>
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} style={{ fontSize: "18px" }}>expand_more</span>
            </button>
            
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className={`absolute top-full mt-3 ${align === "right" ? "right-0" : "left-0"} z-50 w-full min-w-[160px] rounded-2xl glass-premium shadow-glass-depth overflow-hidden animate-in fade-in zoom-in duration-300`}>
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
                                <span>{opt.label}</span>
                            </button>
                        ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function TrashPage({ activeSection, onNavigate, onLogout: _onLogout, currentRole = "admin" }) {
    const isTeknisi = currentRole === "teknisi";
    const [searchQuery, setSearchQuery] = useState("");
    const [trashItems, setTrashItems] = useState([]);
    const [deletionStats, setDeletionStats] = useState({
        lastClearedAt: new Date().toISOString(),
        totalItems: 0,
        breakdown: { ISP: 0, Jalur: 0, Lokasi: 0, Kontrak: 0, "Versi Kontrak": 0, Invoice: 0, Dokumen: 0 }
    });
    const [sortOrder, setSortOrder] = useState("newest");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

    const loadTrashData = useCallback(async () => {
        setIsLoading(true);
        setSelectedItems(new Set());
        try {
            const trashOptions = isTeknisi ? { tables: [TABLE_MAP.Jalur] } : undefined;
            const [data, stats] = await Promise.all([
                api.trash.list(trashOptions),
                api.trash.getStats(trashOptions)
            ]);

            // Transform data to UI format
            const items = [
                ...data.isps.map(item => ({
                    id: item.id,
                    name: item.name,
                    type: 'ISP',
                    origin: `Direktori / Mitra ISP`,
                    deletedAt: item.deleted_at,
                    table: 'isps'
                })),
                ...data.customers.map(item => ({
                    id: item.id,
                    name: item.name,
                    type: 'Lokasi',
                    origin: `${item.isp_name || 'N/A'} / ${item.customer_code || 'N/A'}`,
                    deletedAt: item.deleted_at,
                    table: 'customers'
                })),
                ...data.contracts.map(item => ({
                    id: item.id,
                    name: item.contract_number || 'Kontrak',
                    type: 'Kontrak',
                    origin: `${item.customers?.name || 'N/A'} / Kontrak`,
                    deletedAt: item.deleted_at,
                    table: 'contracts'
                })),
                ...data.contractVersions.map(item => ({
                    id: item.id,
                    name: item.version_number ? `Versi ${item.version_number}` : 'Versi Kontrak',
                    type: 'Versi Kontrak',
                    origin: `${item.customers?.name || 'N/A'} / ${item.contracts?.contract_number || 'Kontrak'}`,
                    deletedAt: item.deleted_at,
                    table: 'contract_versions'
                })),
                ...data.invoices.map(item => ({
                    id: item.id,
                    name: item.invoice_number || 'Invoice',
                    type: 'Invoice',
                    origin: `${item.customers?.name || 'N/A'} / Invoice`,
                    deletedAt: item.deleted_at,
                    table: 'invoices'
                })),
                ...data.documents.map(item => ({
                    id: item.id,
                    name: item.nomor_dokumen || item.jenis_dokumen || 'Dokumen',
                    type: 'Dokumen',
                    origin: `${item.customers?.name || 'N/A'} / Dokumen`,
                    deletedAt: item.deleted_at,
                    table: 'documents'
                })),
                ...data.routes.map(item => ({
                    id: item.id,
                    name: item.change_note || (item.version_number ? `Jalur FO v${item.version_number}` : 'Jalur FO'),
                    type: 'Jalur',
                    origin: `${item.customers?.name || 'N/A'} / Jalur`,
                    deletedAt: item.deleted_at,
                    table: 'customer_route_versions'
                })),
            ];

            setTrashItems(items);
            setDeletionStats(stats);
        } catch (error) {
            console.error('Failed to load trash:', error);
            alert('Gagal memuat data tempat sampah');
        } finally {
            setIsLoading(false);
        }
    }, [isTeknisi]);

    useEffect(() => {
        loadTrashData();
    }, [loadTrashData]);

    const filteredItems = trashItems
        .filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.type.toLowerCase().includes(searchQuery.toLowerCase());
            if (isTeknisi) {
                return matchesSearch && item.type === "Jalur";
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            const dateA = new Date(a.deletedAt).getTime();
            const dateB = new Date(b.deletedAt).getTime();
            return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
        });





    const toggleSelection = (itemKey) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(itemKey)) newSet.delete(itemKey);
        else newSet.add(itemKey);
        setSelectedItems(newSet);
    };

    const toggleAll = () => {
        if (selectedItems.size === filteredItems.length && filteredItems.length > 0) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(item => `${item.table}-${item.id}`)));
        }
    };

    const handleBatchDelete = async () => {
        if (isTeknisi) {
            alert('Role teknisi tidak diizinkan menghapus permanen data.');
            return;
        }
        if (!window.confirm(`Hapus permanen ${selectedItems.size} item terpilih? Tindakan ini tidak dapat dibatalkan!`)) return;
        setIsLoading(true);
        try {
            for (const key of selectedItems) {
                const [table, id] = key.split('-');
                await api.trash.deletePermanently(table, id);
            }
            setSelectedItems(new Set());
            loadTrashData();
        } catch (error) {
            console.error("Failed to batch delete:", error);
            alert("Gagal menghapus beberapa item.");
            setIsLoading(false);
        }
    };

    const handleBatchRestore = async () => {
        if (!window.confirm(`Pulihkan ${selectedItems.size} item terpilih?`)) return;
        setIsLoading(true);
        try {
            for (const key of selectedItems) {
                const [table, id] = key.split('-');
                await api.trash.restore(table, id);
            }
            setSelectedItems(new Set());
            loadTrashData();
        } catch (error) {
            console.error("Failed to batch restore:", error);
            alert("Gagal memulihkan beberapa item.");
            setIsLoading(false);
        }
    };

    const selectedCount = selectedItems.size;

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={_onLogout} currentRole={currentRole}>
            <div className="space-y-3 pb-20 pt-2 md:pt-4">
                {/* Premium Header Section */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="h-[2px] w-6 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[9px] font-black text-gold-accent uppercase tracking-[0.3em]">Arsip Pembuangan</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight leading-tight">
                            Tempat <span className="text-gold-accent italic">Sampah</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                        <button
                            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all active:scale-95 group disabled:opacity-50 backdrop-blur-md"
                            onClick={loadTrashData}
                            disabled={isLoading}
                            title="Refresh Data"
                        >
                            <span className={`material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500 ${isLoading ? 'animate-spin' : ''}`}>sync</span>
                        </button>
                    </div>
                </header>

                {/* Stats Section */}
                <div className="relative overflow-hidden glass-card rounded-2xl p-5 group">
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold-accent/5 blur-2xl transition-all duration-700 group-hover:bg-gold-accent/10 backdrop-blur-md" />

                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-accent/10 border border-gold-accent/20 backdrop-blur-md">
                                <span className="material-symbols-outlined text-xl text-gold-accent animate-pulse">auto_delete</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-wider">Statistik Pembersihan</h2>
                                <p className="text-[9px] font-bold text-white/40 mt-0.5 uppercase tracking-widest leading-relaxed">
                                    Terakhir: <span className="text-gold-accent">{deletionStats.lastClearedAt ? formatDate(deletionStats.lastClearedAt) : "-"}</span>
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 flex-1 max-w-2xl">
                            {Object.entries(deletionStats.breakdown).filter(([type]) => type !== 'Versi Kontrak').map(([type, count]) => {
                                const config = TYPE_CONFIG[type] || { color: 'text-white/30', bg: 'bg-white/5' };
                                const hoverBorderClass = {
                                    ISP: "hover:border-blue-500/40",
                                    Jalur: "hover:border-indigo-500/40",
                                    Lokasi: "hover:border-amber-500/40",
                                    Kontrak: "hover:border-emerald-500/40",
                                    "Versi Kontrak": "hover:border-lime-500/40",
                                    Invoice: "hover:border-[#ff2400]/40",
                                    Dokumen: "hover:border-white/30",
                                }[type] || "hover:border-white/20";

                                return (
                                    <div
                                        key={type}
                                        className={`rounded-xl bg-white/5 border border-white/10 p-3 transition-all hover:bg-white/10 ${hoverBorderClass} hover:scale-105 hover:shadow-lg active:scale-95 cursor-default group/stat backdrop-blur-md`}
                                    >
                                        <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 transition-colors ${config.color} opacity-70 group-hover/stat:opacity-100`}>{type}</p>
                                        <p className="text-sm font-black text-white">{count}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="glass-card rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 items-center z-40 relative">
                    <div className="relative flex-1 w-full group">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-colors z-10 pointer-events-none" style={{ fontSize: "18px" }}>
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Cari data yang dihapus..."
                            className="w-full h-9 rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-[9px] font-black uppercase tracking-widest text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 shadow-inner-glass backdrop-blur-md"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                        className="h-9 w-full sm:w-32 shrink-0 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-[9px] font-bold text-white/60 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all shadow-inner-glass backdrop-blur-md"
                        title={sortOrder === "newest" ? "Urutkan Terlama" : "Urutkan Terbaru"}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                            {sortOrder === "newest" ? "arrow_downward" : "arrow_upward"}
                        </span>
                        {sortOrder === "newest" ? "Terbaru" : "Terlama"}
                    </button>
                </div>

                {/* List Section */}
                <div className="glass-card rounded-2xl p-5 cursor-default">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <span className="h-4 w-1 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Daftar Item Terhapus</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            {!isTeknisi && selectedCount > 0 && (
                                <button
                                    onClick={handleBatchDelete}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] transition-all hover:bg-[#ff2400] hover:text-white active:scale-95 backdrop-blur-md animate-in fade-in"
                                    title="Hapus Permanen Terpilih"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete_forever</span>
                                </button>
                            )}
                            {selectedCount > 0 && (
                                <button
                                    onClick={handleBatchRestore}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 transition-all hover:bg-emerald-500 hover:text-white active:scale-95 backdrop-blur-md animate-in fade-in"
                                    title="Pulihkan Terpilih"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>restore_from_trash</span>
                                </button>
                            )}
                            <button
                                onClick={toggleAll}
                                className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[8px] font-black uppercase tracking-widest transition-all backdrop-blur-md ${
                                    selectedCount > 0
                                        ? "border-gold-accent/40 bg-gold-accent/20 text-gold-accent hover:bg-gold-accent hover:text-black"
                                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                    {selectedCount > 0 && selectedCount === filteredItems.length ? "deselect" : "select_all"}
                                </span>
                                {selectedCount > 0 ? `${selectedCount} Terpilih` : "Pilih"}
                            </button>
                            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block"></div>
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md">
                                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Total Sampah:</span>
                                <span className="text-sm font-black text-gold-accent">{trashItems.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="h-10 w-10 border-2 border-gold-accent border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Memuat data...</p>
                            </div>
                        ) : filteredItems.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2.5">
                                {filteredItems.map((item) => {
                                    const config = TYPE_CONFIG[item.type] || { icon: "article", color: "text-white/30", bg: "bg-white/5" };
                                    const hoverBorderClass = {
                                        ISP: "hover:border-blue-500/40",
                                        Jalur: "hover:border-indigo-500/40",
                                        Lokasi: "hover:border-amber-500/40",
                                        Kontrak: "hover:border-emerald-500/40",
                                        "Versi Kontrak": "hover:border-lime-500/40",
                                        Invoice: "hover:border-[#ff2400]/40",
                                        Dokumen: "hover:border-white/30",
                                    }[item.type] || "hover:border-white/20";

                                    return (
                                        <div
                                            key={`${item.table}-${item.id}`}
                                            className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10 ${hoverBorderClass} hover:scale-[1.01] backdrop-blur-md overflow-hidden border border-white/10 cursor-pointer ${selectedItems.has(`${item.table}-${item.id}`) ? 'border-gold-accent/40 bg-gold-accent/5' : ''}`}
                                            onClick={() => toggleSelection(`${item.table}-${item.id}`)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors shrink-0 ${
                                                    selectedItems.has(`${item.table}-${item.id}`) 
                                                        ? "bg-gold-accent border-gold-accent text-black" 
                                                        : "border-white/20 bg-black/20"
                                                }`}>
                                                    {selectedItems.has(`${item.table}-${item.id}`) && (
                                                        <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>check</span>
                                                    )}
                                                </div>
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${TYPE_CONFIG[item.type]?.bg || 'bg-white/5'} border border-white/5 transition-all group-hover:scale-110`}>
                                                    <span className={`material-symbols-outlined text-xl ${TYPE_CONFIG[item.type]?.color || 'text-white'}`}>
                                                        {TYPE_CONFIG[item.type]?.icon || 'article'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                                        <h3 className="text-xs font-black text-white tracking-tight leading-none">{item.name}</h3>
                                                        <span className={`rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] border ${config.color.replace('text-', 'border-')}/40 ${config.bg} ${config.color}`}>
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[8px] font-bold text-white/50 uppercase tracking-widest shrink-0">Asal:</p>
                                                            <div className="flex items-center gap-1 overflow-hidden">
                                                                {item.origin.split(' / ').map((crumb, idx, arr) => (
                                                                    <React.Fragment key={idx}>
                                                                        <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap text-gold-accent">
                                                                            {crumb}
                                                                        </span>
                                                                        {idx < arr.length - 1 && <span className="text-white/20 text-[7px]">/</span>}
                                                                    </React.Fragment>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="h-1 w-1 rounded-full bg-white/20 hidden sm:block backdrop-blur-md" />
                                                        <p className="text-[8px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-1">
                                                            <span className="text-[#ff2400] font-black">{new Date(item.deletedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>


                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 sm:py-12 animate-in fade-in zoom-in duration-500">
                                <div className="relative mb-5 mt-2 group">
                                    <div className="absolute inset-0 scale-125 bg-gold-accent/5 blur-[40px] rounded-full transition-all duration-700 group-hover:bg-gold-accent/10" />
                                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-inner-glass transition-all duration-500 group-hover:scale-105 group-hover:border-gold-accent/30 group-hover:bg-white/10">
                                        <span className="material-symbols-outlined text-[44px] text-white/20 transition-colors duration-500 group-hover:text-gold-accent/80">delete_outline</span>
                                    </div>
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Tempat Sampah Kosong</h3>
                                <p className="text-[11px] font-bold text-white/30 tracking-wide text-center max-w-[240px] leading-relaxed">Data yang Anda hapus sementara akan muncul di sini.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
