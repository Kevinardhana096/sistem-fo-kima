import { useMemo, useState, useEffect, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import { SummaryCard, StatCard } from "../../components/shared/AppShared";
import api from "../../lib/api";
import { getPackageDisplay, normalizeOperationalStatus, isStoppedStatus, resolveTenantOperationalStatus } from "./utils";

const getTenantOperationalStatus = (tenant, todayIso) => {
    const status = resolveTenantOperationalStatus(tenant, todayIso);
    return status === "aktif" ? "beroperasi" : status;
};
const isTenantActive = (tenant, todayIso) => getTenantOperationalStatus(tenant, todayIso) === "beroperasi";
const getIspOperationalStatus = (isp, todayIso) => {
    const rawStatus = normalizeOperationalStatus(isp?.status);
    if (isStoppedStatus(rawStatus)) return "berhenti";
    if (rawStatus === "expired") return "expired";

    const contractPeriodEnd = typeof isp?.contractPeriodEnd === "string"
        ? isp.contractPeriodEnd.slice(0, 10)
        : "";
    return contractPeriodEnd && contractPeriodEnd < todayIso ? "expired" : "beroperasi";
};
const resolveTenantRouteStatus = (tenant, todayIso) => getTenantOperationalStatus(tenant, todayIso) === "berhenti"
    ? "nonaktif"
    : String(tenant?.routeStatus || "aktif").trim().toLowerCase();
const getPeriodStart = (item) => String(item?.startDate ?? item?.start_date ?? "").slice(0, 10);
const getPeriodEnd = (item) => String(item?.endDate ?? item?.end_date ?? "").slice(0, 10);
const isInPeriod = (item, todayIso) => {
    const start = getPeriodStart(item);
    const end = getPeriodEnd(item);
    return start && end && start <= todayIso && end >= todayIso;
};
const normalizeContractNumber = (value) => {
    const contractNumber = String(value ?? "").trim();
    return contractNumber && !contractNumber.startsWith("NO-BAK-") ? contractNumber : "-";
};
const getCurrentContractNumber = (tenant, todayIso) => {
    const contracts = Array.isArray(tenant?.contracts)
        ? tenant.contracts.filter((contract) => !(contract?.deletedAt ?? contract?.deleted_at))
        : [];

    const activeVersion = contracts
        .flatMap((contract) => Array.isArray(contract?.versions)
            ? contract.versions.map((version) => ({
                ...version,
                fallbackContractNumber: contract.contractNumber ?? contract.contract_number,
            }))
            : [])
        .find((version) => !(version?.deletedAt ?? version?.deleted_at) && isInPeriod(version, todayIso));

    if (activeVersion) {
        return normalizeContractNumber(activeVersion.contractNumber ?? activeVersion.contract_number ?? activeVersion.fallbackContractNumber);
    }

    const activeContract = contracts.find((contract) => isInPeriod(contract, todayIso));
    return normalizeContractNumber(activeContract?.contractNumber ?? activeContract?.contract_number ?? tenant?.contractNumber);
};
const getIspActionCounts = (isp, notificationCountsByIspId = {}) => {
    const ispId = Number(isp?.id);
    const notificationCounts = Number.isFinite(ispId) ? notificationCountsByIspId[ispId] : null;
    const activeNotificationCount = Number(notificationCounts?.active ?? 0);
    const unreadNotificationCount = Number(notificationCounts?.unread ?? 0);

    return {
        priority: unreadNotificationCount,
        needAction: Math.max(activeNotificationCount - unreadNotificationCount, 0),
        total: activeNotificationCount,
    };
};

const getTenantActionCounts = (tenant, notificationCountsByCustomerId = {}) => {
    if (tenant?.actionSummary) {
        const priority = Number(tenant.actionSummary.priority ?? 0);
        const needAction = Number(tenant.actionSummary.needAction ?? 0);
        return {
            priority,
            needAction,
            total: Number(tenant.actionSummary.total ?? priority + needAction),
        };
    }

    const customerId = Number(tenant?.id);
    const notificationCounts = Number.isFinite(customerId) ? notificationCountsByCustomerId[customerId] : null;
    const activeNotificationCount = Number(notificationCounts?.active ?? 0);
    const unreadNotificationCount = Number(notificationCounts?.unread ?? 0);

    if (activeNotificationCount > 0) {
        return {
            priority: unreadNotificationCount,
            needAction: Math.max(activeNotificationCount - unreadNotificationCount, 0),
            total: activeNotificationCount,
        };
    }

    const priority = Number(tenant?.todoSummary?.counts?.priority ?? 0);
    const needAction = Number(tenant?.todoSummary?.counts?.needAction ?? 0);
    return {
        priority,
        needAction,
        total: priority + needAction,
    };
};

// --- Custom UI Components ---
const CustomSelect = ({ value, onChange, options, icon, label }) => {
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

    return (
        <div className="space-y-1.5" ref={dropdownRef}>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] pl-1 text-gold-accent/40">{label}</p>
            <div className="relative group">
                {/* Trigger */}
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full rounded-xl flex items-center justify-center text-[9px] font-bold cursor-pointer transition-all border relative z-20 h-9 pl-7 pr-6 uppercase font-black tracking-widest shadow-inner-glass ${isOpen || isSelected
                        ? "bg-gold-accent/10 border-gold-accent/60 text-gold-accent shadow-gold-glow"
                        : "bg-black/20 border-white/10 text-white/70 hover:border-white/30"
                        }`}
                >
                    {icon && (
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 transition-all duration-300" style={{ fontSize: "18px", color: isOpen || isSelected ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                            {icon}
                        </span>
                    )}
                    <span className="truncate">{selectedOption.label}</span>
                    <div className="absolute inset-y-0 right-0 flex items-center justify-center transition-colors w-6 border-l border-white/5 group-hover:border-gold-accent/20">
                        <span className={`material-symbols-outlined transition-all duration-500 ${isOpen ? "rotate-180" : (isSelected ? "" : "text-white/20 group-hover:text-gold-accent")}`} style={{ fontSize: "18px" }}>
                            expand_more
                        </span>
                    </div>
                </div>

                {/* Dropdown Menu - Deep Steel Glass Alignment */}
                {isOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-[#0a0d16] border border-white/15 rounded-2xl overflow-hidden z-[9999] shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="relative p-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                            {options.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all mb-1 last:mb-0 flex items-center justify-center group/item ${value === opt.value
                                        ? "text-black relative overflow-hidden"
                                        : "text-white/50 hover:bg-white/8 hover:text-white"
                                        }`}
                                >
                                    {value === opt.value && (
                                        <div className="absolute inset-0 bg-[#d4a937]"></div>
                                    )}
                                    <span className="relative z-10 w-full text-center font-black">{opt.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function CustomerWorkspacePage({
    activeSection,
    customers,
    customersPageInfo = null,
    notificationCountsByCustomerId = {},
    notificationCountsByIspId = {},
    isps,
    error,
    secondaryError,
    isLoading,
    onNavigate,
    onLogout,
    onOpenTenant,
    onOpenIsp,
    onOpenCreateTenant,
    onOpenCreateIsp,
    onRefresh,
    onLoadMoreCustomers,
    canCreateTenant = true,
    canCreateIsp = true,
    currentRole = "admin",
}) {
    const isTeknisi = currentRole === "teknisi";
    const [searchTerm, setSearchTerm] = useState("");
    const [listType, setListType] = useState("current");
    const [ispSortMethod, setIspSortMethod] = useState("newest");
    const [contractStatusFilter, setContractStatusFilter] = useState("all");
    const [routeStatusFilter, setRouteStatusFilter] = useState("all");
    const [todoFilter, setTodoFilter] = useState("all");
    const [collapsedMap, setCollapsedMap] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const totalCustomerCount = Number(customersPageInfo?.count ?? customers.length);
    const hasMoreCustomers = Boolean(customersPageInfo?.hasMore);

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const todayIso = new Date().toISOString().slice(0, 10);

    // Reset to page 1 when any filter changes
    const handleFilterChange = (setter, value) => {
        setter(value);
        setCurrentPage(1);
    };

    // --- LOGIC: Filter ISP ---
    const filteredIsps = useMemo(() => isps, [isps]);

    // Global toggle to show empty ISP groups (only in current list and if no specific filters are active)
    const shouldIncludeEmptyIspGroups = listType === "current"
        && contractStatusFilter === "all"
        && routeStatusFilter === "all"
        && todoFilter === "all";

    // --- LOGIC: Filtered Tenants ---
    // First, filter all customers based on global filters (search, status, etc.)
    const filteredTenants = useMemo(() => {
        return customers.filter((tenant) => {
            const operationalStatus = getTenantOperationalStatus(tenant, todayIso);
            const matchesListType = listType === "riwayat"
                ? operationalStatus === "berhenti"
                : operationalStatus !== "berhenti";
            if (!matchesListType) return false;

            const searchableText = [
                tenant.name,
                tenant.customerId,
                tenant.ispDisplay,
                ...(Array.isArray(tenant.ispList) ? tenant.ispList : []),
            ].filter(Boolean).join(" ").toLowerCase();

            const contractStatusKey = getTenantOperationalStatus(tenant, todayIso);
            const tenantRouteStatus = resolveTenantRouteStatus(tenant, todayIso);
            const actionCounts = getTenantActionCounts(tenant, notificationCountsByCustomerId);
            const todoStatusKey = actionCounts.total > 0 ? "perlu_tindakan" : "tidak_ada";

            const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
            const matchesContractStatus = contractStatusFilter === "all" ? true : contractStatusKey === contractStatusFilter;
            const matchesRouteStatus = routeStatusFilter === "all" ? true : tenantRouteStatus === routeStatusFilter;
            const matchesTodo = todoFilter === "all" ? true : todoStatusKey === todoFilter;

            return matchesSearch && matchesContractStatus && matchesRouteStatus && matchesTodo;
        });
    }, [customers, listType, normalizedSearch, contractStatusFilter, routeStatusFilter, todoFilter, todayIso, notificationCountsByCustomerId]);

    // --- LOGIC: Groups & Tenants ---
    const allGroups = useMemo(() => {
        const knownIspNames = new Set(filteredIsps.map(isp => isp.name));

        const groups = filteredIsps
            .map((isp) => {
                const tenants = filteredTenants.filter(t => Array.isArray(t.ispList) && t.ispList.includes(isp.name));

                const ispActionCounts = getIspActionCounts(isp, notificationCountsByIspId);
                const actionTenantCount = tenants.filter((tenant) => getTenantActionCounts(tenant, notificationCountsByCustomerId).total > 0).length;
                const tenantActionCount = tenants.reduce((total, tenant) => total + getTenantActionCounts(tenant, notificationCountsByCustomerId).total, 0);
                const totalActionCount = tenantActionCount + ispActionCounts.total;

                return {
                    ...isp,
                    tenants: tenants.sort((a, b) => a.name.localeCompare(b.name)),
                    activeTenantCount: tenants.filter((tenant) => isTenantActive(tenant, todayIso)).length,
                    actionTenantCount: actionTenantCount + (ispActionCounts.total > 0 ? 1 : 0),
                    ispActionCounts,
                    tenantActionCount,
                    totalActionCount,
                };
            })
            .filter((group) => {
                // Keep group if it has matching tenants
                if (group.tenants.length > 0) return true;
                if (group.ispActionCounts?.total > 0 && todoFilter !== "tidak_ada") return true;
                // Or if it matches the general "show empty" criteria
                if (!shouldIncludeEmptyIspGroups) return false;
                // If search is active, only show empty group if the ISP name itself matches the search
                if (normalizedSearch) {
                    return group.name.toLowerCase().includes(normalizedSearch);
                }
                return true;
            });

        // Add "Lainnya" group for tenants whose ISP is not in the master list
        const otherTenants = filteredTenants.filter(t =>
            !Array.isArray(t.ispList) || t.ispList.every(name => !knownIspNames.has(name))
        );

        if (otherTenants.length > 0) {
            groups.push({
                id: "other",
                isSyntheticGroup: true,
                name: "Lokasi Tanpa ISP Terdaftar",
                logoUrl: null,
                contractReference: "Kumpulan lokasi yang belum terhubung ke ISP master",
                tenants: otherTenants.sort((a, b) => a.name.localeCompare(b.name)),
                activeTenantCount: otherTenants.filter((tenant) => isTenantActive(tenant, todayIso)).length,
                actionTenantCount: otherTenants.filter((tenant) => getTenantActionCounts(tenant, notificationCountsByCustomerId).total > 0).length,
                totalActionCount: otherTenants.reduce((total, tenant) => total + getTenantActionCounts(tenant, notificationCountsByCustomerId).total, 0),
            });
        }

        return groups.sort((a, b) => {
            if (a.id === "other") return 1;
            if (b.id === "other") return -1;

            if (ispSortMethod === "oldest") return a.id - b.id;
            if (ispSortMethod === "name_asc") return a.name.localeCompare(b.name);
            if (ispSortMethod === "name_desc") return b.name.localeCompare(a.name);

            // Default: newest first
            return b.id - a.id;
        });
    }, [filteredIsps, filteredTenants, shouldIncludeEmptyIspGroups, normalizedSearch, ispSortMethod, todayIso, notificationCountsByCustomerId, notificationCountsByIspId, todoFilter]);

    const totalPages = Math.ceil(allGroups.length / itemsPerPage);
    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return allGroups.slice(start, start + itemsPerPage);
    }, [allGroups, currentPage, itemsPerPage]);

    // --- LOGIC: Stats ---
    const totalActiveTenants = customers.filter((tenant) => isTenantActive(tenant, todayIso)).length;
    const totalExpiredTenants = customers.filter((tenant) => getTenantOperationalStatus(tenant, todayIso) === "expired").length;
    const totalPendingTenants = customers.filter((tenant) => getTenantOperationalStatus(tenant, todayIso) === "belum_beroperasi").length;
    const totalActiveOrExpiredTenants = totalActiveTenants + totalExpiredTenants + totalPendingTenants;
    const totalIspExpired = isps.filter((isp) => getIspOperationalStatus(isp, todayIso) === "expired").length;
    const filteredTenantCount = allGroups.reduce((total, group) => total + group.tenants.length, 0);
    const isAnyFilterActive = Boolean(normalizedSearch)
        || contractStatusFilter !== "all"
        || routeStatusFilter !== "all"
        || todoFilter !== "all"
        || ispSortMethod !== "newest";

    const handleResetFilters = () => {
        setSearchTerm("");
        setIspSortMethod("newest");
        setContractStatusFilter("all");
        setRouteStatusFilter("all");
        setTodoFilter("all");
        setCollapsedMap({});
        setCurrentPage(1);
    };

    const handleOpenTenantDetail = (tenant, group, initialTab = "overview") => {
        const tenantCode = typeof tenant?.customerId === "string"
            ? tenant.customerId.trim()
            : "";

        const idCandidates = [tenant?.id, tenant?.customer?.id];
        let resolvedTenantId = null;

        for (const candidate of idCandidates) {
            const parsedId = Number(candidate);
            if (Number.isFinite(parsedId) && parsedId > 0) {
                resolvedTenantId = parsedId;
                break;
            }
        }

        const matchedCustomer = customers.find((customerRow) => {
            const sameId = resolvedTenantId !== null && Number(customerRow.id) === resolvedTenantId;
            const sameCode = tenantCode && String(customerRow.customerId ?? "").trim() === tenantCode;
            return sameId || sameCode;
        });

        const payload = matchedCustomer
            ?? (resolvedTenantId !== null ? { ...tenant, id: resolvedTenantId } : tenant);

        onOpenTenant(payload, initialTab, group);
    };

    const handleDeleteIsp = async (group) => {
        const confirmDelete = window.confirm(
            `PERINGATAN: Menghapus ISP "${group.name}" akan menghapus SEMUA pelanggan yang terkait!\n\nApakah Anda yakin ingin melanjutkan?`,
        );
        if (!confirmDelete) return;

        try {
            const result = await api.isps.delete(group.id);
            const deletedCount = result?.deletedCustomersCount || 0;

            if (deletedCount > 0) {
                alert(`ISP berhasil dihapus bersama ${deletedCount} pelanggan terkait.`);
            } else {
                alert("ISP berhasil dihapus.");
            }

            onRefresh?.();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Gagal menghapus ISP.");
        }
    };

    const handleArchiveTenant = async (tenant) => {
        if (!confirm(`Apakah Anda yakin ingin memindahkan lokasi "${tenant.name}" ke sampah?`)) {
            return;
        }

        try {
            await api.customers.delete(tenant.id);

            alert("Lokasi berhasil dipindahkan ke sampah.");
            onRefresh?.();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Terjadi kesalahan saat mengarsipkan lokasi.");
        }
    };

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>
            {/* Background Decorative Blobs */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-[100px]" />
            </div>

            <div className="space-y-3 pb-20 pt-2 md:pt-4">
                {/* 1. HEADER SECTION */}
                <header className="flex flex-col justify-between gap-10 lg:flex-row lg:items-end mb-4">
                    <div>
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-gold-accent/10 border border-gold-accent/20 backdrop-blur-md mb-4">
                            <span className="w-2 h-2 rounded-full bg-gold-accent animate-pulse shadow-gold-glow" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-accent">Workspace Utama</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight">
                            ISP & <span className="text-gold-accent italic">Lokasi</span>
                        </h1>
                        <p className="mt-1 max-w-xl text-[11px] font-bold text-white/40">
                            Panel integrasi layer grouping ISP dan entitas operasional lokasi.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {canCreateIsp && (
                            <button
                                onClick={onOpenCreateIsp}
                                className="h-10 inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/10 transition-all active:scale-95 shadow-glass-depth backdrop-blur-md"
                            >
                                <span className="material-symbols-outlined text-[15px] text-gold-accent">add_link</span>
                                ISP Baru
                            </button>
                        )}
                        {canCreateTenant && (
                            <button
                                onClick={onOpenCreateTenant}
                                className="h-10 inline-flex items-center gap-2 rounded-xl bg-gold-accent px-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-900 active:scale-95 shadow-gold-glow transition-all"
                            >
                                <span className="material-symbols-outlined text-[15px] text-slate-900">person_add</span>
                                Lokasi Baru
                            </button>
                        )}
                        <button
                            onClick={() => void onRefresh()}
                            className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 hover:text-white transition-all group active:rotate-180 shadow-glass-depth backdrop-blur-md"
                        >
                            <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">sync</span>
                        </button>
                    </div>
                </header>

                {/* 2. ERROR STATE */}
                {(error || secondaryError) && (
                    <div className="rounded-premium bg-red-500/10 border border-red-500/20 p-8 flex items-center gap-6 animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 backdrop-blur-md">
                            <span className="material-symbols-outlined text-3xl">report</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Terjadi Gangguan Sistem</h4>
                            <p className="text-xs font-bold text-red-200/60 uppercase tracking-wider">{error || secondaryError}</p>
                        </div>
                    </div>
                )}

                {/* 3. SUMMARY CARDS */}
                <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {[
                        { label: "Total ISP", value: isps.length, icon: "domain", color: "text-white", bg: "bg-white/5", border: "border-white/10" },
                        { label: "Total Lokasi", value: totalActiveOrExpiredTenants, icon: "groups", color: "text-white", bg: "bg-white/5", border: "border-white/10" },
                        { label: "Lokasi Belum Beroperasi", value: totalPendingTenants, icon: "schedule", color: "text-[#38bdf8]", bg: "bg-[#38bdf8]/10", border: "border-[#38bdf8]/20" },
                        { label: "ISP Belum Diperpanjang", value: totalIspExpired, icon: "dns", color: "text-[#ffab00]", bg: "bg-[#ffab00]/10", border: "border-[#ffab00]/20" },
                        { label: "Lokasi Belum Diperpanjang", value: totalExpiredTenants, icon: "event_busy", color: "text-[#ffab00]", bg: "bg-[#ffab00]/10", border: "border-[#ffab00]/20" },
                    ].map(({ label, value, icon, color, bg, border }) => (
                        <div key={label} className={`relative overflow-hidden glass-card rounded-xl p-4 group border ${border} transition-all duration-300 hover:scale-[1.03] hover:shadow-xl cursor-default`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[8px] font-black uppercase tracking-widest text-white/40">{label}</p>
                                <div className={`flex h-7 w-7 items-center justify-center rounded-xl ${bg} border ${border}`}>
                                    <span className={`material-symbols-outlined ${color}`} style={{ fontSize: "16px" }}>{icon}</span>
                                </div>
                            </div>
                            <p className={`text-2xl font-black ${color}`}>{value}</p>
                        </div>
                    ))}
                </section>

                {/* Premium Filter Section */}
                <section className="glass-card monitoring-card backdrop-blur-xl rounded-xl p-5 border-white/40 shadow-glass-depth relative z-[40] !overflow-visible">
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Tab Switch - Compact */}
                            <div className="flex shrink-0 h-9 p-1 rounded-xl gap-1 bg-black/40 border border-white/5 backdrop-blur-2xl shadow-inner-glass">
                                <button
                                    className={`flex-1 px-4 rounded-lg text-[9px] font-black tracking-[0.2em] uppercase transition-all duration-500 relative overflow-hidden ${listType === "current" ? "text-white bg-gold-accent shadow-gold-glow" : "text-white/40 hover:text-white/70"}`}
                                    onClick={() => setListType("current")}
                                >
                                    <span className="relative z-10">Saat Ini</span>
                                </button>
                                <button
                                    className={`flex-1 px-4 rounded-lg text-[9px] font-black tracking-[0.2em] uppercase transition-all duration-500 relative overflow-hidden ${listType === "riwayat" ? "text-white bg-gold-accent shadow-gold-glow" : "text-white/40 hover:text-white/70"}`}
                                    onClick={() => setListType("riwayat")}
                                >
                                    <span className="relative z-10">Riwayat</span>
                                </button>
                            </div>

                            {/* Search Input - Compact */}
                            <div className="relative group flex-grow min-w-[200px]">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold-accent transition-all duration-300" style={{ fontSize: "18px" }}>search</span>
                                <input
                                    className="w-full h-9 rounded-xl bg-black/20 border border-white/10 pl-8 pr-3 text-[10px] font-bold text-white placeholder:text-white/20 outline-none transition-all focus:bg-black/40 focus:border-gold-accent/40 focus:ring-2 focus:ring-gold-accent/10 shadow-inner-glass backdrop-blur-md"
                                    onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                                    placeholder="Cari ID, ISP, atau nama lokasi..."
                                    type="text"
                                    value={searchTerm}
                                />
                            </div>

                            <button
                                className={`h-9 w-9 rounded-xl transition-all border flex items-center justify-center backdrop-blur-md ${isAnyFilterActive ? "border-[#ff2400]/40 bg-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white cursor-pointer shadow-[0_0_15px_rgba(255,36,0,0.4)]" : "bg-white/5 border-white/10 text-white/20 opacity-40 cursor-not-allowed"}`}
                                disabled={!isAnyFilterActive}
                                onClick={handleResetFilters}
                                title="Hapus Filter"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>filter_alt_off</span>
                            </button>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 gap-4 ${isTeknisi ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>

                        <CustomSelect
                            label="Status Kontrak"
                            value={contractStatusFilter}
                            onChange={(val) => handleFilterChange(setContractStatusFilter, val)}
                            icon="description"
                            options={[
                                { value: "all", label: "Semua Status" },
                                { value: "beroperasi", label: "Beroperasi" },
                                { value: "belum_beroperasi", label: "Belum Beroperasi" },
                                { value: "expired", label: "Belum Diperpanjang" }
                            ]}
                        />

                        <CustomSelect
                            label="Status Jalur"
                            value={routeStatusFilter}
                            onChange={(val) => handleFilterChange(setRouteStatusFilter, val)}
                            icon="lan"
                            options={[
                                { value: "all", label: "Semua Jalur" },
                                { value: "aktif", label: "Aktif" },
                                { value: "nonaktif", label: "Nonaktif" },
                                { value: "gangguan", label: "Gangguan" },
                                { value: "sedang perbaikan", label: "Perbaikan" }
                            ]}
                        />

                        {!isTeknisi && (
                            <CustomSelect
                                label="Status Tindakan"
                                value={todoFilter}
                                onChange={(val) => handleFilterChange(setTodoFilter, val)}
                                icon="task_alt"
                                options={[
                                    { value: "all", label: "Semua Tindakan" },
                                    { value: "perlu_tindakan", label: "Perlu Tindakan" },
                                    { value: "tidak_ada", label: "Tidak Perlu" }
                                ]}
                            />
                        )}

                        <CustomSelect
                            label="Urutan Tampilan"
                            value={ispSortMethod}
                            onChange={(val) => handleFilterChange(setIspSortMethod, val)}
                            icon="sort"
                            options={[
                                { value: "newest", label: "ISP Terbaru" },
                                { value: "oldest", label: "ISP Terlama" },
                                { value: "name_asc", label: "ISP Nama (A-Z)" },
                                { value: "name_desc", label: "ISP Nama (Z-A)" }
                            ]}
                        />

                    </div>

                    {/* Result Indicators */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/60 shadow-sm backdrop-blur-md">
                            <span><span className="text-white font-black">{filteredTenantCount}</span> Lokasi Terpilih</span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/60 shadow-sm backdrop-blur-md">
                            <span><span className="text-white font-black">{allGroups.length}</span> ISP Terkait</span>
                        </div>

                        {hasMoreCustomers && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest text-blue-200/80 shadow-sm backdrop-blur-md">
                                <span className="material-symbols-outlined text-[15px]">database</span>
                                Data dimuat {customers.length} dari {totalCustomerCount}
                            </div>
                        )}
                    </div>
                </section>




                {/* 5. DATA LIST SECTION */}
                <section className="space-y-4">
                    {isLoading && allGroups.length === 0 ? (
                        <div className="rounded-premium bg-white/5 border border-white/10 py-32 px-6 text-center space-y-6 backdrop-blur-xl shadow-glass-depth">
                            <div className="relative w-20 h-20 mx-auto">
                                <div className="absolute inset-0 border-4 border-gold-accent/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-gold-accent rounded-full animate-spin"></div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-accent animate-pulse">Menyelaraskan Data</p>
                                <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Menghubungkan ke pusat arsip kima...</p>
                            </div>
                        </div>
                    ) : (
                        paginatedGroups.map((group) => {
                            const isExpanded = normalizedSearch ? true : !(collapsedMap[group.id] ?? true);
                            const groupIspId = Number(group.id);
                            const canManageIspGroup = !group.isSyntheticGroup
                                && Number.isFinite(groupIspId)
                                && groupIspId > 0;
                            return (
                                <div key={group.id} className="relative group/group">

                                    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden transition-all duration-500 hover:border-gold-accent/40 shadow-glass-depth hover:shadow-gold-accent/5">
                                        {/* Group Header */}
                                        <div className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between bg-white/[0.03] relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-accent/5 rounded-full -mr-32 -mt-32 blur-[80px] group-hover/group:bg-gold-accent/10 transition-all duration-700 backdrop-blur-md"></div>
                                            <button
                                                className="flex flex-1 items-center gap-4 relative z-10 text-left group/title-btn"
                                                onClick={() => setCollapsedMap((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? true) }))}
                                                type="button"
                                            >
                                                <div className="w-11 h-11 shrink-0 rounded-xl bg-[#fff] shadow-xl flex items-center justify-center text-gold-accent border border-white/10 overflow-hidden relative group-hover/title-btn:scale-105 transition-all duration-500">
                                                    {group.logoUrl ? (
                                                        <img src={group.logoUrl} alt={group.name} className="box-border h-full w-full object-contain p-1.5" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-2xl">router</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-3 mb-0.5">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gold-accent">ISP MITRA</p>
                                                    </div>
                                                    <h3 className="text-lg md:text-xl font-black text-gold-accent tracking-tight leading-none truncate transition-colors group-hover/title-btn:text-white">{group.name}</h3>
                                                    <p className="text-[9px] font-black text-white/20 mt-1 uppercase tracking-widest truncate">{group.contractReference || "No reference index"}</p>
                                                </div>
                                            </button>

                                            <div className="flex flex-wrap items-center gap-2 relative z-10">
                                                {/* 1. Tombol Buka Tutup */}
                                                <button
                                                    onClick={() => setCollapsedMap((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? true) }))}
                                                    type="button"
                                                    className={`flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-white/20 transition-all duration-500 hover:border-gold-accent/40 hover:text-gold-accent backdrop-blur-md ${isExpanded ? "rotate-180 bg-gold-accent/10 text-gold-accent border-gold-accent/30" : ""}`}
                                                    title={isExpanded ? "Tutup" : "Buka"}
                                                >
                                                    <span className="material-symbols-outlined text-[13px]">expand_more</span>
                                                </button>

                                                {/* 2. Jumlah Lokasi */}
                                                <div className="px-3 py-1.5 rounded-full bg-gold-accent/10 border border-gold-accent/20 text-[9px] font-black text-gold-accent uppercase tracking-widest shadow-[0_0_15px_rgba(212,169,55,0.05)] transition-all duration-300 backdrop-blur-md">
                                                    {group.tenants.length} LOKASI
                                                </div>

                                                {/* 3. Jumlah Tindakan */}
                                                <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 backdrop-blur-md ${group.totalActionCount > 0 ? "bg-red-600/10 border border-red-600/20 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.05)] animate-pulse" : "bg-white/5 border border-white/10 text-white/20"}`}>
                                                    {group.totalActionCount} TINDAKAN
                                                </div>

                                                {/* 4. Detail ISP */}
                                                {canManageIspGroup && (
                                                    <button
                                                        className="h-8 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500 hover:text-white transition-all duration-300 active:scale-95 shadow-glass-depth hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-1.5 group/isp-btn backdrop-blur-md"
                                                        onClick={() => onOpenIsp(group)}
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined group-hover/isp-btn:translate-x-0.5 transition-transform" style={{ fontSize: "16px" }}>visibility</span>
                                                        Detail ISP
                                                    </button>
                                                )}

                                                {/* 5. Tombol Hapus */}
                                                {!isTeknisi && canManageIspGroup && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteIsp(group)}
                                                        className="h-8 w-8 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 flex items-center justify-center active:scale-95 shadow-glass-depth backdrop-blur-md"
                                                        title="Hapus ISP"
                                                    >
                                                        <span className="material-symbols-outlined text-[15px]">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Group Content (Table) */}
                                        {isExpanded && (
                                            <div className="p-6 pt-2 border-t border-white/5">
                                                <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur-md custom-scrollbar">
                                                    <table className="w-full border-collapse min-w-[800px]">
                                                        <thead>
                                                            <tr className="border-b border-white/10">
                                                                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-gold-accent/60">Info Lokasi</th>
                                                                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Paket</th>
                                                                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Jumlah</th>
                                                                <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Status Operasional</th>
                                                                {!isTeknisi && <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Tindakan</th>}
                                                                <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Aksi</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {group.tenants.length === 0 ? (
                                                                <tr>
                                                                    <td className="px-4 py-8 text-center text-[10px] font-black text-white/20 uppercase tracking-widest" colSpan={isTeknisi ? 5 : 6}>
                                                                        Database lokasi kosong untuk ISP ini.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                group.tenants.map((tenant) => {
                                                                    const actionCounts = getTenantActionCounts(tenant, notificationCountsByCustomerId);
                                                                    return (
                                                                        <tr key={`${group.id}-${tenant.id}`} className="hover:bg-white/[0.04] transition-colors group/row">
                                                                            <td className="px-4 py-2.5">
                                                                                <p className="text-[11px] font-black text-white group-hover/row:text-gold-accent transition-colors break-words max-w-[250px]">{tenant.name}</p>
                                                                                <p className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase mt-0.5">{getCurrentContractNumber(tenant, todayIso)}</p>
                                                                            </td>
                                                                            <td className="px-4 py-2.5">
                                                                                {tenant.paket ? (() => {
                                                                                    const packageDisplay = getPackageDisplay(tenant.paket);

                                                                                    return (
                                                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${packageDisplay.isSharingPackage
                                                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                                                            }`}>
                                                                                            {packageDisplay.label}
                                                                                        </span>
                                                                                    );
                                                                                })() : (
                                                                                    <span className="text-[9px] font-bold text-white/20">-</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-2.5">
                                                                                <span className="text-[11px] font-black text-white/80">
                                                                                    {tenant.jumlah != null && tenant.jumlah !== "" ? tenant.jumlah : "-"}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-2.5">
                                                                                <div className="flex flex-wrap items-center gap-2">
                                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isTenantActive(tenant, todayIso)
                                                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                                                        : "bg-white/5 text-white/40 border border-white/10"
                                                                                        }`}>
                                                                                        {getTenantOperationalStatus(tenant, todayIso) === "expired"
                                                                                            ? "Belum Diperpanjang"
                                                                                            : getTenantOperationalStatus(tenant, todayIso) === "belum_beroperasi"
                                                                                                ? "Belum Beroperasi"
                                                                                                : isTenantActive(tenant, todayIso)
                                                                                                    ? "Beroperasi"
                                                                                                    : "Berhenti"}
                                                                                    </span>
                                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${resolveTenantRouteStatus(tenant, todayIso) === "gangguan"
                                                                                        ? "bg-red-600/10 text-red-400 border border-red-600/20"
                                                                                        : resolveTenantRouteStatus(tenant, todayIso) === "perbaikan"
                                                                                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                                                            : resolveTenantRouteStatus(tenant, todayIso) === "nonaktif"
                                                                                                ? "bg-white/5 text-white/40 border border-white/10"
                                                                                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                                                        }`}>
                                                                                        Jalur {
                                                                                            resolveTenantRouteStatus(tenant, todayIso) === "gangguan"
                                                                                                ? "Gangguan"
                                                                                                : resolveTenantRouteStatus(tenant, todayIso) === "perbaikan"
                                                                                                    ? "Perbaikan"
                                                                                                    : resolveTenantRouteStatus(tenant, todayIso) === "nonaktif"
                                                                                                        ? "Nonaktif"
                                                                                                        : "Aktif"
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            {!isTeknisi && (
                                                                                <td className="px-4 py-2.5">
                                                                                    <div
                                                                                        className="flex flex-col justify-center"
                                                                                        title={`${actionCounts.total} tindakan aktif${actionCounts.priority > 0 ? `, ${actionCounts.priority} prioritas` : ""}${actionCounts.needAction > 0 ? `, ${actionCounts.needAction} perlu tindakan` : ""}`}
                                                                                    >
                                                                                        <span className={`text-[11px] font-black ${actionCounts.total > 0 ? "text-red-500" : "text-white"}`}>{actionCounts.total}</span>
                                                                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Tindakan</span>
                                                                                    </div>
                                                                                </td>
                                                                            )}
                                                                            <td className="px-4 py-2.5 text-right">
                                                                                <div className="flex justify-end gap-2">
                                                                                    {!isTeknisi && (
                                                                                        <button
                                                                                            className="h-7 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 transition-all hover:bg-emerald-500 hover:text-white active:scale-95 shadow-glass-depth backdrop-blur-md"
                                                                                            onClick={() => onOpenTenant(tenant, "invoices", group)}
                                                                                            type="button"
                                                                                        >
                                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>receipt_long</span>
                                                                                            Invoice
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        className="h-7 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 text-[9px] font-black uppercase tracking-widest text-blue-400 transition-all hover:bg-blue-500 hover:text-white active:scale-95 shadow-glass-depth backdrop-blur-md"
                                                                                        onClick={() => handleOpenTenantDetail(tenant, group, "jalur")}
                                                                                        type="button"
                                                                                    >
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>route</span>
                                                                                        Jalur
                                                                                    </button>
                                                                                    <button
                                                                                        className="h-7 inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 text-[9px] font-black uppercase tracking-widest text-white hover:border-gold-accent hover:text-gold-accent transition-all active:scale-95 shadow-glass-depth backdrop-blur-md"
                                                                                        onClick={() => handleOpenTenantDetail(tenant, group)}
                                                                                        type="button"
                                                                                    >
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                                                                                        Detail
                                                                                    </button>
                                                                                    {!isTeknisi && (
                                                                                        <button
                                                                                            className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-red-600/10 text-red-500 border border-red-600/20 shadow-glass-depth hover:bg-red-600 hover:text-white transition-all active:scale-95 backdrop-blur-md"
                                                                                            onClick={() => handleArchiveTenant(tenant)}
                                                                                            title="Hapus Lokasi"
                                                                                            type="button"
                                                                                        >
                                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Pagination Controls */}
                    {!isLoading && totalPages > 1 && (
                        <div className="flex items-center justify-between p-6 rounded-premium bg-white/5 border border-white/10 backdrop-blur-xl shadow-glass-depth">
                            <div className="flex items-center gap-4">
                                <span className="h-px w-6 bg-gold-accent/30"></span>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">
                                    HALAMAN <span className="text-white">{currentPage}</span> / {totalPages}
                                </p>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-gold-accent hover:border-gold-accent/40 disabled:opacity-10 disabled:cursor-not-allowed transition-all duration-300 active:scale-90 backdrop-blur-md"
                                    title="Sebelumnya"
                                >
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>

                                <div className="flex items-center gap-1.5 px-2">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all duration-300 ${currentPage === page ? "bg-gold-gradient text-white shadow-gold-glow scale-105" : "bg-white/5 border border-white/10 text-white/30 hover:text-white hover:border-gold-accent/40"}`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-gold-accent hover:border-gold-accent/40 disabled:opacity-10 disabled:cursor-not-allowed transition-all duration-300 active:scale-90 backdrop-blur-md"
                                    title="Selanjutnya"
                                >
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && hasMoreCustomers && (
                        <div className="flex justify-center">
                            <button
                                onClick={() => void onLoadMoreCustomers?.()}
                                className="h-14 inline-flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:text-gold-accent hover:border-gold-accent/40 transition-all active:scale-95 shadow-glass-depth backdrop-blur-md"
                                type="button"
                            >
                                <span className="material-symbols-outlined">expand_more</span>
                                Muat Lagi ({customers.length}/{totalCustomerCount})
                            </button>
                        </div>
                    )}

                    {/* Simplified Empty State */}
                    {!isLoading && allGroups.length === 0 && (
                        <div className="rounded-premium bg-white/[0.03] border border-white/10 py-32 text-center backdrop-blur-xl shadow-glass-depth group">
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-700 backdrop-blur-md">
                                    <span className="material-symbols-outlined text-5xl text-white/20">search_off</span>
                                </div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Data Tidak Ditemukan</h2>
                                <p className="text-[11px] font-bold text-white/30 mt-3 max-w-xs mx-auto uppercase tracking-widest leading-relaxed">
                                    Parameter filter saat ini tidak menghasilkan rekaman arsip apapun.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </AppShell>
    );
}

export default CustomerWorkspacePage;
