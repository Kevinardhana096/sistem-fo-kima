import { useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { SummaryCard } from "../../components/shared/AppShared";
import { API_BASE_URL, fetchJson } from "../../app/utils";

function CustomerWorkspacePage({
    activeSection,
    customers,
    isps,
    error,
    secondaryError,
    isLoading,
    onNavigate,
    onOpenTenant,
    onOpenIsp,
    onOpenCreateTenant,
    onOpenCreateIsp,
    onRefresh,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [listType, setListType] = useState("current");
    const [selectedIspFilter, setSelectedIspFilter] = useState("all");
    const [contractStatusFilter, setContractStatusFilter] = useState("all");
    const [routeStatusFilter, setRouteStatusFilter] = useState("all");
    const [todoFilter, setTodoFilter] = useState("all");
    const [collapsedMap, setCollapsedMap] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const todayIso = new Date().toISOString().slice(0, 10);
    const isTenantActive = (tenant) => String(tenant?.rawStatus ?? "")
        .trim()
        .toLowerCase() === "aktif";

    // Reset to page 1 when any filter changes
    const handleFilterChange = (setter, value) => {
        setter(value);
        setCurrentPage(1);
    };

    // --- LOGIC: Filter ISP ---
    const filteredIsps = useMemo(() => isps, [isps]);

    const ispFilterOptions = useMemo(
        () => filteredIsps.map((isp) => isp.name).sort((a, b) => a.localeCompare(b)),
        [filteredIsps],
    );

    const effectiveSelectedIspFilter = selectedIspFilter !== "all" && !ispFilterOptions.includes(selectedIspFilter)
        ? "all"
        : selectedIspFilter;
    const shouldIncludeEmptyIspGroups = !normalizedSearch
        && listType === "current"
        && contractStatusFilter === "all"
        && routeStatusFilter === "all"
        && todoFilter === "all";

    // --- LOGIC: Groups & Tenants ---
    const allGroups = useMemo(() => filteredIsps
        .filter((isp) => effectiveSelectedIspFilter === "all" || isp.name === effectiveSelectedIspFilter)
        .map((isp) => {
            const tenants = customers
                .filter((customerRow) => Array.isArray(customerRow.ispList) && customerRow.ispList.includes(isp.name))
                .filter((tenant) => {
                    const searchableText = [
                        tenant.name,
                        tenant.customerId,
                        tenant.ispDisplay,
                        ...(Array.isArray(tenant.ispList) ? tenant.ispList : []),
                        isp.name,
                    ].filter(Boolean).join(" ").toLowerCase();

                    const contractEndDate = typeof tenant.contractPeriodEnd === "string"
                        ? tenant.contractPeriodEnd.slice(0, 10)
                        : "";
                    const contractStatusKey = contractEndDate && contractEndDate < todayIso
                        ? "expired"
                        : "beroperasi";
                    const matchesListType = listType === "riwayat"
                        ? !isTenantActive(tenant)
                        : isTenantActive(tenant);
                    const tenantRouteStatus = typeof tenant.routeStatus === "string" ? tenant.routeStatus : "aktif";
                    const priorityCount = Number(tenant.todoSummary?.counts?.priority ?? 0);
                    const needActionCount = Number(tenant.todoSummary?.counts?.needAction ?? 0);
                    const todoStatusKey = priorityCount + needActionCount > 0 ? "perlu_tindakan" : "tidak_ada";

                    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
                    const matchesContractStatus = contractStatusFilter === "all" ? true : contractStatusKey === contractStatusFilter;
                    const matchesRouteStatus = routeStatusFilter === "all" ? true : tenantRouteStatus === routeStatusFilter;
                    const matchesTodo = todoFilter === "all" ? true : todoStatusKey === todoFilter;

                    return matchesListType && matchesSearch && matchesContractStatus && matchesRouteStatus && matchesTodo;
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            const actionTenantCount = tenants.filter((tenant) => {
                const priorityCount = Number(tenant.todoSummary?.counts?.priority ?? 0);
                const needActionCount = Number(tenant.todoSummary?.counts?.needAction ?? 0);
                return priorityCount + needActionCount > 0;
            }).length;

            const totalActionCount = tenants.reduce((total, tenant) => {
                const priorityCount = Number(tenant.todoSummary?.counts?.priority ?? 0);
                const needActionCount = Number(tenant.todoSummary?.counts?.needAction ?? 0);
                return total + priorityCount + needActionCount;
            }, 0);

            return {
                ...isp,
                tenants,
                activeTenantCount: tenants.filter((tenant) => isTenantActive(tenant)).length,
                actionTenantCount,
                totalActionCount,
            };
        })
        .filter((group) => group.tenants.length > 0 || shouldIncludeEmptyIspGroups)
        .sort((a, b) => a.name.localeCompare(b.name)), [
        customers,
        filteredIsps,
        normalizedSearch,
        effectiveSelectedIspFilter,
        contractStatusFilter,
        routeStatusFilter,
        listType,
        todayIso,
        todoFilter,
        shouldIncludeEmptyIspGroups,
    ]);

    const totalPages = Math.ceil(allGroups.length / itemsPerPage);
    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return allGroups.slice(start, start + itemsPerPage);
    }, [allGroups, currentPage, itemsPerPage]);

    // --- LOGIC: Stats ---
    const totalActiveTenants = customers.filter((tenant) => isTenantActive(tenant)).length;
    const totalNonActiveTenants = customers.length - totalActiveTenants;
    const filteredTenantCount = allGroups.reduce((total, group) => total + group.tenants.length, 0);
    const filteredActionTenantCount = allGroups.reduce((total, group) => total + group.actionTenantCount, 0);
    const isAnyFilterActive = Boolean(normalizedSearch)
        || effectiveSelectedIspFilter !== "all"
        || contractStatusFilter !== "all"
        || routeStatusFilter !== "all"
        || todoFilter !== "all";

    const handleResetFilters = () => {
        setSearchTerm("");
        setSelectedIspFilter("all");
        setContractStatusFilter("all");
        setRouteStatusFilter("all");
        setTodoFilter("all");
        setCollapsedMap({});
        setCurrentPage(1);
    };

    const handleOpenTenantDetail = (tenant, group) => {
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

        onOpenTenant(payload, "overview", group);
    };

    const handleDeleteIsp = async (group) => {
        const confirmDelete = window.confirm(
            `Apakah Anda yakin ingin menghapus ISP"${group.name}"?`,
        );
        if (!confirmDelete) return;

        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${group.id}`,
                {
                    method: "DELETE",
                });

            alert("ISP berhasil dihapus.");
            onRefresh?.();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Gagal menghapus ISP.");
        }
    };

    const handleArchiveTenant = async (tenant) => {
        if (!confirm(`Apakah Anda yakin ingin memindahkan tenant "${tenant.name}" ke sampah?`)) {
            return;
        }

        try {
            await fetchJson(`${API_BASE_URL}/api/customers/${tenant.id}/archive`, {
                method: "PATCH",
            });

            alert("Tenant berhasil dipindahkan ke sampah.");
            onRefresh?.();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Terjadi kesalahan saat mengarsipkan tenant.");
        }
    };

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            {/* Background Decorative Blobs */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-[100px]" />
            </div>

            <div className="mx-auto max-w-7xl space-y-10 px-4 py-6">
                {/* 1. HEADER SECTION */}
                <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Workspace</span>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-on-surface">
                            ISP & <span className="text-primary">Tenants.</span>
                        </h1>
                        <p className="max-w-xl text-sm font-medium leading-relaxed text-on-surface/60">
                            Visualisasi layer grouping ISP dan entitas operasional tenant dalam satu dashboard terintegrasi.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={onOpenCreateIsp}
                            className="glass-card inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold text-on-surface hover:bg-white transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-primary">add_link</span>
                            ISP Baru
                        </button>
                        <button
                            onClick={onOpenCreateTenant}
                            className="btn-gradient inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold active:scale-95"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            Tenant Baru
                        </button>
                        <button
                            onClick={() => void onRefresh()}
                            className="glass-card inline-flex items-center justify-center rounded-2xl w-[56px] h-[56px] text-on-surface hover:text-primary transition-all group active:rotate-180"
                        >
                            <span className="material-symbols-outlined group-hover:scale-110">sync</span>
                        </button>
                    </div>
                </header>

                {/* 2. ERROR STATE */}
                {(error || secondaryError) && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                        {error && (
                            <div className="rounded-2xl bg-rose-50 border border-rose-100 px-5 py-4 text-sm font-bold text-rose-600 flex items-center gap-3">
                                <span className="material-symbols-outlined">error</span> {error}
                            </div>
                        )}
                        {secondaryError && (
                            <div className="rounded-2xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm font-bold text-primary flex items-center gap-3">
                                <span className="material-symbols-outlined">info</span> {secondaryError}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. SUMMARY CARDS */}
                <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Total ISP" value={isps.length} icon="device_hub" className="glass-card border-b-4 border-b-primary/40" />
                    <SummaryCard label="Total Tenant" value={customers.length} icon="groups" className="glass-card" />
                    <SummaryCard label="Active Tenant" value={totalActiveTenants} icon="check_circle" className="glass-card text-secondary" />
                    <SummaryCard label="Non-active Tenant" value={totalNonActiveTenants} icon="cancel" className="glass-card" />
                </section>

                {/* 4. FILTER PANEL */}
                <section className="glass-card rounded-[2.5rem] p-8 space-y-8">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <nav className="flex bg-surface-container-low p-1.5 rounded-2xl w-fit">
                            <button
                                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${listType === "current" ? "bg-white text-primary shadow-sm" : "text-on-surface/40 hover:text-on-surface"}`}
                                onClick={() => setListType("current")}
                            >
                                SAAT INI
                            </button>
                            <button
                                className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${listType === "riwayat" ? "bg-white text-primary shadow-sm" : "text-on-surface/40 hover:text-on-surface"}`}
                                onClick={() => setListType("riwayat")}
                            >
                                RIWAYAT
                            </button>
                        </nav>

                        <button
                            disabled={!isAnyFilterActive}
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-2 text-xs font-black text-primary/60 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            Reset Filter
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                        <div className="relative xl:col-span-2 group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface/30 group-focus-within:text-primary transition-colors">search</span>
                            <input
                                className="glass-input w-full rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none"
                                onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
                                placeholder="Cari ID, ISP, atau nama tenant..."
                                type="text"
                                value={searchTerm}
                            />
                        </div>

                        <select
                            className="glass-input rounded-2xl px-4 py-4 text-sm font-bold outline-none cursor-pointer appearance-none"
                            onChange={(e) => setSelectedIspFilter(e.target.value)}
                            value={effectiveSelectedIspFilter}
                        >
                            <option value="all">Semua ISP</option>
                            {ispFilterOptions.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>

                        <select
                            className="glass-input rounded-2xl px-4 py-4 text-sm font-bold outline-none cursor-pointer appearance-none"
                            onChange={(e) => setContractStatusFilter(e.target.value)}
                            value={contractStatusFilter}
                        >
                            <option value="all">Status Kontrak</option>
                            <option value="beroperasi">Beroperasi</option>
                            <option value="expired">Expired</option>
                        </select>

                        <select
                            className="glass-input rounded-2xl px-4 py-4 text-sm font-bold outline-none cursor-pointer appearance-none"
                            onChange={(e) => setRouteStatusFilter(e.target.value)}
                            value={routeStatusFilter}
                        >
                            <option value="all">Status Jalur</option>
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Nonaktif</option>
                            <option value="gangguan">Gangguan</option>
                        </select>

                        <select
                            className="glass-input rounded-2xl px-4 py-4 text-sm font-bold outline-none cursor-pointer appearance-none"
                            onChange={(e) => setTodoFilter(e.target.value)}
                            value={todoFilter}
                        >
                            <option value="all">Status Tindakan</option>
                            <option value="perlu_tindakan">⚠️ Perlu Tindakan</option>
                            <option value="tidak_ada">✅ Selesai</option>
                        </select>
                    </div>

                    {/* Filter Indicators */}
                    <div className="flex flex-wrap gap-3 pt-2">
                        <div className="px-4 py-2 rounded-xl bg-on-surface/[0.03] border border-on-surface/5 text-[11px] font-bold text-on-surface/60">
                            <span className="text-primary mr-1">●</span> {filteredTenantCount} Tenant Terfilter
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-on-surface/[0.03] border border-on-surface/5 text-[11px] font-bold text-on-surface/60">
                            <span className="text-secondary mr-1">●</span> {allGroups.length} ISP Terhubung
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-100 text-[11px] font-bold text-rose-600">
                            <span className="mr-1">●</span> {filteredActionTenantCount} Butuh Perhatian
                        </div>
                    </div>
                </section>

                {/* 5. DATA LIST SECTION */}
                <section className="space-y-6">
                    {isLoading ? (
                        <div className="glass-card rounded-[2rem] p-20 text-center space-y-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                            <p className="text-sm font-black uppercase tracking-widest text-on-surface/40">Menyelaraskan Data...</p>
                        </div>
                    ) : (
                        paginatedGroups.map((group) => {
                            const isExpanded = normalizedSearch ? true : !collapsedMap[group.id];
                            return (
                                <div key={group.id} className="glass-card overflow-hidden rounded-[2.5rem] transition-all hover:translate-y-[-2px] hover:shadow-2xl">
                                    {/* Group Header */}
                                    <div className="flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between bg-gradient-to-r from-on-surface/[0.02] to-transparent">
                                        <button
                                            className="flex flex-1 items-center gap-6 text-left"
                                            onClick={() => setCollapsedMap((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                                            type="button"
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary border border-on-surface/5 overflow-hidden">
                                                {group.logoUrl ? (
                                                    <img src={group.logoUrl} alt={group.name} className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-3xl">router</span>
                                                )}
                                            </div>                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">ISP PROVIDER</p>
                                                <h3 className="text-2xl font-black text-on-surface tracking-tight">{group.name}</h3>
                                                <p className="text-xs font-medium text-on-surface/40 italic">{group.contractReference || "No contract info"}</p>
                                            </div>
                                            <span className={`material-symbols-outlined ml-auto text-on-surface/20 transition-transform duration-500 ${isExpanded ? "rotate-180 text-primary" : ""}`}>
                                                expand_circle_down
                                            </span>
                                        </button>

                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="px-4 py-2 rounded-xl bg-white/50 text-[11px] font-black text-on-surface">
                                                {group.tenants.length} <span className="text-on-surface/40">TENANTS</span>
                                            </div>
                                            <div
                                                className={`px-4 py-2 rounded-xl text-[11px] font-black border ${group.totalActionCount > 0
                                                    ? "bg-rose-50 text-rose-600 border-rose-100"
                                                    : "bg-white/50 text-on-surface border-on-surface/10"
                                                    }`}
                                            >
                                                {group.totalActionCount} <span className="opacity-70">ACTIONS</span>
                                            </div>
                                            {group.actionTenantCount > 0 && (
                                                <div className="px-4 py-2 rounded-xl bg-rose-500 text-[11px] font-black text-white shadow-lg shadow-rose-200">
                                                    {group.actionTenantCount} ACTION REQUIRED
                                                </div>
                                            )}
                                            <button
                                                className="h-[48px] px-6 rounded-xl bg-on-surface text-white text-xs font-bold hover:bg-primary transition-colors"
                                                onClick={() => onOpenIsp(group)}
                                            >
                                                Detail ISP
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteIsp(group)}
                                                className="h-[48px] w-[48px] rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center"
                                                title={`Hapus ISP ${group.name}`}
                                                aria-label={`Hapus ISP ${group.name}`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Group Content (Table) */}
                                    {isExpanded && (
                                        <div className="p-4 pt-0">
                                            <div className="overflow-x-auto rounded-[1.5rem] border border-on-surface/5 bg-white/30">
                                                <table className="w-full border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-on-surface/5">
                                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface/40">Tenant Info</th>
                                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface/40">Operational Status</th>
                                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface/40">To-Do Metrics</th>
                                                            <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface/40">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-on-surface/5">
                                                        {group.tenants.length === 0 ? (
                                                            <tr>
                                                                <td className="px-8 py-8 text-sm font-medium text-on-surface/50" colSpan={4}>
                                                                    Belum ada tenant terhubung ke ISP ini.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            group.tenants.map((tenant) => (
                                                                <tr key={`${group.id}-${tenant.id}`} className="hover:bg-white/60 transition-colors group/row">
                                                                    <td className="px-8 py-5">
                                                                        <p className="text-sm font-black text-on-surface group-hover/row:text-primary transition-colors">{tenant.name}</p>
                                                                        <p className="text-[10px] font-bold text-on-surface/30 tracking-widest">{tenant.customerId}</p>
                                                                    </td>
                                                                    <td className="px-8 py-5">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${isTenantActive(tenant)
                                                                                ? "bg-secondary/10 text-secondary border border-secondary/20"
                                                                                : "bg-on-surface/5 text-on-surface/40 border border-on-surface/10"
                                                                                }`}>
                                                                                <span className={`w-1 h-1 rounded-full ${isTenantActive(tenant) ? "bg-secondary" : "bg-on-surface/40"}`} />
                                                                                {isTenantActive(tenant) ? "Beroperasi" : "Berhenti"}
                                                                            </span>
                                                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${tenant.routeStatus === "gangguan"
                                                                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                                                : tenant.routeStatus === "nonaktif"
                                                                                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                                                                                    : "bg-blue-100 text-blue-800 border border-blue-200"
                                                                                }`}>
                                                                                <span className={`w-1 h-1 rounded-full ${tenant.routeStatus === "gangguan"
                                                                                    ? "bg-amber-500"
                                                                                    : tenant.routeStatus === "nonaktif"
                                                                                        ? "bg-slate-500"
                                                                                        : "bg-blue-500"
                                                                                    }`} />
                                                                                Jalur {tenant.routeStatus === "gangguan" ? "Gangguan" : tenant.routeStatus === "nonaktif" ? "Nonaktif" : "Aktif"}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-5">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-xs font-black text-on-surface">{tenant.todoSummary?.counts?.priority ?? 0}</span>
                                                                                <span className="text-[9px] font-bold text-rose-500 uppercase">Priority</span>
                                                                            </div>
                                                                            <div className="w-px h-6 bg-on-surface/5" />
                                                                            <div className="flex flex-col">
                                                                                <span className="text-xs font-black text-on-surface">{tenant.todoSummary?.counts?.needAction ?? 0}</span>
                                                                                <span className="text-[9px] font-bold text-on-surface/30 uppercase">Actions</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-5 text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button
                                                                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95"
                                                                                onClick={() => onOpenTenant(tenant, "invoices", group)}
                                                                                type="button"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                                                                Invoice
                                                                            </button>
                                                                            <button
                                                                                className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-black text-on-surface border border-on-surface/5 shadow-sm hover:border-primary hover:text-primary transition-all active:scale-95"
                                                                                onClick={() => handleOpenTenantDetail(tenant, group)}
                                                                                type="button"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                                                                Detail
                                                                            </button>
                                                                            <button
                                                                                className="inline-flex items-center justify-center rounded-lg bg-rose-50 px-2 py-1 text-rose-700 border border-rose-100 shadow-sm hover:bg-rose-100 transition-all active:scale-95"
                                                                                onClick={() => handleArchiveTenant(tenant)}
                                                                                title="Hapus Tenant"
                                                                                type="button"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {/* Pagination Controls */}
                    {!isLoading && totalPages > 1 && (
                        <div className="flex items-center justify-between px-8 py-6 glass-card rounded-[2rem]">
                            <p className="text-xs font-black text-on-surface/40 uppercase tracking-widest">
                                Halaman {currentPage} dari {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="w-10 h-10 rounded-xl bg-white border border-on-surface/10 flex items-center justify-center text-on-surface hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === page ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white border border-on-surface/10 text-on-surface hover:border-primary hover:text-primary"}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    className="w-10 h-10 rounded-xl bg-white border border-on-surface/10 flex items-center justify-center text-on-surface hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && allGroups.length === 0 && (
                        <div className="glass-card rounded-[2.5rem] py-24 text-center">
                            <div className="w-20 h-20 bg-on-surface/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-4xl text-on-surface/20">search_off</span>
                            </div>
                            <h2 className="text-xl font-black text-on-surface">Data tidak ditemukan</h2>
                            <p className="text-sm text-on-surface/40 mt-2 max-w-xs mx-auto">Kami tidak menemukan ISP atau Tenant dengan kriteria filter tersebut.</p>
                            <button
                                onClick={handleResetFilters}
                                className="mt-8 px-8 py-3 bg-primary text-white rounded-2xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                            >
                                Bersihkan Filter
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </AppShell>
    );
}

export default CustomerWorkspacePage;
