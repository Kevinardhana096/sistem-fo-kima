import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import AppShell from "../../components/layout/AppShell";
import api from "../../lib/api";
import { resolveCustomerOperationalStatus } from "../../app/utils";
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

const chartTooltipContentStyle = {
    backgroundColor: "rgba(15,20,30,0.88)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px",
    padding: "12px",
    backdropFilter: "blur(20px)",
    color: "#fff",
};
const chartTooltipItemStyle = { fontSize: "10px", fontWeight: 900 };
const chartTooltipLabelStyle = { fontSize: "10px", fontWeight: 900, marginBottom: "8px" };
const compactChartMargin = { top: 5, right: 5, bottom: 5, left: -25 };

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
    isps = [],
    notifications = [],
    currentRole = "admin",
    refreshToken = 0,
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
    const [growthMetrics, setGrowthMetrics] = useState(null);
    const [, setIsLoadingOperational] = useState(false);
    const [growthType, setGrowthType] = useState("tenant");
    const [coreChartType, setCoreChartType] = useState("sharing");
    const [coreTrendFilter, setCoreTrendFilter] = useState({
        mode: "this_year",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear()),
        currentMonthOnly: false
    });
    const [coreTrendExportFilter, setCoreTrendExportFilter] = useState({
        mode: "this_year",
        year: String(new Date().getUTCFullYear()),
        range: "5",
        start: String(new Date().getUTCFullYear() - 2),
        end: String(new Date().getUTCFullYear()),
        currentMonthOnly: false
    });
    const [isExportingCoreTrend, setIsExportingCoreTrend] = useState(false);
    const [isExportingCoreTrendXlsx, setIsExportingCoreTrendXlsx] = useState(false);
    const coreTrendChartRef = useRef(null);

    const currentYear = String(new Date().getUTCFullYear());
    const currentMonthCount = new Date().getUTCMonth() + 1;
    const coreTrendModeOptions = [
        { value: "this_year", label: "Tahun Ini" },
        { value: "specific_year", label: "Tahun Spesifik" }
    ];
    const growthModeOptions = [
        { value: "range_years", label: "Rentang" },
        { value: "specific_year", label: "Tahun Spesifik" },
        { value: "custom", label: "Kustom Range" }
    ];
    const getCoreTrendYear = useCallback(() => {
        if (coreTrendFilter.mode === "specific_year") return coreTrendFilter.year;
        return currentYear;
    }, [coreTrendFilter, currentYear]);

    const getGrowthYear = useCallback(() => {
        if (growthFilter.mode === "specific_year") return growthFilter.year;
        if (growthFilter.mode === "custom") return growthFilter.end;
        return currentYear;
    }, [growthFilter, currentYear]);

    const loadOperationalData = useCallback(async (year, growthRange = null) => {
        setIsLoadingOperational(true);
        try {
            const metricsResult = await api.monitoring.getDashboardMetrics({
                year: Number(year),
                growthStartYear: growthRange?.startYear,
                growthEndYear: growthRange?.endYear,
            });
            setDashboardMetrics(metricsResult ?? null);
        } catch (error) {
            console.error("Dashboard load error:", error);
        } finally {
            setIsLoadingOperational(false);
        }
    }, []);

    const loadGrowthData = useCallback(async (year, growthRange = null) => {
        try {
            const metricsResult = await api.monitoring.getDashboardMetrics({
                year: Number(year),
                growthStartYear: growthRange?.startYear,
                growthEndYear: growthRange?.endYear,
            });
            setGrowthMetrics(metricsResult ?? null);
        } catch (error) {
            console.error("Growth chart load error:", error);
        }
    }, []);

    useEffect(() => { loadOperationalData(getCoreTrendYear()); }, [getCoreTrendYear, loadOperationalData, refreshToken]);
    useEffect(() => {
        const growthYear = getGrowthYear();
        const coreYear = getCoreTrendYear();
        const growthRange = growthFilter.mode === "range_years"
            ? (() => {
                const range = Math.max(Number(growthFilter.range) || 1, 1);
                return {
                    startYear: Number(currentYear) - range + 1,
                    endYear: Number(currentYear),
                };
            })()
            : growthFilter.mode === "custom"
                ? {
                    startYear: Math.min(Number(growthFilter.start), Number(growthFilter.end)),
                    endYear: Math.max(Number(growthFilter.start), Number(growthFilter.end)),
                }
                : growthFilter.mode === "specific_year"
                    ? {
                        startYear: Number(growthFilter.year),
                        endYear: Number(growthFilter.year),
                    }
                    : null;

        if (growthYear === coreYear && !growthRange) return;

        void loadGrowthData(growthYear, growthRange);
    }, [currentYear, getCoreTrendYear, getGrowthYear, growthFilter.end, growthFilter.mode, growthFilter.range, growthFilter.start, growthFilter.year, loadGrowthData, refreshToken]);
    useEffect(() => { setAlerts(notifications.slice(0, 20)); }, [notifications]);

    const stats = useMemo(() => {
        const tenants = customers.filter(c => c.type === "TENANT" || !c.is_isp);
        const today = new Date().toISOString().slice(0, 10);
        let beroperasi = 0, expired = 0, berhenti = 0, belum_beroperasi = 0;
        tenants.forEach(t => {
            const status = resolveCustomerOperationalStatus(t, today);
            if (["berhenti", "nonaktif"].includes(status)) { berhenti++; return; }
            if (["belum_beroperasi", "belum beroperasi", "belum"].includes(status)) { belum_beroperasi++; return; }
            if (["expired", "expired_contract"].includes(status)) { expired++; return; }
            const endDate = typeof t.contractPeriodEnd === "string" ? t.contractPeriodEnd.slice(0, 10) : "";
            const startDate = typeof t.contractPeriodStart === "string" ? t.contractPeriodStart.slice(0, 10) : "";
            if (startDate && startDate > today) belum_beroperasi++;
            else if (endDate && endDate < today) expired++;
            else beroperasi++;
        });
        return {
            ispCount: isps.length,
            tenantCount: beroperasi + expired + belum_beroperasi,
            activeTenantCount: beroperasi,
            contract: { beroperasi, expired, berhenti, belum_beroperasi, totalOperational: beroperasi + expired + belum_beroperasi }
        };
    }, [customers, isps]);

    const sharingRows = useMemo(() => ([
        { ratio: '1:2', count: dashboardMetrics?.sharingCounts?.['1/2'] ?? 0, color: 'text-[#d4a937]', bg: 'bg-[#d4a937]/10', border: 'bg-[#d4a937]' },
        { ratio: '1:4', count: dashboardMetrics?.sharingCounts?.['1/4'] ?? 0, color: 'text-[#00687b]', bg: 'bg-[#00687b]/10', border: 'bg-[#00687b]' },
        { ratio: '1:8', count: dashboardMetrics?.sharingCounts?.['1/8'] ?? 0, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', border: 'bg-[#10b981]' },
        { ratio: '1:16', count: dashboardMetrics?.sharingCounts?.['1/16'] ?? 0, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', border: 'bg-[#8b5cf6]' },
        { ratio: '1:32', count: dashboardMetrics?.sharingCounts?.['1/32'] ?? 0, color: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]/10', border: 'bg-[#f43f5e]' },
    ]), [dashboardMetrics]);

    const sharingTrendData = dashboardMetrics?.sharingTrend?.length ? dashboardMetrics.sharingTrend : [];
    const coreTrendData = dashboardMetrics?.coreTrend?.length ? dashboardMetrics.coreTrend : [];
    const shouldLimitCoreTrendToCurrentMonth = coreTrendFilter.mode === "this_year" && coreTrendFilter.currentMonthOnly;
    const visibleSharingTrendData = shouldLimitCoreTrendToCurrentMonth ? sharingTrendData.slice(0, currentMonthCount) : sharingTrendData;
    const visibleCoreTrendData = shouldLimitCoreTrendToCurrentMonth ? coreTrendData.slice(0, currentMonthCount) : coreTrendData;
    const growthSource = growthMetrics?.growth ?? dashboardMetrics?.growth;
    const growthData = useMemo(() => {
        const baseData = growthSource ?? { tenant: [], isp: [] };
        const normalizeYear = (value) => String(value ?? "").trim();

        if (growthFilter.mode === "specific_year") {
            const targetYear = normalizeYear(growthFilter.year);
            return {
                tenant: (baseData.tenant ?? []).filter((row) => normalizeYear(row.year) === targetYear),
                isp: (baseData.isp ?? []).filter((row) => normalizeYear(row.year) === targetYear),
            };
        }

        if (growthFilter.mode === "custom") {
            const start = Number(growthFilter.start);
            const end = Number(growthFilter.end);
            const minYear = Math.min(start, end);
            const maxYear = Math.max(start, end);
            return {
                tenant: (baseData.tenant ?? []).filter((row) => {
                    const year = Number(row.year);
                    return Number.isFinite(year) && year >= minYear && year <= maxYear;
                }),
                isp: (baseData.isp ?? []).filter((row) => {
                    const year = Number(row.year);
                    return Number.isFinite(year) && year >= minYear && year <= maxYear;
                }),
            };
        }

        if (growthFilter.mode === "range_years") {
            const range = Math.max(Number(growthFilter.range) || 1, 1);
            return {
                tenant: (baseData.tenant ?? []).slice(-range),
                isp: (baseData.isp ?? []).slice(-range),
            };
        }

        return {
            tenant: (baseData.tenant ?? []).filter((row) => normalizeYear(row.year) === currentYear),
            isp: (baseData.isp ?? []).filter((row) => normalizeYear(row.year) === currentYear),
        };
    }, [currentYear, growthFilter, growthSource]);
    const capacityCore = dashboardMetrics?.capacityCore ?? { total: 0, available: 0, availablePercent: 0 };
    const coreRentals = dashboardMetrics?.coreRentals ?? { totalCoreUsed: 0, locationCount: 0 };
    const routeStatus = dashboardMetrics?.routeStatus ?? { aktif: 0, gangguan: 0, perbaikan: 0, nonaktif: 0, total: 0 };
    const routeTotal = Math.max(Number(routeStatus.total || 0), 1);
    const routePercent = (count) => Math.round((Number(count || 0) / routeTotal) * 100);

    const getExportYears = () => {
        if (coreTrendExportFilter.mode === "specific_year") return [Number(coreTrendExportFilter.year)];
        if (coreTrendExportFilter.mode === "range_years") {
            const range = Math.max(Number(coreTrendExportFilter.range) || 1, 1);
            const endYear = Number(currentYear);
            return Array.from({ length: range }, (_, index) => endYear - range + index + 1);
        }
        if (coreTrendExportFilter.mode === "custom") {
            const start = Number(coreTrendExportFilter.start);
            const end = Number(coreTrendExportFilter.end);
            const minYear = Math.min(start, end);
            const maxYear = Math.max(start, end);
            return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
        }
        return [Number(currentYear)];
    };

    const buildCoreTrendExportRows = async () => {
        const years = getExportYears();
        const metricsByYear = await Promise.all(
            years.map(async (year) => ({
                year,
                metrics: await api.monitoring.getDashboardMetrics({ year })
            }))
        );
        const rows = [["Tahun", "Bulan", "Sharing 1:2", "Sharing 1:4", "Sharing 1:8", "Sharing 1:16", "Sharing 1:32", "Core"]];
        metricsByYear.forEach(({ year, metrics }) => {
            const sharingRows = metrics?.sharingTrend ?? [];
            const coreRows = metrics?.coreTrend ?? [];
            const shouldLimitExportToCurrentMonth = coreTrendExportFilter.mode === "this_year" && coreTrendExportFilter.currentMonthOnly && String(year) === currentYear;
            const monthCount = shouldLimitExportToCurrentMonth ? currentMonthCount : Math.max(sharingRows.length, coreRows.length);
            Array.from({ length: monthCount }, (_, index) => {
                const sharing = sharingRows[index] ?? {};
                const core = coreRows[index] ?? {};
                rows.push([
                    year,
                    sharing.name || core.name || "",
                    sharing["1:2"] ?? 0,
                    sharing["1:4"] ?? 0,
                    sharing["1:8"] ?? 0,
                    sharing["1:16"] ?? 0,
                    sharing["1:32"] ?? 0,
                    core.count ?? 0,
                ]);
            });
        });
        return { years, rows };
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const getExportFilename = (years, extension) => {
        const yearLabel = years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`;
        return `tren_penggunaan_core_${yearLabel}.${extension}`;
    };

    const getCoreTrendChartPng = async () => {
        const svg = coreTrendChartRef.current?.querySelector("svg");
        if (!svg) return null;

        const svgClone = svg.cloneNode(true);
        const { width, height } = svg.getBoundingClientRect();
        svgClone.setAttribute("width", String(width));
        svgClone.setAttribute("height", String(height));
        svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

        const serialized = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = svgUrl;
            });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(width);
            canvas.height = Math.ceil(height);
            const context = canvas.getContext("2d");
            context.fillStyle = "#1f2937";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);
            return canvas.toDataURL("image/png");
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    };

    const handleExportCoreTrend = async () => {
        setIsExportingCoreTrend(true);
        try {
            const { years, rows } = await buildCoreTrendExportRows();
            const csvContent = rows
                .map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
                .join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            downloadBlob(blob, getExportFilename(years, "csv"));
        } catch (error) {
            console.error("Core trend export error:", error);
        } finally {
            setIsExportingCoreTrend(false);
        }
    };

    const handleExportCoreTrendXlsx = async () => {
        setIsExportingCoreTrendXlsx(true);
        try {
            const [{ default: ExcelJS }, { years, rows }, chartPng] = await Promise.all([
                import("exceljs"),
                buildCoreTrendExportRows(),
                getCoreTrendChartPng()
            ]);
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Sistem FO KIMA";
            workbook.created = new Date();
            const worksheet = workbook.addWorksheet("Tren Core");
            worksheet.addRows(rows);
            worksheet.columns = [
                { width: 12 },
                { width: 12 },
                { width: 14 },
                { width: 14 },
                { width: 14 },
                { width: 15 },
                { width: 15 },
                { width: 12 },
            ];
            worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
            worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };

            if (chartPng) {
                const imageId = workbook.addImage({ base64: chartPng, extension: "png" });
                worksheet.addImage(imageId, {
                    tl: { col: 0, row: rows.length + 2 },
                    ext: { width: 900, height: 320 },
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            downloadBlob(blob, getExportFilename(years, "xlsx"));
        } catch (error) {
            console.error("Core trend XLSX export error:", error);
        } finally {
            setIsExportingCoreTrendXlsx(false);
        }
    };

    const glassCardClass = "glass-card backdrop-blur-xl rounded-2xl p-3 relative overflow-hidden group";

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
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-on-surface tracking-tight leading-tight">Dashboard <span className="text-gold-accent italic">FO KIMA</span></h1>
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
                <section className="relative z-30 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[300px]">
                    {/* Core Chart with Toggle */}
                    <div className={`${glassCardClass} z-[60] flex flex-col overflow-visible lg:col-span-2 h-full`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2 relative z-50">
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                <h2 className="text-base font-black text-on-surface tracking-tight">Tren Penggunaan Core</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <ChartFilterSelector filter={coreTrendFilter} setFilter={setCoreTrendFilter} availableYears={availableYears} modeOptions={coreTrendModeOptions} showCurrentMonthOption />
                                <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15 backdrop-blur-md">
                                    {["sharing", "core"].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setCoreChartType(type)}
                                            className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest anim-surface ${coreChartType === type
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
                        {/* Legend moved above chart */}
                        {coreChartType === "sharing" && (
                            <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 mb-4 relative z-50">
                                <LegendItem dotColor="bg-[#d4a937]" label="1:2" small />
                                <LegendItem dotColor="bg-[#00687b]" label="1:4" small />
                                <LegendItem dotColor="bg-[#10b981]" label="1:8" small />
                                <LegendItem dotColor="bg-[#8b5cf6]" label="1:16" small />
                                <LegendItem dotColor="bg-[#f43f5e]" label="1:32" small />
                            </div>
                        )}
                        <div ref={coreTrendChartRef} className="h-[220px] min-h-[220px] w-full min-w-[1px] md:h-[240px] md:min-h-[240px]">
                            <ResponsiveContainer width="100%" height={240} minWidth={1} minHeight={1} debounce={100}>
                                <LineChart data={coreChartType === "sharing" ? visibleSharingTrendData : visibleCoreTrendData} margin={compactChartMargin}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} />
                                    <Tooltip contentStyle={chartTooltipContentStyle} itemStyle={chartTooltipItemStyle} labelStyle={chartTooltipLabelStyle} />

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

                        <div className="relative z-50 mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <ChartFilterSelector filter={coreTrendExportFilter} setFilter={setCoreTrendExportFilter} availableYears={availableYears} showCurrentMonthOption />
                            </div>
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                <button
                                    type="button"
                                    onClick={handleExportCoreTrend}
                                    disabled={isExportingCoreTrend}
                                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-0.5 text-[7px] font-black uppercase tracking-widest anim-surface ${isExportingCoreTrend ? "bg-white/10 text-gold-accent" : "btn-premium"}`}
                                >
                                    <span className={`material-symbols-outlined text-[10px] ${isExportingCoreTrend ? "animate-spin" : ""}`}>{isExportingCoreTrend ? "sync" : "download"}</span>
                                    {isExportingCoreTrend ? "Menyiapkan" : "CSV"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportCoreTrendXlsx}
                                    disabled={isExportingCoreTrendXlsx}
                                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-0.5 text-[7px] font-black uppercase tracking-widest anim-surface ${isExportingCoreTrendXlsx ? "bg-white/10 text-gold-accent" : "btn-premium"}`}
                                >
                                    <span className={`material-symbols-outlined text-[10px] ${isExportingCoreTrendXlsx ? "animate-spin" : ""}`}>{isExportingCoreTrendXlsx ? "sync" : "insert_chart"}</span>
                                    {isExportingCoreTrendXlsx ? "Menyiapkan" : "XLSX Grafik"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Sewa Sharing Core (Tabel) */}
                    <div className={`${glassCardClass} flex flex-col lg:col-span-1 h-full`}>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                <h2 className="text-base font-black text-on-surface tracking-tight">Rincian Sharing Core</h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[8px] font-black uppercase">5 PAKET</span>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <div className="space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                {sharingRows.map((item) => (
                                    <div key={item.ratio} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/12 anim-surface backdrop-blur-md">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-0.5">Paket</p>
                                                <p className={`text-[11px] font-black uppercase tracking-wider ${item.color}`}>{item.ratio}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-baseline gap-1.5">
                                            <span className={`text-sm font-black ${item.color}`}>{item.count}</span>
                                            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Lokasi</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-auto pt-3 border-t border-white/10">
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gold-accent/10 border border-gold-accent/20 backdrop-blur-md">
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-0.5">Total Lokasi</p>
                                            <p className="text-[11px] font-black text-gold-accent uppercase tracking-wider">Semua Paket</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-baseline gap-1.5">
                                        <span className="text-base font-black text-gold-accent">{sharingRows.reduce((sum, item) => sum + item.count, 0)}</span>
                                        <span className="text-[8px] font-black text-gold-accent/50 uppercase tracking-widest">Lokasi</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 h-auto lg:h-[360px] items-stretch">
                    {/* Growth Chart */}
                    <div className={`${glassCardClass} lg:col-span-2 xl:col-span-2 h-full flex flex-col`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2 relative z-50">
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                <h2 className="text-base font-black text-on-surface tracking-tight">Grafik Pertumbuhan</h2>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <ChartFilterSelector filter={growthFilter} setFilter={setGrowthFilter} availableYears={availableYears} modeOptions={growthModeOptions} />
                                <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15 backdrop-blur-md">
                                    {["tenant", "isp"].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setGrowthType(type)}
                                            className={`rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-widest anim-surface ${growthType === type
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
                        <div className="flex-1 w-full min-w-[1px] min-h-[220px] -ml-2 pb-2">
                            <ResponsiveContainer width="100%" height={260} minWidth={1} minHeight={1} debounce={100}>
                                <LineChart data={growthData[growthType]} margin={compactChartMargin}>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} dy={15} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.6)' }} />
                                    <Tooltip contentStyle={chartTooltipContentStyle} itemStyle={chartTooltipItemStyle} labelStyle={chartTooltipLabelStyle} />
                                    <Line type="monotone" dataKey="count" name={growthType === "tenant" ? "Lokasi" : "ISP"} stroke={growthType === "tenant" ? "#d4a937" : "#00687b"} strokeWidth={5} dot={{ r: 6, fill: '#fff', strokeWidth: 4, stroke: growthType === "tenant" ? "#d4a937" : "#00687b" }} activeDot={{ r: 8, fill: growthType === "tenant" ? "#d4a937" : "#00687b", stroke: '#fff', strokeWidth: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className={`${glassCardClass} flex flex-col h-full`}>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                <h2 className="text-base font-black text-on-surface tracking-tight">Tindakan Kritis</h2>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 text-[8px] font-black uppercase">{alerts.length} MASALAH</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                            {alerts.map((alert, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/12 anim-surface backdrop-blur-md">
                                    <div className="h-6 w-6 shrink-0 flex items-center justify-center rounded bg-rose-500/15 text-rose-300">
                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>priority_high</span>
                                    </div>
                                    <p className="text-[9px] font-black text-on-surface line-clamp-1">{alert.message || alert.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {/* Berita Terbaru */}
                    <div className={`${glassCardClass} h-full flex flex-col`}>
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                            <h2 className="text-base font-black text-on-surface tracking-tight">Berita Terbaru</h2>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                            <span className="material-symbols-outlined text-4xl mb-2">news</span>
                            <p className="text-xs font-bold uppercase tracking-widest">Belum Ada Berita</p>
                        </div>
                    </div>

                    {/* Status Jalur */}
                    <div className={`${glassCardClass} h-full flex flex-col`}>
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                            <h2 className="text-base font-black text-on-surface tracking-tight">Status Jalur</h2>
                        </div>
                        <div className="flex-1 flex flex-col justify-between mt-2">
                            <div className="space-y-2">
                                <OperationalStatusRow label="Aktif" count={routeStatus.aktif} percent={routePercent(routeStatus.aktif)} color="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" bg="bg-emerald-500/5 border-emerald-500/10" />
                                <OperationalStatusRow label="Gangguan Jaringan" count={routeStatus.gangguan} percent={routePercent(routeStatus.gangguan)} color="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" bg="bg-amber-500/5 border-amber-500/10" />
                                <OperationalStatusRow label="Sedang Perbaikan" count={routeStatus.perbaikan} percent={routePercent(routeStatus.perbaikan)} color="bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" bg="bg-rose-500/5 border-rose-500/10" />
                            </div>
                            <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
                                <div>
                                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Jalur Terdata</p>
                                    <p className="text-xl font-black text-on-surface mt-0.5">{routeStatus.total}</p>
                                </div>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-on-surface-variant border border-white/5 backdrop-blur-md">
                                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>route</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Kontrak */}
                    <div className={`${glassCardClass} h-full flex flex-col md:col-span-2 xl:col-span-1`}>
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                            <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                            <h2 className="text-base font-black text-on-surface tracking-tight">Status Kontrak Lokasi</h2>
                        </div>
                        <div className="flex-1 flex flex-col justify-between mt-2">
                            <div className="space-y-2">
                                <ContractStatusRow label="Beroperasi" count={stats.contract.beroperasi} color="text-emerald-500" bg="bg-emerald-500/10 border-emerald-500/20" icon="check_circle" />
                                <ContractStatusRow label="Belum Beroperasi" count={stats.contract.belum_beroperasi} color="text-sky-500" bg="bg-sky-500/10 border-sky-500/20" icon="schedule" />
                                <ContractStatusRow label="Belum Diperpanjang" count={stats.contract.expired} color="text-amber-500" bg="bg-amber-500/10 border-amber-500/20" icon="warning" />
                                <ContractStatusRow label="Berhenti" count={stats.contract.berhenti} color="text-rose-500" bg="bg-rose-500/10 border-rose-500/20" icon="cancel" />
                            </div>
                            <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between shrink-0 backdrop-blur-md">
                                <div>
                                    <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest">Total Lokasi Operasional</p>
                                    <p className="text-xl font-black text-on-surface mt-0.5">{stats.contract.totalOperational} <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider ml-1">Lokasi</span></p>
                                </div>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-on-surface-variant border border-white/5 backdrop-blur-md">
                                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>domain</span>
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
        <div className="glass-card backdrop-blur-xl rounded-2xl p-4 md:p-5 border-white/40">
            <div className="flex justify-between items-start mb-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">{label}</p>
                <div className={`h-10 w-10 flex items-center justify-center rounded-xl ${accents[accent]}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{icon}</span>
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
        <div className={`group cursor-pointer rounded-lg border p-2.5 anim-surface hover:scale-[1.02] ${bg}`}>
            <div className="flex items-end justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-on-surface/80 transition-colors group-hover:text-on-surface">{label}</span>
                <span className="text-base font-black text-on-surface">{count}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10 border border-white/5 backdrop-blur-md">
                <div className={`h-full ${color} rounded-full transition-[width] duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
}

function ContractStatusRow({ label, count, color, bg, icon }) {
    return (
        <div className={`flex items-center justify-between rounded-lg border p-2.5 transition-transform hover:scale-[1.02] ${bg}`}>
            <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ${color} backdrop-blur-md`}>
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>{icon}</span>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest ${color}`}>{label}</span>
            </div>
            <span className={`text-base font-black ${color} flex items-baseline gap-1`}>
                {count}
                <span className="text-[8px] font-black opacity-60 uppercase tracking-wider">Lokasi</span>
            </span>
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
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} style={{ fontSize: "14px" }}>expand_more</span>
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

function ChartFilterSelector({ filter, setFilter, availableYears, modeOptions, showCurrentMonthOption = false }) {
    const handleChange = (key, value) => {
        setFilter(prev => ({ ...prev, [key]: value }));
    };

    const yearOptions = availableYears.map(y => ({ value: y, label: String(y) }));
    const currentMonthOptions = [
        { value: "current_month", label: "Bulan Ini" },
        { value: "full_year", label: "Jan-Des" }
    ];
    const resolvedModeOptions = modeOptions ?? [
        { value: "this_year", label: "Tahun Ini" },
        { value: "range_years", label: "Rentang" },
        { value: "specific_year", label: "Tahun Spesifik" },
        { value: "custom", label: "Kustom Range" }
    ];

    return (
        <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {showCurrentMonthOption && filter.mode === "this_year" && (
                <div className="flex items-center border-r border-white/10 pr-3">
                    <CustomDropdown
                        value={filter.currentMonthOnly ? "current_month" : "full_year"}
                        onChange={(val) => handleChange('currentMonthOnly', val === "current_month")}
                        options={currentMonthOptions}
                        align="left"
                    />
                </div>
            )}

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
                options={resolvedModeOptions}
                align="right"
                triggerClass="text-on-surface text-[10px] uppercase tracking-widest"
            />
        </div>
    );
}
