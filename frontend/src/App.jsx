import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import MonitoringSpreadsheetPage from "./features/monitoring/MonitoringSpreadsheetPage";
import CustomerWorkspacePage from "./features/pelanggan/CustomerWorkspacePage";
import IspDetailPage from "./features/pelanggan/IspDetailPage";
import TenantDetailPage from "./features/pelanggan/TenantDetailPage";
import TenantAdminFormPage from "./features/pelanggan/TenantAdminFormPage";
import IspAdminFormPage from "./features/pelanggan/IspAdminFormPage";
import LoginPage from "./features/login/LoginPage";
import { sectionMeta } from "./app/constants";
import { API_BASE_URL, fetchJson, mapCustomerToRow } from "./app/utils";
import {
    APP_PATHS,
    normalizePathname,
    parseAppRoute,
    resolveCustomerByIdentifier,
    resolveIspByIdentifier,
} from "./app/routes";
import "./App.css";

function App() {
    const [locationState, setLocationState] = useState(() => ({
        pathname: typeof window !== "undefined"
            ? normalizePathname(window.location.pathname) === "/"
                ? APP_PATHS.customers
                : window.location.pathname
            : APP_PATHS.customers,
        search: typeof window !== "undefined" ? window.location.search : "",
    }));
    const [customers, setCustomers] = useState([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [customersError, setCustomersError] = useState("");
    const [isps, setIsps] = useState([]);
    const [isLoadingIsps, setIsLoadingIsps] = useState(false);
    const [ispsError, setIspsError] = useState("");
    const route = useMemo(
        () => parseAppRoute(locationState.pathname, locationState.search),
        [locationState.pathname, locationState.search],
    );

    const loadCustomers = useCallback(async () => {
        setIsLoadingCustomers(true);
        setCustomersError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers`);
            const mappedCustomers = Array.isArray(result)
                ? result.map((customer, index) => mapCustomerToRow(customer, index))
                : [];

            setCustomers(mappedCustomers);

            return mappedCustomers;
        } catch (error) {
            setCustomersError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat daftar pelanggan.",
            );

            return [];
        } finally {
            setIsLoadingCustomers(false);
        }
    }, []);

    useEffect(() => {
        void loadCustomers();
    }, [loadCustomers]);

    const loadIsps = useCallback(async () => {
        setIsLoadingIsps(true);
        setIspsError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/isps`);
            setIsps(Array.isArray(result) ? result : []);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            setIspsError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat daftar ISP.",
            );
            return [];
        } finally {
            setIsLoadingIsps(false);
        }
    }, []);

    useEffect(() => {
        void loadIsps();
    }, [loadIsps]);

    const navigateTo = useCallback((targetPath, { replace = false } = {}) => {
        if (typeof window === "undefined") {
            return;
        }

        const nextUrl = new URL(targetPath, window.location.origin);
        const nextState = {
            pathname: nextUrl.pathname,
            search: nextUrl.search,
        };

        if (replace) {
            window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
        } else {
            window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
        }

        setLocationState(nextState);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const handlePopState = () => {
            setLocationState({
                pathname: window.location.pathname,
                search: window.location.search,
            });
        };

        window.addEventListener("popstate", handlePopState);

        if (normalizePathname(window.location.pathname) === "/") {
            navigateTo(APP_PATHS.customers, { replace: true });
        }

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [navigateTo]);

    useEffect(() => {
        if (route.type === "redirect") {
            navigateTo(route.to, { replace: true });
        }
    }, [navigateTo, route]);

    const ispOptions = useMemo(() => {
        const uniqueIsp = new Set();
        customers.forEach((item) => {
            if (Array.isArray(item.ispList) && item.ispList.length > 0) {
                item.ispList.forEach((ispName) => uniqueIsp.add(ispName));
                return;
            }

            if (item.isp) {
                uniqueIsp.add(item.isp);
            }
        });

        return Array.from(uniqueIsp).sort((left, right) => left.localeCompare(right));
    }, [customers]);

    const activeSection = route.sectionKey ?? "customers";
    const selectedCustomer = route.type === "customer-detail"
        || route.type === "customer-edit"
        || route.type === "customer-jalur"
        || route.type === "customer-jalur-planner"
        || route.type === "customer-jalur-fullscreen"
        ? resolveCustomerByIdentifier(customers, route.customerId)
        : null;
    const selectedCustomerContextIsp = route.contextIspId
        ? resolveIspByIdentifier(isps, route.contextIspId)
        : null;
    const selectedIsp = route.type === "isp-detail" || route.type === "isp-edit"
        ? resolveIspByIdentifier(isps, route.ispId)
        : null;
    const createTenantContextIsp = route.type === "customer-create"
        ? resolveIspByIdentifier(isps, route.contextIspId)
        : null;
    const editingCustomer = route.type === "customer-edit" ? selectedCustomer : null;
    const editingIsp = route.type === "isp-edit" ? selectedIsp : null;
    const customerDetailReady = route.type !== "customer-detail"
        && route.type !== "customer-edit"
        && route.type !== "customer-jalur"
        && route.type !== "customer-jalur-planner"
        && route.type !== "customer-jalur-fullscreen"
        ? true
        : Boolean(selectedCustomer) || (!isLoadingCustomers && customers.length > 0);
    const ispDetailReady = route.type !== "isp-detail" && route.type !== "isp-edit"
        ? true
        : Boolean(selectedIsp) || (!isLoadingIsps && isps.length > 0);

    const handleNavigate = useCallback((sectionKey) => {
        const targetPath = {
            dashboard: APP_PATHS.dashboard,
            customers: APP_PATHS.customers,
            monitoring: APP_PATHS.monitoring,
            trash: APP_PATHS.trash,
        }[sectionKey];

        if (targetPath) {
            navigateTo(targetPath);
        }
    }, [navigateTo]);

    const handleOpenTenantDetail = useCallback((customer, initialTab = "overview", contextIsp = null) => {
        const resolvedCustomerId = Number(customer?.id);
        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        setCustomersError("");
        navigateTo(APP_PATHS.customerDetail(resolvedCustomerId, {
            tab: initialTab,
            ispId: contextIsp?.id ?? null,
        }));
    }, [navigateTo]);

    const handleOpenIspDetail = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(APP_PATHS.ispDetail(resolvedIspId));
    }, [navigateTo]);

    const handleOpenCreateTenant = useCallback(() => {
        navigateTo(APP_PATHS.customerCreate);
    }, [navigateTo]);

    const handleOpenCreateTenantFromIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        const nextPath = Number.isFinite(resolvedIspId) && resolvedIspId > 0
            ? `${APP_PATHS.customerCreate}?isp=${resolvedIspId}`
            : APP_PATHS.customerCreate;

        navigateTo(nextPath);
    }, [navigateTo]);

    const handleOpenCreateIsp = useCallback(() => {
        navigateTo(APP_PATHS.ispCreate);
    }, [navigateTo]);

    const handleCancelCreate = useCallback(() => {
        if (route.type === "customer-edit" && selectedCustomer) {
            navigateTo(APP_PATHS.customerDetail(selectedCustomer.id), { replace: true });
            return;
        }

        if (route.type === "isp-edit" && selectedIsp) {
            navigateTo(APP_PATHS.ispDetail(selectedIsp.id), { replace: true });
            return;
        }

        navigateTo(APP_PATHS.customers, { replace: true });
    }, [navigateTo, route.type, selectedCustomer, selectedIsp]);

    const handleOpenEditIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(APP_PATHS.ispEdit(resolvedIspId));
    }, [navigateTo]);

    const handleOpenEditTenant = useCallback((customer) => {
        const resolvedCustomerId = Number(customer?.id);
        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        navigateTo(APP_PATHS.customerEdit(resolvedCustomerId));
    }, [navigateTo]);

    const handleEntitySaved = useCallback(async (savedEntity, type) => {
        await Promise.all([loadCustomers(), loadIsps()]);

        if (type === "isp") {
            const savedIspId = Number(savedEntity?.id);
            if (Number.isFinite(savedIspId) && savedIspId > 0) {
                navigateTo(APP_PATHS.ispDetail(savedIspId), { replace: true });
                return;
            }
        } else {
            const savedCustomerId = Number(savedEntity?.id);
            if (Number.isFinite(savedCustomerId) && savedCustomerId > 0) {
                navigateTo(APP_PATHS.customerDetail(savedCustomerId), { replace: true });
                return;
            }
        }

        navigateTo(APP_PATHS.customers, { replace: true });
    }, [loadCustomers, loadIsps, navigateTo]);

    const handleOpenCustomerById = useCallback((customerId, initialTab = "overview") => {
        const normalizedCustomerId = Number(customerId);
        const targetCustomer = customers.find((item) => Number(item.id) === normalizedCustomerId);
        if (!targetCustomer) {
            return;
        }

        handleOpenTenantDetail(targetCustomer, initialTab);
    }, [customers, handleOpenTenantDetail]);

    if (route.type === "redirect") {
        return (
            <RouteLoadingPage
                activeSection={activeSection}
                onNavigate={handleNavigate}
                message="Mengarahkan ke halaman pelanggan..."
            />
        );
    }

    if (route.type === "login") {
        return (
            <LoginPage
                onLoginSuccess={() => {
                    navigateTo(APP_PATHS.customers, { replace: true });
                }}
            />
        );
    }

    if (route.type === "section" && route.sectionKey === "dashboard") {
        return (
            <DashboardPage
                activeSection={activeSection}
                customers={customers}
                isLoadingCustomers={isLoadingCustomers}
                onNavigate={handleNavigate}
            />
        );
    }

    if (route.type === "section" && route.sectionKey === "monitoring") {
        return (
            <MonitoringSpreadsheetPage
                activeSection={activeSection}
                ispOptions={ispOptions}
                onNavigate={handleNavigate}
                onOpenCustomerById={handleOpenCustomerById}
            />
        );
    }

    if (route.type === "section" && route.sectionKey === "trash") {
        return (
            <SectionPlaceholderPage
                activeSection={activeSection}
                onNavigate={handleNavigate}
            />
        );
    }

    if (route.type === "customer-create") {
        return (
            <TenantAdminFormPage
                isps={isps}
                lockedIsp={createTenantContextIsp}
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={(entity) => handleEntitySaved(entity, "tenant")}
            />
        );
    }

    if (route.type === "isp-create") {
        return (
            <IspAdminFormPage
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={(entity) => handleEntitySaved(entity, "isp")}
            />
        );
    }

    if (route.type === "customer-edit") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat data tenant untuk halaman edit..."
                />
            );
        }

        if (!editingCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Tenant yang diminta tidak tersedia atau belum dimuat."
                />
            );
        }

        return (
            <TenantAdminFormPage
                initialData={editingCustomer}
                isps={isps}
                mode="edit"
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                    navigateTo(APP_PATHS.customerDetail(editingCustomer.id), { replace: true });
                }}
            />
        );
    }

    if (route.type === "isp-edit") {
        if (!ispDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat data ISP untuk halaman edit..."
                />
            );
        }

        if (!editingIsp) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="ISP tidak ditemukan"
                    description="ISP yang diminta tidak tersedia atau belum dimuat."
                />
            );
        }

        return (
            <IspAdminFormPage
                initialData={editingIsp}
                mode="edit"
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                    navigateTo(APP_PATHS.ispDetail(editingIsp.id), { replace: true });
                }}
            />
        );
    }

    if (route.type === "isp-detail") {
        if (!ispDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat detail ISP..."
                />
            );
        }

        if (!selectedIsp) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="ISP tidak ditemukan"
                    description="Data ISP yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <IspDetailPage
                isp={selectedIsp}
                onBack={() => navigateTo(APP_PATHS.customers, { replace: true })}
                onEditIsp={handleOpenEditIsp}
                onNavigate={handleNavigate}
                onOpenCreateTenant={handleOpenCreateTenantFromIsp}
                onOpenTenant={(tenant, initialTab = "overview") =>
                    handleOpenTenantDetail(tenant, initialTab, selectedIsp)}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
            />
        );
    }

    if (route.type === "customer-detail") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat detail tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <TenantDetailPage
                customer={selectedCustomer}
                contextIsp={selectedCustomerContextIsp}
                initialTab={route.initialTab}
                onBack={() => {
                    navigateTo(APP_PATHS.customers, { replace: true });
                }}
                onEditTenant={handleOpenEditTenant}
                onCreateIsp={handleOpenCreateIsp}
                onNavigate={handleNavigate}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
                onTabChange={(nextTab) => {
                    if (nextTab === "jalur") {
                        navigateTo(APP_PATHS.customerJalur(selectedCustomer.id), { replace: true });
                        return;
                    }

                    navigateTo(APP_PATHS.customerDetail(selectedCustomer.id, {
                        tab: nextTab,
                        ispId: selectedCustomerContextIsp?.id ?? null,
                    }), { replace: true });
                }}
                onOpenRoutePlanner={(tenant) => {
                    const resolvedCustomerId = Number(tenant?.id ?? selectedCustomer.id);
                    if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
                        setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
                        return;
                    }

                    navigateTo(APP_PATHS.customerJalurFullscreen(resolvedCustomerId));
                }}
            />
        );
    }

    if (route.type === "customer-jalur-fullscreen") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat tampilan jalur..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <TenantDetailPage
                customer={selectedCustomer}
                initialTab="jalur"
                backLabel="Kembali ke Detail Tenant"
                onBack={() => {
                    navigateTo(APP_PATHS.customerDetail(selectedCustomer.id), { replace: true });
                }}
                onEditTenant={handleOpenEditTenant}
                onNavigate={handleNavigate}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
                routeViewMode="standalone"
                hideSidebar={true}
            />
        );
    }

    if (route.type === "customer-jalur") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat pengaturan jalur tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <TenantDetailPage
                customer={selectedCustomer}
                initialTab="jalur"
                backLabel="Kembali ke Detail Tenant"
                onBack={() => {
                    navigateTo(APP_PATHS.customerDetail(selectedCustomer.id), { replace: true });
                }}
                onEditTenant={handleOpenEditTenant}
                onNavigate={handleNavigate}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
                onOpenRoutePlanner={(tenant) => {
                    const resolvedCustomerId = Number(tenant?.id ?? selectedCustomer.id);
                    if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
                        setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
                        return;
                    }

                    navigateTo(APP_PATHS.customerJalurPlanner(resolvedCustomerId));
                }}
                routeViewMode="standalone"
            />
        );
    }

    if (route.type === "customer-jalur-planner") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    message="Memuat FO route planner tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <TenantDetailPage
                customer={selectedCustomer}
                initialTab="jalur"
                backLabel="Kembali ke Halaman Jalur"
                onBack={() => {
                    navigateTo(APP_PATHS.customerJalur(selectedCustomer.id), { replace: true });
                }}
                onEditTenant={handleOpenEditTenant}
                onNavigate={handleNavigate}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
                routeViewMode="planner"
            />
        );
    }

    if (route.type === "not-found") {
        return (
            <RouteMissingPage
                activeSection={activeSection}
                onNavigate={handleNavigate}
                title="Halaman tidak ditemukan"
                description="Path yang Anda buka belum terdaftar di aplikasi ini."
            />
        );
    }

    return (
        <CustomerWorkspacePage
            activeSection={activeSection}
            customers={customers}
            isps={isps}
            error={customersError}
            secondaryError={ispsError}
            isLoading={isLoadingCustomers || isLoadingIsps}
            onNavigate={handleNavigate}
            onOpenTenant={handleOpenTenantDetail}
            onOpenIsp={handleOpenIspDetail}
            onOpenCreateTenant={handleOpenCreateTenant}
            onOpenCreateIsp={handleOpenCreateIsp}
            onRefresh={async () => {
                await Promise.all([loadCustomers(), loadIsps()]);
            }}
        />
    );
}

