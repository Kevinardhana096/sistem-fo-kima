import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { sectionMeta } from "./app/constants";
import { mapCustomerToRow } from "./app/utils";
import { signOut, supabase } from "./lib/supabase";
import api from "./lib/api";
import { APP_NAVIGATION_EVENT } from "./app/navigation-events";

const CHUNK_RELOAD_STATE_KEY = "__sistemFoKimaChunkReloaded";
const AUTH_TRANSITION_EVENT = "sistem-fo-kima:auth-transition";
const TRANSITION_STATE_KEY = "__sistemFoKimaTransitionState";

const DEFAULT_TRANSITION_STATE = {
    logout: false,
    page: false,
    title: "Memuat Halaman",
    description: "Menyiapkan tampilan tujuan...",
};

function getRuntimeTransitionState() {
    if (typeof window === "undefined") return DEFAULT_TRANSITION_STATE;
    return window[TRANSITION_STATE_KEY] ?? DEFAULT_TRANSITION_STATE;
}

function setRuntimeTransitionState(nextState) {
    if (typeof window === "undefined") return;

    window[TRANSITION_STATE_KEY] = {
        ...DEFAULT_TRANSITION_STATE,
        ...getRuntimeTransitionState(),
        ...nextState,
    };
    window.dispatchEvent(new CustomEvent(AUTH_TRANSITION_EVENT, {
        detail: window[TRANSITION_STATE_KEY],
    }));
}

function isDynamicImportLoadError(error) {
    const message = String(error?.message || error || "");
    return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(message);
}

function lazyRoute(importer) {
    return lazy(() =>
        importer()
            .then((module) => {
                if (typeof window !== "undefined") {
                    const historyState = { ...(window.history.state ?? {}) };
                    if (historyState[CHUNK_RELOAD_STATE_KEY]) {
                        delete historyState[CHUNK_RELOAD_STATE_KEY];
                        window.history.replaceState(historyState, "", window.location.href);
                    }
                }
                return module;
            })
            .catch((error) => {
                if (typeof window !== "undefined" && isDynamicImportLoadError(error)) {
                    const hasReloaded = window.history.state?.[CHUNK_RELOAD_STATE_KEY] === true;
                    if (!hasReloaded) {
                        window.history.replaceState({
                            ...(window.history.state ?? {}),
                            [CHUNK_RELOAD_STATE_KEY]: true,
                        }, "", window.location.href);
                        window.location.reload();
                        return new Promise(() => {});
                    }
                }

                throw error;
            })
    );
}

// Lazy load heavy components
const DashboardPage = lazyRoute(() => import("./features/dashboard/DashboardPage"));
const MonitoringSpreadsheetPage = lazyRoute(() => import("./features/monitoring/MonitoringSpreadsheetPage"));
const CustomerWorkspacePage = lazyRoute(() => import("./features/pelanggan/CustomerWorkspacePage"));
const IspDetailPage = lazyRoute(() => import("./features/pelanggan/IspDetailPage"));
const TenantDetailPage = lazyRoute(() => import("./features/pelanggan/TenantDetailPage"));
const TenantAdminFormPage = lazyRoute(() => import("./features/pelanggan/TenantAdminFormPage"));
const IspAdminFormPage = lazyRoute(() => import("./features/pelanggan/IspAdminFormPage"));
const LoginPage = lazyRoute(() => import("./features/login/LoginPage"));
const AdminRegisterPage = lazyRoute(() => import("./features/login/AdminRegisterPage"));
const TrashPage = lazyRoute(() => import("./features/trash/TrashPage"));
const ActivityLogPage = lazyRoute(() => import("./features/activity/ActivityLogPage"));
const TodoListPage = lazyRoute(() => import("./features/todos/TodoListPage"));
import {
    getAppPaths,
    normalizePathname,
    parseAppRoute,
    resolveCustomerByIdentifier,
    resolveIspByIdentifier,
} from "./app/routes";
import { APP_ROLES, canAccessRoute, getRoleConfig } from "./roles";
import { getStoredRole, normalizeAppRole, persistRole } from "./app/session/role-session";
import "./App.css";

const CUSTOMER_PAGE_SIZE = 500;
const PUBLIC_ROUTE_TYPES = new Set(["login", "admin-register"]);

const SECTION_TRANSITION_COPY = {
    dashboard: {
        title: "Membuka Dashboard",
        description: "Menyiapkan ringkasan operasional...",
    },
    customers: {
        title: "Membuka Daftar Tenant",
        description: "Menyiapkan data tenant dan ISP...",
    },
    monitoring: {
        title: "Membuka Monitoring",
        description: "Menyiapkan tampilan monitoring operasional...",
    },
    trash: {
        title: "Membuka Tempat Sampah",
        description: "Menyiapkan data yang dihapus sementara...",
    },
    activity: {
        title: "Membuka Log Aktivitas",
        description: "Menyiapkan catatan aktivitas terbaru...",
    },
    todos: {
        title: "Membuka Tindak Lanjut",
        description: "Menyiapkan daftar tindak lanjut...",
    },
};

