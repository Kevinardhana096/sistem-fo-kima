export const ADMIN_PATHS = {
    login: "/login",
    adminRegister: "/kima-admin/register-7f4c9a2e",
    dashboard: "/dashboard",
    customers: "/customers",
    customerCreate: "/customers/new",
    monitoring: "/monitoring",
    monitoringFullscreen: "/monitoring/fullscreen",
    trash: "/trash",
    activity: "/activity-log",
    todos: "/todos",
    ispCreate: "/isps/new",
    customerDetail: (customerId, { tab = "overview", ispId = null } = {}) => {
        const searchParams = new URLSearchParams();

        if (tab && tab !== "overview") {
            searchParams.set("tab", tab);
        }

        if (ispId !== null && ispId !== undefined) {
            searchParams.set("isp", String(ispId));
        }

        const query = searchParams.toString();
        return `/customers/${customerId}${query ? `?${query}` : ""}`;
    },
    customerEdit: (customerId) => `/customers/${customerId}/edit`,
    customerJalur: (customerId) => `/customers/${customerId}/jalur`,
    customerJalurPlanner: (customerId) => `/customers/${customerId}/jalur/planner`,
    customerJalurFullscreen: (customerId) => `/customers/${customerId}/jalur/fullscreen`,
    ispDetail: (ispId, { tab = "overview" } = {}) => {
        const searchParams = new URLSearchParams();

        if (tab && tab !== "overview") {
            searchParams.set("tab", tab);
        }

        const query = searchParams.toString();
        return `/isps/${ispId}${query ? `?${query}` : ""}`;
    },
    ispEdit: (ispId) => `/isps/${ispId}/edit`,
};

export function getAdminSectionPath(sectionKey) {
    return {
        dashboard: ADMIN_PATHS.dashboard,
        customers: ADMIN_PATHS.customers,
        monitoring: ADMIN_PATHS.monitoring,
        trash: ADMIN_PATHS.trash,
        activity: ADMIN_PATHS.activity,
        todos: ADMIN_PATHS.todos,
    }[sectionKey] ?? ADMIN_PATHS.customers;
}

export function normalizePathname(pathname) {
    const trimmedPath = pathname.replace(/\/+$/, "");
    return trimmedPath.length > 0 ? trimmedPath : "/";
}

export function parseAdminRoute(pathname, search) {
    const normalizedPath = normalizePathname(pathname);
    const searchParams = new URLSearchParams(search);

    if (normalizedPath === "/") {
        return { type: "redirect", to: ADMIN_PATHS.login };
    }

    if (normalizedPath === ADMIN_PATHS.login) {
        return { type: "login" };
    }

    if (normalizedPath === ADMIN_PATHS.adminRegister) {
        return { type: "admin-register" };
    }

    if (normalizedPath === ADMIN_PATHS.dashboard) {
        return { type: "section", sectionKey: "dashboard" };
    }

    if (normalizedPath === ADMIN_PATHS.customers) {
        return { type: "section", sectionKey: "customers" };
    }

    if (normalizedPath === ADMIN_PATHS.monitoring) {
        return { type: "section", sectionKey: "monitoring" };
    }

    if (normalizedPath === ADMIN_PATHS.monitoringFullscreen) {
        return { type: "monitoring-fullscreen", sectionKey: "monitoring" };
    }

    if (normalizedPath === ADMIN_PATHS.trash) {
        return { type: "section", sectionKey: "trash" };
    }

    if (normalizedPath === ADMIN_PATHS.activity) {
        return { type: "section", sectionKey: "activity" };
    }

    if (normalizedPath === ADMIN_PATHS.todos) {
        return { type: "section", sectionKey: "todos" };
    }

    if (normalizedPath === ADMIN_PATHS.customerCreate) {
        return {
            type: "customer-create",
            sectionKey: "customers",
            contextIspId: searchParams.get("isp"),
        };
    }

    if (normalizedPath === ADMIN_PATHS.ispCreate) {
        return { type: "isp-create", sectionKey: "customers" };
    }

    const customerEditMatch = normalizedPath.match(/^\/customers\/([^/]+)\/edit$/);
    if (customerEditMatch) {
        return {
            type: "customer-edit",
            sectionKey: "customers",
            customerId: customerEditMatch[1],
        };
    }

    const customerJalurPlannerMatch = normalizedPath.match(/^\/customers\/([^/]+)\/jalur\/planner$/);
    if (customerJalurPlannerMatch) {
        return {
            type: "customer-jalur-planner",
            sectionKey: "customers",
            customerId: customerJalurPlannerMatch[1],
        };
    }

    const customerJalurFullscreenMatch = normalizedPath.match(/^\/customers\/([^/]+)\/jalur\/fullscreen$/);
    if (customerJalurFullscreenMatch) {
        return {
            type: "customer-jalur-fullscreen",
            sectionKey: "customers",
            customerId: customerJalurFullscreenMatch[1],
        };
    }

    const customerJalurMatch = normalizedPath.match(/^\/customers\/([^/]+)\/jalur$/);
    if (customerJalurMatch) {
        return {
            type: "customer-jalur",
            sectionKey: "customers",
            customerId: customerJalurMatch[1],
        };
    }

    const customerDetailMatch = normalizedPath.match(/^\/customers\/([^/]+)$/);
    if (customerDetailMatch) {
        return {
            type: "customer-detail",
            sectionKey: "customers",
            customerId: customerDetailMatch[1],
            initialTab: searchParams.get("tab") || "overview",
            contextIspId: searchParams.get("isp"),
        };
    }

    const ispEditMatch = normalizedPath.match(/^\/isps\/([^/]+)\/edit$/);
    if (ispEditMatch) {
        return {
            type: "isp-edit",
            sectionKey: "customers",
            ispId: ispEditMatch[1],
        };
    }

    const ispDetailMatch = normalizedPath.match(/^\/isps\/([^/]+)$/);
    if (ispDetailMatch) {
        return {
            type: "isp-detail",
            sectionKey: "customers",
            ispId: ispDetailMatch[1],
            initialTab: searchParams.get("tab") || "overview",
        };
    }

    return { type: "not-found", sectionKey: "customers" };
}
