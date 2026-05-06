import React, { useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { formatDate } from "../../app/utils";

const MOCK_TRASH_ITEMS = [
    { id: 1, name: "PT Telekomunikasi Indonesia", type: "ISP", origin: "Direktori ISP" },
    { id: 2, name: "Jalur FO - Segmen A1", type: "Jalur", origin: "Lokasi Makassar" },
    { id: 3, name: "Gudang Logistik Utama", type: "Lokasi", origin: "Kawasan KIMA" },
    { id: 4, name: "KTR-2026-001-KIMA", type: "Kontrak", origin: "PT Cahaya Baru" },
    { id: 5, name: "INV/2026/04/0023", type: "Invoice", origin: "Bulan April 2026" },
    { id: 6, name: "BAK-Instalasi-01.pdf", type: "Dokumen", origin: "Lampiran Kontrak" },
];

const TYPE_LABELS = {
    ISP: { label: "ISP", color: "bg-blue-100 text-blue-700" },
    Jalur: { label: "Jalur", color: "bg-indigo-100 text-indigo-700" },
    Lokasi: { label: "Lokasi", color: "bg-amber-100 text-amber-700" },
    Kontrak: { label: "Kontrak", color: "bg-emerald-100 text-emerald-700" },
    Invoice: { label: "Invoice", color: "bg-rose-100 text-rose-700" },
    Dokumen: { label: "Dokumen", color: "bg-slate-100 text-slate-700" },
};

const INITIAL_DELETION_STATS = {
    lastClearedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    totalItems: 145,
    breakdown: {
        ISP: 5,
        Jalur: 12,
        Lokasi: 3,
        Kontrak: 45,
        Invoice: 60,
        Dokumen: 20
    }
};

export default function TrashPage({ activeSection, onNavigate, currentRole = "admin" }) {
    const isTeknisi = currentRole === "teknisi";
    const [searchQuery, setSearchQuery] = useState("");
    const [trashItems, setTrashItems] = useState(MOCK_TRASH_ITEMS);
    const [deletionStats, setDeletionStats] = useState(INITIAL_DELETION_STATS);

    const filteredItems = trashItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             item.type.toLowerCase().includes(searchQuery.toLowerCase());
        if (isTeknisi) {
            return matchesSearch && item.type === "Jalur";
        }
        return matchesSearch;
    });

    const handleRestore = (id) => {
        // In a real app, this would call an API
        setTrashItems(prev => prev.filter(item => item.id !== id));
        alert("Item berhasil dipulihkan!");
    };

    const handleDeletePermanently = (id) => {
        const itemToDelete = trashItems.find(item => item.id === id);
        if (!itemToDelete) return;

        // In a real app, this would call an API
        if (confirm("Apakah Anda yakin ingin menghapus data ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) {
            setTrashItems(prev => prev.filter(item => item.id !== id));
            
            // Update stats
            setDeletionStats(prev => ({
                lastClearedAt: new Date().toISOString(),
                totalItems: prev.totalItems + 1,
                breakdown: {
                    ...prev.breakdown,
                    [itemToDelete.type]: (prev.breakdown[itemToDelete.type] || 0) + 1
                }
            }));
        }
    };

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} currentRole={currentRole}>
            <div className="mx-auto max-w-5xl space-y-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Tempat Sampah</h1>
                        <p className="mt-1 text-sm text-on-surface-variant">Kelola data yang dihapus sementara.</p>
                    </div>
                    
                    <div className="relative max-w-xs w-full">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Cari data..."
                            className="w-full rounded-2xl border-none bg-surface-container-low py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </header>

                <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-rose-500">auto_delete</span>
                                <h2 className="text-lg font-bold text-rose-900">Info Pembersihan Permanen</h2>
                            </div>
                            <p className="text-sm font-medium text-rose-700/70">Terakhir dihapus: <span className="font-bold text-rose-800">{formatDate(deletionStats.lastClearedAt) || "Belum ada data"}</span></p>
                        </div>
                        <div className="flex items-center gap-4 border-l-2 border-rose-100 pl-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Total Dihapus</p>
                                <p className="text-3xl font-black text-rose-600">{deletionStats.totalItems}</p>
                            </div>
                        </div>
                    </div>
                    {!isTeknisi && (
                        <div className="mt-6 flex flex-wrap gap-3 pt-6 border-t border-rose-100/50">
                            {Object.entries(deletionStats.breakdown).map(([type, count]) => count > 0 && (
                                <div key={type} className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 shadow-sm border border-rose-50">
                                    <span className={`h-2 w-2 rounded-full ${TYPE_LABELS[type]?.color?.split(' ')[0] || 'bg-slate-300'}`}></span>
                                    <span className="text-xs font-bold text-slate-600">Data {type}</span>
                                    <span className="text-xs font-black text-slate-800 bg-slate-50 px-1.5 rounded">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-3xl bg-white/30 shadow-sm backdrop-blur-md">
                    {filteredItems.length > 0 ? (
                        <div className="divide-y divide-slate-100/50">
                            {filteredItems.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="group flex items-center justify-between p-5 transition-colors hover:bg-white/40"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">
                                                {item.type === "Dokumen" ? "description" : 
                                                 item.type === "Invoice" ? "receipt_long" :
                                                 item.type === "ISP" ? "corporate_fare" :
                                                 item.type === "Jalur" ? "route" :
                                                 item.type === "Lokasi" ? "location_on" : "article"}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-on-surface">{item.name}</span>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TYPE_LABELS[item.type]?.color || "bg-slate-100 text-slate-600"}`}>
                                                    {item.type}
                                                </span>
                                            </div>
                                            <p className="text-xs text-on-surface-variant">
                                                {item.origin}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleRestore(item.id)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                            title="Pulihkan"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">restore_from_trash</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeletePermanently(item.id)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors"
                                            title="Hapus Permanen"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                                <span className="material-symbols-outlined text-4xl">delete_outline</span>
                            </div>
                            <h3 className="text-lg font-medium text-on-surface">Tidak ada data di tempat sampah</h3>
                            <p className="mt-1 text-sm text-on-surface-variant">Data yang Anda hapus akan muncul di sini.</p>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
