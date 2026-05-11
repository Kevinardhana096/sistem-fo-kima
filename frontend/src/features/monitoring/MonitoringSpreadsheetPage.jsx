import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

// --- Custom UI Components ---
const CustomSelect = ({ value, onChange, options, icon, label, variant = "default" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isSelected = value !== "all" && value !== "";
    const isCompact = variant === "compact";

    return (
        <div className={isCompact ? "relative" : "space-y-3"} ref={dropdownRef}>
            {!isCompact && <p className="text-[10px] font-black uppercase tracking-[0.3em] pl-1 text-gold-accent/40">{label}</p>}
            <div className="relative group">
                {/* Trigger */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full rounded-xl flex items-center text-[11px] font-bold cursor-pointer transition-all border relative z-20 ${isCompact
                            ? "h-[38px] px-3 pr-8 bg-white/5 border-white/10 text-white hover:bg-white/10"
                            : `h-14 pl-14 pr-12 uppercase font-black tracking-widest shadow-inner-glass ${isOpen || isSelected
                                ? "bg-gold-accent/10 border-gold-accent/60 text-gold-accent shadow-gold-glow"
                                : "bg-black/20 border-white/10 text-white/70 hover:border-white/30"
                            }`
                        }`}
                >
                    {!isCompact && icon && (
                        <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl transition-all duration-300 group-hover:scale-110" style={{ color: isOpen || isSelected ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                            {icon}
                        </span>
                    )}
                    <span className="truncate">{selectedOption.label}</span>
                    <div className={`absolute inset-y-0 right-0 flex items-center justify-center transition-colors ${isCompact ? "w-8" : "w-12 border-l border-white/5 group-hover:border-gold-accent/20"}`}>
                        <span className={`material-symbols-outlined transition-all duration-500 ${isCompact ? "text-base text-gold-accent" : "text-xl"} ${isOpen ? "rotate-180" : (isSelected ? "" : "text-white/20 group-hover:text-gold-accent")}`}>
                            expand_more
                        </span>
                    </div>
                </div>

                {/* Dropdown Menu - Deep Steel Glass Alignment (Matched with Pelanggan) */}
                {isOpen && (
                    <div className={`absolute left-0 right-0 bg-black/60 border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-top-2 duration-300 ${isCompact ? "top-[calc(100%+4px)] min-w-[200px]" : "top-[calc(100%+8px)]"}`}>
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none"></div>

                        <div className="relative p-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {options.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-5 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all mb-1 last:mb-0 flex items-center justify-between group/item ${value === opt.value
                                            ? "text-black shadow-gold-glow relative overflow-hidden"
                                            : "text-white/40 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    {value === opt.value && (
                                        <div className="absolute inset-0 bg-gold-gradient animate-shimmer"></div>
                                    )}
                                    <span className={`relative z-10 ${value === opt.value ? "italic" : ""}`}>{opt.label}</span>
                                    {value === opt.value && (
                                        <span className="material-symbols-outlined text-base relative z-10">check_circle</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function MonitoringSpreadsheetPage({
    activeSection,
    onNavigate,
    onLogout,
    ispOptions,
    currentRole = "admin",
    onOpenCustomerById,
    layout = "shell",
    showEnterTableButton = false,
    tableOnly = false,
    onOpenTableOnly,
    onCloseTableOnly,
}) {
    const isTeknisi = currentRole === "teknisi";
    const currentYear = String(new Date().getUTCFullYear());

    const [headerRow1Height, setHeaderRow1Height] = useState(0);
    const headerRow1Ref = useCallback((node) => {
        if (node !== null) {
            const updateHeight = () => {
                const height = node.getBoundingClientRect().height;
                setHeaderRow1Height(height);
            };
            updateHeight();

            if (typeof ResizeObserver !== "undefined") {
                const resizeObserver = new ResizeObserver(updateHeight);
                resizeObserver.observe(node);
                return () => resizeObserver.disconnect();
            }
        }
    }, []);

    const [filters, setFilters] = useState(() => ({
        search: "",
        year: currentYear,
        contractStatus: "all",
        routeStatus: "all",
        todoStatus: "all",
        package: "all",
    }));
    const [appliedFilters, setAppliedFilters] = useState(() => ({
        year: currentYear,
        contractStatus: "all",
        routeStatus: "all",
        todoStatus: "all",
        package: "all",
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

    const invoiceDetailModal = selectedInvoiceCell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl rounded-3xl bg-slate-900/80 backdrop-blur-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/10 overflow-hidden group">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-accent/5 blur-3xl transition-all duration-700 group-hover:bg-gold-accent/10" />

                <div className="relative mb-8 flex items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-gold-accent animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-accent/80">Invoice Detail (Read Only)</p>
                        </div>
                        <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                            {selectedInvoiceCell.customerName}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-white/40 uppercase tracking-widest">
                            {selectedInvoiceCell.ispName} <span className="mx-2 text-white/10">|</span> {selectedInvoiceCell.customerCode}
                        </p>
                    </div>
                    <button
                        className="rounded-xl bg-white/5 p-3 text-white/40 transition-all hover:bg-white/10 hover:text-white border border-white/5"
                        onClick={() => setSelectedInvoiceCell(null)}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 mb-8">
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Periode Tagihan</dt>
                        <dd className="text-sm font-black text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-gold-accent text-sm">calendar_today</span>
                            {selectedInvoiceCell.month} {selectedInvoiceCell.year}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Status Pembayaran</dt>
                        <dd className="flex items-center">
                            <span className={`rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest border transition-all ${getMonthStatusClass(selectedInvoiceCell.status)} border-opacity-30`}>
                                {invoiceStatusLabelMap[selectedInvoiceCell.status]?.toUpperCase() ?? selectedInvoiceCell.status.toUpperCase()}
                            </span>
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Kontrak Awal</dt>
                        <dd className="text-xs font-bold text-white/70">
                            {formatDate(selectedInvoiceCell.contractStart)}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Kontrak Akhir</dt>
                        <dd className="text-xs font-bold text-white/70">
                            {formatDate(selectedInvoiceCell.contractEnd)}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Paket</dt>
                        <dd className="text-xs font-bold text-white/70">
                            {toTitleCase(selectedInvoiceCell.coreType)}
                            <span className="mx-2 text-white/10">•</span>
                            {formatCoreAllocation({
                                coreType: selectedInvoiceCell.coreType,
                                coreTotal: selectedInvoiceCell.coreTotal,
                                sharingRatio: selectedInvoiceCell.sharingRatio,
                            })}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07]">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Sisa Masa Sewa</dt>
                        <dd className="text-xs font-bold text-white/70 flex items-center gap-2">
                            <span className="material-symbols-outlined text-gold-accent text-sm">timer</span>
                            {getRemainingRentalDays(selectedInvoiceCell.contractEnd)} Hari
                        </dd>
                    </div>
                </div>

                <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4 mb-8">
                    <p className="text-[11px] leading-relaxed text-amber-200/60 font-medium italic">
                        <span className="font-black not-italic text-amber-500 mr-1 uppercase">Catatan:</span>
                        Monitoring ini bersifat informatif. Gunakan Detail Lokasi untuk meninjau data kontrak, invoice, dan dokumen secara terpusat.
                    </p>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                    <button
                        className="rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white/40 transition-all hover:text-white hover:bg-white/5"
                        onClick={() => setSelectedInvoiceCell(null)}
                        type="button"
                    >
                        Tutup
                    </button>
                    <button
                        className="inline-flex items-center gap-2 rounded-xl bg-gold-accent px-6 py-3 text-xs font-black uppercase tracking-widest text-[#05080a] shadow-lg shadow-gold-accent/20 transition-all hover:scale-[1.02] hover:shadow-gold-accent/40 active:scale-[0.98]"
                        onClick={() => {
                            onOpenCustomerById(selectedInvoiceCell.customerId, "invoices");
                            setSelectedInvoiceCell(null);
                        }}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Buka Detail Lokasi
                    </button>
                </div>
            </div>
        </div>
    );

    useEffect(() => {
        if (typeof document === "undefined") {
            return undefined;
        }

        const root = document.documentElement;
        const body = document.body;
        const previous = {
            rootOverflow: root.style.overflow,
            rootOverflowX: root.style.overflowX,
            bodyOverflow: body.style.overflow,
            bodyOverflowX: body.style.overflowX,
        };

        if (tableOnly) {
            // Table-only mode: disable outer page scrolling, scroll happens inside the table container.
            root.style.overflow = "hidden";
            body.style.overflow = "hidden";
        } else {
            // Default: prevent horizontal scroll on the entire page just for this feature.
            root.style.overflowX = "hidden";
            body.style.overflowX = "hidden";
        }

        return () => {
            root.style.overflow = previous.rootOverflow;
            root.style.overflowX = previous.rootOverflowX;
            body.style.overflow = previous.bodyOverflow;
            body.style.overflowX = previous.bodyOverflowX;
        };
    }, [tableOnly]);

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
                .filter((activity) => {
                    const technicalKeywords = ["jalur", "peta", "route", "core", "gangguan", "aktivasi", "survey", "titik", "pop"];
                    const haystack = (activity.title + " " + activity.description).toLowerCase();
                    return technicalKeywords.some((keyword) => haystack.includes(keyword));
                })
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
        const todayIso = new Date().toISOString().slice(0, 10);
        const alertCustomerIds = new Set(alerts.map(a => a.customerId));

        return billingRows.filter((row) => {
            // 1. Search Filter (ISP or Location)
            const searchableText = [
                row.customerName,
                row.ispName,
                row.customerCode,
            ].filter(Boolean).join(" ").toLowerCase();
            const matchesSearch = !loweredSearch || searchableText.includes(loweredSearch);

            // 2. Status Kontrak Filter
            const remainingDays = getRemainingRentalDays(row.contractEnd);
            let contractStatusKey = "beroperasi";
            if (row.customerStatus === "nonaktif") {
                contractStatusKey = "berhenti";
            } else if (remainingDays !== null && remainingDays < 0) {
                contractStatusKey = "expired";
            }
            const matchesContract = filters.contractStatus === "all" ? true : contractStatusKey === filters.contractStatus;

            // 3. Status Jalur Filter
            const tenantRouteStatus = String(row.routeStatus || "aktif").trim().toLowerCase();
            const matchesRoute = filters.routeStatus === "all" ? true : tenantRouteStatus === filters.routeStatus;

            // 4. Status Tindakan Filter
            const hasAlert = alertCustomerIds.has(row.customerId);
            const todoStatusKey = hasAlert ? "perlu_tindakan" : "tidak_ada";
            const matchesTodo = filters.todoStatus === "all" ? true : todoStatusKey === filters.todoStatus;

            // 5. Paket Filter
            const rowPackage = row.paket || row.coreType;
            const matchesPackage = filters.package === "all" ? true : rowPackage === filters.package;

            return matchesSearch && matchesContract && matchesRoute && matchesTodo && matchesPackage;
        });
    }, [billingRows, filters.search, filters.contractStatus, filters.routeStatus, filters.todoStatus, filters.package, alerts]);

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

    const routeSummary = useMemo(() => {
        const summary = { aktif: 0, gangguan: 0, perbaikan: 0 };
        billingRows.forEach((row) => {
            if (row.routeStatus === "gangguan") {
                summary.gangguan++;
            } else if (row.routeStatus === "perbaikan" || row.routeStatus === "maintenance") {
                summary.perbaikan++;
            } else {
                summary.aktif++;
            }
        });
        return summary;
    }, [billingRows]);

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
        const combined = [];

        billingRows.forEach((row) => {
            if (row.routeStatus === "gangguan") {
                combined.push({
                    customerId: row.customerId,
                    customerName: row.customerName,
                    code: "route_gangguan",
                    message: "Jalur sedang gangguan, butuh penanganan segera.",
                    actionLabel: "Buka & Perbaiki Jalur",
                    targetTab: "jalur",
                });
            }

            if (!row.routeStatus && row.customerStatus === "aktif") {
                combined.push({
                    customerId: row.customerId,
                    customerName: row.customerName,
                    code: "missing_jalur",
                    message: "Data jalur belum lengkap, segera input jalur.",
                    actionLabel: "Buka & Input Jalur",
                    targetTab: "jalur",
                });
            }
        });

        alerts.forEach((alert) => {
            combined.push({
                customerId: alert.customerId,
                customerName: alert.customerName,
                code: alert.code,
                message: alert.message,
                actionLabel: "Tindak Lanjuti",
                targetTab: alert.code.includes("invoice") ? "invoices" : "overview",
            });
        });

        return combined.slice(0, 15);
    }, [billingRows, alerts]);

    const yearOptions = [
        String(Number(currentYear) - 1),
        currentYear,
        String(Number(currentYear) + 1),
    ];

    const availablePackages = useMemo(() => {
        const pkts = billingRows
            .map(t => t.paket || t.coreType)
            .filter(Boolean);
        return [...new Set(pkts)].sort();
    }, [billingRows]);

    const exportToExcel = () => {
        if (filteredRows.length === 0) return;

        const headers = [
            "No", "Nama ISP", "Nama Pelanggan", "Periode Awal", "Berjalan Awal", "Berjalan Akhir",
            "Paket", "Jumlah",
            ...(isTeknisi ? [] : ["No. Kontrak", "No. Invoice"]),
            "Sisa Sewa", "Status Kontrak", "Status Jalur",
            ...(isTeknisi ? [] : ["Aktivasi", ...monitoringMonths])
        ];

        const csvRows = filteredRows.map((row, index) => {
            const monthsData = isTeknisi ? [] : monitoringMonths.map((_, i) => {
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
                ...(isTeknisi ? [] : [row.contractNumber ?? "-", row.currentInvoiceNumber ?? "-"]),
                getRemainingRentalDays(row.contractEnd) ?? "-",
                row.customerStatus === "nonaktif" ? "Berhenti" : "Beroperasi",
                row.routeStatus || "aktif",
                ...(isTeknisi ? [] : [row.activationFeePaidAt ? "Selesai" : formatCurrency(row.activationFeeAmount), ...monthsData])
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

    const handleEnterTable = useCallback(() => {
        const el = document.getElementById("monitoring-table");
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, []);

    const tableSection = (
        <section
            className={`glass-card rounded-premium border-white/40 overflow-hidden shadow-glass-depth max-w-full ${tableOnly ? "flex h-full flex-col" : ""}`}
            id="monitoring-table"
        >
            <div className={`max-w-full overflow-auto custom-scrollbar ${tableOnly ? "flex-1 min-h-0" : ""}`}>
                <table className="w-full min-w-[2400px] table-fixed border-separate border-spacing-0 text-[13px]">
                    <colgroup>
                        <col style={{ width: "64px" }} />
                        <col style={{ width: "160px" }} />
                        <col style={{ width: "240px" }} />
                        <col style={{ width: "200px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "150px" }} />
                        <col style={{ width: "100px" }} />
                        {!isTeknisi && (
                            <>
                                <col style={{ width: "180px" }} />
                                <col style={{ width: "180px" }} />
                            </>
                        )}
                        <col style={{ width: "180px" }} />
                        <col style={{ width: "240px" }} />
                        <col style={{ width: "180px" }} />
                        {!isTeknisi && <col style={{ width: "200px" }} />}
                        {!isTeknisi && monitoringMonths.map((month) => (
                            <col key={`month-${month}`} style={{ width: "48px" }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th rowSpan="2" className="sticky left-0 top-0 z-[100] w-[64px] pl-2 pr-0 py-5 text-center font-black uppercase tracking-widest text-gold-accent bg-[#1e293b]/95 border-b border-white/10 shadow-lg backdrop-blur-3xl">
                                NO
                            </th>
                            <th rowSpan="2" className="sticky left-[64px] top-0 z-[100] -ml-px w-[160px] pl-0 pr-0 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-white/10 shadow-lg backdrop-blur-3xl">
                                MITRA ISP
                            </th>
                            <th rowSpan="2" className="sticky left-[224px] top-0 z-[100] -ml-px w-[240px] pl-0 pr-2 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-white/10 shadow-lg backdrop-blur-3xl">
                                UNIT LOKASI
                                <span className="absolute right-0 top-0 h-full w-px bg-white/5" />
                            </th>
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[200px] px-4 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                PERIODE AWAL
                            </th>
                            <th ref={headerRow1Ref} colSpan="2" className="sticky top-0 z-[90] px-4 py-4 text-center font-black uppercase tracking-widest text-gold-accent bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                PERIODE BERJALAN
                            </th>
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[150px] px-4 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                PAKET
                            </th>
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[100px] px-4 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                JUMLAH
                            </th>
                            {!isTeknisi && (
                                <>
                                    <th rowSpan="2" className="sticky top-0 z-[90] w-[180px] px-4 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                        NO. KONTRAK
                                    </th>
                                    <th rowSpan="2" className="sticky top-0 z-[90] w-[180px] px-4 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                        NO. INVOICE
                                    </th>
                                </>
                            )}
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[180px] px-6 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                SISA SEWA
                            </th>
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[240px] px-6 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                ST. KONTRAK
                            </th>
                            <th rowSpan="2" className="sticky top-0 z-[90] w-[180px] px-6 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                ST. JALUR
                            </th>
                            {!isTeknisi && (
                                <>
                                    <th rowSpan="2" className="sticky top-0 z-[90] w-[200px] px-6 py-5 text-center font-black uppercase tracking-widest text-white bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl">
                                        AKTIVASI
                                    </th>
                                    <th colSpan="12" className="sticky top-0 z-[90] px-6 py-4 text-center font-black uppercase tracking-widest text-gold-accent bg-[#1e293b]/95 border-b border-r border-white/10 shadow-lg backdrop-blur-3xl">
                                        MONITORING BILLING {appliedFilters.year}
                                    </th>
                                </>
                            )}
                        </tr>
                        <tr>
                            <th
                                className="sticky z-[80] w-[120px] px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-white/40 bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl shadow-md"
                                style={{ top: `${headerRow1Height}px` }}
                            >
                                AWAL
                            </th>
                            <th
                                className="sticky z-[80] w-[120px] px-4 py-3 text-center font-black text-[10px] uppercase tracking-widest text-white/40 bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl shadow-md"
                                style={{ top: `${headerRow1Height}px` }}
                            >
                                AKHIR
                            </th>
                            {!isTeknisi && monitoringMonths.map((month) => (
                                <th
                                    key={`month-header-${month}`}
                                    className="sticky z-[80] w-12 px-2 py-3 text-center font-black text-[10px] uppercase tracking-widest text-white/40 bg-[#1e293b]/95 border-b border-r border-white/10 backdrop-blur-3xl shadow-md"
                                    style={{ top: `${headerRow1Height}px` }}
                                >
                                    {month}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-white/5">
                        {isLoading && (
                            <tr>
                                <td className="px-6 py-20 text-center text-sm font-bold text-white/40 italic" colSpan="27">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-10 w-10 border-4 border-gold-accent border-t-transparent rounded-full animate-spin"></div>
                                        <span>Sinkronisasi data monitoring dari pusat...</span>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!isLoading && filteredRows.length === 0 && (
                            <tr>
                                <td className="px-6 py-32 text-center" colSpan="27">
                                    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                        {/* Icon Container with Glow */}
                                        <div className="relative mb-8">
                                            <div className="absolute inset-0 scale-150 bg-gold-accent/10 blur-[50px] rounded-full" />
                                            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl">
                                                <span className="material-symbols-outlined text-6xl text-gold-accent/40">data_alert</span>
                                            </div>
                                        </div>

                                        {/* Text Section */}
                                        <div className="max-w-md mx-auto">
                                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-8">Data Tidak Ditemukan</h3>

                                            {/* Action Button */}
                                            <button
                                                className="inline-flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/10 hover:border-gold-accent/30 hover:text-gold-accent shadow-xl group"
                                                onClick={() => {
                                                    setFilters({ search: "", year: currentYear, isp: "", status: "" });
                                                    setAppliedFilters({ year: currentYear, isp: "", status: "" });
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-500">restart_alt</span>
                                                Reset Semua Filter
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!isLoading && filteredRows.map((row, rowIndex) => (
                            <tr key={`${row.customerId}-${rowIndex}`} className="bg-[#0f172a]/40 transition-all group hover:bg-[#1e293b]/60">
                                <td className="relative sticky left-0 z-20 w-[64px] pl-2 pr-0 py-5 font-black text-white/30 text-center bg-[#0f172a]/65 backdrop-blur-sm group-hover:!bg-[#0f1117] group-hover:!backdrop-blur-none group-hover:text-gold-accent transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.3)] group-hover:border-l-4 group-hover:border-l-gold-accent">
                                    {String(rowIndex + 1).padStart(2, "0")}
                                </td>
                                <td className="relative sticky left-[64px] z-20 -ml-px w-[160px] pl-0 pr-0 py-5 font-black text-white bg-[#0f172a]/65 backdrop-blur-sm group-hover:!bg-[#0f1117] group-hover:!backdrop-blur-none transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.3)]">
                                    {row.ispName}
                                </td>
                                <td className="relative sticky left-[224px] z-20 -ml-px w-[240px] pl-0 pr-2 py-5 bg-[#0f172a]/65 backdrop-blur-sm group-hover:!bg-[#0f1117] group-hover:!backdrop-blur-none transition-colors shadow-[4px_0_15px_rgba(0,0,0,0.4)]">
                                    <p className="font-black text-on-surface truncate max-w-[200px] tracking-tight group-hover:text-gold-accent transition-colors">{row.customerName}</p>
                                    <button
                                        className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-accent hover:text-white transition-colors"
                                        onClick={() => onOpenCustomerById(row.customerId, "overview")}
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                        Detail Unit
                                    </button>
                                    <span className="absolute right-0 top-0 h-full w-px bg-white/10" />
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold text-center group-hover:bg-white/5 transition-colors border-r border-white/5">
                                    {formatDate(row.ispContractStart)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold group-hover:bg-white/5 transition-colors border-r border-white/5">
                                    {formatDate(row.contractStart)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold group-hover:bg-white/5 transition-colors border-r border-white/5">
                                    {formatDate(row.contractEnd)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-black tracking-tight transition-colors group-hover:bg-white/5 border-r border-white/5 text-center">
                                    {toTitleCase(row.coreType)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-black text-center transition-colors group-hover:bg-white/5 border-r border-white/5">
                                    {row.coreTotal ?? "-"}
                                </td>
                                {!isTeknisi && (
                                    <>
                                        <td className="px-4 py-5 text-on-surface-variant font-mono text-[11px] font-bold transition-colors group-hover:bg-white/5 border-r border-white/5">
                                            {row.contractNumber ?? "-"}
                                        </td>
                                        <td className="px-4 py-5 text-on-surface-variant font-mono text-[11px] font-bold transition-colors group-hover:bg-white/5 border-r border-white/5">
                                            {row.currentInvoiceNumber ?? "-"}
                                        </td>
                                    </>
                                )}
                                <td className="px-6 py-5 whitespace-nowrap transition-colors group-hover:bg-white/5 border-r border-white/5 text-center">
                                    {(() => {
                                        const remainingDays = getRemainingRentalDays(row.contractEnd);

                                        if (remainingDays === null) {
                                            return <span className="text-on-surface-variant opacity-30">-</span>;
                                        }

                                        if (remainingDays < 0) {
                                            return <span className="font-black text-rose-500 uppercase text-[10px] tracking-widest flex items-center gap-1 justify-center"><span className="material-symbols-outlined text-sm">error</span> {Math.abs(remainingDays)} hari</span>;
                                        }

                                        if (remainingDays === 0) {
                                            return <span className="font-black text-amber-500 uppercase text-[10px] tracking-widest flex items-center gap-1 justify-center"><span className="material-symbols-outlined text-sm">warning</span> Akhir hari ini</span>;
                                        }

                                        const colorClass = remainingDays < 30 ? "text-amber-400" : "text-emerald-400";
                                        return <span className={`font-black ${colorClass} uppercase text-[10px] tracking-widest flex items-center gap-1 justify-center`}><span className="material-symbols-outlined text-sm">schedule</span> {remainingDays} hari</span>;
                                    })()}
                                </td>
                                <td className="px-6 py-5 text-center transition-colors group-hover:bg-white/5 border-r border-white/5">
                                    {(() => {
                                        const remainingDays = getRemainingRentalDays(row.contractEnd);
                                        let label = "BEROPERASI";
                                        let style = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-glow/5";

                                        if (row.customerStatus === "nonaktif") {
                                            label = "BERHENTI";
                                            style = "bg-white/5 text-white/40 border-white/10";
                                        } else if (remainingDays !== null && remainingDays < 0) {
                                            label = "BELUM DIPERPANJANG";
                                            style = "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-glow/5";
                                        }

                                        return (
                                            <span className={`rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest border transition-all ${style} whitespace-nowrap`}>
                                                {label}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="px-6 py-5 text-center transition-colors group-hover:bg-white/5 border-r border-white/5">
                                    {(() => {
                                        const statusValue = (row.routeStatus ?? "aktif").toLowerCase();
                                        const label = statusValue === "perbaikan" || statusValue === "sedang perbaikan" ? "PERBAIKAN" : statusValue.toUpperCase();
                                        const style = {
                                            aktif: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-glow/5",
                                            nonaktif: "bg-white/5 text-white/40 border-white/10",
                                            gangguan: "bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-glow/10 animate-pulse",
                                            perbaikan: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-glow/5",
                                            "sedang perbaikan": "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-glow/5",
                                        }[statusValue] ?? "bg-white/5 text-white/40 border-white/10";

                                        return (
                                            <span className={`rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest border transition-all ${style} whitespace-nowrap`}>
                                                {label}
                                            </span>
                                        );
                                    })()}
                                </td>
                                {!isTeknisi && (
                                    <>
                                        <td className="px-6 py-5 transition-colors group-hover:bg-white/5 border-r border-white/5 text-center">
                                            {row.activationFeePaidAt ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="inline-flex rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[9px] font-black text-emerald-500 tracking-widest uppercase">
                                                        SELESAI
                                                    </span>
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter text-center">{formatDate(row.activationFeePaidAt)}</p>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] font-black text-rose-400 tracking-tighter whitespace-nowrap block text-center">
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
                                                    key={`${row.customerId}-${month}-cell`}
                                                    className="p-0 transition-colors group-hover:bg-white/5 border-r border-white/5"
                                                >
                                                    <button
                                                        className={`h-10 w-full transition-all hover:scale-110 hover:z-10 relative hover:shadow-lg ${getMonthStatusClass(status)}`}
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
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!tableOnly && (
                <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/10 bg-[#0f141e]/50 px-10 py-6 backdrop-blur-md">
                    <div className="flex items-center gap-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            ISP: <span className="text-gold-accent ml-2">{ispOptions.length}</span>
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            LOKASI: <span className="text-gold-accent ml-2">{filteredRows.length}</span>
                        </p>
                    </div>
                </div>
            )}
        </section>
    );

    if (tableOnly) {
        const tableOnlyContent = (
            <div className="h-full min-h-0 w-full flex flex-col gap-5 p-2">
                {typeof onCloseTableOnly === "function" && (
                    <div className="shrink-0 flex items-center justify-between gap-6 px-2">
                        <div className="flex items-center gap-4">
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
                                onClick={onCloseTableOnly}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-sm text-gold-accent">arrow_back</span>
                                Kembali
                            </button>
                            <div className="h-8 w-px bg-white/10 mx-2" />
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <span className="material-symbols-outlined text-gold-accent">fullscreen</span>
                                Monitoring <span className="text-gold-accent italic">Fokus</span>
                            </h2>
                        </div>

                        {/* Quick Filters for Focus Mode */}
                        <div className="flex-1 flex flex-wrap items-center gap-3">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[180px] group">
                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-white/30 group-focus-within:text-gold-accent transition-colors">search</span>
                                <input
                                    className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-3 text-[11px] font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-white/10 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5"
                                    onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                                    placeholder="Cari ISP atau Lokasi..."
                                    type="text"
                                    value={filters.search}
                                />
                            </div>

                            <div className="w-36">
                                <CustomSelect
                                    variant="compact"
                                    value={filters.contractStatus}
                                    onChange={(val) => setFilters(p => ({ ...p, contractStatus: val }))}
                                    options={[
                                        { label: "Semua Status", value: "all" },
                                        { label: "Beroperasi", value: "beroperasi" },
                                        { label: "Belum Diperpanjang", value: "expired" },
                                        { label: "Berhenti", value: "berhenti" },
                                    ]}
                                />
                            </div>

                            <div className="w-36">
                                <CustomSelect
                                    variant="compact"
                                    value={filters.routeStatus}
                                    onChange={(val) => setFilters(p => ({ ...p, routeStatus: val }))}
                                    options={[
                                        { label: "Semua Jalur", value: "all" },
                                        { label: "Aktif", value: "aktif" },
                                        { label: "Nonaktif", value: "nonaktif" },
                                        { label: "Gangguan", value: "gangguan" },
                                        { label: "Perbaikan", value: "perbaikan" },
                                    ]}
                                />
                            </div>

                            {!isTeknisi && (
                                <div className="w-36">
                                    <CustomSelect
                                        variant="compact"
                                        value={filters.todoStatus}
                                        onChange={(val) => setFilters(p => ({ ...p, todoStatus: val }))}
                                        options={[
                                            { label: "Semua Tindakan", value: "all" },
                                            { label: "Perlu Tindakan", value: "perlu_tindakan" },
                                            { label: "Tidak Perlu", value: "tidak_ada" },
                                        ]}
                                    />
                                </div>
                            )}

                            <div className="w-36">
                                <CustomSelect
                                    variant="compact"
                                    value={filters.package}
                                    onChange={(val) => setFilters(p => ({ ...p, package: val }))}
                                    options={[
                                        { label: "Semua Paket", value: "all" },
                                        ...availablePackages.map(pkg => ({ label: String(pkg).toUpperCase(), value: pkg }))
                                    ]}
                                />
                            </div>

                            <div className="w-28">
                                <CustomSelect
                                    variant="compact"
                                    value={filters.year}
                                    onChange={(val) => setFilters(p => ({ ...p, year: val }))}
                                    options={yearOptions.map(y => ({ label: y, value: y }))}
                                />
                            </div>

                            <button
                                className="h-[44px] w-[44px] rounded-xl btn-premium shadow-gold-glow flex items-center justify-center active:scale-95 transition-transform shrink-0"
                                onClick={() => setAppliedFilters({
                                    year: filters.year,
                                    contractStatus: filters.contractStatus,
                                    routeStatus: filters.routeStatus,
                                    todoStatus: filters.todoStatus,
                                    package: filters.package,
                                })}
                                title="Update Data"
                            >
                                <span className="material-symbols-outlined text-sm">sync_alt</span>
                            </button>

                            <button
                                className="h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 active:scale-95 transition-transform shrink-0 hover:bg-white/10 group"
                                onClick={() => {
                                    const reset = {
                                        search: "",
                                        year: currentYear,
                                        contractStatus: "all",
                                        routeStatus: "all",
                                        todoStatus: "all",
                                        package: "all"
                                    };
                                    setFilters(reset);
                                    setAppliedFilters({
                                        year: currentYear,
                                        contractStatus: "all",
                                        routeStatus: "all",
                                        todoStatus: "all",
                                        package: "all"
                                    });
                                }}
                            >
                                <span className="material-symbols-outlined text-sm text-white/40 group-hover:text-white transition-colors">restart_alt</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Reset</span>
                            </button>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="shrink-0 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-6 py-4 text-sm font-bold text-rose-400 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined">warning</span>
                            {error}
                        </div>
                    </div>
                )}
                <div className="flex-1 min-h-0">
                    {tableSection}
                </div>
                {invoiceDetailModal}
            </div>
        );

        if (layout === "plain") {
            return (
                <main className="relative h-screen overflow-hidden p-3 text-on-surface">
                    <div id="bg-image-layer" />
                    <div id="bg-glass-overlay" />
                    <div className="mesh-glow" />
                    <div className="relative z-10 h-full">
                        {tableOnlyContent}
                    </div>
                </main>
            );
        }

        return (
            <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
                <div className="relative z-10">
                    {tableOnlyContent}
                </div>
            </AppShell>
        );
    }

    const content = (
        <div className="w-full overflow-x-hidden">
            <div className="space-y-6 pb-20 pt-2 md:pt-4">

                {/* Premium Header Section */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="h-[2px] w-8 bg-gold-accent shadow-gold-glow"></span>
                            <p className="text-[10px] font-black text-gold-accent uppercase tracking-[0.4em]">Mesin Analitik</p>
                        </div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-on-surface tracking-tight leading-tight">
                            Monitoring <span className="text-gold-accent italic">Operasional</span>
                        </h1>
                        <p className="mt-4 text-sm font-medium text-on-surface-variant max-w-2xl leading-relaxed opacity-80">
                            Pusat kendali informasi operasional, prioritas aksi, dan matriks billing pelanggan.
                            Gunakan mode spreadsheet untuk pemantauan mendalam.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {showEnterTableButton && (
                            <button
                                className="btn-premium px-6 py-3 flex items-center gap-2"
                                onClick={handleEnterTable}
                            >
                                <span className="material-symbols-outlined text-xl">table_chart</span>
                                <span className="text-[11px] font-black uppercase tracking-widest">Masuk ke Tabel</span>
                            </button>
                        )}
                        {typeof onOpenTableOnly === "function" && (
                            <button
                                className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-on-surface px-5 py-3 rounded-xl transition-all flex items-center gap-2"
                                onClick={onOpenTableOnly}
                            >
                                <span className="material-symbols-outlined text-xl">fullscreen</span>
                                <span className="text-[11px] font-black uppercase tracking-widest">Mode Fokus</span>
                            </button>
                        )}
                        <button
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 px-5 py-3 rounded-xl transition-all flex items-center gap-2"
                            onClick={exportToExcel}
                        >
                            <span className="material-symbols-outlined text-xl text-emerald-500">download_for_offline</span>
                            <span className="text-[11px] font-black uppercase tracking-widest">Ekspor Excel</span>
                        </button>
                        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/15 backdrop-blur-md">
                            <button
                                onClick={() => loadMonitoring()}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all ${isLoading ? "bg-white/10 text-gold-accent" : "btn-premium"}`}
                                disabled={isLoading}
                            >
                                <span className={`material-symbols-outlined text-xl ${isLoading ? "animate-spin" : ""}`}>sync</span>
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}



                {/* Premium Filter Section */}
                <section className="glass-card rounded-premium p-8 border-white/40 shadow-glass-depth relative z-[40] !overflow-visible">
                    <div className="flex flex-col gap-6 mb-6">
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Filter Tabel Monitoring</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Search Input - Now inside card */}
                            <div className="relative group flex-grow">
                                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-xl text-white/30 group-focus-within:text-gold-accent transition-all duration-300">search</span>
                                <input
                                    className="w-full h-14 rounded-2xl bg-black/20 border border-white/10 pl-14 pr-6 text-sm font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5 shadow-inner-glass"
                                    onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                                    placeholder="Cari ISP atau Lokasi..."
                                    type="text"
                                    value={filters.search}
                                />
                            </div>

                            <button
                                className="h-14 bg-white/5 hover:bg-white/10 text-on-surface-variant px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/10 hover:border-white/20 active:scale-95 flex items-center gap-2"
                                onClick={() => {
                                    setFilters({
                                        search: "",
                                        year: currentYear,
                                        contractStatus: "all",
                                        routeStatus: "all",
                                        todoStatus: "all",
                                        package: "all"
                                    });
                                    setAppliedFilters({
                                        year: currentYear,
                                        contractStatus: "all",
                                        routeStatus: "all",
                                        todoStatus: "all",
                                        package: "all"
                                    });
                                }}
                            >
                                <span className="material-symbols-outlined text-base">restart_alt</span>
                                Reset
                            </button>

                            <button
                                className="h-14 btn-premium px-8 rounded-2xl shadow-gold-glow active:scale-95 transition-transform flex items-center gap-2"
                                onClick={() => setAppliedFilters({
                                    year: filters.year,
                                    contractStatus: filters.contractStatus,
                                    routeStatus: filters.routeStatus,
                                    todoStatus: filters.todoStatus,
                                    package: filters.package,
                                })}
                            >
                                <span className="material-symbols-outlined text-base">sync_alt</span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Terapkan</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <CustomSelect
                            icon="description"
                            label="Status Kontrak"
                            onChange={(val) => setFilters(p => ({ ...p, contractStatus: val }))}
                            options={[
                                { label: "Semua Status", value: "all" },
                                { label: "Beroperasi", value: "beroperasi" },
                                { label: "Belum Diperpanjang", value: "expired" },
                                { label: "Berhenti", value: "berhenti" },
                            ]}
                            value={filters.contractStatus}
                        />

                        <CustomSelect
                            icon="lan"
                            label="Status Jalur"
                            onChange={(val) => setFilters(p => ({ ...p, routeStatus: val }))}
                            options={[
                                { label: "Semua Jalur", value: "all" },
                                { label: "Aktif", value: "aktif" },
                                { label: "Nonaktif", value: "nonaktif" },
                                { label: "Gangguan", value: "gangguan" },
                                { label: "Perbaikan", value: "perbaikan" },
                            ]}
                            value={filters.routeStatus}
                        />

                        {!isTeknisi && (
                            <CustomSelect
                                icon="task_alt"
                                label="Status Tindakan"
                                onChange={(val) => setFilters(p => ({ ...p, todoStatus: val }))}
                                options={[
                                    { label: "Semua Tindakan", value: "all" },
                                    { label: "Perlu Tindakan", value: "perlu_tindakan" },
                                    { label: "Tidak Perlu", value: "tidak_ada" },
                                ]}
                                value={filters.todoStatus}
                            />
                        )}

                        <CustomSelect
                            icon="inventory_2"
                            label="Paket"
                            onChange={(val) => setFilters(p => ({ ...p, package: val }))}
                            options={[
                                { label: "Semua Paket", value: "all" },
                                ...availablePackages.map(pkg => ({ label: String(pkg).toUpperCase(), value: pkg }))
                            ]}
                            value={filters.package}
                        />

                        <CustomSelect
                            icon="calendar_month"
                            label="Periode Tahun"
                            onChange={(val) => setFilters(p => ({ ...p, year: val }))}
                            options={yearOptions.map(y => ({ label: y, value: y }))}
                            value={filters.year}
                        />
                    </div>

                    {/* Result Indicators - Matched with Pelanggan */}
                    <div className="mt-6 flex flex-wrap items-center gap-4 pt-6 border-t border-white/5">
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 shadow-sm">
                            <span className="material-symbols-outlined text-lg text-gold-accent">location_on</span>
                            <span><span className="text-white font-black">{filteredRows.length}</span> Lokasi Terpilih</span>
                        </div>
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 shadow-sm">
                            <span className="material-symbols-outlined text-lg text-gold-accent">hub</span>
                            <span><span className="text-white font-black">{new Set(filteredRows.map(r => r.ispName)).size}</span> ISP Terkait</span>
                        </div>
                        {!isTeknisi && (
                            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest shadow-sm transition-all duration-500 ${filteredRows.filter(r => new Set(alerts.map(a => a.customerId)).has(r.customerId)).length > 0 ? "bg-gold-accent/10 border-gold-accent/20 text-gold-accent shadow-gold-glow animate-pulse" : "bg-white/5 border-white/10 text-white/20"}`}>
                                <span className="material-symbols-outlined text-lg">warning</span>
                                <span>({filteredRows.filter(r => new Set(alerts.map(a => a.customerId)).has(r.customerId)).length}) Butuh Perhatian</span>
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-premium glass-premium p-6 border-white/30">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#00c853] shadow-[0_0_12px_rgba(0,200,83,0.4)]"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/60">Lunas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ff2400] shadow-[0_0_12px_rgba(255,36,0,0.4)]"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/60">Belum Bayar</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#ffab00] shadow-[0_0_12px_rgba(255,171,0,0.4)]"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/60">Terlambat</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-white/10 border border-white/10"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/60">Belum Ditagih</span>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-on-surface-variant leading-relaxed opacity-60 uppercase tracking-widest">
                            <span className="material-symbols-outlined text-xs">touch_app</span>
                            Klik sel bulanan untuk detail
                        </span>
                    </div>
                </section>

                {tableSection}

                {/* KPI Section moved to bottom */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <StatCard
                        label="Jaringan Mitra"
                        value={ispOptions.length}
                        icon="hub"
                        accent="gold"
                        sub="Mitra ISP Terintegrasi"
                    />
                    <StatCard
                        label="Total Lokasi"
                        value={billingRows.length}
                        icon="groups"
                        accent="gold"
                        sub="Unit Lokasi Terdata"
                    />
                    <StatCard
                        label={isTeknisi ? "Anomali Jalur" : "Perlu Tindakan"}
                        value={isTeknisi
                            ? billingRows.filter(r => r.routeStatus === "gangguan" || (!r.routeStatus && r.customerStatus === "aktif")).length
                            : uniqueAlertCustomers
                        }
                        icon="warning"
                        accent={hasIssues ? "rose" : "gold"}
                        sub="Prioritas Penanganan"
                    />
                </section>

                {/* Consolidated Detailed Overview moved to bottom */}
                <section className="grid grid-cols-1">
                    <div className="glass-card rounded-premium p-8 border-white/40 shadow-glass-depth">
                        <div className="flex flex-col lg:flex-row gap-10">
                            {/* Left: Billing Overview */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-8">
                                    <span className="h-6 w-1.5 bg-emerald-500 rounded-full shadow-emerald-glow"></span>
                                    <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Ringkasan Status Jalur</h2>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Indeks Keamanan Jalur</span>
                                            <span className="text-xs font-black text-emerald-500">{Math.round((routeSummary.aktif / (billingRows.length || 1)) * 100)}%</span>
                                        </div>
                                        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-emerald-glow"
                                                style={{ width: `${(routeSummary.aktif / (billingRows.length || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-emerald-500/30 transition-colors">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Aktif / Aman</p>
                                            <p className="text-2xl font-black text-emerald-500">{routeSummary.aktif}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-rose-500/30 transition-colors">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Gangguan</p>
                                            <p className="text-2xl font-black text-rose-500">{routeSummary.gangguan}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-amber-500/30 transition-colors">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Perbaikan</p>
                                            <p className="text-2xl font-black text-amber-500">{routeSummary.perbaikan}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider for Desktop */}
                            <div className="hidden lg:block w-px bg-white/10 self-stretch"></div>

                            {/* Right: Anomaly & Action Details */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <span className="h-6 w-1.5 bg-rose-500 rounded-full shadow-rose-glow"></span>
                                        <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Ringkasan Tindak Lanjut</h2>
                                    </div>
                                    <div className="px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{totalAlerts} ALERT AKTIF</span>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em]">Kelengkapan Administrasi</span>
                                        <span className="text-xs font-black text-rose-400">{Math.round(((billingRows.length - uniqueAlertCustomers) / (billingRows.length || 1)) * 100)}%</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
                                        <div
                                            className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full shadow-rose-glow transition-all duration-700"
                                            style={{ width: `${((billingRows.length - uniqueAlertCustomers) / (billingRows.length || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                                    {[
                                        { label: "Kontrak Belum Input", count: issueCounts.missingContract, icon: "description", color: "text-rose-400" },
                                        { label: "Invoice Belum Upload", count: issueCounts.missingInvoice, icon: "receipt_long", color: "text-amber-400" },
                                        { label: "Kontrak Segera Habis", count: issueCounts.contractExpiring, icon: "event_busy", color: "text-rose-400" },
                                        { label: "Aktivasi Outstanding", count: issueCounts.activationFee, icon: "payments", color: "text-rose-400" },
                                        { label: "Dokumen Blm Lengkap", count: issueCounts.terminationDoc, icon: "folder_off", color: "text-white/40" }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between group/metric py-1 border-b border-white/5 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <span className={`material-symbols-outlined text-lg ${item.count > 0 ? item.color : "text-white/10"}`}>{item.icon}</span>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${item.count > 0 ? "text-on-surface" : "text-on-surface/30"}`}>{item.label}</span>
                                            </div>
                                            <span className={`text-sm font-black ${item.count > 0 ? item.color : "text-white/5"}`}>{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Perlu Tindak Lanjut moved to bottom */}
                {(isTeknisi || hasIssues) && (
                    <section className="glass-card rounded-premium p-8 group border-white/40 shadow-glass-depth">
                        <div className="mb-8 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="h-6 w-1.5 bg-rose-500 rounded-full shadow-rose-glow"></span>
                                <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Perlu Tindak Lanjut</h2>
                            </div>
                            <span className="px-4 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase tracking-widest border border-rose-500/20 shadow-sm">
                                {actionNeededToday.length} MASALAH AKTIF
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {actionNeededToday.length === 0 && (
                                <p className="col-span-full py-10 text-center text-sm font-medium text-on-surface-variant italic opacity-50">
                                    Tidak ada prioritas aksi untuk saat ini.
                                </p>
                            )}

                            {actionNeededToday.map((item, index) => (
                                <div
                                    key={`${item.customerId}-${item.code}-${index}`}
                                    className="flex flex-col justify-between p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/12 hover:border-white/20 transition-all hover:scale-[1.02] group/item"
                                >
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-black text-gold-accent uppercase tracking-widest">{item.code.replace(/_/g, ' ')}</p>
                                            <span className="material-symbols-outlined text-rose-500 text-sm animate-pulse">emergency</span>
                                        </div>
                                        <h3 className="text-sm font-black text-on-surface leading-tight group-hover/item:text-gold-accent transition-colors truncate">{item.customerName ?? `Pelanggan #${item.customerId}`}</h3>
                                        <p className="mt-2 text-xs font-medium text-on-surface-variant leading-relaxed line-clamp-2 opacity-80">{item.message}</p>
                                    </div>

                                    <button
                                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-gold-accent hover:text-white border border-white/10 hover:border-gold-accent/50 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all"
                                        onClick={() => onOpenCustomerById(item.customerId, item.targetTab)}
                                    >
                                        <span className="material-symbols-outlined text-base">bolt</span>
                                        {item.actionLabel}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="glass-card rounded-premium p-8 border-white/40">
                    <div className="mb-8 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Aktivitas Lintas Unit</h2>
                        </div>
                        <span className="px-4 py-1 rounded-full bg-white/5 text-on-surface-variant text-[10px] font-black uppercase tracking-widest border border-white/10">REAL-TIME FEED</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {recentActivities.length === 0 && (
                            <p className="col-span-full py-10 text-center text-sm font-medium text-on-surface-variant italic opacity-50">
                                Aktivitas terbaru belum tersedia.
                            </p>
                        )}

                        {recentActivities.map((activity) => (
                            <div
                                key={activity.id}
                                className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/12 transition-all group/activity cursor-default"
                            >
                                <div className="mb-3 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="h-2 w-2 rounded-full bg-gold-accent shadow-gold-glow shrink-0"></div>
                                        <p className="text-xs font-black text-on-surface truncate uppercase tracking-wider">{activity.customerName}</p>
                                    </div>
                                    <p className="text-[10px] font-black text-on-surface-variant/40 shrink-0 uppercase tracking-[0.2em]">
                                        {formatDateTime(activity.date)}
                                    </p>
                                </div>
                                <p className="text-sm font-black text-on-surface group-hover/activity:text-gold-accent transition-colors leading-snug">{activity.title}</p>
                                <p className="mt-2 text-xs font-medium text-on-surface-variant leading-relaxed line-clamp-2 opacity-70">{activity.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
                {invoiceDetailModal}
            </div>
        </div>
    );

    if (layout === "plain") {
        return (
            <main className="min-h-screen pb-10 overflow-x-hidden pt-6 px-6 text-on-surface">
                {content}
            </main>
        );
    }

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            {content}
        </AppShell>
    );
}

/** 
 * Premium Stat Card for Monitoring 
 */
function StatCard({ label, value, icon, accent, sub }) {
    const accents = {
        gold: "text-gold-accent bg-gold-accent/10 border-gold-accent/20 shadow-gold-glow/5",
        rose: "text-rose-500 bg-rose-500/10 border-rose-500/20 shadow-rose-glow/5",
        emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-glow/5",
        white: "text-on-surface-variant bg-white/10 border-white/20"
    };
    return (
        <div className="glass-card rounded-2xl p-6 border-white/40 group hover:border-gold-accent/30 transition-all hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-6">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-gold-accent transition-colors">{label}</p>
                <div className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all group-hover:shadow-lg ${accents[accent]}`}>
                    <span className="material-symbols-outlined text-xl">{icon}</span>
                </div>
            </div>
            <h3 className="text-3xl font-black text-on-surface tracking-tighter mb-2">{value}</h3>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">{sub}</p>
        </div>
    );
}

export default MonitoringSpreadsheetPage;