import { useCallback, useEffect, useState, useMemo } from "react";
import AppShell from "../../components/layout/AppShell";
import { monitoringMonths } from "../../app/constants";
import { API_BASE_URL, fetchJson, formatCurrency } from "../../app/utils";
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

/**
 * Premium Dashboard Page - Light Theme
 * Style: Apple-inspired Glassmorphism, Bright & Elegant
 * Responsiveness: Tablet (md) to Desktop (xl)
 */

const sewaSharingTrendData = [
    { name: 'Jan', '1:2': 10, '1:4': 20, '1:8': 15, '1:16': 5, '1:32': 2 },
    { name: 'Feb', '1:2': 12, '1:4': 22, '1:8': 16, '1:16': 6, '1:32': 3 },
    { name: 'Mar', '1:2': 11, '1:4': 24, '1:8': 18, '1:16': 8, '1:32': 4 },
    { name: 'Apr', '1:2': 14, '1:4': 25, '1:8': 17, '1:16': 7, '1:32': 4 },
    { name: 'Mei', '1:2': 15, '1:4': 27, '1:8': 19, '1:16': 9, '1:32': 5 },
    { name: 'Jun', '1:2': 13, '1:4': 26, '1:8': 20, '1:16': 8, '1:32': 5 },
    { name: 'Jul', '1:2': 16, '1:4': 28, '1:8': 22, '1:16': 10, '1:32': 6 },
    { name: 'Agt', '1:2': 18, '1:4': 30, '1:8': 21, '1:16': 11, '1:32': 6 },
    { name: 'Sep', '1:2': 17, '1:4': 29, '1:8': 23, '1:16': 12, '1:32': 7 },
    { name: 'Okt', '1:2': 19, '1:4': 32, '1:8': 25, '1:16': 13, '1:32': 7 },
    { name: 'Nov', '1:2': 20, '1:4': 31, '1:8': 24, '1:16': 14, '1:32': 8 },
    { name: 'Des', '1:2': 22, '1:4': 34, '1:8': 26, '1:16': 15, '1:32': 9 },
];

