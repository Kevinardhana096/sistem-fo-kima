import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { sectionMeta } from "./app/constants";
import { mapCustomerToRow } from "./app/utils";
import { signOut } from "./lib/supabase";
import api from "./lib/api";

// Lazy load heavy components
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const MonitoringSpreadsheetPage = lazy(() => import("./features/monitoring/MonitoringSpreadsheetPage"));
const CustomerWorkspacePage = lazy(() => import("./features/pelanggan/CustomerWorkspacePage"));
const IspDetailPage = lazy(() => import("./features/pelanggan/IspDetailPage"));
const TenantDetailPage = lazy(() => import("./features/pelanggan/TenantDetailPage"));
const TenantAdminFormPage = lazy(() => import("./features/pelanggan/TenantAdminFormPage"));
const IspAdminFormPage = lazy(() => import("./features/pelanggan/IspAdminFormPage"));
const LoginPage = lazy(() => import("./features/login/LoginPage"));
const TrashPage = lazy(() => import("./features/trash/TrashPage"));
const ActivityLogPage = lazy(() => import("./features/activity/ActivityLogPage"));
const TodoListPage = lazy(() => import("./features/todos/TodoListPage"));
import {
    getAppPaths,
    normalizePathname,
    parseAppRoute,
    resolveCustomerByIdentifier,
    resolveIspByIdentifier,
} from "./app/routes";
import { APP_ROLES, canAccessRoute, getRoleConfig } from "./roles";
import { getStoredRole, persistRole } from "./app/session/role-session";
import "./App.css";

const CUSTOMER_PAGE_SIZE = 500;

