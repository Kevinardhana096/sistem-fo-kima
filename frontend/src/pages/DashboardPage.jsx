import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { IssueCountRow, MetricCard } from "../components/shared/AppShared";
import { monitoringMonths } from "../app/constants";
import { API_BASE_URL, fetchJson, formatCurrency } from "../app/utils";

function DashboardPage({
    activeSection,
    onNavigate,
    customers,
    isLoadingCustomers,
}) {
    const currentYear = String(new Date().getUTCFullYear());
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

    const loadOperationalData = useCallback(async () => {
        setIsLoadingOperational(true);
        setOperationalError("");

        try {
            const [billingResult, alertsResult, insightsResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/monitoring/billing?year=${currentYear}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/alerts?year=${currentYear}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/insights?year=${currentYear}`),
            ]);

            const summary = billingResult?.summary ?? {};
            setBillingSummary({
                lunas: Number(summary.lunas ?? 0),
                belum_bayar: Number(summary.belum_bayar ?? 0),
                terlambat: Number(summary.terlambat ?? 0),
                belum_ditagih: Number(summary.belum_ditagih ?? 0),
            });

            const parsedAlerts = Array.isArray(alertsResult)
                ? alertsResult
                : Array.isArray(alertsResult?.alerts)
                    ? alertsResult.alerts
                    : [];
            setAlerts(parsedAlerts);

            const parsedInsights =
                insightsResult
                    && Array.isArray(insightsResult?.months)
                    && insightsResult?.totals
                    ? insightsResult
                    : null;
            setInsights(parsedInsights);
        } catch (error) {
            setOperationalError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat data operasional dashboard.",
            );
        } finally {
            setIsLoadingOperational(false);
        }
    }, [currentYear]);

    useEffect(() => {
        void loadOperationalData();
    }, [loadOperationalData]);

    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((customer) => customer.active).length;
    const inactiveCustomers = totalCustomers - activeCustomers;
    const overdueInvoices = Number(billingSummary.terlambat ?? 0);
    const unpaidInvoices = Number(billingSummary.belum_bayar ?? 0);
    const totalAlerts = alerts.length;
    const issueCounts = {
        missingContract: alerts.filter((alert) => alert.code === "missing_contract").length,
        missingInvoice: alerts.filter((alert) => ["missing_invoice_current_month", "invoice_not_uploaded", "payment_overdue"].includes(alert.code)).length,
        contractExpiring: alerts.filter((alert) => ["contract_expiring", "bak_missing"].includes(alert.code)).length,
        activationFee: alerts.filter((alert) => alert.code === "activation_fee_unpaid").length,
        terminationDoc: alerts.filter((alert) => ["has_termination_document", "missing_required_document"].includes(alert.code)).length,
    };

    const insightMonths = Array.isArray(insights?.months) ? insights.months : [];
    const insightTotals = insights?.totals ?? {
        revenuePaid: 0,
        revenueProjected: 0,
        estimatedProfit: 0,
        averageActiveRentals: 0,
    };

    const maxRevenue = Math.max(
        1,
        ...insightMonths.map((item) =>
            Math.max(Number(item.revenuePaid ?? 0), Number(item.revenueProjected ?? 0))),
    );

    const firstHalfAverageRentals = insightMonths.length > 0
        ? Math.round(
            insightMonths
                .slice(0, 6)
                .reduce((sum, item) => sum + Number(item.activeRentals ?? 0), 0) / 6,
        )
        : 0;
    const secondHalfAverageRentals = insightMonths.length > 0
        ? Math.round(
            insightMonths
                .slice(6)
                .reduce((sum, item) => sum + Number(item.activeRentals ?? 0), 0) / 6,
        )
        : 0;
    const rentalDelta = secondHalfAverageRentals - firstHalfAverageRentals;

    let biggestDrop = { month: null, delta: 0 };
    insightMonths.forEach((item, index) => {
        if (index === 0) {
            return;
        }

        const previous = Number(insightMonths[index - 1]?.activeRentals ?? 0);
        const current = Number(item.activeRentals ?? 0);
        const delta = current - previous;

        if (delta < biggestDrop.delta) {
            biggestDrop = {
                month: item.month,
                delta,
            };
        }
    });

    const totalStatusCells =
        Number(billingSummary.lunas)
        + Number(billingSummary.belum_bayar)
        + Number(billingSummary.terlambat)
        + Number(billingSummary.belum_ditagih);

    const statusVisual = [
        {
            key: "lunas",
            label: "Lunas",
            value: Number(billingSummary.lunas),
            barClass: "bg-emerald-500",
            textClass: "text-emerald-700",
        },
        {
            key: "belum_bayar",
            label: "Belum Bayar",
            value: Number(billingSummary.belum_bayar),
            barClass: "bg-red-500",
            textClass: "text-red-700",
        },
        {
            key: "terlambat",
            label: "Terlambat",
            value: Number(billingSummary.terlambat),
            barClass: "bg-orange-500",
            textClass: "text-orange-700",
        },
        {
            key: "belum_ditagih",
            label: "Belum Ditagih",
            value: Number(billingSummary.belum_ditagih),
            barClass: "bg-amber-400",
            textClass: "text-amber-700",
        },
    ];

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl space-y-8">
                <section className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
                    <div className="max-w-3xl">
                        <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-primary">
                            Dashboard Visual Ringkasan
                        </h1>
                        <p className="text-on-surface-variant">
                            Menampilkan visual diagram keuangan, tren sewa, dan indikator utama lintas pelanggan.
                            Detail operasional lengkap tersedia pada halaman Monitoring.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary/20 transition-opacity hover:opacity-90"
                            onClick={() => {
                                void loadOperationalData();
                            }}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-base">sync</span>
                            Sinkronkan
                        </button>

                        <button
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                            onClick={() => onNavigate("monitoring")}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-base">monitor_heart</span>
                            Buka Monitoring Detail
                        </button>
                    </div>
                </section>

                {(isLoadingCustomers || isLoadingOperational) && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-700">
                        Memuat data dashboard dari backend...
                    </div>
                )}

                {operationalError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                        {operationalError}
                    </div>
                )}

                <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
                    <MetricCard
                        accentClass="border-primary"
                        title="Pendapatan Terealisasi"
                        value={formatCurrency(insightTotals.revenuePaid)}
                        helper={`Tahun ${currentYear}`}
                    />
                    <MetricCard
                        accentClass="border-emerald-600"
                        title="Estimasi Keuntungan"
                        value={formatCurrency(insightTotals.estimatedProfit)}
                        helper="Asumsi margin 28%"
                    />
                    <MetricCard
                        accentClass="border-blue-600"
                        title="Proyeksi Pendapatan"
                        value={formatCurrency(insightTotals.revenueProjected)}
                        helper="Termasuk invoice belum lunas"
                    />
                    <MetricCard
                        accentClass="border-amber-500"
                        title="Rata-rata Sewa Aktif"
                        value={String(insightTotals.averageActiveRentals)}
                        helper={`Total kendala: ${totalAlerts}`}
                    />
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="xl:col-span-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Diagram Pendapatan</p>
                                <h2 className="text-xl font-bold text-on-surface">Perbandingan Pendapatan per Bulan</h2>
                            </div>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                Tahun {currentYear}
                            </span>
                        </div>

                        {insightMonths.length === 0 ? (
                            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-on-surface-variant">
                                Data pendapatan belum tersedia untuk divisualisasikan.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="inline-flex items-center gap-2 text-emerald-700">
                                        <span className="h-2.5 w-2.5 rounded bg-emerald-500"></span>
                                        Terealisasi
                                    </span>
                                    <span className="inline-flex items-center gap-2 text-blue-700">
                                        <span className="h-2.5 w-2.5 rounded bg-blue-500"></span>
                                        Proyeksi
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <div className="flex min-w-[760px] items-end gap-4 pb-2">
                                        {insightMonths.map((item) => {
                                            const paid = Number(item.revenuePaid ?? 0);
                                            const projected = Number(item.revenueProjected ?? 0);
                                            const paidHeight = Math.max(
                                                paid > 0 ? 10 : 0,
                                                Math.round((paid / maxRevenue) * 170),
                                            );
                                            const projectedHeight = Math.max(
                                                projected > 0 ? 10 : 0,
                                                Math.round((projected / maxRevenue) * 170),
                                            );

                                            return (
                                                <div key={item.month} className="flex flex-col items-center gap-2">
                                                    <div className="flex h-[190px] items-end gap-1">
                                                        <div
                                                            className="w-4 rounded-t bg-emerald-500"
                                                            style={{ height: `${paidHeight}px` }}
                                                            title={`Terealisasi: ${formatCurrency(paid)}`}
                                                        ></div>
                                                        <div
                                                            className="w-4 rounded-t bg-blue-500"
                                                            style={{ height: `${projectedHeight}px` }}
                                                            title={`Proyeksi: ${formatCurrency(projected)}`}
                                                        ></div>
                                                    </div>

                                                    <p className="text-[11px] font-bold text-on-surface-variant">
                                                        {monitoringMonths[item.month - 1]}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="xl:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div className="mb-4">
                            <p className="text-xs font-black uppercase tracking-widest text-primary">Tren Jumlah Sewa</p>
                            <h2 className="text-xl font-bold text-on-surface">Naik Turun Sewa Aktif</h2>
                        </div>

                        <div className="space-y-3">
                            <div className="rounded-xl border border-slate-100 bg-blue-50/70 px-4 py-3">
                                <div className="mb-1 flex items-center justify-between">
                                    <p className="text-sm font-bold text-blue-900">Rata-rata Semester 1</p>
                                    <p className="text-sm font-black text-blue-900">{firstHalfAverageRentals}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                <div className="mb-1 flex items-center justify-between">
                                    <p className="text-sm font-bold text-slate-700">Rata-rata Semester 2</p>
                                    <p className="text-sm font-black text-slate-700">{secondHalfAverageRentals}</p>
                                </div>
                            </div>

                            <div className={`rounded-xl border px-4 py-3 ${rentalDelta < 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Perubahan Sewa
                                </p>
                                <p className={`mt-1 text-2xl font-black ${rentalDelta < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                    {rentalDelta > 0 ? `+${rentalDelta}` : rentalDelta}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Penurunan Terbesar
                                </p>
                                <p className="mt-1 text-sm font-bold text-blue-900">
                                    {biggestDrop.month
                                        ? `${monitoringMonths[biggestDrop.month - 1]} (${biggestDrop.delta})`
                                        : "Tidak ada penurunan signifikan"}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-bold text-on-surface">Status Billing Tahunan</h3>
                        <div className="space-y-3">
                            {totalStatusCells === 0 && (
                                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-on-surface-variant">
                                    Data billing belum tersedia untuk divisualisasikan.
                                </p>
                            )}

                            {statusVisual.map((item) => {
                                const percentage = totalStatusCells > 0
                                    ? Math.round((item.value / totalStatusCells) * 100)
                                    : 0;

                                return (
                                    <div
                                        key={item.key}
                                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                                    >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <p className="text-sm font-bold text-on-surface">{item.label}</p>
                                            <p className={`text-xs font-bold ${item.textClass}`}>
                                                {item.value} ({percentage}%)
                                            </p>
                                        </div>

                                        <div className="h-2 w-full rounded-full bg-slate-200">
                                            <div
                                                className={`h-2 rounded-full ${item.barClass}`}
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-on-surface">Ringkasan Kendala</h3>
                            <div className="space-y-3">
                                <IssueCountRow label="Kontrak belum tersedia" value={issueCounts.missingContract} />
                                <IssueCountRow label="Invoice bulan berjalan belum ada" value={issueCounts.missingInvoice} />
                                <IssueCountRow label="Kontrak mendekati habis" value={issueCounts.contractExpiring} />
                                <IssueCountRow label="Biaya aktivasi belum dibayar" value={issueCounts.activationFee} />
                                <IssueCountRow label="Dokumen terminasi terdeteksi" value={issueCounts.terminationDoc} />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-primary p-6 text-white">
                            <p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-200">Status Data Visual</p>
                            <h4 className="mb-4 text-xl font-bold leading-tight">
                                Dashboard menampilkan diagram keuangan dan tren sewa sebagai ringkasan cepat manajemen.
                            </h4>
                            <div className="space-y-2 text-sm text-blue-100/90">
                                <p>Total pelanggan: <span className="font-bold text-white">{totalCustomers}</span></p>
                                <p>Pelanggan aktif: <span className="font-bold text-white">{activeCustomers}</span></p>
                                <p>Pelanggan non-aktif: <span className="font-bold text-white">{inactiveCustomers}</span></p>
                                <p>Invoice belum bayar/terlambat: <span className="font-bold text-white">{unpaidInvoices} / {overdueInvoices}</span></p>
                                <p>Untuk daftar tindakan dan konfirmasi, gunakan halaman Monitoring.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

export default DashboardPage;
