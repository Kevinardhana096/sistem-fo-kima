import { useCallback, useEffect, useState, useMemo } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../lib/api";
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

export default function DashboardPage({
    activeSection,
    onNavigate,
    onLogout,
    customers,
    notifications = [],
    currentRole = "admin"
}) {
    const [availableYears] = useState([
        String(new Date().getUTCFullYear() - 3),
        String(new Date().getUTCFullYear() - 2),
        String(new Date().getUTCFullYear() - 1),
        String(new Date().getUTCFullYear()),
        String(new Date().getUTCFullYear() + 1),
    ]);
    const [growthFilter, setGrowthFilter] = useState({
        mode: "range_years",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear())
    });

    const [alerts, setAlerts] = useState(() => notifications.slice(0, 20));
    const [dashboardMetrics, setDashboardMetrics] = useState(null);
    const [isLoadingOperational, setIsLoadingOperational] = useState(false);
    const [growthType, setGrowthType] = useState("tenant");
    const [coreChartType, setCoreChartType] = useState("sharing");
    const [coreTrendFilter, setCoreTrendFilter] = useState({
        mode: "this_year",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear())
    });

    const loadOperationalData = useCallback(async (year) => {
        setIsLoadingOperational(true);
        try {
            const metricsResult = await api.monitoring.getDashboardMetrics({ year: Number(year) });
            setDashboardMetrics(metricsResult ?? null);
        } catch (error) {
            console.error("Dashboard load error:", error);
        } finally {
            setIsLoadingOperational(false);
        }
    }, []);

    useEffect(() => { loadOperationalData(String(new Date().getUTCFullYear())); }, [loadOperationalData]);
    useEffect(() => { setAlerts(notifications.slice(0, 20)); }, [notifications]);

    const stats = useMemo(() => {
        const isps = customers.filter(c => c.type === "ISP" || c.is_isp);
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);
        const today = new Date().toISOString().slice(0, 10);
        let beroperasi = 0, expired = 0, berhenti = 0;
        tenants.forEach(t => {
            const status = String(t.rawStatus || "").toLowerCase().trim();
            if (["berhenti", "nonaktif"].includes(status)) { berhenti++; return; }
            if (status === "expired") { expired++; return; }
            const endDate = typeof t.contractPeriodEnd === "string" ? t.contractPeriodEnd.slice(0, 10) : "";
            if (endDate && endDate < today) expired++; else beroperasi++;
        });
        return {
            ispCount: isps.length,
            tenantCount: tenants.length,
            activeTenantCount: beroperasi,
            contract: { beroperasi, expired, berhenti, totalOperational: beroperasi + expired }
        };
    }, [customers]);

    const sharingRows = useMemo(() => ([
        { ratio: '1:2', count: dashboardMetrics?.sharingCounts?.['1/2'] ?? 0 },
        { ratio: '1:4', count: dashboardMetrics?.sharingCounts?.['1/4'] ?? 0 },
        { ratio: '1:8', count: dashboardMetrics?.sharingCounts?.['1/8'] ?? 0 },
        { ratio: '1:16', count: dashboardMetrics?.sharingCounts?.['1/16'] ?? 0 },
        { ratio: '1:32', count: dashboardMetrics?.sharingCounts?.['1/32'] ?? 0 },
    ]), [dashboardMetrics]);

    const sharingTrendData = dashboardMetrics?.sharingTrend?.length ? dashboardMetrics.sharingTrend : [];
    const coreTrendData = dashboardMetrics?.coreTrend?.length ? dashboardMetrics.coreTrend : [];
    const growthData = dashboardMetrics?.growth ?? { tenant: [], isp: [] };
    const capacityCore = dashboardMetrics?.capacityCore ?? { total: 0, available: 0, availablePercent: 0 };
    const coreRentals = dashboardMetrics?.coreRentals ?? { totalCoreUsed: 0, locationCount: 0 };
    const routeStatus = dashboardMetrics?.routeStatus ?? { aktif: 0, gangguan: 0, perbaikan: 0, nonaktif: 0, total: 0 };
    const routeTotal = Math.max(Number(routeStatus.total || 0), 1);
    const routePercent = (count) => Math.round((Number(count || 0) / routeTotal) * 100);

    const glassCardClass = "glass-card backdrop-blur-xl rounded-premium p-6 md:p-8 relative overflow-hidden group";

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
                            <span className="text-[10px] font-black text-white/50 uppercase tracking-widest pl-2 pr-2">REFRESH</span>
                            <button 
                                onClick={() => loadOperationalData(String(new Date().getUTCFullYear()))}
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${isLoadingOperational ? "bg-white/10 text-gold-accent" : "btn-premium"}`}
                                disabled={isLoadingOperational}
                            >
                                <span className={`material-symbols-outlined text-xl ${isLoadingOperational ? "animate-spin" : ""}`}>sync</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Row 1: KPI & Core Metrics Section */}
                <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard label="Total ISP" value={stats.ispCount} icon="hub" accent="gold" sub="Mitra ISP Terintegrasi" />
                    <StatCard label="Total Lokasi" value={stats.tenantCount} icon="groups" accent="gold" sub="Total Lokasi Terdata" />
                    <StatCard label="Kapasitas Core" value={capacityCore.total} icon="storage" accent="teal" sub="Total Core" />
                    <StatCard label="Core Tersewa" value={coreRentals.totalCoreUsed} icon="cable" accent="gold" sub={`${coreRentals.locationCount} Lokasi`} />
                    <StatCard label="Core Tersedia" value={capacityCore.available} icon="check_circle" accent="teal" sub={`${capacityCore.availablePercent}% Tersedia`} />
                </section>

                {/* Row 2: Core Trend & Sharing Details */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Core Chart with Toggle */}
                    <div className={`${glassCardClass} flex flex-col lg:col-span-2`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-50">
                            <div className="flex items-center gap-3">
                                <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                                <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">Tren Penggunaan Core</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <ChartFilterSelector filter={coreTrendFilter} setFilter={setCoreTrendFilter} availableYears={availableYears} />
                                <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15 backdrop-blur-md">
                                    {["sharing", "core"].map(type => (
                                        <button 
                                            key={type}
                                            onClick={() => setCoreChartType(type)}
                                            className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                                                coreChartType === type 
                                                    ? "bg-gold-accent text-white shadow-gold-glow" 
                                                    : "text-white/70 hover:text-white"
                                            }`}
                                        >
                                            {type === "sharing" ? "Sharing Core" : "Core"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full min-h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={coreChartType === "sharing" ? sharingTrendData : coreTrendData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,20,30,0.88)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px', backdropFilter: 'blur(20px)', color: '#fff' }} itemStyle={{ fontSize: '10px', fontWeight: 900 }} labelStyle={{ fontSize: '10px', fontWeight: 900, marginBottom: '8px' }} />
                                    
                                    {coreChartType === "sharing" ? (
                                        <>
                                            <Line type="monotone" dataKey="1:2" stroke="#d4a937" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#d4a937" }} />
                                            <Line type="monotone" dataKey="1:4" stroke="#00687b" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#00687b" }} />
                                            <Line type="monotone" dataKey="1:8" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#10b981" }} />
                                            <Line type="monotone" dataKey="1:16" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#8b5cf6" }} />
                                            <Line type="monotone" dataKey="1:32" stroke="#f43f5e" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: "#f43f5e" }} />
                                        </>
                                    ) : (
                                        <Line type="monotone" dataKey="count" stroke="#00687b" strokeWidth={4} dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: "#00687b" }} />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Legend */}
                        {coreChartType === "sharing" && (
                            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 mt-3">
                                <LegendItem dotColor="bg-[#d4a937]" label="1:2" small />
                                <LegendItem dotColor="bg-[#00687b]" label="1:4" small />
                                <LegendItem dotColor="bg-[#10b981]" label="1:8" small />
                                <LegendItem dotColor="bg-[#8b5cf6]" label="1:16" small />
                                <LegendItem dotColor="bg-[#f43f5e]" label="1:32" small />
                            </div>
                        )}
                    </div>

                    {/* Card 2: Sewa Sharing Core (Tabel) */}
                    <div className={`${glassCardClass} flex flex-col lg:col-span-1`}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-white tracking-tight leading-none">Rincian Sharing Core</h2>
                        </div>
                        <div className="flex-1 mt-2 flex flex-col justify-between">
                            {sharingRows.map((item) => (
                                <div key={item.ratio} className="flex justify-between items-center py-3 px-4 mb-2 rounded-xl hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.08)] transition-all border border-white/10 last:mb-0 group cursor-default backdrop-blur-md">
                                    <span className="text-[11px] font-black text-white/80 uppercase tracking-widest transition-colors">Ratio {item.ratio}</span>
                                    <span className="text-lg font-black text-white">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {/* Growth Chart */}
                    <div className={`${glassCardClass} lg:col-span-2 xl:col-span-2`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-50">
                            <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">Grafik Pertumbuhan</h2>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <ChartFilterSelector filter={growthFilter} setFilter={setGrowthFilter} availableYears={availableYears} />
                                <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15 backdrop-blur-md">
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
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,20,30,0.88)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '12px', backdropFilter: 'blur(20px)', color: '#fff' }} itemStyle={{ fontSize: '10px', fontWeight: 900 }} labelStyle={{ fontSize: '10px', fontWeight: 900, marginBottom: '8px' }} />
                                    <Line type="monotone" dataKey="count" name={growthType === "tenant" ? "Lokasi" : "ISP"} stroke={growthType === "tenant" ? "#d4a937" : "#00687b"} strokeWidth={5} dot={{ r: 6, fill: '#fff', strokeWidth: 4, stroke: growthType === "tenant" ? "#d4a937" : "#00687b"} } activeDot={{ r: 8, fill: growthType === "tenant" ? "#d4a937" : "#00687b", stroke: '#fff', strokeWidth: 3 }} />
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
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/12 transition-all backdrop-blur-md">
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
                    {/* Berita Terbaru */}
                    <div className={`${glassCardClass} h-full min-h-[400px] flex flex-col`}>
                        <div className="flex items-center gap-3 mb-5 shrink-0">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight">Berita Terbaru</h2>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                            <span className="material-symbols-outlined text-4xl mb-2">news</span>
                            <p className="text-xs font-bold uppercase tracking-widest">Belum Ada Berita</p>
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
                                <OperationalStatusRow label="Aktif & Beroperasi" count={routeStatus.aktif} percent={routePercent(routeStatus.aktif)} color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" bg="bg-emerald-500/5 border-emerald-500/10" />
                                <OperationalStatusRow label="Gangguan Jaringan" count={routeStatus.gangguan} percent={routePercent(routeStatus.gangguan)} color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" bg="bg-amber-500/5 border-amber-500/10" />
                                <OperationalStatusRow label="Sedang Perbaikan" count={routeStatus.perbaikan} percent={routePercent(routeStatus.perbaikan)} color="bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" bg="bg-rose-500/5 border-rose-500/10" />
                            </div>
                            <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
                                <div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Jalur Terdata</p>
                                    <p className="text-3xl font-black text-on-surface mt-1">{routeStatus.total}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-on-surface-variant border border-white/5 backdrop-blur-md">
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
                            <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
                                <div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Operasional</p>
                                    <p className="text-3xl font-black text-on-surface mt-1">{stats.contract.totalOperational}</p>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-on-surface-variant border border-white/5 backdrop-blur-md">
                                    <span className="material-symbols-outlined text-2xl">domain</span>
                                </div>
                            </div>
                        </div>
                    </div>
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
        <div className="glass-card backdrop-blur-xl rounded-2xl p-6 border-white/40">
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

function OperationalStatusRow({ label, count, percent, color, bg }) {
    return (
        <div className={`group cursor-pointer rounded-2xl border p-4 transition-all hover:scale-[1.02] ${bg}`}>
            <div className="flex items-end justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface/80 transition-colors group-hover:text-on-surface">{label}</span>
                <span className="text-xl font-black text-on-surface">{count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
                <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ContractStatusRow({ label, count, color, bg, icon }) {
    return (
        <div className={`flex items-center justify-between rounded-2xl border p-4 transition-transform hover:scale-[1.02] ${bg}`}>
            <div className="flex items-center gap-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ${color} backdrop-blur-md`}>
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
                <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
            </div>
            <span className={`text-2xl font-black ${color}`}>{count}</span>
        </div>
    );
}

function CustomDropdown({ value, options, onChange, align = "right", triggerClass = "text-gold-accent text-[10px]" }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0] || { label: value };

    return (
        <div className="relative">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1 appearance-none bg-transparent border-none font-black focus:outline-none ${triggerClass}`}
            >
                <span>{selectedOption.label}</span>
                <span className={`material-symbols-outlined text-[12px] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>expand_more</span>
            </button>
            
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className={`absolute top-full mt-3 ${align === "right" ? "right-0" : "left-0"} z-50 min-w-[140px] max-h-[250px] overflow-y-auto custom-scrollbar rounded-2xl bg-[#0f141e]/95 border border-white/10 backdrop-blur-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-200`}>
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
                </>
            )}
        </div>
    );
}

function ChartFilterSelector({ filter, setFilter, availableYears }) {
    const handleChange = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: value }));
    };

    const yearOptions = availableYears.map(y => ({ value: y, label: String(y) }));
    const modeOptions = [
        { value: "this_year", label: "Tahun Ini" },
        { value: "range_years", label: "Rentang" },
        { value: "specific_year", label: "Tahun Spesifik" },
        { value: "custom", label: "Kustom Range" }
    ];

    return (
        <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {filter.mode === "specific_year" && (
                <div className="flex items-center border-r border-white/10 pr-3">
                    <CustomDropdown 
                        value={filter.year} 
                        onChange={(val) => handleChange('year', val)} 
                        options={yearOptions} 
                        align="left"
                    />
                </div>
            )}

            {filter.mode === "range_years" && (
                <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                    <input 
                        type="number" 
                        min="1" max="50"
                        value={filter.range}
                        onChange={(e) => handleChange('range', e.target.value)}
                        className="bg-transparent border-b border-white/20 text-[11px] font-black text-gold-accent focus:ring-0 outline-none w-8 text-center py-0.5 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                    />
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-widest mt-0.5">Tahun Terakhir</span>
                </div>
            )}

            {filter.mode === "custom" && (
                <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                    <CustomDropdown 
                        value={filter.start} 
                        onChange={(val) => handleChange('start', val)} 
                        options={yearOptions} 
                        align="left"
                    />
                    <span className="text-white/30 text-[10px] font-black">-</span>
                    <CustomDropdown 
                        value={filter.end} 
                        onChange={(val) => handleChange('end', val)} 
                        options={yearOptions} 
                        align="left"
                    />
                </div>
            )}

            <CustomDropdown 
                value={filter.mode} 
                onChange={(val) => handleChange('mode', val)} 
                options={modeOptions} 
                align="right"
                triggerClass="text-on-surface text-[10px] uppercase tracking-widest"
            />
        </div>
    );
}
