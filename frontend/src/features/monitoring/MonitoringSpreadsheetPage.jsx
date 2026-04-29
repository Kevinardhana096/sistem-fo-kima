import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { IssueCountRow } from "../../components/shared/AppShared";
import { invoiceStatusLabelMap, monitoringMonths } from "../../app/constants";
import {
    API_BASE_URL,
    fetchJson,
    formatCoreAllocation,
    formatCurrency,
    formatDate,
    formatDateTime,
    getRemainingRentalDays,
    getMonthStatusClass,
    parseDateValue,
    toTitleCase,
} from "../../app/utils";

function MonitoringSpreadsheetPage({ activeSection, onNavigate, ispOptions, onOpenCustomerById }) {
    const currentYear = String(new Date().getUTCFullYear());
    const [filters, setFilters] = useState(() => ({
        search: "",
        year: currentYear,
        isp: "",
        status: "",
    }));
    const [appliedFilters, setAppliedFilters] = useState(() => ({
        year: currentYear,
        isp: "",
        status: "",
    }));

    const [billingRows, setBillingRows] = useState([]);
    const [billingSummary, setBillingSummary] = useState({
        lunas: 0,
        belum_bayar: 0,
        terlambat: 0,
        belum_ditagih: 0,
    });
    const [alerts, setAlerts] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [selectedInvoiceCell, setSelectedInvoiceCell] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // Prevent horizontal scroll on the entire page just for this feature
        document.documentElement.style.overflowX = "hidden";
        document.body.style.overflowX = "hidden";
        
        return () => {
            document.documentElement.style.overflowX = "";
            document.body.style.overflowX = "";
        };
    }, []);

    const loadMonitoring = useCallback(async () => {
        setIsLoading(true);
        setError("");

        try {
            const params = new URLSearchParams();
            params.set("year", appliedFilters.year);

            if (appliedFilters.isp) {
                params.set("isp", appliedFilters.isp);
            }

            if (appliedFilters.status) {
                params.set("status", appliedFilters.status);
            }

            const [billingResult, alertsResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/monitoring/billing?${params.toString()}`),
                fetchJson(`${API_BASE_URL}/api/monitoring/alerts?year=${encodeURIComponent(appliedFilters.year)}`),
            ]);

            const nextBillingRows = Array.isArray(billingResult?.rows) ? billingResult.rows : [];

            setBillingRows(nextBillingRows);
            setBillingSummary({
                lunas: Number(billingResult?.summary?.lunas ?? 0),
                belum_bayar: Number(billingResult?.summary?.belum_bayar ?? 0),
                terlambat: Number(billingResult?.summary?.terlambat ?? 0),
                belum_ditagih: Number(billingResult?.summary?.belum_ditagih ?? 0),
            });

            let nextAlerts = [];
            if (Array.isArray(alertsResult)) {
                nextAlerts = alertsResult;
            } else if (Array.isArray(alertsResult?.alerts)) {
                nextAlerts = alertsResult.alerts;
            }

            setAlerts(nextAlerts);

            const candidateCustomerIds = [
                ...new Set([
                    ...nextBillingRows.map((row) => row.customerId).filter((id) => Number.isFinite(id)),
                    ...nextAlerts.map((alert) => alert.customerId).filter((id) => Number.isFinite(id)),
                ]),
            ].slice(0, 8);

            if (candidateCustomerIds.length === 0) {
                setRecentActivities([]);
                return;
            }

            const nameMap = new Map();
            nextBillingRows.forEach((row) => {
                nameMap.set(row.customerId, row.customerName);
            });
            nextAlerts.forEach((alert) => {
                if (!nameMap.has(alert.customerId) && alert.customerName) {
                    nameMap.set(alert.customerId, alert.customerName);
                }
            });

            const timelineResults = await Promise.all(
                candidateCustomerIds.map(async (customerId) => {
                    try {
                        const timeline = await fetchJson(
                            `${API_BASE_URL}/api/customers/${customerId}/timeline`,
                        );

                        return {
                            customerId,
                            customerName: nameMap.get(customerId) ?? `Pelanggan #${customerId}`,
                            events: Array.isArray(timeline) ? timeline : [],
                        };
                    } catch {
                        return {
                            customerId,
                            customerName: nameMap.get(customerId) ?? `Pelanggan #${customerId}`,
                            events: [],
                        };
                    }
                }),
            );

            const flattenedActivities = timelineResults
                .flatMap((entry) => entry.events.map((event) => ({
                    id: `${entry.customerId}-${event.id ?? event.date ?? event.title}`,
                    customerId: entry.customerId,
                    customerName: entry.customerName,
                    title: event.title ?? "Aktivitas",
                    description: event.description ?? "-",
                    date: event.date ?? null,
                })))
                .sort((left, right) => {
                    const leftDate = parseDateValue(left.date)?.getTime() ?? 0;
                    const rightDate = parseDateValue(right.date)?.getTime() ?? 0;
                    return rightDate - leftDate;
                })
                .slice(0, 10);

            setRecentActivities(flattenedActivities);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat memuat monitoring.",
            );
        } finally {
            setIsLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        void loadMonitoring();
    }, [loadMonitoring]);

    const filteredRows = useMemo(() => {
        const loweredSearch = filters.search.trim().toLowerCase();

        if (!loweredSearch) {
            return billingRows;
        }

        return billingRows.filter((row) => {
            const haystack = [
                row.customerName,
                row.ispName,
                row.customerCode,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(loweredSearch);
        });
    }, [billingRows, filters.search]);

    const visibleSummary = useMemo(() => {
        const summary = {
            lunas: 0,
            belum_bayar: 0,
            terlambat: 0,
            belum_ditagih: 0,
        };

        filteredRows.forEach((row) => {
            if (!Array.isArray(row.months)) {
                return;
            }

            row.months.forEach((status) => {
                if (status in summary) {
                    summary[status] += 1;
                }
            });
        });

        return summary;
    }, [filteredRows]);

    const totalCells =
        visibleSummary.lunas
        + visibleSummary.belum_bayar
        + visibleSummary.terlambat
        + visibleSummary.belum_ditagih;

    const totalAlerts = alerts.length;
    const hasIssues = totalAlerts > 0;
    const issueCounts = {
        missingContract: alerts.filter((alert) => alert.code === "missing_contract").length,
        missingInvoice: alerts.filter((alert) => ["missing_invoice_current_month", "invoice_not_uploaded", "payment_overdue"].includes(alert.code)).length,
        contractExpiring: alerts.filter((alert) => ["contract_expiring", "bak_missing"].includes(alert.code)).length,
        activationFee: alerts.filter((alert) => alert.code === "activation_fee_unpaid").length,
        terminationDoc: alerts.filter((alert) => ["has_termination_document", "missing_required_document"].includes(alert.code)).length,
    };

    const actionNeededToday = useMemo(() => {
        return alerts
            .slice(0, 8)
            .map((alert) => ({
                ...alert,
                actionLabel: {
                    missing_contract: "Buka & Buat Surat Kontrak",
                    missing_invoice_current_month: "Buka & Buat Surat Invoice",
                    payment_overdue: "Buka & Follow Up Pembayaran",
                    contract_expiring: "Buka & Tindak Masa Sewa",
                    bak_missing: "Buka & Upload BAK",
                    missing_required_document: "Buka & Lengkapi Dokumen",
                    invoice_not_uploaded: "Buka & Lengkapi Invoice",
                    has_termination_document: "Buka & Verifikasi Terminasi",
                    activation_fee_unpaid: "Buka & Update Aktivasi",
                }[alert.code] ?? "Buka Detail Pelanggan",
                targetTab: {
                    missing_contract: "contracts",
                    missing_invoice_current_month: "invoices",
                    payment_overdue: "invoices",
                    contract_expiring: "contracts",
                    bak_missing: "documents",
                    missing_required_document: "documents",
                    invoice_not_uploaded: "invoices",
                    has_termination_document: "documents",
                    activation_fee_unpaid: "overview",
                }[alert.code] ?? "overview",
            }));
    }, [alerts]);

    const yearOptions = [
        String(Number(currentYear) - 1),
        currentYear,
        String(Number(currentYear) + 1),
    ];

    const exportToExcel = () => {
        if (filteredRows.length === 0) return;

        const headers = [
            "No", "Nama ISP", "Nama Pelanggan", "Periode Awal", "Berjalan Awal", "Berjalan Akhir",
            "Paket", "Jumlah", "No. Kontrak", "No. Invoice", "Sisa Sewa", "Status Kontrak", "Status Jalur", "Aktivasi",
            ...monitoringMonths
        ];

        const csvRows = filteredRows.map((row, index) => {
            const monthsData = monitoringMonths.map((_, i) => {
                const status = Array.isArray(row.months) ? row.months[i] : "belum_ditagih";
                return invoiceStatusLabelMap[status] || status;
            });

            const data = [
                index + 1,
                row.ispName,
                row.customerName,
                formatDate(row.ispContractStart),
                formatDate(row.contractStart),
                formatDate(row.contractEnd),
                toTitleCase(row.coreType),
                row.coreTotal ?? "-",
                row.contractNumber ?? "-",
                row.currentInvoiceNumber ?? "-",
                getRemainingRentalDays(row.contractEnd) ?? "-",
                row.customerStatus === "nonaktif" ? "Berhenti" : "Beroperasi",
                row.routeStatus || "aktif",
                row.activationFeePaidAt ? "Selesai" : formatCurrency(row.activationFeeAmount),
                ...monthsData
            ];
            return data.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
        });

        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `monitoring_billing_${appliedFilters.year}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const uniqueAlertCustomers = useMemo(() => {
        return new Set(alerts.map(a => a.customerId)).size;
    }, [alerts]);

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="w-full overflow-x-hidden">
                <div className="mx-auto w-full max-w-[1450px] space-y-6">
                    <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end px-1">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                            <span>Dashboard</span>
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                            <span className="font-bold text-primary">Monitoring Operasional</span>
                        </div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-blue-900 text-pretty">
                            Monitoring Informasi Penting
                        </h2>
                        <p className="text-sm text-on-surface-variant max-w-3xl">
                            Seluruh informasi operasional penting ditampilkan di sini: prioritas aksi,
                            alert, aktivitas terbaru, dan matriks billing pelanggan. Monitoring bersifat
                            read-only, sedangkan edit/upload dilakukan dari Detail Pelanggan.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 font-semibold text-on-surface-variant shadow-sm transition-colors hover:bg-slate-50"
                            onClick={exportToExcel}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-sm">download_for_offline</span>
                            Ekspor ke Excel
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                            onClick={() => {
                                void loadMonitoring();
                            }}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-sm">sync</span>
                            Refresh Monitoring
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <section className={`rounded-xl border px-5 py-4 ${hasIssues ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    {hasIssues ? (
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-amber-700">warning</span>
                            <div>
                                <p className="text-sm font-bold text-amber-800">Ada kendala yang butuh tindakan</p>
                                <p className="text-sm text-amber-700">
                                    Terdapat {totalAlerts} alert. Cek bagian Action Needed Today
                                    lalu buka Detail Pelanggan untuk mengedit kontrak, invoice, dokumen,
                                    atau status aktivasi.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-emerald-700">verified</span>
                            <div>
                                <p className="text-sm font-bold text-emerald-800">Semua aman</p>
                                <p className="text-sm text-emerald-700">
                                    Tidak ada kendala aktif. Lanjutkan pemantauan melalui mode spreadsheet dan filtering.
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 border-l-4 border-l-blue-500 bg-white p-6 shadow-sm">
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                            Total ISP
                        </h4>
                        <p className="text-2xl font-black text-blue-900">{ispOptions.length}</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 border-l-4 border-l-indigo-500 bg-white p-6 shadow-sm">
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                            Total Pelanggan
                        </h4>
                        <p className="text-2xl font-black text-blue-900">{billingRows.length}</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 border-l-4 border-l-red-500 bg-white p-6 shadow-sm">
                        <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                            Pelanggan Perlu Tindak Lanjut
                        </h4>
                        <p className="text-2xl font-black text-blue-900">{uniqueAlertCustomers}</p>
                    </div>
                </section>

                {hasIssues && (
                    <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                        <div className="xl:col-span-3 rounded-xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Action Needed Today</p>
                                    <h3 className="text-lg font-bold text-on-surface">Prioritas Operasional</h3>
                                </div>
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                    {actionNeededToday.length} aksi
                                </span>
                            </div>

                            <div className="space-y-3">
                                {actionNeededToday.length === 0 && (
                                    <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-on-surface-variant">
                                        Tidak ada prioritas aksi untuk saat ini.
                                    </p>
                                )}

                                {actionNeededToday.map((item, index) => (
                                    <div
                                        key={`${item.customerId}-${item.code}-${index}`}
                                        className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-on-surface truncate">{item.customerName ?? `Pelanggan #${item.customerId}`}</p>
                                            <p className="mt-1 text-xs text-on-surface-variant truncate md:whitespace-normal">{item.message}</p>
                                        </div>

                                        <button
                                            className="inline-flex items-center gap-1 self-start rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/15 shrink-0"
                                            onClick={() => onOpenCustomerById(item.customerId, item.targetTab)}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-sm">bolt</span>
                                            {item.actionLabel}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="xl:col-span-2 rounded-xl border border-slate-100 bg-white p-6 shadow-sm relative overflow-hidden">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Ringkasan Cepat</p>
                                    <h3 className="text-lg font-bold text-on-surface">Ringkasan Alert</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Alert</p>
                                    <p className="text-2xl font-black text-red-600 leading-none">{totalAlerts}</p>
                                </div>
                            </div>

                            <div className="space-y-3 relative z-10">
                                <IssueCountRow label="Surat kontrak belum dibuat" value={issueCounts.missingContract} />
                                <IssueCountRow label="Surat invoice bulan ini belum dibuat" value={issueCounts.missingInvoice} />
                                <IssueCountRow label="Kontrak mendekati habis" value={issueCounts.contractExpiring} />
                                <IssueCountRow label="Biaya aktivasi belum dibayar" value={issueCounts.activationFee} />
                                <IssueCountRow label="Dokumen terminasi terdeteksi" value={issueCounts.terminationDoc} />
                            </div>
                        </div>
                    </section>
                )}

                <section className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0">
                            <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Pencarian Cepat
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400">
                                    search
                                </span>
                                <input
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-xs transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    onChange={(event) =>
                                        setFilters((previous) => ({
                                            ...previous,
                                            search: event.target.value,
                                        }))
                                    }
                                    placeholder="ISP, Pelanggan, Kode..."
                                    type="text"
                                    value={filters.search}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Nama ISP
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-on-surface-variant transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        isp: event.target.value,
                                    }))
                                }
                                value={filters.isp}
                            >
                                <option value="">Semua ISP</option>
                                {ispOptions.map((isp) => (
                                    <option key={isp} value={isp}>
                                        {isp}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Status Invoice
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-on-surface-variant transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        status: event.target.value,
                                    }))
                                }
                                value={filters.status}
                            >
                                <option value="">Semua Status</option>
                                <option value="lunas">Lunas</option>
                                <option value="belum_bayar">Belum Bayar</option>
                                <option value="terlambat">Terlambat</option>
                                <option value="belum_ditagih">Belum Ditagih</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Tahun
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-on-surface-variant transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                onChange={(event) =>
                                    setFilters((previous) => ({
                                        ...previous,
                                        year: event.target.value,
                                    }))
                                }
                                value={filters.year}
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                            onClick={() =>
                                setAppliedFilters({
                                    year: filters.year,
                                    isp: filters.isp,
                                    status: filters.status,
                                })
                            }
                            type="button"
                        >
                            <span className="material-symbols-outlined text-sm">search</span>
                            Terapkan Filter Backend
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-slate-50"
                            onClick={() => {
                                const reset = {
                                    search: "",
                                    year: currentYear,
                                    isp: "",
                                    status: "",
                                };

                                setFilters(reset);
                                setAppliedFilters({
                                    year: currentYear,
                                    isp: "",
                                    status: "",
                                });
                            }}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            Reset
                        </button>
                    </div>
                </section>

                <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-slate-100 bg-surface-container-low p-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Keterangan:</span>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-emerald-500 shrink-0"></div>
                        <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Lunas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-red-500 shrink-0"></div>
                        <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Belum Bayar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-orange-400 shrink-0"></div>
                        <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Terlambat</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-amber-200 shrink-0"></div>
                        <span className="text-xs font-bold text-on-surface-variant whitespace-nowrap">Belum Ditagih</span>
                    </div>
                    <div className="text-xs font-medium text-on-surface-variant space-y-1 md:space-y-0 md:flex md:flex-wrap md:gap-x-4">
                        <p>Klik sel bulanan untuk lihat detail invoice pelanggan.</p>
                        <p>Biaya aktivasi: "Selesai" jika sudah dibayar, nominal jika masih outstanding.</p>
                        <p>Monitoring hanya menampilkan notifikasi. Edit dilakukan di Detail Pelanggan.</p>
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm max-w-full">
                    <div className="overflow-x-auto max-w-full">
                        <table className="w-full min-w-[2400px] table-fixed border-collapse text-[13px]">
                            <colgroup>
                                <col style={{ width: "64px" }} />
                                <col style={{ width: "160px" }} />
                                <col style={{ width: "240px" }} />
                                <col style={{ width: "200px" }} />
                                <col style={{ width: "120px" }} />
                                <col style={{ width: "120px" }} />
                                <col style={{ width: "150px" }} />
                                <col style={{ width: "100px" }} />
                                <col style={{ width: "180px" }} />
                                <col style={{ width: "180px" }} />
                                <col style={{ width: "180px" }} />
                                <col style={{ width: "160px" }} />
                                <col style={{ width: "160px" }} />
                                <col style={{ width: "200px" }} />
                                {monitoringMonths.map((month) => (
                                    <col key={`month-${month}`} style={{ width: "48px" }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr className="bg-slate-50">
                                    <th rowSpan="2" className="relative sticky left-0 top-0 z-30 w-[64px] pl-2 pr-0 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 bg-slate-50 border-b border-slate-200">
                                        No
                                    </th>
                                    <th rowSpan="2" className="relative sticky left-[64px] top-0 z-30 -ml-px w-[160px] pl-0 pr-0 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 bg-slate-50 border-b border-slate-200">
                                        Nama ISP
                                    </th>
                                    <th rowSpan="2" className="relative sticky left-[224px] top-0 z-30 -ml-px w-[240px] pl-0 pr-2 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 bg-slate-50 border-b border-slate-200">
                                        Nama Pelanggan
                                        <span className="absolute right-0 top-0 h-full w-px bg-slate-200" />
                                    </th>
                                    <th rowSpan="2" className="w-[200px] px-4 py-4 text-center font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Periode Awal
                                    </th>
                                    <th colSpan="2" className="px-4 py-3 text-center font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Periode Berjalan
                                    </th>
                                    <th rowSpan="2" className="w-[150px] px-4 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Paket
                                    </th>
                                    <th rowSpan="2" className="w-[100px] px-4 py-4 text-center font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Jumlah
                                    </th>
                                    <th rowSpan="2" className="w-[180px] px-4 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        No. Kontrak
                                    </th>
                                    <th rowSpan="2" className="w-[180px] px-4 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        No. Invoice
                                    </th>
                                    <th rowSpan="2" className="w-[180px] px-6 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Sisa Sewa
                                    </th>
                                    <th rowSpan="2" className="w-[160px] px-6 py-4 text-center font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        St. Kontrak
                                    </th>
                                    <th rowSpan="2" className="w-[160px] px-6 py-4 text-center font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        St. Jalur
                                    </th>
                                    <th rowSpan="2" className="w-[200px] px-6 py-4 text-left font-bold uppercase tracking-tighter text-blue-900 border-b border-r border-slate-200">
                                        Aktivasi
                                    </th>
                                    <th colSpan="12" className="px-6 py-3 text-center font-bold uppercase tracking-widest text-blue-900 border-b border-r border-slate-200">
                                        Monitoring Billing {appliedFilters.year}
                                    </th>
                                </tr>
                                <tr className="bg-slate-50">
                                    <th className="w-[120px] px-4 py-2 text-center font-bold text-[10px] uppercase text-blue-900 border-b border-r border-slate-200">
                                        Awal
                                    </th>
                                    <th className="w-[120px] px-4 py-2 text-center font-bold text-[10px] uppercase text-blue-900 border-b border-r border-slate-200">
                                        Akhir
                                    </th>
                                    {monitoringMonths.map((month) => (
                                        <th
                                            key={month}
                                            className="w-12 px-2 py-2 text-center font-bold text-[10px] uppercase text-blue-900 border-b border-r border-slate-200"
                                        >
                                            {month}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {isLoading && (
                                    <tr>
                                        <td className="px-6 py-6 text-center text-sm text-on-surface-variant" colSpan="27">
                                            Memuat data monitoring dari backend...
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && filteredRows.length === 0 && (
                                    <tr>
                                        <td className="px-6 py-6 text-center text-sm text-on-surface-variant" colSpan="27">
                                            Tidak ada data monitoring yang sesuai dengan filter.
                                        </td>
                                    </tr>
                                )}

                                {!isLoading && filteredRows.map((row, rowIndex) => (
                                    <tr key={`${row.customerId}-${rowIndex}`} className="bg-white transition-colors group">
                                        <td className="relative sticky left-0 z-20 w-[64px] pl-2 pr-0 py-4 font-medium text-slate-400 text-center bg-white group-hover:bg-slate-50 transition-colors">
                                            {String(rowIndex + 1).padStart(2, "0")}
                                        </td>
                                        <td className="relative sticky left-[64px] z-20 -ml-px w-[160px] pl-0 pr-0 py-4 font-bold text-blue-900 bg-white group-hover:bg-slate-50 transition-colors">
                                            {row.ispName}
                                        </td>
                                        <td className="relative sticky left-[224px] z-20 -ml-px w-[240px] pl-0 pr-2 py-4 bg-white group-hover:bg-slate-50 transition-colors">
                                            <p className="font-semibold text-slate-700 truncate max-w-[200px]">{row.customerName}</p>
                                            <button
                                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                                                onClick={() => onOpenCustomerById(row.customerId, "overview")}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                Detail
                                            </button>
                                            <span className="absolute right-0 top-0 h-full w-px bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant text-center group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                                            {formatDate(row.ispContractStart)}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                                            {formatDate(row.contractStart)}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                                            {formatDate(row.contractEnd)}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {toTitleCase(row.coreType)}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant text-center transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {row.coreTotal ?? "-"}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant font-mono text-[11px] transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {row.contractNumber ?? "-"}
                                        </td>
                                        <td className="px-4 py-4 text-on-surface-variant font-mono text-[11px] transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {row.currentInvoiceNumber ?? "-"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {(() => {
                                                const remainingDays = getRemainingRentalDays(row.contractEnd);

                                                if (remainingDays === null) {
                                                    return <span className="text-on-surface-variant">-</span>;
                                                }

                                                if (remainingDays < 0) {
                                                    return <span className="font-semibold text-red-700">Expired {Math.abs(remainingDays)} hari</span>;
                                                }

                                                if (remainingDays === 0) {
                                                    return <span className="font-semibold text-amber-700">Berakhir hari ini</span>;
                                                }

                                                return <span className="font-semibold text-blue-700">{remainingDays} hari lagi</span>;
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {(() => {
                                                const remainingDays = getRemainingRentalDays(row.contractEnd);
                                                let label = "Beroperasi";
                                                let style = "bg-emerald-100 text-emerald-700";

                                                if (row.customerStatus === "nonaktif") {
                                                    label = "Berhenti";
                                                    style = "bg-slate-100 text-on-surface-variant";
                                                } else if (remainingDays !== null && remainingDays < 0) {
                                                    label = "Expired";
                                                    style = "bg-red-100 text-red-700";
                                                }

                                                return (
                                                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${style}`}>
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {(() => {
                                                const status = row.routeStatus ?? "aktif";
                                                const style = {
                                                    aktif: "bg-blue-100 text-blue-700",
                                                    nonaktif: "bg-slate-100 text-on-surface-variant",
                                                    gangguan: "bg-red-100 text-red-700",
                                                }[status] ?? "bg-slate-100 text-on-surface-variant";

                                                return (
                                                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${style}`}>
                                                        {toTitleCase(status)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 transition-colors group-hover:bg-slate-50 border-r border-slate-200">
                                            {row.activationFeePaidAt ? (
                                                <div className="whitespace-nowrap">
                                                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                                        Selesai
                                                    </span>
                                                    <p className="mt-1 text-[11px] text-on-surface-variant">{formatDate(row.activationFeePaidAt)}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
                                                    {formatCurrency(row.activationFeeAmount)}
                                                </span>
                                            )}
                                        </td>

                                        {monitoringMonths.map((month, monthIndex) => {
                                            const status = Array.isArray(row.months)
                                                ? row.months[monthIndex]
                                                : "belum_ditagih";

                                            return (
                                                <td
                                                    key={`${row.customerId}-${month}`}
                                                    className="p-0 transition-colors group-hover:bg-slate-50 border-r border-slate-200"
                                                >
                                                    <button
                                                        className={`h-10 w-full transition hover:opacity-80 ${getMonthStatusClass(status)}`}
                                                        onClick={() =>
                                                            setSelectedInvoiceCell({
                                                                customerId: row.customerId,
                                                                customerName: row.customerName,
                                                                customerCode: row.customerCode,
                                                                ispName: row.ispName,
                                                                month,
                                                                monthIndex,
                                                                status,
                                                                year: appliedFilters.year,
                                                                contractStart: row.contractStart,
                                                                contractEnd: row.contractEnd,
                                                                coreType: row.coreType,
                                                                coreTotal: row.coreTotal,
                                                                sharingRatio: row.sharingRatio,
                                                            })
                                                        }
                                                        title={invoiceStatusLabelMap[status] ?? status}
                                                        type="button"
                                                    >
                                                        <span className="sr-only">
                                                            {row.customerName} {month} {appliedFilters.year} {invoiceStatusLabelMap[status] ?? status}
                                                        </span>
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-8 py-5">
                        <p className="text-xs font-semibold text-on-surface-variant">
                            Menampilkan <span className="text-blue-900">{filteredRows.length}</span> baris data
                        </p>
                        <p className="text-xs font-semibold text-on-surface-variant">
                            Total sel status: <span className="text-blue-900">{totalCells}</span>
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm overflow-hidden">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-on-surface">Recent Activity</h3>
                        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Aktivitas lintas pelanggan
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {recentActivities.length === 0 && (
                            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                                Aktivitas terbaru belum tersedia.
                            </p>
                        )}

                        {recentActivities.map((activity) => (
                            <div
                                key={activity.id}
                                className="rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3 min-w-0"
                            >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-on-surface truncate">{activity.customerName}</p>
                                    <p className="text-[11px] font-medium text-on-surface-variant shrink-0">
                                        {formatDateTime(activity.date)}
                                    </p>
                                </div>
                                <p className="text-sm font-semibold text-primary truncate">{activity.title}</p>
                                <p className="text-xs text-on-surface-variant line-clamp-2">{activity.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-100 bg-surface-container-low p-4 text-xs text-on-surface-variant">
                    Ringkasan backend (tanpa filter pencarian lokal): Lunas {billingSummary.lunas}, Belum Bayar {billingSummary.belum_bayar},
                    Terlambat {billingSummary.terlambat}, Belum Ditagih {billingSummary.belum_ditagih}.
                </section>

                {selectedInvoiceCell && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                        <div className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Invoice Detail (Read Only)</p>
                                    <h3 className="text-xl font-bold text-on-surface">
                                        {selectedInvoiceCell.customerName}
                                    </h3>
                                    <p className="text-xs text-on-surface-variant">
                                        {selectedInvoiceCell.ispName} | {selectedInvoiceCell.customerCode}
                                    </p>
                                </div>

                                <button
                                    className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200"
                                    onClick={() => setSelectedInvoiceCell(null)}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>

                            <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-2">
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Periode</dt>
                                    <dd className="font-semibold text-slate-700">
                                        {selectedInvoiceCell.month} {selectedInvoiceCell.year}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Status Invoice</dt>
                                    <dd className="font-semibold text-slate-700">
                                        {invoiceStatusLabelMap[selectedInvoiceCell.status] ?? toTitleCase(selectedInvoiceCell.status)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Kontrak Mulai</dt>
                                    <dd className="font-semibold text-slate-700">{formatDate(selectedInvoiceCell.contractStart)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Kontrak Berakhir</dt>
                                    <dd className="font-semibold text-slate-700">{formatDate(selectedInvoiceCell.contractEnd)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Core / Sharing Core</dt>
                                    <dd className="font-semibold text-slate-700">
                                        {formatCoreAllocation(selectedInvoiceCell.coreType, selectedInvoiceCell.coreTotal, selectedInvoiceCell.sharingRatio)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-on-surface-variant">Sisa Masa Sewa</dt>
                                    <dd className="font-semibold text-slate-700">
                                        {(() => {
                                            const remainingDays = getRemainingRentalDays(selectedInvoiceCell.contractEnd);

                                            if (remainingDays === null) {
                                                return "-";
                                            }

                                            if (remainingDays < 0) {
                                                return `Sudah berakhir ${Math.abs(remainingDays)} hari`;
                                            }

                                            if (remainingDays === 0) {
                                                return "Berakhir hari ini";
                                            }

                                            return `${remainingDays} hari lagi`;
                                        })()}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-4 text-xs text-on-surface-variant">
                                Monitoring bersifat non-edit. Gunakan detail pelanggan untuk meninjau data kontrak,
                                invoice, dan dokumen secara terpusat.
                            </p>

                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                                <button
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                                    onClick={() => setSelectedInvoiceCell(null)}
                                    type="button"
                                >
                                    Tutup
                                </button>
                                <button
                                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                                    onClick={() => {
                                        onOpenCustomerById(selectedInvoiceCell.customerId, "invoices");
                                        setSelectedInvoiceCell(null);
                                    }}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                    Buka Detail Pelanggan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </AppShell>
);
}

export default MonitoringSpreadsheetPage;