function RouteLoadingPage({ activeSection, onNavigate, message }) {
    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center">
                <div className="rounded-2xl border border-slate-100 bg-surface-container-lowest px-6 py-5 text-sm text-on-surface-variant shadow-sm">
                    {message}
                </div>
            </div>
        </AppShell>
    );
}

function RouteMissingPage({ activeSection, onNavigate, title, description }) {
    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-4xl">
                <section className="rounded-2xl border border-slate-100 bg-surface-container-lowest p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <span className="material-symbols-outlined rounded-lg bg-red-50 p-2 text-red-600">
                            report
                        </span>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
                                {title}
                            </h1>
                            <p className="mt-2 text-sm text-on-surface-variant">
                                {description}
                            </p>
                        </div>
                    </div>

                    <button
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-bold text-white"
                        onClick={() => onNavigate("customers")}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">groups</span>
                        Kembali ke Customer Page
                    </button>
                </section>
            </div>
        </AppShell>
    );
}

function SectionPlaceholderPage({ activeSection, onNavigate }) {
    const section = sectionMeta[activeSection] ?? sectionMeta.dashboard;
    const isTrashSection = activeSection === "trash";

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-5xl">
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-primary">{section.title}</h1>
                    <p className="mt-3 max-w-2xl text-on-surface-variant">{section.description}</p>
                </header>

                <section className="rounded-2xl border border-slate-100 bg-surface-container-lowest p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-primary">
                            {isTrashSection ? "delete" : "construction"}
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-on-surface">
                                {isTrashSection
                                    ? "Antrian Pemulihan"
                                    : "Modul Disiapkan"}
                            </h2>
                            <p className="text-sm text-on-surface-variant">
                                {isTrashSection
                                    ? "Tempat sampah dipakai untuk item terhapus sementara sebelum proses pembersihan permanen."
                                    : `Untuk modul ${section.title.toLowerCase()}, endpoint backend final belum tersedia.`}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Status UI</p>
                            <p className="mt-2 text-sm text-on-surface">
                                {isTrashSection
                                    ? "Mode read-only pendukung workflow"
                                    : "Sudah siap dipasang data"}
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Backend</p>
                            <p className="mt-2 text-sm text-on-surface">Menunggu endpoint write/list final</p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Temporary UX</p>
                            <p className="mt-2 text-sm text-on-surface">Arahkan workflow ke modul aktif</p>
                        </div>
                    </div>

                    <button
                        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-bold text-white"
                        onClick={() => onNavigate("customers")}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">groups</span>
                        Kembali ke Direktori Pelanggan
                    </button>
                </section>
            </div>
        </AppShell>
    );
}

export default App;