function App() {
    const [currentRole, setCurrentRole] = useState(() => getStoredRole());
    const appPaths = useMemo(() => getAppPaths(currentRole), [currentRole]);
    const [locationState, setLocationState] = useState(() => ({
        pathname: typeof window !== "undefined"
            ? normalizePathname(window.location.pathname) === "/"
                ? getAppPaths(getStoredRole()).login
                : window.location.pathname
            : getAppPaths(getStoredRole()).login,
        search: typeof window !== "undefined" ? window.location.search : "",
    }));
    const [customers, setCustomers] = useState([]);
    const [customersPageInfo, setCustomersPageInfo] = useState({
        count: 0,
        hasMore: false,
        limit: CUSTOMER_PAGE_SIZE,
        offset: 0,
    });
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [customersError, setCustomersError] = useState("");
    const [isps, setIsps] = useState([]);
    const [isLoadingIsps, setIsLoadingIsps] = useState(false);
    const [ispsError, setIspsError] = useState("");
    const [notifications, setNotifications] = useState([]);
    const route = useMemo(
        () => parseAppRoute(locationState.pathname, locationState.search, currentRole),
        [currentRole, locationState.pathname, locationState.search],
    );
    const roleConfig = useMemo(() => getRoleConfig(currentRole), [currentRole]);
    const roleCapabilities = roleConfig.capabilities;
    const isRouteAllowed = useMemo(
        () => canAccessRoute(currentRole, route),
        [currentRole, route],
    );

    const loadCustomers = useCallback(async ({ append = false, offset = 0 } = {}) => {
        setIsLoadingCustomers(true);
        setCustomersError("");

        try {
            const result = await api.customers.getAll({
                limit: CUSTOMER_PAGE_SIZE,
                offset,
            });
            const rows = Array.isArray(result)
                ? result
                : Array.isArray(result?.data)
                    ? result.data
                    : [];
            const mappedCustomers = rows.length > 0
                ? rows.map((customer, index) => mapCustomerToRow(customer, offset + index))
                : [];

            setCustomers((previousCustomers) => {
                if (!append) return mappedCustomers;

                const existingIds = new Set(previousCustomers.map((customer) => Number(customer.id)));
                const nextCustomers = mappedCustomers.filter((customer) => !existingIds.has(Number(customer.id)));
                return [...previousCustomers, ...nextCustomers];
            });
            setCustomersPageInfo({
                count: Number(result?.count ?? mappedCustomers.length),
                hasMore: Boolean(result?.hasMore),
                limit: Number(result?.limit ?? CUSTOMER_PAGE_SIZE),
                offset: Number(result?.offset ?? offset),
            });

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

    const loadMoreCustomers = useCallback(async () => {
        if (isLoadingCustomers || !customersPageInfo.hasMore) return [];

        return loadCustomers({
            append: true,
            offset: customers.length,
        });
    }, [customers.length, customersPageInfo.hasMore, isLoadingCustomers, loadCustomers]);

    // Only load data when user is authenticated (not on login page)
    useEffect(() => {
        if (route.type !== "login" && customers.length === 0 && !isLoadingCustomers && !customersError) {
            void loadCustomers();
        }
    }, [customers.length, customersError, isLoadingCustomers, loadCustomers, route.type]);

    const loadIsps = useCallback(async () => {
        setIsLoadingIsps(true);
        setIspsError("");

        try {
            const result = await api.isps.getAll();
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

    // Only load ISPs when user is authenticated (not on login page)
    useEffect(() => {
        if (route.type !== "login" && isps.length === 0 && !isLoadingIsps && !ispsError) {
            void loadIsps();
        }
    }, [isLoadingIsps, isps.length, ispsError, loadIsps, route.type]);

    const loadNotifications = useCallback(async () => {
        try {
            const result = await api.notifications.list({ limit: 500 });
            setNotifications(Array.isArray(result) ? result : []);
        } catch {
            setNotifications([]);
        }
    }, []);

    useEffect(() => {
        if (route.type !== "login") {
            void loadNotifications();
        }
    }, [loadNotifications, route.type]);

    const notificationCountsByCustomerId = useMemo(() => {
        return notifications.reduce((counts, notification) => {
            const customerId = Number(notification.customerId);
            if (!Number.isFinite(customerId) || customerId <= 0 || notification.resolvedAt) {
                return counts;
            }

            const existing = counts[customerId] ?? { active: 0, unread: 0 };
            counts[customerId] = {
                active: existing.active + 1,
                unread: existing.unread + (notification.readAt ? 0 : 1),
            };
            return counts;
        }, {});
    }, [notifications]);

    const notificationCountsByIspId = useMemo(() => {
        return notifications.reduce((counts, notification) => {
            const ispId = Number(notification.ispId);
            if (!Number.isFinite(ispId) || ispId <= 0 || notification.resolvedAt) {
                return counts;
            }

            const existing = counts[ispId] ?? { active: 0, unread: 0 };
            counts[ispId] = {
                active: existing.active + 1,
                unread: existing.unread + (notification.readAt ? 0 : 1),
            };
            return counts;
        }, {});
    }, [notifications]);

    const notificationsByIspId = useMemo(() => {
        return notifications.reduce((itemsByIspId, notification) => {
            const ispId = Number(notification.ispId);
            if (!Number.isFinite(ispId) || ispId <= 0) {
                return itemsByIspId;
            }

            itemsByIspId[ispId] = [...(itemsByIspId[ispId] ?? []), notification];
            return itemsByIspId;
        }, {});
    }, [notifications]);

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
            navigateTo(appPaths.login, { replace: true });
        }

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [appPaths.login, navigateTo]);

    useEffect(() => {
        if (route.type === "redirect") {
            navigateTo(route.to, { replace: true });
        }
    }, [navigateTo, route]);

    // Reset scroll to top on route change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [locationState.pathname, locationState.search]);

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
    const fallbackSection = roleConfig.defaultSection;
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
            dashboard: appPaths.dashboard,
            customers: appPaths.customers,
            monitoring: appPaths.monitoring,
            trash: appPaths.trash,
            activity: appPaths.activity,
            todos: appPaths.todos,
        }[sectionKey];

        if (targetPath) {
            navigateTo(targetPath);
        }
    }, [appPaths, navigateTo]);

    const handleOpenTenantDetail = useCallback((customer, initialTab = "overview", contextIsp = null) => {
        const resolvedCustomerId = Number(customer?.id);
        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        setCustomersError("");
        navigateTo(appPaths.customerDetail(resolvedCustomerId, {
            tab: initialTab,
            ispId: contextIsp?.id ?? null,
        }));
    }, [appPaths, navigateTo]);

    const handleOpenIspDetail = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.ispDetail(resolvedIspId));
    }, [appPaths, navigateTo]);

    const handleOpenCreateTenant = useCallback(() => {
        navigateTo(appPaths.customerCreate);
    }, [appPaths, navigateTo]);

    const handleOpenCreateTenantFromIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        const nextPath = Number.isFinite(resolvedIspId) && resolvedIspId > 0
            ? `${appPaths.customerCreate}?isp=${resolvedIspId}`
            : appPaths.customerCreate;

        navigateTo(nextPath);
    }, [appPaths, navigateTo]);

    const handleOpenCreateIsp = useCallback(() => {
        navigateTo(appPaths.ispCreate);
    }, [appPaths, navigateTo]);

    const handleCancelCreate = useCallback(() => {
        if (route.type === "customer-edit" && selectedCustomer) {
            navigateTo(appPaths.customerDetail(selectedCustomer.id), { replace: true });
            return;
        }

        if (route.type === "isp-edit" && selectedIsp) {
            navigateTo(appPaths.ispDetail(selectedIsp.id), { replace: true });
            return;
        }

        navigateTo(appPaths.customers, { replace: true });
    }, [appPaths, navigateTo, route.type, selectedCustomer, selectedIsp]);

    const handleOpenEditIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.ispEdit(resolvedIspId));
    }, [appPaths, navigateTo]);

    const handleOpenEditTenant = useCallback((customer) => {
        const resolvedCustomerId = Number(customer?.id);
        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.customerEdit(resolvedCustomerId));
    }, [appPaths, navigateTo]);

    const handleEntitySaved = useCallback(async (savedEntity, type) => {
        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);

        if (type === "isp") {
            const savedIspId = Number(savedEntity?.id);
            if (Number.isFinite(savedIspId) && savedIspId > 0) {
                navigateTo(appPaths.ispDetail(savedIspId), { replace: true });
                return;
            }
        } else {
            const savedCustomerId = Number(savedEntity?.id);
            if (Number.isFinite(savedCustomerId) && savedCustomerId > 0) {
                navigateTo(appPaths.customerDetail(savedCustomerId), { replace: true });
                return;
            }
        }

        navigateTo(appPaths.customers, { replace: true });
    }, [appPaths, loadCustomers, loadIsps, loadNotifications, navigateTo]);

    const handleLogout = useCallback(async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear role and redirect to login
            setCurrentRole(APP_ROLES.admin);
            persistRole(APP_ROLES.admin);
            navigateTo(appPaths.login, { replace: true });
        }
    }, [appPaths.login, navigateTo]);

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
                currentRole={currentRole}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                message="Mengarahkan ke halaman pelanggan..."
            />
        );
    }

    if (!isRouteAllowed) {
        return (
            <RouteForbiddenPage
                activeSection={fallbackSection}
                currentRole={currentRole}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                defaultSection={fallbackSection}
                roleLabel={roleConfig.label}
            />
        );
    }

    if (route.type === "login") {
        return (
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-primary-container/10"><div className="text-sm text-on-surface-variant">Memuat...</div></div>}>
                <LoginPage
                    onLoginSuccess={async ({ user }) => {
                        // Extract role from user metadata
                        const nextRole = user?.user_metadata?.role ?? APP_ROLES.admin;
                        const nextRoleConfig = getRoleConfig(nextRole);
                        const nextRolePaths = getAppPaths(nextRole);
                        const landingPath = nextRolePaths[nextRoleConfig.defaultSection] ?? nextRolePaths.customers;

                        setCurrentRole(nextRole);
                        persistRole(nextRole);
                        navigateTo(landingPath, { replace: true });
                    }}
                />
            </Suspense>
        );
    }

    if (route.type === "section" && route.sectionKey === "dashboard") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat dashboard..." />}>
                <DashboardPage
                    activeSection={activeSection}
                    customers={customers}
                    isps={isps}
                    notifications={notifications}
                    isLoadingCustomers={isLoadingCustomers}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            </Suspense>
        );
    }

    if (route.type === "section" && route.sectionKey === "monitoring") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat monitoring..." />}>
                <MonitoringSpreadsheetPage
                    activeSection={activeSection}
                    ispOptions={ispOptions}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onOpenCustomerById={handleOpenCustomerById}
                    onOpenTableOnly={() => navigateTo(appPaths.monitoringFullscreen)}
                />
            </Suspense>
        );
    }

    if (route.type === "monitoring-fullscreen") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection="monitoring" currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat monitoring..." />}>
                <MonitoringSpreadsheetPage
                    ispOptions={ispOptions}
                    currentRole={currentRole}
                    layout="plain"
                    onLogout={handleLogout}
                    onOpenCustomerById={handleOpenCustomerById}
                    tableOnly
                    onCloseTableOnly={() => navigateTo(appPaths.monitoring)}
                />
            </Suspense>
        );
    }

    if (route.type === "section" && route.sectionKey === "trash") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat trash..." />}>
                <TrashPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            </Suspense>
        );
    }

    if (route.type === "section" && route.sectionKey === "activity") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat activity log..." />}>
                <ActivityLogPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            </Suspense>
        );
    }

    if (route.type === "section" && route.sectionKey === "todos") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat to do list..." />}>
                <TodoListPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-create") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat form..." />}>
                <TenantAdminFormPage
                    isps={isps}
                    lockedIsp={createTenantContextIsp}
                    onCancel={handleCancelCreate}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onSaved={(entity) => handleEntitySaved(entity, "tenant")}
                />
            </Suspense>
        );
    }

    if (route.type === "isp-create") {
        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat form..." />}>
                <IspAdminFormPage
                    onCancel={handleCancelCreate}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onSaved={(entity) => handleEntitySaved(entity, "isp")}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-edit") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat data tenant untuk halaman edit..."
                />
            );
        }

        if (!editingCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Tenant yang diminta tidak tersedia atau belum dimuat."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat form..." />}>
                <TenantAdminFormPage
                    initialData={editingCustomer}
                    isps={isps}
                    mode="edit"
                    onCancel={handleCancelCreate}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onSaved={async () => {
                        await Promise.all([loadCustomers(), loadIsps()]);
                        navigateTo(appPaths.customerDetail(editingCustomer.id), { replace: true });
                    }}
                />
            </Suspense>
        );
    }

    if (route.type === "isp-edit") {
        if (!ispDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    message="Memuat data ISP untuk halaman edit..."
                />
            );
        }

        if (!editingIsp) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    title="ISP tidak ditemukan"
                    description="ISP yang diminta tidak tersedia atau belum dimuat."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat form..." />}>
                <IspAdminFormPage
                    initialData={editingIsp}
                    mode="edit"
                    onCancel={handleCancelCreate}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onSaved={async () => {
                        await Promise.all([loadCustomers(), loadIsps()]);
                        navigateTo(appPaths.ispDetail(editingIsp.id), { replace: true });
                    }}
                />
            </Suspense>
        );
    }

    if (route.type === "isp-detail") {
        if (!ispDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat detail ISP..."
                />
            );
        }

        if (!selectedIsp) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="ISP tidak ditemukan"
                    description="Data ISP yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat detail ISP..." />}>
                <IspDetailPage
                    isp={selectedIsp}
                    currentRole={currentRole}
                    initialTab={route.initialTab}
                    onBack={() => navigateTo(appPaths.customers, { replace: true })}
                    onEditIsp={handleOpenEditIsp}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onOpenCreateTenant={handleOpenCreateTenantFromIsp}
                    onOpenTenant={(tenant, initialTab = "overview") =>
                        handleOpenTenantDetail(tenant, initialTab, selectedIsp)}
                    onTabChange={(nextTab) => {
                        navigateTo(appPaths.ispDetail(selectedIsp.id, { tab: nextTab }), { replace: true });
                    }}
                    notifications={notificationsByIspId[Number(selectedIsp.id)] ?? []}
                    onRefreshAll={async () => {
                        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                    }}
                    canCreateTenant={roleCapabilities.canCreateTenant}
                    canDeleteIsp={roleCapabilities.canDeleteIsp}
                    canDeleteTenant={roleCapabilities.canDeleteTenant}
                    canEditIsp={roleCapabilities.canEditIsp}
                    canEditTenant={roleCapabilities.canEditTenant}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-detail") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat detail tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat detail tenant..." />}>
                <TenantDetailPage
                    customer={selectedCustomer}
                    contextIsp={selectedCustomerContextIsp}
                    initialTab={route.initialTab}
                    currentRole={currentRole}
                    onBack={() => {
                        navigateTo(appPaths.customers, { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onCreateIsp={handleOpenCreateIsp}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                    }}
                    onTabChange={(nextTab) => {
                        if (nextTab === "jalur") {
                            navigateTo(appPaths.customerJalur(selectedCustomer.id), { replace: true });
                            return;
                        }

                        navigateTo(appPaths.customerDetail(selectedCustomer.id, {
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

                        navigateTo(appPaths.customerJalurFullscreen(resolvedCustomerId));
                    }}
                    canDeleteTenant={roleCapabilities.canDeleteTenant}
                    canEditTenant={roleCapabilities.canEditTenant}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-jalur-fullscreen") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat tampilan jalur..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat tampilan jalur..." />}>
                <TenantDetailPage
                    customer={selectedCustomer}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Detail Tenant"
                    onBack={() => {
                        navigateTo(appPaths.customerDetail(selectedCustomer.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                    }}
                    routeViewMode="standalone"
                    hideSidebar={true}
                    canDeleteTenant={roleCapabilities.canDeleteTenant}
                    canEditTenant={roleCapabilities.canEditTenant}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-jalur") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat pengaturan jalur tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat pengaturan jalur..." />}>
                <TenantDetailPage
                    customer={selectedCustomer}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Detail Tenant"
                    onBack={() => {
                        navigateTo(appPaths.customerDetail(selectedCustomer.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                    }}
                    onOpenRoutePlanner={(tenant) => {
                        const resolvedCustomerId = Number(tenant?.id ?? selectedCustomer.id);
                        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
                            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
                            return;
                        }

                        navigateTo(appPaths.customerJalurPlanner(resolvedCustomerId));
                    }}
                    routeViewMode="standalone"
                    canDeleteTenant={roleCapabilities.canDeleteTenant}
                    canEditTenant={roleCapabilities.canEditTenant}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-jalur-planner") {
        if (!customerDetailReady) {
            return (
                <RouteLoadingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    message="Memuat FO route planner tenant..."
                />
            );
        }

        if (!selectedCustomer) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description="Data tenant yang Anda buka belum tersedia."
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat route planner..." />}>
                <TenantDetailPage
                    customer={selectedCustomer}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Halaman Jalur"
                    onBack={() => {
                        navigateTo(appPaths.customerJalur(selectedCustomer.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                    }}
                    routeViewMode="planner"
                    canDeleteTenant={roleCapabilities.canDeleteTenant}
                    canEditTenant={roleCapabilities.canEditTenant}
                />
            </Suspense>
        );
    }

    if (route.type === "not-found") {
        return (
            <RouteMissingPage
                activeSection={activeSection}
                currentRole={currentRole}
                onNavigate={handleNavigate}
                title="Halaman tidak ditemukan"
                description="Path yang Anda buka belum terdaftar di aplikasi ini."
            />
        );
    }

    return (
        <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat halaman..." />}>
            <CustomerWorkspacePage
                activeSection={activeSection}
                customers={customers}
                customersPageInfo={customersPageInfo}
                notificationCountsByCustomerId={notificationCountsByCustomerId}
                notificationCountsByIspId={notificationCountsByIspId}
                isps={isps}
                error={customersError}
                secondaryError={ispsError}
                isLoading={isLoadingCustomers}
                currentRole={currentRole}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                onOpenTenant={handleOpenTenantDetail}
                onOpenIsp={handleOpenIspDetail}
                onOpenCreateTenant={handleOpenCreateTenant}
                onOpenCreateIsp={handleOpenCreateIsp}
                onRefresh={async () => {
                    await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
                }}
                onLoadMoreCustomers={loadMoreCustomers}
                canCreateIsp={roleCapabilities.canCreateIsp}
                canCreateTenant={roleCapabilities.canCreateTenant}
            />
        </Suspense>
    );
    }

    function RouteLoadingPage({ activeSection, currentRole, onNavigate, onLogout, message }) {
    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onLogout={onLogout}>
            <div className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center">
                <div className="rounded-2xl border border-slate-100 bg-surface-container-lowest px-6 py-5 text-sm text-on-surface-variant shadow-sm">
                    {message}
                </div>
            </div>
        </AppShell>
    );
    }

    function RouteMissingPage({ activeSection, currentRole, onNavigate, onLogout, title, description }) {
    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onLogout={onLogout}>
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

    function RouteForbiddenPage({ activeSection, currentRole, onNavigate, onLogout, defaultSection, roleLabel }) {
    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onLogout={onLogout}>
            <div className="mx-auto max-w-4xl">
                <section className="rounded-2xl border border-amber-100 bg-surface-container-lowest p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <span className="material-symbols-outlined rounded-lg bg-amber-50 p-2 text-amber-700">
                            lock
                        </span>
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
                                Akses dibatasi
                            </h1>
                            <p className="mt-2 text-sm text-on-surface-variant">
                                Halaman ini belum tersedia untuk role {roleLabel}.
                            </p>
                        </div>
                    </div>

                    <button
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-bold text-white"
                        onClick={() => onNavigate(defaultSection)}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Kembali ke modul utama
                    </button>
                </section>
            </div>
        </AppShell>
    );
    }

    function SectionPlaceholderPage({ activeSection, currentRole, onNavigate, onLogout }) {
    const section = sectionMeta[activeSection] ?? sectionMeta.dashboard;
    const isTrashSection = activeSection === "trash";

    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onLogout={onLogout}>
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