function getPageTransitionCopy(targetPath, currentRole) {
    if (typeof window === "undefined") {
        return {
            title: "Memuat Halaman",
            description: "Menyiapkan tampilan tujuan...",
        };
    }

    try {
        const nextUrl = new URL(targetPath, window.location.origin);
        const route = parseAppRoute(nextUrl.pathname, nextUrl.search, currentRole);

        if (route.type === "section") {
            return SECTION_TRANSITION_COPY[route.sectionKey] ?? {
                title: "Membuka Halaman",
                description: "Menyiapkan tampilan tujuan...",
            };
        }

        if (route.type === "monitoring-fullscreen") {
            return {
                title: "Membuka Monitoring",
                description: "Menyiapkan tampilan monitoring penuh...",
            };
        }

        if (route.type === "customer-detail") {
            return {
                title: "Membuka Detail Tenant",
                description: "Menyiapkan data tenant...",
            };
        }

        if (route.type === "isp-detail") {
            return {
                title: "Membuka Detail ISP",
                description: "Menyiapkan data ISP...",
            };
        }

        if (route.type === "customer-create") {
            return {
                title: "Membuka Form Tenant",
                description: "Menyiapkan formulir tenant baru...",
            };
        }

        if (route.type === "isp-create") {
            return {
                title: "Membuka Form ISP",
                description: "Menyiapkan formulir ISP baru...",
            };
        }

        if (route.type === "customer-edit") {
            return {
                title: "Membuka Edit Tenant",
                description: "Menyiapkan formulir edit tenant...",
            };
        }

        if (route.type === "isp-edit") {
            return {
                title: "Membuka Edit ISP",
                description: "Menyiapkan formulir edit ISP...",
            };
        }

        if (route.type === "customer-jalur") {
            return {
                title: "Membuka Jalur Tenant",
                description: "Menyiapkan pengaturan jalur tenant...",
            };
        }

        if (route.type === "customer-jalur-planner") {
            return {
                title: "Membuka Route Planner",
                description: "Menyiapkan perencana jalur tenant...",
            };
        }

        if (route.type === "customer-jalur-fullscreen") {
            return {
                title: "Membuka Jalur Tenant",
                description: "Menyiapkan tampilan jalur penuh...",
            };
        }

        if (route.type === "login") {
            return {
                title: "Membuka Login",
                description: "Menyiapkan halaman masuk...",
            };
        }

        if (route.type === "admin-register") {
            return {
                title: "Membuka Pendaftaran Admin",
                description: "Menyiapkan halaman pendaftaran...",
            };
        }
    } catch {
        return {
            title: "Memuat Halaman",
            description: "Menyiapkan tampilan tujuan...",
        };
    }

    return {
        title: "Memuat Halaman",
        description: "Menyiapkan tampilan tujuan...",
    };
}


