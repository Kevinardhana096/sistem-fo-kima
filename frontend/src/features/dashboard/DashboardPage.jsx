import { useCallback, useEffect, useState, useMemo } from "react";
import AppShell from "../../components/layout/AppShell";
import { MetricCard } from "../../components/shared/AppShared";
import { monitoringMonths } from "../../app/constants";
import { API_BASE_URL, fetchJson, formatCurrency } from "../../app/utils";
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    BarChart,
    Line,
    LineChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Area,
} from "recharts";

/**
 * Modern Dashboard Page using Recharts
 * Focus: High-quality statistical visualization
 */

export default function DashboardPage({
    activeSection,
    onNavigate,
    onLogout,
    customers,
    isLoadingCustomers,
    currentRole = "admin"
}) {
    const [displayYear] = useState(() => String(new Date().getUTCFullYear()));
    const [availableYears] = useState(["2022", "2023", "2024", "2025", "2026"]);
    const [timeFilter, setTimeFilter] = useState("last_5_years");
    const [customStartYear, setCustomStartYear] = useState("2022");
    const [customEndYear, setCustomEndYear] = useState("2026");
    
    const [billingSummary, setBillingSummary] = useState({
        lunas: 0,
        belum_bayar: 0,
        terlambat: 0,
        belum_ditagih: 0,
    });
    const [alerts, setAlerts] = useState([]);
    const [insights, setInsights] = useState(null);
    const [isLoadingOperational, setIsLoadingOperational] = useState(false);
    const [operationalError, setOperationalError] = useState("");
    const [growthType, setGrowthType] = useState("tenant");

    const loadOperationalData = useCallback(async (year) => {
        setIsLoadingOperational(true);
        setOperationalError("");
        try {
            const [billingResult, alertsResult, insightsResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/monitoring/billing?year=${year}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/alerts?year=${year}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/insights?year=${year}`),
            ]);

            setBillingSummary(billingResult?.summary ?? { lunas: 0, belum_bayar: 0, terlambat: 0, belum_ditagih: 0 });
            setAlerts(Array.isArray(alertsResult) ? alertsResult : (alertsResult?.alerts ?? []));
            setInsights(insightsResult?.months && insightsResult?.totals ? insightsResult : null);
        } catch (error) {
            console.error("Dashboard data load error:", error);
            setOperationalError("Terjadi kesalahan saat sinkronisasi data visual.");
        } finally {
            setIsLoadingOperational(false);
        }
    }, []);

    useEffect(() => {
        void loadOperationalData(displayYear);
    }, [loadOperationalData, displayYear]);

    // Format financial data for Recharts
    const financialData = useMemo(() => {
        if (!insights?.months) return [];
        return insights.months.map(m => ({
            name: monitoringMonths[m.month - 1].substring(0, 3),
            realisasi: m.revenuePaid,
            proyeksi: m.revenueProjected,
        }));
    }, [insights]);

    // Data Processing for Sections
    const stats = useMemo(() => {
        const isps = customers.filter(c => c.type === "ISP" || c.is_isp);
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);
        return {
            ispCount: isps.length,
            tenantCount: tenants.length,
        };
    }, [customers]);

    const topIsps = useMemo(() => {
        const isps = customers.filter(c => c.type === "ISP" || c.is_isp);
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);

        const ispTenantCounts = isps.map(isp => {
            const count = tenants.filter(t => Array.isArray(t.ispList) && t.ispList.includes(isp.name)).length;
            return {
                ...isp,
                tenantCount: count
            };
        });

        return ispTenantCounts
            .sort((a, b) => b.tenantCount - a.tenantCount)
            .slice(0, 5);
    }, [customers]);

    const insightTotals = insights?.totals ?? { revenuePaid: 0, revenueProjected: 0 };
    
    const paymentRatio = useMemo(() => {
        const total = Number(billingSummary.lunas) + Number(billingSummary.belum_bayar) + Number(billingSummary.terlambat);
        if (total === 0) return 0;
        return Math.round((Number(billingSummary.lunas) / total) * 100);
    }, [billingSummary]);

    // Mock Growth Data for Line Chart
    const growthData = {
        tenant: [
            { year: "2022", count: 85 },
            { year: "2023", count: 78 },
            { year: "2024", count: 92 },
            { year: "2025", count: 88 },
            { year: "2026", count: 105 },
        ],
        isp: [
            { year: "2022", count: 18 },
            { year: "2023", count: 21 },
            { year: "2024", count: 25 },
            { year: "2025", count: 22 },
            { year: "2026", count: 28 },
        ],
    };

    const currentGrowth = growthData[growthType];

    const growthInsight = useMemo(() => {
        const data = currentGrowth;
        if (!data || data.length < 2) return null;
        const first = data[0].count;
        const last = data[data.length - 1].count;
        const diff = last - first;
        const percent = first === 0 ? 100 : Math.round((diff / first) * 100);
        return {
            diff,
            percent,
            isUp: diff >= 0,
            text: `${growthType === "tenant" ? "Customer" : "ISP"} ${diff >= 0 ? "meningkat" : "menurun"} ${Math.abs(percent)}% dalam 5 tahun terakhir`
        };
    }, [currentGrowth, growthType]);

    const glassCard = "bg-white/70 backdrop-blur-md rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.05)] border border-white/40 p-6 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]";
    const kpiCard = "bg-white/80 backdrop-blur-lg rounded-[2.5rem] shadow-sm border border-white/50 p-8 flex flex-col justify-between transition-transform hover:-translate-y-1";

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            <div className="mx-auto max-w-[1400px] space-y-10 pb-20 px-4">
                
                {/* Header Section */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard Ringkasan</h1>
                        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Visual Data & Statistik Sistem</p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-3">
                            {isLoadingOperational && <span className="text-xs font-bold text-slate-400 animate-pulse hidden sm:inline-block">Menyinkronkan...</span>}
                            {operationalError && <span className="text-xs font-bold text-rose-500 hidden sm:inline-block" title={operationalError}>Gagal sinkronisasi</span>}
                            
                            <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-2xl shadow-sm ring-1 ring-white/50 backdrop-blur-md">
                                {timeFilter === 'custom' && (
                                    <>
                                        <select 
                                            value={customStartYear}
                                            onChange={(e) => setCustomStartYear(e.target.value)}
                                            disabled={isLoadingCustomers || isLoadingOperational}
                                            className="rounded-xl border-none bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 focus:ring-0 cursor-pointer outline-none"
                                        >
                                            {availableYears.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                        <span className="text-slate-400 font-black text-sm">-</span>
                                        <select 
                                            value={customEndYear}
                                            onChange={(e) => setCustomEndYear(e.target.value)}
                                            disabled={isLoadingCustomers || isLoadingOperational}
                                            className="rounded-xl border-none bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 focus:ring-0 cursor-pointer outline-none"
                                        >
                                            {availableYears.map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </>
                                )}
                                <select 
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value)}
                                    disabled={isLoadingCustomers || isLoadingOperational}
                                    className="rounded-xl border-none bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100 focus:ring-0 cursor-pointer outline-none"
                                >
                                    <optgroup label="SHORT">
                                        <option value="this_month">Bulan Ini</option>
                                        <option value="last_3_months">3 Bulan Terakhir</option>
                                    </optgroup>
                                    <optgroup label="MID">
                                        <option value="this_year">Tahun Ini</option>
                                    </optgroup>
                                    <optgroup label="LONG">
                                        <option value="last_3_years">3 Tahun Terakhir</option>
                                        <option value="last_5_years">5 Tahun Terakhir</option>
                                        <option value="last_10_years">10 Tahun Terakhir</option>
                                    </optgroup>
                                    <optgroup label="CUSTOM">
                                        <option value="custom">Custom Range...</option>
                                    </optgroup>
                                </select>
                                <button
                                    onClick={() => void loadOperationalData(displayYear)}
                                    disabled={isLoadingCustomers || isLoadingOperational}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#745b00] shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-transform hover:scale-105"
                                >
                                    <span className={`material-symbols-outlined text-lg ${isLoadingOperational ? "animate-spin" : ""}`}>sync</span>
                                </button>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">
                            Periode: {timeFilter === 'custom' ? `${customStartYear} - ${customEndYear}` : (timeFilter.includes('month') ? 'Bulan Terakhir' : (timeFilter === 'this_year' ? '2026' : '2022 - 2026'))}
                        </span>
                    </div>
                </header>

                {/* SECTION 1: KPI CARDS */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    <div className={kpiCard}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#745b00]/60">Pendapatan Realisasi</p>
                        <h3 className="mt-2 text-2xl font-black text-[#745b00]">{formatCurrency(insightTotals.revenuePaid)}</h3>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                            <span className="material-symbols-outlined text-sm">trending_up</span>
                            <span>Lunas {displayYear}</span>
                        </div>
                    </div>
                    <div className={kpiCard}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00687b]/60">Proyeksi Pendapatan</p>
                        <h3 className="mt-2 text-2xl font-black text-[#00687b]">{formatCurrency(insightTotals.revenueProjected)}</h3>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-blue-600">
                            <span className="material-symbols-outlined text-sm">payments</span>
                            <span>Total Tagihan</span>
                        </div>
                    </div>
                    <div className={kpiCard}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Jumlah ISP</p>
                        <h3 className="mt-2 text-4xl font-black text-slate-800">{stats.ispCount}</h3>
                        <p className="mt-4 text-xs font-bold text-slate-400">Mitra Penyedia</p>
                    </div>
                    <div className={kpiCard}>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#745b00]/60">Jumlah Pelanggan</p>
                        <h3 className="mt-2 text-4xl font-black text-[#745b00]">{stats.tenantCount}</h3>
                        <p className="mt-4 text-xs font-bold text-amber-600">Total Tenant Aktif</p>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                    {/* SECTION 2: FINANCIAL PERFORMANCE (ComposedChart) */}
                    <div className={`${glassCard} xl:col-span-2`}>
                        <div className="mb-8">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Kinerja Finansial Bulanan</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Realisasi vs Proyeksi {displayYear}</p>
                        </div>
                        
                        <div className="h-[350px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={financialData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} tickFormatter={(value) => `Rp${value / 1000000}M`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', padding: '12px' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 900 }}
                                        formatter={(value) => formatCurrency(value)}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 900 }} />
                                    <Bar dataKey="proyeksi" fill="#00687b" radius={[6, 6, 0, 0]} barSize={24} name="Proyeksi Tagihan" fillOpacity={0.2} />
                                    <Line type="monotone" dataKey="realisasi" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#fff', strokeWidth: 3 }} activeDot={{ r: 6 }} name="Realisasi Lunas" />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* SECTION 3: PAYMENT STATUS */}
                    <div className={glassCard}>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Payment Status</h2>
                        <div className="mt-8 flex flex-col items-center justify-center">
                            <div className="relative flex h-36 w-36 items-center justify-center">
                                <svg className="h-full w-full -rotate-90 drop-shadow-sm">
                                    <circle cx="50%" cy="50%" r="60" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                                    <circle 
                                        cx="50%" cy="50%" r="60" fill="none" stroke="#10b981" strokeWidth="14" 
                                        strokeDasharray="377" strokeDashoffset={377 - (377 * paymentRatio / 100)}
                                        strokeLinecap="round" className="transition-all duration-1000"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-slate-800">{paymentRatio}%</span>
                                </div>
                            </div>
                            <div className="mt-8 w-full space-y-3">
                                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 p-3.5 border border-emerald-100 transition-colors hover:bg-emerald-100/50">
                                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Lunas</span>
                                    <span className="text-sm font-black text-emerald-700">{billingSummary.lunas} Unit</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-amber-50 p-3.5 border border-amber-100 transition-colors hover:bg-amber-100/50">
                                    <span className="text-xs font-bold text-amber-800 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Belum Lunas</span>
                                    <span className="text-sm font-black text-amber-700">{billingSummary.belum_bayar} Unit</span>
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-rose-50 p-3.5 border border-rose-100 transition-colors hover:bg-rose-100/50">
                                    <span className="text-xs font-bold text-rose-800 uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> Overdue</span>
                                    <span className="text-sm font-black text-rose-700">{billingSummary.terlambat} Unit</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                    {/* SECTION 4: CUSTOMER GROWTH */}
                    <div className={`${glassCard} xl:col-span-2`}>
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Growth Customer</h2>
                                {growthInsight && (
                                    <p className="text-xs font-bold text-slate-500 mt-1.5">
                                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black mr-2 ${growthInsight.isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {growthInsight.isUp ? '+' : '-'}{Math.abs(growthInsight.diff)} {growthInsight.isUp ? '↑' : '↓'}
                                        </span>
                                        {growthInsight.text}
                                    </p>
                                )}
                            </div>
                            
                            <div className="inline-flex rounded-2xl bg-slate-100/80 p-1 shadow-inner border border-slate-200">
                                <button 
                                    onClick={() => setGrowthType("tenant")}
                                    className={`rounded-xl px-6 py-2 text-[11px] uppercase tracking-wider font-black transition-all ${growthType === "tenant" ? "bg-white text-[#745b00] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    TENANT
                                </button>
                                <button 
                                    onClick={() => setGrowthType("isp")}
                                    className={`rounded-xl px-6 py-2 text-[11px] uppercase tracking-wider font-black transition-all ${growthType === "isp" ? "bg-white text-[#745b00] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                                >
                                    ISP
                                </button>
                            </div>
                        </div>

                        <div className="h-[300px] w-full px-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={currentGrowth} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#745b00', border: 'none', borderRadius: '12px', padding: '12px' }}
                                        itemStyle={{ fontSize: '14px', fontWeight: 900, color: '#fff' }}
                                        labelStyle={{ color: '#fff', marginBottom: '4px', fontWeight: 800, opacity: 0.7 }}
                                        formatter={(value) => [`${value} Entitas`, growthType.toUpperCase()]}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="count" 
                                        stroke={growthType === "tenant" ? "#745b00" : "#00687b"} 
                                        strokeWidth={5} 
                                        dot={{ r: 6, fill: '#fff', strokeWidth: 4 }} 
                                        activeDot={{ r: 8, strokeWidth: 0 }}
                                        animationDuration={1500}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* SECTION 6: STATUS BILLING TAHUNAN */}
                    <div className={glassCard}>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Status Billing Tahunan</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ringkasan {displayYear}</p>
                        
                        <div className="mt-8">
                            <div className="flex h-12 w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-100">
                                {paymentRatio > 0 && (
                                    <div style={{ width: `${paymentRatio}%` }} className="bg-emerald-500 transition-all duration-1000 flex items-center justify-center">
                                        {paymentRatio > 15 && <span className="text-[10px] font-black text-white">{paymentRatio}%</span>}
                                    </div>
                                )}
                                {billingSummary.belum_bayar > 0 && (
                                    <div style={{ width: `${(Number(billingSummary.belum_bayar) / (Number(billingSummary.lunas) + Number(billingSummary.belum_bayar) + Number(billingSummary.terlambat))) * 100}%` }} className="bg-amber-400 transition-all duration-1000"></div>
                                )}
                                {billingSummary.terlambat > 0 && (
                                    <div style={{ width: `${(Number(billingSummary.terlambat) / (Number(billingSummary.lunas) + Number(billingSummary.belum_bayar) + Number(billingSummary.terlambat))) * 100}%` }} className="bg-rose-500 transition-all duration-1000"></div>
                                )}
                            </div>
                            
                            <div className="mt-8 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-3 w-3 rounded-md bg-emerald-500 shadow-sm"></div>
                                        <span className="text-sm font-bold text-slate-600">Lunas</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">{billingSummary.lunas} <span className="text-[10px] text-slate-400">Unit</span></span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-3 w-3 rounded-md bg-amber-400 shadow-sm"></div>
                                        <span className="text-sm font-bold text-slate-600">Belum Lunas</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">{billingSummary.belum_bayar} <span className="text-[10px] text-slate-400">Unit</span></span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-3 w-3 rounded-md bg-rose-500 shadow-sm"></div>
                                        <span className="text-sm font-bold text-slate-600">Overdue</span>
                                    </div>
                                    <span className="text-sm font-black text-slate-800">{billingSummary.terlambat} <span className="text-[10px] text-slate-400">Unit</span></span>
                                </div>
                            </div>
                            
                            <div className="mt-6 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5">info</span>
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                        Mayoritas tagihan tahun ini {paymentRatio >= 50 ? 'telah diselesaikan tepat waktu.' : 'masih dalam proses pembayaran.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
                    {/* SECTION 7: ALERT / TO DO */}
                    <div className={`${glassCard} flex flex-col h-[520px]`}>
                        <div className="mb-6 flex items-center justify-between shrink-0">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Tindakan Prioritas</h2>
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-black">{alerts.length}</span>
                        </div>
                        
                        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                            {alerts.map((alert, i) => (
                                <div key={i} className="group flex items-center gap-4 border-l-4 border-rose-500 bg-rose-50/50 p-4 rounded-r-2xl transition-all hover:bg-rose-50">
                                    <span className="material-symbols-outlined text-rose-600">error_outline</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-slate-700 line-clamp-1">{alert.message || alert.title}</p>
                                        <p className="text-[10px] font-bold text-rose-700/60 uppercase tracking-widest">{alert.code || "Alert Operasional"}</p>
                                    </div>
                                    <button 
                                        onClick={() => onNavigate("monitoring")}
                                        className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
                                    </button>
                                </div>
                            ))}
                            {alerts.length === 0 && (
                                <div className="text-center py-8 text-sm font-bold text-slate-400">
                                    Tidak ada tindakan prioritas.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SECTION 8: TOP ISP */}
                    <div className={`${glassCard} flex flex-col h-[520px]`}>
                        <div className="shrink-0">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Top ISP</h2>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Berdasarkan Jumlah Tenant</p>
                        </div>
                        <div className="mt-6 space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                            {topIsps.map((isp, index) => (
                                <div key={isp.id || index} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 transition-colors hover:bg-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white font-black text-[11px] text-slate-600 shadow-sm ring-1 ring-slate-200">
                                            {index + 1}
                                        </div>
                                        <span className="text-sm font-black text-slate-700 line-clamp-1">{isp.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl shadow-sm ring-1 ring-slate-100">
                                        <span className="text-sm font-black text-[#00687b]">{isp.tenantCount}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenant</span>
                                    </div>
                                </div>
                            ))}
                            {topIsps.length === 0 && (
                                <div className="text-center py-8 text-sm font-bold text-slate-400">
                                    Belum ada data ISP
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMN 3: STATUS CARDS */}
                    <div className="flex flex-col gap-4 h-[520px]">
                        {/* SECTION 9: STATUS JALUR */}
                        <div className={`${glassCard} flex-1 flex flex-col p-5`}>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight mb-2">Status Jalur</h2>
                            <div className="space-y-2 flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Aktif</span>
                                    </div>
                                    <span className="text-base font-black text-emerald-800">42</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-slate-400"></div>
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nonaktif</span>
                                    </div>
                                    <span className="text-base font-black text-slate-800">12</span>
                                </div>
                                <div className="flex items-center justify-between bg-rose-50/60 p-2.5 rounded-xl border border-rose-100/50">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                                        <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Gangguan</span>
                                    </div>
                                    <span className="text-base font-black text-rose-800">3</span>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 10: STATUS KONTRAK */}
                        <div className={`${glassCard} flex-1 flex flex-col p-5`}>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight mb-2">Status Kontrak</h2>
                            <div className="space-y-2 flex-1 flex flex-col justify-center">
                                <div className="flex items-center justify-between bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100/50">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">check_circle</span> Beroperasi
                                    </span>
                                    <span className="text-xs font-black text-emerald-800">58 <span className="opacity-60">Unit</span></span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-50/60 p-2.5 rounded-xl border border-slate-100/50">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">pause_circle</span> Berhenti
                                    </span>
                                    <span className="text-xs font-black text-slate-700">5 <span className="opacity-60">Unit</span></span>
                                </div>
                                <div className="flex items-center justify-between bg-rose-50/60 p-2.5 rounded-xl border border-rose-100/50">
                                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">cancel</span> Kedaluwarsa
                                    </span>
                                    <span className="text-xs font-black text-rose-800">2 <span className="opacity-60">Unit</span></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 10: AUTO INSIGHT */}
                <div className={`${glassCard} flex items-center gap-6 p-10 bg-gradient-to-br from-amber-50/50 to-white/50`}>
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white shadow-xl">
                        <span className="material-symbols-outlined text-[#745b00] text-5xl">lightbulb</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-[#745b00] uppercase tracking-tighter italic">Insight Otomatis</h2>
                        <p className="mt-2 text-lg font-bold text-slate-700 leading-relaxed max-w-4xl">
                            "Pertumbuhan pelanggan di tahun {displayYear} diprediksi naik <span className="text-emerald-600 font-black underline underline-offset-4 decoration-emerald-200">15%</span> berdasarkan tren data historis dan tingkat retensi kontrak yang sangat tinggi."
                        </p>
                    </div>
                </div>

            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
            `}</style>
        </AppShell>
    );
}