export default function DashboardPage({
    activeSection,
    onNavigate,
    onLogout,
    customers,
    isLoadingCustomers,
    currentRole = "admin"
}) {
    const [availableYears] = useState([
        String(new Date().getUTCFullYear() - 3),
        String(new Date().getUTCFullYear() - 2),
        String(new Date().getUTCFullYear() - 1),
        String(new Date().getUTCFullYear()),
        String(new Date().getUTCFullYear() + 1),
    ]);
    const [financialFilter, setFinancialFilter] = useState({
        mode: "range_years",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear())
    });
    const [growthFilter, setGrowthFilter] = useState({
        mode: "range_years",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear())
    });

    const [billingSummary, setBillingSummary] = useState({ lunas: 0, belum_bayar: 0, terlambat: 0 });
    const [alerts, setAlerts] = useState([]);
    const [insights, setInsights] = useState(null);
    const [isLoadingOperational, setIsLoadingOperational] = useState(false);
    const [growthType, setGrowthType] = useState("tenant");

    const loadOperationalData = useCallback(async (year) => {
        setIsLoadingOperational(true);
        try {
            const [billingResult, alertsResult, insightsResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/monitoring/billing?year=${year}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/alerts?year=${year}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/insights?year=${year}`),
            ]);
            setBillingSummary(billingResult?.summary ?? { lunas: 0, belum_bayar: 0, terlambat: 0 });
            setAlerts(Array.isArray(alertsResult) ? alertsResult : (alertsResult?.alerts ?? []));
            setInsights(insightsResult?.months && insightsResult?.totals ? insightsResult : null);
        } catch (error) {
            console.error("Dashboard load error:", error);
        } finally {
            setIsLoadingOperational(false);
        }
    }, []);

    useEffect(() => { loadOperationalData(String(new Date().getUTCFullYear())); }, [loadOperationalData]);

    const financialData = useMemo(() => {
        if (!insights?.months) return [];
        return insights.months.map(m => ({
            name: monitoringMonths[m.month - 1].substring(0, 3).toUpperCase(),
            realisasi: m.revenuePaid,
            proyeksi: m.revenueProjected,
        }));
    }, [insights]);

    const stats = useMemo(() => {
        const isps = customers.filter(c => c.type === "ISP" || c.is_isp);
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);
        const today = new Date().toISOString().slice(0, 10);
        let beroperasi = 0, expired = 0, berhenti = 0;
        tenants.forEach(t => {
            const isActive = String(t.rawStatus || "").toLowerCase().trim() === "aktif";
            if (!isActive) { berhenti++; return; }
            const endDate = typeof t.contractPeriodEnd === "string" ? t.contractPeriodEnd.slice(0, 10) : "";
            if (endDate && endDate < today) expired++; else beroperasi++;
        });
        return {
            ispCount: isps.length,
            tenantCount: tenants.length,
            contract: { beroperasi, expired, berhenti, totalOperational: beroperasi + expired }
        };
    }, [customers]);

    const topIsps = useMemo(() => {
        const isps = customers.filter(c => c.type === "ISP" || c.is_isp);
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);
        return isps.map(isp => ({
            ...isp,
            tenantCount: tenants.filter(t => Array.isArray(t.ispList) && t.ispList.includes(isp.name)).length
        })).sort((a, b) => b.tenantCount - a.tenantCount).slice(0, 5);
    }, [customers]);

    const paymentRatio = useMemo(() => {
        const total = Number(billingSummary.lunas) + Number(billingSummary.belum_bayar) + Number(billingSummary.terlambat);
        return total === 0 ? 0 : Math.round((Number(billingSummary.lunas) / total) * 100);
    }, [billingSummary]);

    const growthData = {
        tenant: [{ year: "2022", count: 85 }, { year: "2023", count: 78 }, { year: "2024", count: 92 }, { year: "2025", count: 88 }, { year: "2026", count: 105 }],
        isp: [{ year: "2022", count: 18 }, { year: "2023", count: 21 }, { year: "2024", count: 25 }, { year: "2025", count: 22 }, { year: "2026", count: 28 }],
    };

    const glassCardClass = "glass-card rounded-premium p-6 md:p-8 relative overflow-hidden group";

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            <div className="space-y-6 pb-20 pt-2 md:pt-4">
                
                {/* Header Section */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="h-[2px] w-8 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[10px] font-black text-gold-accent uppercase tracking-[0.4em]">Mesin Analitik</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-on-surface tracking-tight leading-tight">Ekosistem <span className="text-gold-accent italic">Intelijen</span></h1>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl border border-white/15 backdrop-blur-md">
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest pl-2 pr-2">SYNC DATA</span>
                            <button 
                                onClick={() => loadOperationalData(financialFilter.mode === 'specific_year' ? financialFilter.year : String(new Date().getUTCFullYear()))}
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${isLoadingOperational ? "bg-white/10 text-gold-accent" : "btn-premium"}`}
                                disabled={isLoadingOperational}
                            >
                                <span className={`material-symbols-outlined text-xl ${isLoadingOperational ? "animate-spin" : ""}`}>sync</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* KPI Section */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Pendapatan Terealisasi" value={formatCurrency(insights?.totals?.revenuePaid ?? 0)} icon="account_balance_wallet" accent="gold" sub="Lunas Terverifikasi" />
                    <StatCard label="Proyeksi Tagihan" value={formatCurrency(insights?.totals?.revenueProjected ?? 0)} icon="analytics" accent="gold" sub="Total Tagihan Berjalan" />
                    <StatCard label="Jaringan Mitra" value={stats.ispCount} icon="hub" accent="gold" sub="Mitra ISP Terintegrasi" />
                    <StatCard label="Total Lokasi Aktif" value={stats.tenantCount} icon="groups" accent="gold" sub="Total Unit Lokasi" />
                </section>

                {/* Core Infrastructure Section */}
                <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {/* Capacity Core */}
                    <div className={`${glassCardClass} lg:col-span-1 flex flex-col justify-between`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">Capacity Core</h2>
                        </div>
                        <div className="mt-2 flex-1">
                            <p className="text-4xl font-black text-white">384</p>
                            <p className="text-[10px] font-medium text-white/70 mt-1 uppercase tracking-widest">Core Tersedia</p>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-end mb-2">
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">76% Tersedia</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
                                <div className="h-full bg-gradient-to-r from-yellow-500 to-gold-accent rounded-full shadow-[0_0_10px_rgba(212,169,55,0.4)]" style={{ width: "76%" }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Sewa Core */}
                    <div className={`${glassCardClass} lg:col-span-1 flex flex-col justify-between`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">Sewa Core</h2>
                        </div>
                        <div className="mt-2 flex-1">
                            <p className="text-4xl font-black text-white">128</p>
                            <p className="text-[10px] font-medium text-white/70 mt-1 uppercase tracking-widest">Core Disewa</p>
                        </div>
                        <div className="mt-4">
                            <span className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-relaxed block">
                                <span className="text-white text-lg mr-1">32</span> Lokasi Menggunakan
                            </span>
                        </div>
                    </div>

                    {/* Card 2: Sewa Sharing Core (Tabel) */}
                    <div className={`${glassCardClass} flex flex-col lg:col-span-1`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">Sewa Sharing</h2>
                        </div>
                        <div className="flex-1 mt-2 flex flex-col justify-between">
                            {[
                                {ratio: '1:2', count: 12}, 
                                {ratio: '1:4', count: 24}, 
                                {ratio: '1:8', count: 18}, 
                                {ratio: '1:16', count: 8}, 
                                {ratio: '1:32', count: 4}
                            ].map((item) => (
                                <div key={item.ratio} className="flex justify-between items-center py-2 px-3 rounded-xl hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)] transition-all border-b border-white/10 last:border-0 group cursor-default">
                                    <span className="text-[10px] font-black text-white transition-colors">Ratio {item.ratio}</span>
                                    <span className="text-sm font-black text-white">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Card 3: Sewa Sharing Trend Chart */}
                    <div className={`${glassCardClass} flex flex-col lg:col-span-2`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">Trend Grafik Sharing</h2>
                        </div>
                        <div className="flex-1 w-full min-h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={sewaSharingTrendData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,20,30,0.88)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px', backdropFilter: 'blur(20px)', color: '#fff' }} itemStyle={{ fontSize: '10px', fontWeight: 900 }} labelStyle={{ fontSize: '10px', fontWeight: 900, marginBottom: '8px' }} />
                                    <Line type="monotone" dataKey="1:2" stroke="#d4a937" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#d4a937" }} />
                                    <Line type="monotone" dataKey="1:4" stroke="#00687b" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#00687b" }} />
                                    <Line type="monotone" dataKey="1:8" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#10b981" }} />
                                    <Line type="monotone" dataKey="1:16" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#8b5cf6" }} />
                                    <Line type="monotone" dataKey="1:32" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#f43f5e" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 mt-3">
                            <LegendItem dotColor="bg-[#d4a937]" label="1:2" small />
                            <LegendItem dotColor="bg-[#00687b]" label="1:4" small />
                            <LegendItem dotColor="bg-[#10b981]" label="1:8" small />
                            <LegendItem dotColor="bg-[#8b5cf6]" label="1:16" small />
                            <LegendItem dotColor="bg-[#f43f5e]" label="1:32" small />
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {/* Financial Chart */}
                    <div className={`${glassCardClass} lg:col-span-2 xl:col-span-2 flex flex-col`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-4">
                            <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">Kinerja Keuangan</h2>
                            <ChartFilterSelector filter={financialFilter} setFilter={setFinancialFilter} availableYears={availableYears} />
                        </div>
                        <div className="flex-1 h-[300px] md:h-[400px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={financialData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: 'rgba(255,255,255,0.6)', letterSpacing: 1 }} dy={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} tickFormatter={(v) => `Rp${v / 1000000}M`} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,20,30,0.88)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '16px', backdropFilter: 'blur(20px)', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} />
                                    <Bar dataKey="proyeksi" fill="rgba(212, 169, 55, 0.25)" radius={[10, 10, 0, 0]} barSize={32} />
                                    <Line type="monotone" dataKey="realisasi" stroke="#fef08a" strokeWidth={5} dot={{ r: 6, fill: '#fff', stroke: '#fef08a', strokeWidth: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-2 mt-4">
                            <LegendItem dotColor="bg-yellow-200" label="Lunas" />
                            <LegendItem dotColor="bg-gold-accent/40" label="Proyeksi" />
                        </div>
                    </div>

                    {/* Circular Progress */}
                    <div className={glassCardClass}>
                        <h2 className="text-lg md:text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Status Likuiditas</h2>
                        <div className="mt-8 flex flex-col items-center">
                            <div className="relative flex h-48 w-48 xl:h-56 xl:w-56 items-center justify-center">
                                <svg className="h-full w-full -rotate-90">
                                    <circle cx="50%" cy="50%" r="80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" />
                                    <circle 
                                        cx="50%" cy="50%" r="80" fill="none" stroke="#d4a937" strokeWidth="16" 
                                        strokeDasharray="502" strokeDashoffset={502 - (502 * paymentRatio / 100)}
                                        strokeLinecap="round" className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-4xl xl:text-5xl font-black text-on-surface tracking-tighter">{paymentRatio}%</span>
                                    <span className="text-[10px] font-black text-gold-accent uppercase tracking-[0.3em] mt-2">Koleksi</span>
                                </div>
                            </div>
                            <div className="mt-10 w-full space-y-3">
                                <StatusRow label="Unit Lunas" value={billingSummary.lunas} color="bg-gold-accent" />
                                <StatusRow label="Unit Tertunda" value={billingSummary.belum_bayar} color="bg-black/10" />
                                <StatusRow label="Peringatan Terlambat" value={billingSummary.terlambat} color="bg-rose-500" isAlert />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {/* Growth Chart */}
                    <div className={`${glassCardClass} lg:col-span-2 xl:col-span-2`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                            <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">Pertumbuhan</h2>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <ChartFilterSelector filter={growthFilter} setFilter={setGrowthFilter} availableYears={availableYears} />
                                <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15">
                                    {["tenant", "isp"].map(type => (
                                        <button 
                                            key={type}
                                            onClick={() => setGrowthType(type)}
                                            className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                                                growthType === type 
                                                    ? "bg-gold-accent text-white shadow-gold-glow" 
                                                    : "text-white/70 hover:text-white"
                                            }`}
                                        >
                                            {type === "tenant" ? "Lokasi" : "ISP"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="h-[240px] md:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={growthData[growthType]}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} dy={15} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} />
                                    <Line type="monotone" dataKey="count" stroke={growthType === "tenant" ? "#d4a937" : "#00687b"} strokeWidth={5} dot={{ r: 6, fill: '#fff', strokeWidth: 4, stroke: growthType === "tenant" ? "#d4a937" : "#00687b"} } />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className={`${glassCardClass} flex flex-col h-[400px] md:h-[480px]`}>
                        <div className="mb-8 flex items-center justify-between">
                            <h2 className="text-xl font-black text-on-surface tracking-tight">Tindakan Kritis</h2>
                            <span className="px-4 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase">{alerts.length} MASALAH</span>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                            {alerts.map((alert, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/12 transition-all">
                                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                                        <span className="material-symbols-outlined text-xl">priority_high</span>
                                    </div>
                                    <p className="text-xs font-black text-on-surface line-clamp-1">{alert.message || alert.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {/* Mitra Utama */}
                    <div className={`${glassCardClass} h-full min-h-[400px] flex flex-col`}>
                        <div className="flex items-center gap-3 mb-5 shrink-0">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight">Mitra Utama</h2>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                            {topIsps.map((isp, index) => (
                                <div key={isp.id || index} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/12 transition-all border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-accent/10">
                                            <span className="text-[10px] font-black text-gold-accent">{index + 1}</span>
                                        </div>
                                        <span className="text-sm font-bold text-on-surface line-clamp-1">{isp.name}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-gold-accent bg-gold-accent/10 px-3 py-1 rounded-lg border border-gold-accent/20">{isp.tenantCount} Unit</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status Jalur */}
                    <div className={`${glassCardClass} h-full min-h-[400px] flex flex-col`}>
                        <div className="flex items-center gap-3 mb-6 shrink-0">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight">Status Jalur</h2>
                        </div>
                        <div className="flex-1 flex flex-col justify-between mt-2">
                            <div className="space-y-4">
                                <OperationalStatusRow label="Aktif & Beroperasi" count="42" percent="75" color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" bg="bg-emerald-500/5 border-emerald-500/10" />
                                <OperationalStatusRow label="Gangguan Jaringan" count="8" percent="35" color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" bg="bg-amber-500/5 border-amber-500/10" />
                                <OperationalStatusRow label="Sedang Perbaikan" count="7" percent="15" color="bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" bg="bg-rose-500/5 border-rose-500/10" />
                            </div>
                            <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shrink-0">
                                <div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Jalur Terdata</p>
                                    <p className="text-3xl font-black text-on-surface mt-1">57</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-on-surface-variant border border-white/5">
                                    <span className="material-symbols-outlined text-2xl">route</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Kontrak */}
                    <div className={`${glassCardClass} h-full min-h-[400px] flex flex-col md:col-span-2 xl:col-span-1`}>
                        <div className="flex items-center gap-3 mb-6 shrink-0">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight">Status Kontrak</h2>
                        </div>
                        <div className="flex-1 flex flex-col justify-between mt-2">
                            <div className="space-y-4">
                                <ContractStatusRow label="Beroperasi" count={stats.contract.beroperasi} color="text-emerald-500" bg="bg-emerald-500/10 border-emerald-500/20" icon="check_circle" />
                                <ContractStatusRow label="Belum Diperpanjang" count={stats.contract.expired} color="text-amber-500" bg="bg-amber-500/10 border-amber-500/20" icon="warning" />
                                <ContractStatusRow label="Berhenti" count={stats.contract.berhenti} color="text-rose-500" bg="bg-rose-500/10 border-rose-500/20" icon="cancel" />
                            </div>
                            <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shrink-0">
                                <div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Operasional</p>
                                    <p className="text-3xl font-black text-on-surface mt-1">{stats.contract.totalOperational}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-on-surface-variant border border-white/5">
                                    <span className="material-symbols-outlined text-2xl">domain</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative rounded-premium glass-premium p-6 flex flex-col lg:flex-row items-center gap-6 border border-white/40 shadow-glass-depth">
                    <div className="h-16 w-16 shrink-0 flex items-center justify-center rounded-2xl bg-gold-gradient shadow-gold-glow">
                        <span className="material-symbols-outlined text-white text-3xl">auto_awesome</span>
                    </div>
                    <h2 className="text-base md:text-lg font-medium text-on-surface leading-snug italic text-center lg:text-left">
                        "Pertumbuhan ekosistem diproyeksikan meningkat <span className="text-gold-accent font-black">22.4%</span> dalam Q3-2026 berdasarkan optimalisasi retensi mitra ISP."
                    </h2>
                </div>
            </div>
        </AppShell>
    );
}

function StatCard({ label, value, icon, accent, sub }) {
    const accents = {
        gold: "text-gold-accent bg-gold-accent/10",
        teal: "text-teal-accent bg-teal-accent/10",
        white: "text-on-surface-variant bg-white/10"
    };
    return (
        <div className="glass-card rounded-2xl p-6 border-white/40">
            <div className="flex justify-between items-start mb-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
                <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${accents[accent]}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
            </div>
            <h3 className="text-2xl font-black text-on-surface tracking-tighter mb-2">{value}</h3>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase opacity-60">{sub}</p>
        </div>
    );
}

function LegendItem({ dotColor, label, small = false }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={`${small ? 'h-1.5 w-1.5' : 'h-2 w-2'} rounded-full ${dotColor}`}></div>
            <span className={`${small ? 'text-[8px]' : 'text-[10px]'} font-black uppercase text-on-surface-variant`}>{label}</span>
        </div>
    );
}

function StatusRow({ label, value, color, isAlert }) {
    return (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full ${color} ${isAlert ? 'animate-pulse' : ''}`}></div>
                <span className="text-[10px] font-black text-on-surface-variant uppercase">{label}</span>
            </div>
            <span className="text-sm font-black text-on-surface">{value}</span>
        </div>
    );
}

function OperationalStatusRow({ label, count, percent, color, bg }) {
    return (
        <div className={`group cursor-pointer rounded-2xl border p-4 transition-all hover:scale-[1.02] ${bg}`}>
            <div className="flex items-end justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface/80 transition-colors group-hover:text-on-surface">{label}</span>
                <span className="text-xl font-black text-on-surface">{count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 border border-white/5">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ContractStatusRow({ label, count, color, bg, icon }) {
    return (
        <div className={`flex items-center justify-between rounded-2xl border p-4 transition-transform hover:scale-[1.02] ${bg}`}>
            <div className="flex items-center gap-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ${color}`}>
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
            </div>
            <span className={`text-2xl font-black ${color}`}>{count}</span>
        </div>
    );
}

function ChartFilterSelector({ filter, setFilter, availableYears }) {
    const handleChange = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {filter.mode === "specific_year" && (
                <div className="relative flex items-center border-r border-white/10 pr-2">
                    <select 
                        value={filter.year}
                        onChange={(e) => handleChange('year', e.target.value)}
                        className="appearance-none bg-transparent border-none text-[10px] font-black text-gold-accent focus:ring-0 cursor-pointer outline-none pr-6 py-1"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year} className="bg-slate-900 text-white">{year}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined text-[10px] absolute right-1 pointer-events-none text-gold-accent/70">expand_more</span>
                </div>
            )}

            {filter.mode === "range_years" && (
                <div className="flex items-center gap-2 pr-2 border-r border-white/10">
                    <input 
                        type="number" 
                        min="1" max="50"
                        value={filter.range}
                        onChange={(e) => handleChange('range', e.target.value)}
                        className="bg-transparent border-b border-white/20 text-[10px] font-black text-gold-accent focus:ring-0 outline-none w-8 text-center py-0.5 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                    />
                    <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Tahun Terakhir</span>
                </div>
            )}

            {filter.mode === "custom" && (
                <div className="flex items-center gap-1 pr-2 border-r border-white/10">
                    <div className="relative flex items-center">
                        <select value={filter.start} onChange={(e) => handleChange('start', e.target.value)} className="appearance-none bg-transparent border-none text-[9px] font-bold text-gold-accent focus:ring-0 pr-4 cursor-pointer outline-none">
                            {availableYears.map(y => <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>)}
                        </select>
                        <span className="material-symbols-outlined text-[10px] absolute right-0 pointer-events-none text-gold-accent/50">expand_more</span>
                    </div>
                    <span className="text-white/30 text-[9px] font-black">-</span>
                    <div className="relative flex items-center">
                        <select value={filter.end} onChange={(e) => handleChange('end', e.target.value)} className="appearance-none bg-transparent border-none text-[9px] font-bold text-gold-accent focus:ring-0 pr-4 cursor-pointer outline-none">
                            {availableYears.map(y => <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>)}
                        </select>
                        <span className="material-symbols-outlined text-[10px] absolute right-0 pointer-events-none text-gold-accent/50">expand_more</span>
                    </div>
                </div>
            )}

            <div className="relative flex items-center">
                <select 
                    value={filter.mode}
                    onChange={(e) => handleChange('mode', e.target.value)}
                    className="appearance-none bg-transparent border-none text-[10px] font-black text-on-surface uppercase tracking-widest focus:ring-0 cursor-pointer outline-none pl-2 pr-6 py-1"
                >
                    <option value="this_year" className="bg-slate-900 text-white font-semibold">Tahun Ini</option>
                    <option value="range_years" className="bg-slate-900 text-white font-semibold">Rentang Waktu</option>
                    <option value="specific_year" className="bg-slate-900 text-white font-semibold">Tahun Spesifik</option>
                    <option value="custom" className="bg-slate-900 text-white font-semibold">Kustom Range</option>
                </select>
                <span className="material-symbols-outlined text-[12px] absolute right-1 pointer-events-none text-gold-accent">expand_more</span>
            </div>
        </div>
    );
}