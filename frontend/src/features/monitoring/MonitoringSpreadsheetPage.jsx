import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { IssueCountRow } from "../../components/shared/AppShared";
import { invoiceStatusLabelMap, monitoringMonths } from "../../app/constants";
import {
    formatCoreAllocation,
    formatCurrency,
    formatDate,
    formatDateTime,
    getRemainingRentalDays,
    getMonthStatusClass,
    parseDateValue,
    toTitleCase,
} from "../../app/utils";
import api from "../../lib/api";

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

const formatMonitoringCoreAmount = (row) => {
    if (row?.coreType === "sharing_core") {
        return row?.sharingRatio || "-";
    }

    return row?.coreTotal ?? "-";
};

const normalizeOperationalStatus = (status) => String(status ?? "").trim().toLowerCase();
const isStoppedStatus = (status) => ["berhenti", "nonaktif"].includes(normalizeOperationalStatus(status));
const resolveRouteStatus = (customerStatus, routeStatus) => isStoppedStatus(customerStatus)
    ? "nonaktif"
    : String(routeStatus || "aktif").trim().toLowerCase();

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

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [activeDataTab, setActiveDataTab] = useState("table");

    const [billingRows, setBillingRows] = useState([]);
    const [historyRows, setHistoryRows] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [recentActivities, setRecentActivities] = useState([]);
    const [selectedInvoiceCell, setSelectedInvoiceCell] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingSupplementary, setIsLoadingSupplementary] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState("");

    const invoiceDetailModal = selectedInvoiceCell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl rounded-3xl bg-slate-900/80 backdrop-blur-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/10 overflow-hidden group">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold-accent/5 blur-3xl transition-all duration-700 group-hover:bg-gold-accent/10 backdrop-blur-md" />

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
                        className="rounded-xl bg-white/5 p-3 text-white/40 transition-all hover:bg-white/10 hover:text-white border border-white/5 backdrop-blur-md"
                        onClick={() => setSelectedInvoiceCell(null)}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 mb-8">
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Periode Tagihan</dt>
                        <dd className="text-sm font-black text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-gold-accent text-sm">calendar_today</span>
                            {selectedInvoiceCell.month} {selectedInvoiceCell.year}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Status Pembayaran</dt>
                        <dd className="flex items-center">
                            <span className={`rounded-lg px-3 py-1.5 text-[9px] font-black tracking-widest border transition-all ${getMonthStatusClass(selectedInvoiceCell.status)} border-opacity-30`}>
                                {invoiceStatusLabelMap[selectedInvoiceCell.status]?.toUpperCase() ?? selectedInvoiceCell.status.toUpperCase()}
                            </span>
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Kontrak Awal</dt>
                        <dd className="text-xs font-bold text-white/70">
                            {formatDate(selectedInvoiceCell.contractStart)}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
                        <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 mb-2">Kontrak Akhir</dt>
                        <dd className="text-xs font-bold text-white/70">
                            {formatDate(selectedInvoiceCell.contractEnd)}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
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
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 transition-colors hover:bg-white/[0.07] backdrop-blur-md">
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
                        className="rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white/40 transition-all hover:text-white hover:bg-white/5 backdrop-blur-md"
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

    const loadCoreData = useCallback(async () => {
        setIsLoading(true);
        setError("");

        try {
            const billingResult = await api.monitoring.getBilling({
                year: appliedFilters.year,
                isp: appliedFilters.isp || undefined,
                status: appliedFilters.status || undefined,
            });

            const nextBillingRows = Array.isArray(billingResult?.rows) ? billingResult.rows : [];
            setBillingRows(nextBillingRows);
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

    const loadSupplementaryData = useCallback(async () => {
        setIsLoadingSupplementary(true);

        try {
            const alertsResult = await api.notifications.list({ year: appliedFilters.year, limit: 200 });

            const nextAlerts = Array.isArray(alertsResult) ? alertsResult : [];

            setAlerts(nextAlerts);

            const candidateCustomerIds = [
                ...new Set([
                    ...billingRows.map((row) => row.customerId).filter((id) => Number.isFinite(id)),
                    ...nextAlerts.map((alert) => alert.customerId).filter((id) => Number.isFinite(id)),
                ]),
            ].slice(0, 8);

            if (candidateCustomerIds.length === 0) {
                setRecentActivities([]);
                return;
            }

            const nameMap = new Map();
            billingRows.forEach((row) => {
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
                        // TODO: Implement timeline API in Supabase
                        // const timeline = await api.customers.getTimeline(customerId);

                        return {
                            customerId,
                            customerName: nameMap.get(customerId) ?? `Pelanggan #${customerId}`,
                            events: [], // Temporarily disabled
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
        } catch {
            // Supplementary data should not block core table render.
        } finally {
            setIsLoadingSupplementary(false);
        }
    }, [appliedFilters.year, billingRows]);

    const loadHistoryData = useCallback(async () => {
        setIsLoadingHistory(true);

        try {
            const historyResult = await api.monitoring.getHistory({
                year: appliedFilters.year,
                isp: appliedFilters.isp || undefined,
            });
            const nextHistoryRows = Array.isArray(historyResult?.rows) ? historyResult.rows : [];
            setHistoryRows(nextHistoryRows);
        } catch {
            // Keep non-blocking; table remains usable.
        } finally {
            setIsLoadingHistory(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        void loadCoreData();
    }, [loadCoreData]);

    useEffect(() => {
        void loadSupplementaryData();
    }, [loadSupplementaryData]);

    useEffect(() => {
        if (activeDataTab === "history") {
            void loadHistoryData();
        }
    }, [activeDataTab, loadHistoryData]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters.search, filters.contractStatus, filters.routeStatus, filters.todoStatus, filters.package]);

    const filteredRows = useMemo(() => {
        const loweredSearch = filters.search.trim().toLowerCase();
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
            if (isStoppedStatus(row.customerStatus)) {
                contractStatusKey = "berhenti";
            } else if (remainingDays !== null && remainingDays < 0) {
                contractStatusKey = "expired";
            }
            const matchesContract = filters.contractStatus === "all" ? true : contractStatusKey === filters.contractStatus;

            // 3. Status Jalur Filter
            const tenantRouteStatus = resolveRouteStatus(row.customerStatus, row.routeStatus);
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

    const filteredHistoryRows = useMemo(() => {
        const loweredSearch = filters.search.trim().toLowerCase();

        return historyRows.filter((row) => {
            const searchableText = [
                row.customerName,
                row.ispName,
                row.customerCode,
                row.contractNumber,
                row.lastInvoiceNumber,
            ].filter(Boolean).join(" ").toLowerCase();
            const matchesSearch = !loweredSearch || searchableText.includes(loweredSearch);
            const rowPackage = row.paket || row.coreType;
            const matchesPackage = filters.package === "all" ? true : rowPackage === filters.package;

            return matchesSearch && matchesPackage;
        });
    }, [historyRows, filters.search, filters.package]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedRows = filteredRows.slice(startIndex, endIndex);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            // Scroll to table top
            const tableEl = document.getElementById("monitoring-table");
            if (tableEl) {
                tableEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    };

    const handleItemsPerPageChange = (newItemsPerPage) => {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);
    };

    const routeSummary = useMemo(() => {
        const summary = { aktif: 0, gangguan: 0, perbaikan: 0 };
        billingRows.forEach((row) => {
            const routeStatus = resolveRouteStatus(row.customerStatus, row.routeStatus);
            if (routeStatus === "gangguan") {
                summary.gangguan++;
            } else if (routeStatus === "perbaikan" || routeStatus === "maintenance") {
                summary.perbaikan++;
            } else {
                summary.aktif++;
            }
        });
        return summary;
    }, [billingRows]);

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

    const exportToExcel = async () => {
        if (filteredRows.length === 0) return;
        setIsExporting(true);

        const yieldToBrowser = () => new Promise((resolve) => {
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(() => resolve());
                return;
            }
            setTimeout(resolve, 0);
        });

        const headers = [
            "No", "Nama ISP", "Nama Pelanggan", "Periode Awal", "Berjalan Awal", "Berjalan Akhir",
            "Paket", "Jumlah",
            ...(isTeknisi ? [] : ["No. Kontrak", "No. Invoice"]),
            "Sisa Sewa", "Status Kontrak", "Status Jalur",
            ...(isTeknisi ? [] : ["Aktivasi", ...monitoringMonths])
        ];

        try {
            const csvRows = [];
            const chunkSize = 150;
            for (let index = 0; index < filteredRows.length; index += chunkSize) {
                const rowChunk = filteredRows.slice(index, index + chunkSize);
                rowChunk.forEach((row, chunkIndex) => {
                    const absoluteIndex = index + chunkIndex;
                    const monthsData = isTeknisi ? [] : monitoringMonths.map((_, i) => {
                        const status = Array.isArray(row.months) ? row.months[i] : "belum_ditagih";
                        return invoiceStatusLabelMap[status] || status;
                    });

                    const data = [
                        absoluteIndex + 1,
                        row.ispName,
                        row.customerName,
                        formatDate(row.ispContractStart),
                        formatDate(row.contractStart),
                        formatDate(row.contractEnd),
                        toTitleCase(row.coreType),
                        formatMonitoringCoreAmount(row),
                        ...(isTeknisi ? [] : [row.contractNumber ?? "-", row.currentInvoiceNumber ?? "-"]),
                        getRemainingRentalDays(row.contractEnd) ?? "-",
                        isStoppedStatus(row.customerStatus) ? "Berhenti" : "Beroperasi",
                        resolveRouteStatus(row.customerStatus, row.routeStatus),
                        ...(isTeknisi ? [] : [row.activationFeePaidAt ? "Selesai" : formatCurrency(row.activationFeeAmount), ...monthsData])
                    ];
                    csvRows.push(data.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
                });

                // Yield to browser so click interaction can paint and INP stays low.
                await yieldToBrowser();
            }

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
            URL.revokeObjectURL(url);
        } finally {
            setIsExporting(false);
        }
    };

    const handleRefreshMonitoring = useCallback(() => {
        void loadCoreData();
        void loadSupplementaryData();
        if (activeDataTab === "history") {
            void loadHistoryData();
        }
    }, [activeDataTab, loadCoreData, loadSupplementaryData, loadHistoryData]);

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
            className={`glass-card backdrop-blur-xl rounded-premium border-white/40 overflow-hidden shadow-glass-depth max-w-full ${tableOnly ? "flex h-full flex-col" : ""}`}
            id="monitoring-table"
        >
            {/* Pagination Top */}
            {!tableOnly && filteredRows.length > 0 && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    totalItems={filteredRows.length}
                    startIndex={startIndex}
                    endIndex={endIndex}
                />
            )}

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
                                <span className="absolute right-0 top-0 h-full w-px bg-white/5 backdrop-blur-md" />
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
                                            <div className="absolute inset-0 scale-150 bg-gold-accent/10 blur-[50px] rounded-full backdrop-blur-md" />
                                            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 border border-white/10 shadow-2xl backdrop-blur-xl">
                                                <span className="material-symbols-outlined text-6xl text-gold-accent/40">data_alert</span>
                                            </div>
                                        </div>

                                        {/* Text Section */}
                                        <div className="max-w-md mx-auto">
                                            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-8">Data Tidak Ditemukan</h3>

                                            {/* Action Button */}
                                            <button
                                                className="inline-flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/10 hover:border-gold-accent/30 hover:text-gold-accent shadow-xl group backdrop-blur-md"
                                                onClick={() => {
                                                    setFilters({ search: "", year: currentYear, contractStatus: "all", routeStatus: "all", todoStatus: "all", package: "all" });
                                                    setAppliedFilters({ year: currentYear, contractStatus: "all", routeStatus: "all", todoStatus: "all", package: "all" });
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

                        {!isLoading && paginatedRows.map((row, rowIndex) => {
                            const actualRowNumber = startIndex + rowIndex + 1;
                            return (
                            <tr key={`${row.customerId}-${rowIndex}`} className="bg-[#0f172a]/40 transition-all group hover:bg-[#1e293b]/60">
                                <td className="relative sticky left-0 z-20 w-[64px] pl-2 pr-0 py-5 font-black text-white/30 text-center bg-[#0f172a]/65 backdrop-blur-sm group-hover:!bg-[#0f1117] group-hover:!backdrop-blur-none group-hover:text-gold-accent transition-colors shadow-[2px_0_10px_rgba(0,0,0,0.3)] group-hover:border-l-4 group-hover:border-l-gold-accent">
                                    {String(actualRowNumber).padStart(2, "0")}
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
                                    <span className="absolute right-0 top-0 h-full w-px bg-white/10 backdrop-blur-md" />
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold text-center group-hover:bg-white/5 transition-colors border-r border-white/5 backdrop-blur-md">
                                    {formatDate(row.ispContractStart)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold group-hover:bg-white/5 transition-colors border-r border-white/5 backdrop-blur-md">
                                    {formatDate(row.contractStart)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-bold group-hover:bg-white/5 transition-colors border-r border-white/5 backdrop-blur-md">
                                    {formatDate(row.contractEnd)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-black tracking-tight transition-colors group-hover:bg-white/5 border-r border-white/5 text-center backdrop-blur-md">
                                    {toTitleCase(row.coreType)}
                                </td>
                                <td className="px-4 py-5 text-on-surface-variant font-black text-center transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md">
                                    {formatMonitoringCoreAmount(row)}
                                </td>
                                {!isTeknisi && (
                                    <>
                                        <td className="px-4 py-5 text-on-surface-variant font-mono text-[11px] font-bold transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md">
                                            {row.contractNumber ?? "-"}
                                        </td>
                                        <td className="px-4 py-5 text-on-surface-variant font-mono text-[11px] font-bold transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md">
                                            {row.currentInvoiceNumber ?? "-"}
                                        </td>
                                    </>
                                )}
                                <td className="px-6 py-5 whitespace-nowrap transition-colors group-hover:bg-white/5 border-r border-white/5 text-center backdrop-blur-md">
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
                                <td className="px-6 py-5 text-center transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md">
                                    {(() => {
                                        const remainingDays = getRemainingRentalDays(row.contractEnd);
                                        let label = "BEROPERASI";
                                        let style = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-glow/5";

                                        if (isStoppedStatus(row.customerStatus)) {
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
                                <td className="px-6 py-5 text-center transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md">
                                    {(() => {
                                        const statusValue = resolveRouteStatus(row.customerStatus, row.routeStatus);
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
                                        <td className="px-6 py-5 transition-colors group-hover:bg-white/5 border-r border-white/5 text-center backdrop-blur-md">
                                            {row.activationFeePaidAt ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="inline-flex rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[9px] font-black text-emerald-500 tracking-widest uppercase backdrop-blur-md">
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
                                                    className="p-0 transition-colors group-hover:bg-white/5 border-r border-white/5 backdrop-blur-md"
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
                        )})}
                    </tbody>
                </table>
            </div>

            {/* Pagination Bottom */}
            {!tableOnly && filteredRows.length > 0 && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    totalItems={filteredRows.length}
                    startIndex={startIndex}
                    endIndex={endIndex}
                />
            )}

            {!tableOnly && (
                <div className="flex flex-wrap items-center justify-between gap-6 border-t border-white/10 bg-[#0f141e]/50 px-10 py-6 backdrop-blur-md">
                    <div className="flex items-center gap-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            ISP: <span className="text-gold-accent ml-2">{ispOptions.length}</span>
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            LOKASI: <span className="text-gold-accent ml-2">{filteredRows.length}</span>
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                            RIWAYAT: <span className="text-gold-accent ml-2">{filteredHistoryRows.length}</span>
                        </p>
                    </div>
                </div>
            )}
        </section>
    );

    const historyTableSection = (
        <section className="glass-card backdrop-blur-xl rounded-premium border-white/40 overflow-hidden shadow-glass-depth max-w-full">
            <div className="flex flex-col gap-3 border-b border-white/10 bg-[#0f141e]/60 px-8 py-6 backdrop-blur-md md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gold-accent/70">Arsip Kontrak</p>
                    <h2 className="mt-2 text-xl font-black uppercase tracking-widest text-white">Riwayat Monitoring</h2>
                    <p className="mt-2 max-w-3xl text-xs font-medium leading-relaxed text-white/45">
                        Menampilkan kontrak yang sudah selesai tetapi masih beririsan dengan tahun filter, agar relasi lama seperti Medialink dan Merapi tetap bisa dilacak.
                    </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 backdrop-blur-md">
                    {filteredHistoryRows.length} Riwayat
                </div>
            </div>
            <div className="max-w-full overflow-auto custom-scrollbar">
                <table className="w-full min-w-[1320px] table-fixed border-separate border-spacing-0 text-[13px]">
                    <thead>
                        <tr>
                            {[
                                "NO",
                                "MITRA ISP",
                                "UNIT LOKASI",
                                "PERIODE KONTRAK",
                                "PAKET",
                                "JUMLAH",
                                "NO. KONTRAK",
                                "INVOICE TERAKHIR",
                                "STATUS",
                            ].map((header) => (
                                <th key={header} className="sticky top-0 z-20 border-b border-r border-white/10 bg-[#1e293b]/95 px-5 py-4 text-center text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-3xl">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {isLoadingHistory && (
                            <tr>
                                <td className="px-6 py-16 text-center text-sm font-bold italic text-white/35" colSpan="9">
                                    Sinkronisasi riwayat kontrak...
                                </td>
                            </tr>
                        )}

                        {!isLoadingHistory && filteredHistoryRows.length === 0 && (
                            <tr>
                                <td className="px-6 py-16 text-center text-sm font-bold italic text-white/35" colSpan="9">
                                    Riwayat kontrak tidak ditemukan untuk filter saat ini.
                                </td>
                            </tr>
                        )}

                        {!isLoadingHistory && filteredHistoryRows.map((row, rowIndex) => (
                            <tr key={`${row.customerId}-${row.contractId}-${rowIndex}`} className="bg-[#0f172a]/40 transition-all group hover:bg-[#1e293b]/60">
                                <td className="border-r border-white/5 px-5 py-5 text-center font-black text-white/30 group-hover:text-gold-accent">
                                    {String(rowIndex + 1).padStart(2, "0")}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 font-black text-white">
                                    {row.ispName}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5">
                                    <p className="truncate font-black text-on-surface group-hover:text-gold-accent">{row.customerName}</p>
                                    <button
                                        className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold-accent hover:text-white transition-colors"
                                        onClick={() => onOpenCustomerById(row.customerId, "overview")}
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                        Detail Unit
                                    </button>
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 text-center text-xs font-bold text-on-surface-variant">
                                    {formatDate(row.contractStart)} <span className="mx-2 text-white/15">-</span> {formatDate(row.contractEnd)}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 text-center font-black text-on-surface-variant">
                                    {toTitleCase(row.coreType)}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 text-center font-black text-on-surface-variant">
                                    {formatMonitoringCoreAmount(row)}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 font-mono text-[11px] font-bold text-on-surface-variant">
                                    {row.contractNumber ?? "-"}
                                </td>
                                <td className="border-r border-white/5 px-5 py-5 font-mono text-[11px] font-bold text-on-surface-variant">
                                    {row.lastInvoiceNumber ?? "-"}
                                </td>
                                <td className="px-5 py-5 text-center">
                                    <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/45 backdrop-blur-md">
                                        Selesai
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );

    if (tableOnly) {
        const tableOnlyContent = (
            <div className="h-full min-h-0 w-full flex flex-col gap-5 p-2">
                {typeof onCloseTableOnly === "function" && (
                    <div className="shrink-0 flex items-center justify-between gap-6 px-2">
                        <div className="flex items-center gap-4">
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:bg-white/20 hover:scale-105 active:scale-95 backdrop-blur-md"
                                onClick={onCloseTableOnly}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-sm text-gold-accent">arrow_back</span>
                                Kembali
                            </button>
                            <div className="h-8 w-px bg-white/10 mx-2 backdrop-blur-md" />
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
                                    className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-3 text-[11px] font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-white/10 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5 backdrop-blur-md"
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
                                className="h-[44px] px-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 active:scale-95 transition-transform shrink-0 hover:bg-white/10 group backdrop-blur-md"
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
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-600 px-5 py-3 rounded-xl transition-all flex items-center gap-2 backdrop-blur-md disabled:opacity-60"
                            onClick={exportToExcel}
                            disabled={isExporting}
                        >
                            <span className="material-symbols-outlined text-xl text-emerald-500">{isExporting ? "progress_activity" : "download_for_offline"}</span>
                            <span className="text-[11px] font-black uppercase tracking-widest">{isExporting ? "Menyiapkan..." : "Ekspor Excel"}</span>
                        </button>
                        <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/15 backdrop-blur-md">
                            <button
                                onClick={handleRefreshMonitoring}
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
                <section className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/40 shadow-glass-depth relative z-[40] !overflow-visible">
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
                                    className="w-full h-14 rounded-2xl bg-black/20 border border-white/10 pl-14 pr-6 text-sm font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-4 focus:ring-gold-accent/5 shadow-inner-glass backdrop-blur-md"
                                    onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                                    placeholder="Cari ISP atau Lokasi..."
                                    type="text"
                                    value={filters.search}
                                />
                            </div>

                            <button
                                className="h-14 bg-white/5 hover:bg-white/10 text-on-surface-variant px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/10 hover:border-white/20 active:scale-95 flex items-center gap-2 backdrop-blur-md"
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
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 shadow-sm backdrop-blur-md">
                            <span className="material-symbols-outlined text-lg text-gold-accent">location_on</span>
                            <span><span className="text-white font-black">{filteredRows.length}</span> Lokasi Terpilih</span>
                        </div>
                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 shadow-sm backdrop-blur-md">
                            <span className="material-symbols-outlined text-lg text-gold-accent">hub</span>
                            <span><span className="text-white font-black">{new Set(filteredRows.map(r => r.ispName)).size}</span> ISP Terkait</span>
                        </div>
                    </div>
                </section>

                <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-premium glass-premium backdrop-blur-xl p-6 border-white/30">
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
                        <span className="h-2 w-2 rounded-full bg-white/10 border border-white/10 backdrop-blur-md"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/60">Belum Ditagih</span>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-on-surface-variant leading-relaxed opacity-60 uppercase tracking-widest">
                            <span className="material-symbols-outlined text-xs">touch_app</span>
                            Klik sel bulanan untuk detail
                        </span>
                    </div>
                </section>

                <section className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-2.5 backdrop-blur-md w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveDataTab("table")}
                        className={`rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeDataTab === "table" ? "bg-gold-accent text-white shadow-gold-glow" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                    >
                        Tabel Aktif
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveDataTab("history")}
                        className={`rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeDataTab === "history" ? "bg-gold-accent text-white shadow-gold-glow" : "text-white/60 hover:text-white hover:bg-white/10"}`}
                    >
                        Riwayat
                    </button>
                    {isLoadingSupplementary && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-2">Sync notifikasi...</span>
                    )}
                </section>

                {activeDataTab === "table" ? tableSection : historyTableSection}

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
                        accent={uniqueAlertCustomers > 0 ? "rose" : "gold"}
                        sub="Prioritas Penanganan"
                    />
                </section>

                {/* Consolidated Detailed Overview moved to bottom */}
                <section className="grid grid-cols-1">
                    <div className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/40 shadow-glass-depth">
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
                                        <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px] backdrop-blur-md">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-emerald-glow"
                                                style={{ width: `${(routeSummary.aktif / (billingRows.length || 1)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-emerald-500/30 transition-colors backdrop-blur-md">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Aktif / Aman</p>
                                            <p className="text-2xl font-black text-emerald-500">{routeSummary.aktif}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-rose-500/30 transition-colors backdrop-blur-md">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Gangguan</p>
                                            <p className="text-2xl font-black text-rose-500">{routeSummary.gangguan}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 group/substat hover:border-amber-500/30 transition-colors backdrop-blur-md">
                                            <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">Perbaikan</p>
                                            <p className="text-2xl font-black text-amber-500">{routeSummary.perbaikan}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>

                <section className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/40">
                    <div className="mb-8 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="h-6 w-1.5 bg-gold-accent rounded-full shadow-gold-glow"></span>
                            <h2 className="text-xl font-black text-on-surface tracking-tight uppercase tracking-widest">Aktivitas Lintas Unit</h2>
                        </div>
                        <span className="px-4 py-1 rounded-full bg-white/5 text-on-surface-variant text-[10px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md">REAL-TIME FEED</span>
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
                                className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/12 transition-all group/activity cursor-default backdrop-blur-md"
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
 * Pagination Component
 */
function PaginationControls({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange, totalItems, startIndex, endIndex }) {
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-white/10 bg-[#0f141e]/50 backdrop-blur-md">
            {/* Left: Info */}
            <div className="flex items-center gap-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Menampilkan <span className="text-gold-accent mx-1">{startIndex + 1}</span> - <span className="text-gold-accent mx-1">{Math.min(endIndex, totalItems)}</span> dari <span className="text-gold-accent mx-1">{totalItems}</span> lokasi
                </p>
                
                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Per Halaman:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white outline-none transition-all hover:bg-white/10 focus:border-gold-accent/40 focus:ring-2 focus:ring-gold-accent/10 backdrop-blur-md"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                    </select>
                </div>
            </div>

            {/* Right: Pagination buttons */}
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center transition-all hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 backdrop-blur-md"
                    >
                        <span className="material-symbols-outlined text-sm text-white">chevron_left</span>
                    </button>

                    {getPageNumbers().map((page, idx) => (
                        page === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-white/40 text-sm font-black">...</span>
                        ) : (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`h-9 min-w-[36px] px-3 rounded-lg text-[11px] font-black transition-all ${
                                    currentPage === page
                                        ? 'bg-gold-accent text-black shadow-gold-glow'
                                        : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                }`}
                            >
                                {page}
                            </button>
                        )
                    ))}

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center transition-all hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5 backdrop-blur-md"
                    >
                        <span className="material-symbols-outlined text-sm text-white">chevron_right</span>
                    </button>
                </div>
            )}
        </div>
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
        <div className="glass-card backdrop-blur-xl rounded-2xl p-6 border-white/40 group hover:border-gold-accent/30 transition-all hover:scale-[1.02]">
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