function getNumericId(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

function getCustomerIspIds(customer) {
    if (!customer) return [];

    const candidateIds = [
        customer.ispId,
        customer.isp_id,
        customer.primaryIspId,
        customer.primary_isp_id,
        ...(Array.isArray(customer.ispIds) ? customer.ispIds : []),
        ...(Array.isArray(customer.isp_ids) ? customer.isp_ids : []),
        ...(Array.isArray(customer.isps) ? customer.isps.map((isp) => isp?.id ?? isp?.isp_id) : []),
        ...(Array.isArray(customer.ispMemberships) ? customer.ispMemberships.map((membership) => membership?.ispId ?? membership?.isp_id ?? membership?.isp?.id) : []),
    ];

    return Array.from(new Set(
        candidateIds
            .map((value) => getNumericId(value))
            .filter((value) => value !== null),
    ));
}

function isCustomerLinkedToIsp(customer, ispId) {
    const numericIspId = getNumericId(ispId);
    if (!numericIspId) return false;
    return getCustomerIspIds(customer).includes(numericIspId);
}

function getAuthUserIspId(user) {
    const rawIspId = user?.user_metadata?.isp_id;
    const ispId = Number(rawIspId);
    return Number.isFinite(ispId) && ispId > 0 ? ispId : null;
}

function getLandingPathForRole(roleKey, paths, user, resolvedIspId = null) {
    if (roleKey === APP_ROLES.isp) {
        const ispId = getNumericId(resolvedIspId) ?? getAuthUserIspId(user);
        return paths.ispDetail(ispId ?? "me");
    }

    const roleConfig = getRoleConfig(roleKey);
    return paths[roleConfig.defaultSection] ?? paths.customers ?? paths.login;
}

function App() {
    const [currentRole, setCurrentRole] = useState(() => getStoredRole());
    const [authSession, setAuthSession] = useState(null);
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
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
    const [hasRequestedCustomers, setHasRequestedCustomers] = useState(false);
    const [isps, setIsps] = useState([]);
    const [isLoadingIsps, setIsLoadingIsps] = useState(false);
    const [ispsError, setIspsError] = useState("");
    const [hasRequestedIsps, setHasRequestedIsps] = useState(false);
    const [currentIspAccount, setCurrentIspAccount] = useState(null);
    const [isLoadingCurrentIspAccount, setIsLoadingCurrentIspAccount] = useState(false);
    const [hasRequestedCurrentIspAccount, setHasRequestedCurrentIspAccount] = useState(false);
    const [currentIspAccountError, setCurrentIspAccountError] = useState("");
    const [notifications, setNotifications] = useState([]);
    const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
    const [customerDetailRecord, setCustomerDetailRecord] = useState(null);
    const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
    const [customerDetailError, setCustomerDetailError] = useState("");
    const [ispDetailRecord, setIspDetailRecord] = useState(null);
    const [ispDetailLoading, setIspDetailLoading] = useState(false);
    const [ispDetailError, setIspDetailError] = useState("");
    const route = useMemo(
        () => parseAppRoute(locationState.pathname, locationState.search, currentRole),
        [currentRole, locationState.pathname, locationState.search],
    );
    const roleConfig = useMemo(() => getRoleConfig(currentRole), [currentRole]);
    const roleCapabilities = roleConfig.capabilities;
    const currentUserIspId = useMemo(() => getAuthUserIspId(authSession?.user), [authSession?.user]);
    const mappedCurrentIspId = useMemo(() => getNumericId(currentIspAccount?.ispId), [currentIspAccount?.ispId]);
    const resolvedCurrentIspId = useMemo(() => {
        if (mappedCurrentIspId) return mappedCurrentIspId;
        if (currentUserIspId) return currentUserIspId;
        if (currentRole !== APP_ROLES.isp || isps.length !== 1) return null;

        const ispId = Number(isps[0]?.id);
        return Number.isFinite(ispId) && ispId > 0 ? ispId : null;
    }, [currentRole, currentUserIspId, isps, mappedCurrentIspId]);
    const isRouteAllowed = useMemo(
        () => canAccessRoute(currentRole, route),
        [currentRole, route],
    );
    const isLoggedIn = Boolean(authSession?.user);

    useEffect(() => {
        let isActive = true;
        let lastAppliedUserId = null;

        const applySession = (nextSession) => {
            if (!isActive) return;
            const nextUserId = nextSession?.user?.id ?? null;
            if (nextUserId !== lastAppliedUserId) {
                lastAppliedUserId = nextUserId;
                api.session.clearCaches();
                setCustomers([]);
                setCustomersPageInfo({
                    count: 0,
                    hasMore: false,
                    limit: CUSTOMER_PAGE_SIZE,
                    offset: 0,
                });
                setHasRequestedCustomers(false);
                setIsps([]);
                setHasRequestedIsps(false);
                setNotifications([]);
                setCustomerDetailRecord(null);
                setIspDetailRecord(null);
                setCurrentIspAccount(null);
                setHasRequestedCurrentIspAccount(false);
                setCurrentIspAccountError("");
            }
            const nextRole = nextSession?.user
                ? normalizeAppRole(nextSession.user.user_metadata?.role)
                : APP_ROLES.guest;
            setAuthSession(nextSession ?? null);
            setCurrentRole(nextRole);
            persistRole(nextRole);
        };

        void supabase.auth.getSession()
            .then(({ data }) => {
                applySession(data?.session ?? null);
            })
            .catch(() => {
                applySession(null);
            })
            .finally(() => {
                if (isActive) setHasCheckedAuth(true);
            });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            applySession(nextSession);
            setHasCheckedAuth(true);
        });

        return () => {
            isActive = false;
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const loadCustomers = useCallback(async ({ append = false, offset = 0 } = {}) => {
        setHasRequestedCustomers(true);
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
        if (
            hasCheckedAuth
            && isLoggedIn
            && route.type !== "login"
            && customers.length === 0
            && !isLoadingCustomers
            && !customersError
            && !hasRequestedCustomers
        ) {
            void loadCustomers();
        }
    }, [customers.length, customersError, hasCheckedAuth, hasRequestedCustomers, isLoadingCustomers, isLoggedIn, loadCustomers, route.type]);

    const loadIsps = useCallback(async () => {
        setHasRequestedIsps(true);
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

    const loadCurrentIspAccount = useCallback(async () => {
        setHasRequestedCurrentIspAccount(true);
        setIsLoadingCurrentIspAccount(true);
        setCurrentIspAccountError("");

        try {
            const account = await api.session.getCurrentIspAccount();
            setCurrentIspAccount(account);
            if (account?.isp) {
                setIsps((previousIsps) => {
                    const accountIspId = Number(account.isp.id);
                    if (!Number.isFinite(accountIspId) || accountIspId <= 0) return previousIsps;

                    const exists = previousIsps.some((item) => Number(item.id) === accountIspId);
                    return exists ? previousIsps : [account.isp, ...previousIsps];
                });
            }
            return account;
        } catch (error) {
            setCurrentIspAccountError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat mapping akun ISP.",
            );
            setCurrentIspAccount(null);
            return null;
        } finally {
            setIsLoadingCurrentIspAccount(false);
        }
    }, []);

    useEffect(() => {
        if (hasCheckedAuth && isLoggedIn && currentRole === APP_ROLES.isp && !hasRequestedCurrentIspAccount && !isLoadingCurrentIspAccount) {
            void loadCurrentIspAccount();
            return;
        }

        if (hasCheckedAuth && (!isLoggedIn || currentRole !== APP_ROLES.isp)) {
            setCurrentIspAccount(null);
            setCurrentIspAccountError("");
            setHasRequestedCurrentIspAccount(false);
            setIsLoadingCurrentIspAccount(false);
        }
    }, [currentRole, hasCheckedAuth, hasRequestedCurrentIspAccount, isLoadingCurrentIspAccount, isLoggedIn, loadCurrentIspAccount]);

    // Only load ISPs when user is authenticated (not on login page)
    useEffect(() => {
        if (
            hasCheckedAuth
            && isLoggedIn
            && route.type !== "login"
            && isps.length === 0
            && !isLoadingIsps
            && !ispsError
            && !hasRequestedIsps
        ) {
            void loadIsps();
        }
    }, [hasCheckedAuth, hasRequestedIsps, isLoadingIsps, isLoggedIn, isps.length, ispsError, loadIsps, route.type]);

    const loadNotifications = useCallback(async () => {
        try {
            const result = await api.notifications.list({ limit: 500 });
            setNotifications(Array.isArray(result) ? result : []);
        } catch {
            setNotifications([]);
        }
    }, []);

    const refreshDashboardMetrics = useCallback(() => {
        setDashboardRefreshToken((previousToken) => previousToken + 1);
    }, []);

    const refreshAppData = useCallback(async () => {
        await Promise.all([loadCustomers(), loadIsps(), loadNotifications()]);
        refreshDashboardMetrics();
    }, [loadCustomers, loadIsps, loadNotifications, refreshDashboardMetrics]);

    useEffect(() => {
        if (hasCheckedAuth && isLoggedIn && route.type !== "login") {
            void loadNotifications();
        }
    }, [hasCheckedAuth, isLoggedIn, loadNotifications, route.type]);

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

    const navigateTo = useCallback((targetPath, { replace = false, transitionTitle = "", transitionDescription = "" } = {}) => {
        if (typeof window === "undefined") {
            return;
        }

        const fallbackTransition = getPageTransitionCopy(targetPath, currentRole);
        const isAuthTransitionActive = getRuntimeTransitionState().logout;

        if (isAuthTransitionActive) {
            setRuntimeTransitionState({
                page: false,
                title: DEFAULT_TRANSITION_STATE.title,
                description: DEFAULT_TRANSITION_STATE.description,
            });
        } else {
            setRuntimeTransitionState({
                page: true,
                title: transitionTitle || fallbackTransition.title,
                description: transitionDescription || fallbackTransition.description,
            });
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
    }, [currentRole]);

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
        if (typeof window === "undefined") {
            return undefined;
        }

        const handleAppNavigationRequest = (event) => {
            const targetPath = event?.detail?.targetPath;
            if (!targetPath) return;
            navigateTo(targetPath, event.detail.options ?? {});
        };

        window.addEventListener(APP_NAVIGATION_EVENT, handleAppNavigationRequest);
        return () => window.removeEventListener(APP_NAVIGATION_EVENT, handleAppNavigationRequest);
    }, [navigateTo]);

    useEffect(() => {
        if (route.type === "redirect") {
            navigateTo(route.to, { replace: true });
        }
    }, [navigateTo, route]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        if (!getRuntimeTransitionState().page) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setRuntimeTransitionState({
                page: false,
                title: DEFAULT_TRANSITION_STATE.title,
                description: DEFAULT_TRANSITION_STATE.description,
            });
        }, 220);

        return () => {
            window.clearTimeout(timer);
        };
    }, [locationState.pathname, locationState.search]);

    useEffect(() => {
        if (!hasCheckedAuth || route.type === "redirect") {
            return;
        }

        if (!isLoggedIn && !PUBLIC_ROUTE_TYPES.has(route.type)) {
            navigateTo(appPaths.login, { replace: true });
            return;
        }

        if (isLoggedIn && route.type === "login") {
            if (currentRole === APP_ROLES.isp && (!hasRequestedCurrentIspAccount || isLoadingCurrentIspAccount)) {
                return;
            }

            const landingPath = getLandingPathForRole(currentRole, appPaths, authSession?.user, resolvedCurrentIspId);
            navigateTo(landingPath, { replace: true });
        }
    }, [appPaths, authSession?.user, currentRole, hasCheckedAuth, hasRequestedCurrentIspAccount, isLoadingCurrentIspAccount, isLoggedIn, navigateTo, resolvedCurrentIspId, route.type]);

    useEffect(() => {
        if (!hasCheckedAuth || !isLoggedIn || currentRole !== APP_ROLES.isp || route.type === "login" || route.type === "redirect") {
            return;
        }

        if (!hasRequestedCurrentIspAccount || isLoadingCurrentIspAccount) {
            return;
        }

        if (resolvedCurrentIspId === null && (!hasRequestedIsps || isLoadingIsps)) {
            return;
        }

        const landingPath = resolvedCurrentIspId
            ? appPaths.ispDetail(resolvedCurrentIspId)
            : getLandingPathForRole(currentRole, appPaths, authSession?.user);
        const routeIspId = Number(route.ispId);
        const isOwnIspDetail = route.type === "isp-detail"
            && resolvedCurrentIspId !== null
            && Number.isFinite(routeIspId)
            && routeIspId === resolvedCurrentIspId;
        const routeContextIspId = Number(route.contextIspId);
        const isOwnCustomerCreate = route.type === "customer-create"
            && resolvedCurrentIspId !== null
            && Number.isFinite(routeContextIspId)
            && routeContextIspId === resolvedCurrentIspId;
        const isOwnCustomerDetail = route.type === "customer-detail"
            && resolvedCurrentIspId !== null
            && Number.isFinite(routeContextIspId)
            && routeContextIspId === resolvedCurrentIspId;
        const isAllowedIspRoute = isOwnIspDetail || isOwnCustomerCreate || isOwnCustomerDetail;

        const currentPath = `${locationState.pathname}${locationState.search}`;

        if (!isAllowedIspRoute && currentPath !== landingPath) {
            navigateTo(landingPath, { replace: true });
        }
    }, [appPaths, authSession?.user, currentRole, hasCheckedAuth, hasRequestedCurrentIspAccount, hasRequestedIsps, isLoadingCurrentIspAccount, isLoadingIsps, isLoggedIn, locationState.pathname, locationState.search, navigateTo, resolvedCurrentIspId, route.contextIspId, route.ispId, route.type]);

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
    const resolvedCustomerDetail = selectedCustomer ?? customerDetailRecord;
    const isResolvedCustomerAllowedForIsp = currentRole !== APP_ROLES.isp
        || isCustomerLinkedToIsp(resolvedCustomerDetail, resolvedCurrentIspId);
    const selectedCustomerContextIsp = route.contextIspId
        ? resolveIspByIdentifier(isps, route.contextIspId)
        : currentRole === APP_ROLES.isp && resolvedCurrentIspId
            ? resolveIspByIdentifier(isps, resolvedCurrentIspId)
            : null;
    const selectedIsp = route.type === "isp-detail" || route.type === "isp-edit"
        ? resolveIspByIdentifier(isps, route.ispId)
            ?? (Number(route.ispId) === mappedCurrentIspId ? currentIspAccount?.isp ?? null : null)
        : null;
    const resolvedIspDetail = selectedIsp ?? ispDetailRecord;
    const createTenantContextIsp = route.type === "customer-create"
        ? resolveIspByIdentifier(isps, route.contextIspId)
        : null;
    const editingCustomer = route.type === "customer-edit" ? resolvedCustomerDetail : null;
    const editingIsp = route.type === "isp-edit" ? resolvedIspDetail : null;
    const customerDetailReady = route.type !== "customer-detail"
        && route.type !== "customer-edit"
        && route.type !== "customer-jalur"
        && route.type !== "customer-jalur-planner"
        && route.type !== "customer-jalur-fullscreen"
        ? true
        : Boolean(resolvedCustomerDetail) || (hasRequestedCustomers && !isLoadingCustomers && !customerDetailLoading);
    const ispDetailReady = route.type !== "isp-detail" && route.type !== "isp-edit"
        ? true
        : Boolean(resolvedIspDetail) || (hasRequestedIsps && !isLoadingIsps && !ispDetailLoading);

    useEffect(() => {
        let isActive = true;

        const canLoadCustomerForCurrentRole = currentRole !== APP_ROLES.isp
            || (
                route.type === "customer-detail"
                && resolvedCurrentIspId !== null
                && Number(route.contextIspId) === resolvedCurrentIspId
            );
        const shouldLoadCustomerDetail = canLoadCustomerForCurrentRole && (
            route.type === "customer-detail"
            || route.type === "customer-edit"
            || route.type === "customer-jalur"
            || route.type === "customer-jalur-planner"
            || route.type === "customer-jalur-fullscreen"
        ) && !selectedCustomer && Number.isFinite(Number(route.customerId));

        if (!shouldLoadCustomerDetail) {
            setCustomerDetailRecord(null);
            setCustomerDetailError("");
            setCustomerDetailLoading(false);
            return undefined;
        }

        setCustomerDetailLoading(true);
        setCustomerDetailError("");

        void (async () => {
            try {
                const record = await api.customers.getById(Number(route.customerId));
                if (!isActive) return;
                setCustomerDetailRecord(record);
            } catch (error) {
                if (!isActive) return;
                setCustomerDetailError(
                    error instanceof Error
                        ? error.message
                        : "Terjadi kesalahan saat memuat detail tenant.",
                );
                setCustomerDetailRecord(null);
            } finally {
                if (isActive) {
                    setCustomerDetailLoading(false);
                }
            }
        })();

        return () => {
            isActive = false;
        };
    }, [currentRole, resolvedCurrentIspId, route.contextIspId, route.customerId, route.type, selectedCustomer]);

    useEffect(() => {
        let isActive = true;

        const routeIspId = Number(route.ispId);
        const canLoadIspDetail = currentRole !== APP_ROLES.isp
            || (resolvedCurrentIspId !== null && routeIspId === resolvedCurrentIspId);
        const shouldLoadIspDetail = canLoadIspDetail && (
            route.type === "isp-detail"
            || route.type === "isp-edit"
        ) && !selectedIsp && Number.isFinite(routeIspId);

        if (!shouldLoadIspDetail) {
            setIspDetailRecord(null);
            setIspDetailError("");
            setIspDetailLoading(false);
            return undefined;
        }

        setIspDetailLoading(true);
        setIspDetailError("");

        void (async () => {
            try {
                const record = await api.isps.getById(Number(route.ispId));
                if (!isActive) return;
                setIspDetailRecord(record);
            } catch (error) {
                if (!isActive) return;
                setIspDetailError(
                    error instanceof Error
                        ? error.message
                        : "Terjadi kesalahan saat memuat detail ISP.",
                );
                setIspDetailRecord(null);
            } finally {
                if (isActive) {
                    setIspDetailLoading(false);
                }
            }
        })();

        return () => {
            isActive = false;
        };
    }, [currentRole, resolvedCurrentIspId, route.ispId, route.type, selectedIsp]);

    const handleNavigate = useCallback((sectionKey) => {
        const targetPath = {
            dashboard: appPaths.dashboard,
            customers: appPaths.customers,
            monitoring: appPaths.monitoring,
            trash: appPaths.trash,
            activity: appPaths.activity,
            todos: appPaths.todos,
            "isp-detail": resolvedCurrentIspId
                ? appPaths.ispDetail(resolvedCurrentIspId)
                : getLandingPathForRole(currentRole, appPaths, authSession?.user),
        }[sectionKey];

        if (targetPath) {
            navigateTo(targetPath);
        }
    }, [appPaths, authSession?.user, currentRole, navigateTo, resolvedCurrentIspId]);

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
        }), {
            transitionTitle: customer?.name ? `Membuka Detail ${customer.name}` : "Membuka Detail Tenant",
            transitionDescription: customer?.name
                ? `Menyiapkan data ${customer.name}...`
                : "Menyiapkan data tenant...",
        });
    }, [appPaths, navigateTo]);

    const handleOpenIspDetail = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.ispDetail(resolvedIspId), {
            transitionTitle: isp?.name ? `Membuka Detail ${isp.name}` : "Membuka Detail ISP",
            transitionDescription: isp?.name
                ? `Menyiapkan data ${isp.name}...`
                : "Menyiapkan data ISP...",
        });
    }, [appPaths, navigateTo]);

    const handleOpenCreateTenant = useCallback(() => {
        navigateTo(appPaths.customerCreate, {
            transitionTitle: "Membuka Form Tenant",
            transitionDescription: "Menyiapkan formulir tenant baru...",
        });
    }, [appPaths, navigateTo]);

    const handleOpenCreateTenantFromIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        const nextPath = Number.isFinite(resolvedIspId) && resolvedIspId > 0
            ? `${appPaths.customerCreate}?isp=${resolvedIspId}`
            : appPaths.customerCreate;

        navigateTo(nextPath, {
            transitionTitle: "Membuka Form Tenant",
            transitionDescription: isp?.name
                ? `Menyiapkan formulir tenant untuk ${isp.name}...`
                : "Menyiapkan formulir tenant baru...",
        });
    }, [appPaths, navigateTo]);

    const handleOpenCreateIsp = useCallback(() => {
        navigateTo(appPaths.ispCreate, {
            transitionTitle: "Membuka Form ISP",
            transitionDescription: "Menyiapkan formulir ISP baru...",
        });
    }, [appPaths, navigateTo]);

    const handleCancelCreate = useCallback(() => {
        if (route.type === "customer-edit" && resolvedCustomerDetail) {
            navigateTo(appPaths.customerDetail(resolvedCustomerDetail.id), {
                replace: true,
                transitionTitle: "Kembali ke Detail Tenant",
                transitionDescription: "Menampilkan detail tenant sebelumnya...",
            });
            return;
        }

        if (route.type === "isp-edit" && resolvedIspDetail) {
            navigateTo(appPaths.ispDetail(resolvedIspDetail.id), {
                replace: true,
                transitionTitle: "Kembali ke Detail ISP",
                transitionDescription: "Menampilkan detail ISP sebelumnya...",
            });
            return;
        }

        if (currentRole === APP_ROLES.isp && resolvedCurrentIspId) {
            navigateTo(appPaths.ispDetail(resolvedCurrentIspId), {
                replace: true,
                transitionTitle: "Kembali ke Detail ISP",
                transitionDescription: "Menampilkan detail ISP sebelumnya...",
            });
            return;
        }

        navigateTo(appPaths.customers, {
            replace: true,
            transitionTitle: "Kembali ke Daftar Tenant",
            transitionDescription: "Menampilkan daftar tenant...",
        });
    }, [appPaths, currentRole, navigateTo, resolvedCurrentIspId, resolvedCustomerDetail, resolvedIspDetail, route.type]);

    const handleOpenEditIsp = useCallback((isp) => {
        const resolvedIspId = Number(isp?.id);
        if (!Number.isFinite(resolvedIspId) || resolvedIspId <= 0) {
            setIspsError("Data ISP tidak valid. ID ISP tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.ispEdit(resolvedIspId), {
            transitionTitle: isp?.name ? `Edit ${isp.name}` : "Membuka Edit ISP",
            transitionDescription: isp?.name
                ? `Menyiapkan formulir edit ${isp.name}...`
                : "Menyiapkan formulir edit ISP...",
        });
    }, [appPaths, navigateTo]);

    const handleOpenEditTenant = useCallback((customer) => {
        const resolvedCustomerId = Number(customer?.id);
        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        navigateTo(appPaths.customerEdit(resolvedCustomerId), {
            transitionTitle: customer?.name ? `Edit ${customer.name}` : "Membuka Edit Tenant",
            transitionDescription: customer?.name
                ? `Menyiapkan formulir edit ${customer.name}...`
                : "Menyiapkan formulir edit tenant...",
        });
    }, [appPaths, navigateTo]);

    const handleEntitySaved = useCallback(async (savedEntity, type) => {
        await refreshAppData();

        if (type === "isp") {
            const savedIspId = Number(savedEntity?.id);
            if (Number.isFinite(savedIspId) && savedIspId > 0) {
                navigateTo(appPaths.ispDetail(savedIspId), {
                    replace: true,
                    transitionTitle: "Membuka Detail ISP",
                    transitionDescription: "Menyiapkan data ISP yang disimpan...",
                });
                return;
            }
        } else {
            const savedCustomerId = Number(savedEntity?.id);
            if (Number.isFinite(savedCustomerId) && savedCustomerId > 0) {
                navigateTo(appPaths.customerDetail(savedCustomerId, {
                    ispId: currentRole === APP_ROLES.isp ? resolvedCurrentIspId : null,
                }), {
                    replace: true,
                    transitionTitle: "Membuka Detail Tenant",
                    transitionDescription: "Menyiapkan data tenant yang disimpan...",
                });
                return;
            }
        }

        navigateTo(appPaths.customers, {
            replace: true,
            transitionTitle: "Kembali ke Daftar Tenant",
            transitionDescription: "Menampilkan daftar tenant...",
        });
    }, [appPaths, currentRole, navigateTo, refreshAppData, resolvedCurrentIspId]);

    const handleLogout = useCallback(async () => {
        if (typeof window !== "undefined") {
            setRuntimeTransitionState({
                logout: true,
                page: false,
                title: DEFAULT_TRANSITION_STATE.title,
                description: DEFAULT_TRANSITION_STATE.description,
            });
        }

        try {
            await signOut();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear role and redirect to login
            api.session.clearCaches();
            setAuthSession(null);
            setCurrentRole(APP_ROLES.guest);
            persistRole(APP_ROLES.guest);
            navigateTo(appPaths.login, { replace: true });
            if (typeof window !== "undefined") {
                setRuntimeTransitionState({
                    logout: false,
                    page: false,
                    title: DEFAULT_TRANSITION_STATE.title,
                    description: DEFAULT_TRANSITION_STATE.description,
                });
            }
        }
    }, [appPaths.login, navigateTo]);

    const handleOpenCustomerById = useCallback((customerId, initialTab = "overview") => {
        const normalizedCustomerId = Number(customerId);
        if (!Number.isFinite(normalizedCustomerId) || normalizedCustomerId <= 0) {
            return;
        }

        const targetCustomer = customers.find((item) => Number(item.id) === normalizedCustomerId);
        if (!targetCustomer) {
            navigateTo(appPaths.customerDetail(normalizedCustomerId, { tab: initialTab }));
            return;
        }

        handleOpenTenantDetail(targetCustomer, initialTab);
    }, [appPaths, customers, handleOpenTenantDetail, navigateTo]);

    if (!hasCheckedAuth || (!isLoggedIn && !PUBLIC_ROUTE_TYPES.has(route.type)) || (isLoggedIn && route.type === "login")) {
        return (
            <RouteLoadingPage
                activeSection={activeSection}
                currentRole={currentRole}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                message="Memeriksa sesi login..."
            />
        );
    }

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
                        const nextRole = normalizeAppRole(user?.user_metadata?.role);
                        const nextRolePaths = getAppPaths(nextRole);
                        api.session.clearCaches();
                        let loginIspAccount = null;
                        if (nextRole === APP_ROLES.isp) {
                            setHasRequestedCurrentIspAccount(true);
                            setIsLoadingCurrentIspAccount(true);
                            setCurrentIspAccountError("");
                            try {
                                loginIspAccount = await api.session.getCurrentIspAccount();
                                setCurrentIspAccount(loginIspAccount);
                                if (loginIspAccount?.isp) {
                                    setIsps([loginIspAccount.isp]);
                                }
                            } catch (error) {
                                setCurrentIspAccount(null);
                                setCurrentIspAccountError(
                                    error instanceof Error
                                        ? error.message
                                        : "Terjadi kesalahan saat memuat mapping akun ISP.",
                                );
                            } finally {
                                setIsLoadingCurrentIspAccount(false);
                            }
                        }
                        const landingPath = getLandingPathForRole(nextRole, nextRolePaths, user, loginIspAccount?.ispId);

                        setAuthSession({ user });
                        setCurrentRole(nextRole);
                        persistRole(nextRole);
                        setCustomersError("");
                        setIspsError("");
                        navigateTo(landingPath, { replace: true });
                        void refreshAppData();
                    }}
                />
            </Suspense>
        );
    }

    if (route.type === "admin-register") {
        return (
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0c12]"><div className="text-sm text-white/60">Memuat...</div></div>}>
                <AdminRegisterPage onBackToLogin={() => navigateTo(appPaths.login, { replace: true })} />
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
                    refreshToken={dashboardRefreshToken}
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
                    onOpenIsp={handleOpenIspDetail}
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
                    onOpenIsp={handleOpenIspDetail}
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
                    onNavigatePath={navigateTo}
                    onLogout={handleLogout}
                />
            </Suspense>
        );
    }

    if (route.type === "customer-create") {
        if (currentRole === APP_ROLES.isp && !createTenantContextIsp) {
            if (!hasRequestedIsps || isLoadingIsps) {
                return (
                    <RouteLoadingPage
                        activeSection={activeSection}
                        currentRole={currentRole}
                        onNavigate={handleNavigate}
                        onLogout={handleLogout}
                        message="Memuat data ISP untuk lokasi baru..."
                    />
                );
            }

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

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat form..." />}>
                <TenantAdminFormPage
                    isps={isps}
                    lockedIsp={createTenantContextIsp}
                    currentRole={currentRole}
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
                    currentRole={currentRole}
                    onCancel={handleCancelCreate}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onSaved={async () => {
                        await refreshAppData();
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
                        await refreshAppData();
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

        if (!resolvedIspDetail) {
            const isUnresolvedSelfIspRoute = currentRole === APP_ROLES.isp && route.ispId === "me";
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title={isUnresolvedSelfIspRoute ? "Akun ISP belum terhubung" : "ISP tidak ditemukan"}
                    description={isUnresolvedSelfIspRoute
                        ? currentIspAccountError || "Akun ini belum memiliki mapping ISP aktif. Hubungi admin untuk mengaitkan akun ke ISP yang benar."
                        : ispDetailError || "Data ISP yang Anda buka belum tersedia."}
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat detail ISP..." />}>
                <IspDetailPage
                    isp={resolvedIspDetail}
                    currentRole={currentRole}
                    initialTab={route.initialTab}
                    onBack={() => {
                        const fallbackPath = currentRole === APP_ROLES.isp
                            ? appPaths.ispDetail(resolvedIspDetail.id)
                            : appPaths.customers;
                        navigateTo(fallbackPath, { replace: true });
                    }}
                    onEditIsp={handleOpenEditIsp}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onOpenCreateTenant={handleOpenCreateTenantFromIsp}
                    onOpenTenant={(tenant, initialTab = "overview") =>
                        handleOpenTenantDetail(tenant, initialTab, resolvedIspDetail)}
                    onTabChange={(nextTab) => {
                        navigateTo(appPaths.ispDetail(resolvedIspDetail.id, { tab: nextTab }), { replace: true });
                    }}
                    notifications={notificationsByIspId[Number(resolvedIspDetail.id)] ?? []}
                    onRefreshAll={async () => {
                        await refreshAppData();
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

        if (!resolvedCustomerDetail) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description={customerDetailError || "Data tenant yang Anda buka belum tersedia."}
                />
            );
        }

        if (!isResolvedCustomerAllowedForIsp) {
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

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat detail tenant..." />}>
                <TenantDetailPage
                    customer={resolvedCustomerDetail}
                    contextIsp={selectedCustomerContextIsp}
                    initialTab={route.initialTab}
                    currentRole={currentRole}
                    backLabel={currentRole === APP_ROLES.isp ? "Kembali ke Halaman ISP" : "Kembali ke Daftar Tenant"}
                    onBack={() => {
                        if (currentRole === APP_ROLES.isp && resolvedCurrentIspId) {
                            navigateTo(appPaths.ispDetail(resolvedCurrentIspId), { replace: true });
                            return;
                        }

                        navigateTo(appPaths.customers, { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onCreateIsp={handleOpenCreateIsp}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await refreshAppData();
                    }}
                    onTabChange={(nextTab) => {
                        if (nextTab === "jalur") {
                            const jalurPath = typeof appPaths.customerJalur === "function"
                                ? appPaths.customerJalur(resolvedCustomerDetail.id)
                                : appPaths.customerDetail(resolvedCustomerDetail.id, { tab: "jalur", ispId: resolvedCurrentIspId });
                            navigateTo(jalurPath, { replace: true });
                            return;
                        }

                        navigateTo(appPaths.customerDetail(resolvedCustomerDetail.id, {
                            tab: nextTab,
                            ispId: selectedCustomerContextIsp?.id ?? (currentRole === APP_ROLES.isp ? resolvedCurrentIspId : null),
                        }), { replace: true });
                    }}
                    onOpenRoutePlanner={(tenant) => {
                        const resolvedCustomerId = Number(tenant?.id ?? resolvedCustomerDetail.id);
                        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) {
                            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
                            return;
                        }

                        if (typeof appPaths.customerJalurPlanner === "function") {
                            navigateTo(appPaths.customerJalurPlanner(resolvedCustomerId));
                        }
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

        if (!resolvedCustomerDetail) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description={customerDetailError || "Data tenant yang Anda buka belum tersedia."}
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat tampilan jalur..." />}>
                <TenantDetailPage
                    customer={resolvedCustomerDetail}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Detail Tenant"
                    onBack={() => {
                        navigateTo(appPaths.customerDetail(resolvedCustomerDetail.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await refreshAppData();
                    }}
                    onOpenRoutePlanner={(tenant) => {
                        const resolvedCustomerId = Number(tenant?.id ?? resolvedCustomerDetail.id);
                        if (!Number.isFinite(resolvedCustomerId) || resolvedCustomerId <= 0) return;
                        navigateTo(appPaths.customerJalurPlanner(resolvedCustomerId));
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

        if (!resolvedCustomerDetail) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description={customerDetailError || "Data tenant yang Anda buka belum tersedia."}
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat pengaturan jalur..." />}>
                <TenantDetailPage
                    customer={resolvedCustomerDetail}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Detail Tenant"
                    onBack={() => {
                        navigateTo(appPaths.customerDetail(resolvedCustomerDetail.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await refreshAppData();
                    }}
                    onOpenRoutePlanner={(tenant) => {
                        const resolvedCustomerId = Number(tenant?.id ?? resolvedCustomerDetail.id);
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

        if (!resolvedCustomerDetail) {
            return (
                <RouteMissingPage
                    activeSection={activeSection}
                    currentRole={currentRole}
                    onNavigate={handleNavigate}
                    title="Tenant tidak ditemukan"
                    description={customerDetailError || "Data tenant yang Anda buka belum tersedia."}
                />
            );
        }

        return (
            <Suspense fallback={<RouteLoadingPage activeSection={activeSection} currentRole={currentRole} onNavigate={handleNavigate} onLogout={handleLogout} message="Memuat route planner..." />}>
                <TenantDetailPage
                    customer={resolvedCustomerDetail}
                    initialTab="jalur"
                    currentRole={currentRole}
                    backLabel="Kembali ke Halaman Jalur"
                    onBack={() => {
                        navigateTo(appPaths.customerJalur(resolvedCustomerDetail.id), { replace: true });
                    }}
                    onEditTenant={handleOpenEditTenant}
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    onRefreshAll={async () => {
                        await refreshAppData();
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
                    await refreshAppData();
                }}
                onLoadMoreCustomers={loadMoreCustomers}
                canCreateIsp={roleCapabilities.canCreateIsp}
                canCreateTenant={roleCapabilities.canCreateTenant}
            />
        </Suspense>
    );
    }

    function requestAppNavigationFallback(targetPath, options) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(APP_NAVIGATION_EVENT, {
        detail: { targetPath, options },
    }));
}

function RouteLoadingPage({ activeSection, currentRole, onNavigate, onLogout, message }) {
    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onNavigatePath={requestAppNavigationFallback} onLogout={onLogout} hideSidebar={currentRole === APP_ROLES.isp}>
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
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onNavigatePath={requestAppNavigationFallback} onLogout={onLogout} hideSidebar={currentRole === APP_ROLES.isp}>
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
                        onClick={() => onNavigate(currentRole === APP_ROLES.isp ? "isp-detail" : "customers")}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">{currentRole === APP_ROLES.isp ? "business" : "groups"}</span>
                        {currentRole === APP_ROLES.isp ? "Kembali ke Halaman ISP" : "Kembali ke Customer Page"}
                    </button>
                </section>
            </div>
        </AppShell>
    );
    }

    function RouteForbiddenPage({ activeSection, currentRole, onNavigate, onLogout, defaultSection, roleLabel }) {
    return (
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onNavigatePath={requestAppNavigationFallback} onLogout={onLogout} hideSidebar={currentRole === APP_ROLES.isp}>
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
        <AppShell activeSection={activeSection} currentRole={currentRole} onNavigate={onNavigate} onNavigatePath={requestAppNavigationFallback} onLogout={onLogout} hideSidebar={currentRole === APP_ROLES.isp}>
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
