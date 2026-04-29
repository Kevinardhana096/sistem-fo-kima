export const APP_PATHS = {
    login: "/login",
    dashboard: "/dashboard",
    customers: "/customers",
    customerCreate: "/customers/new",
    monitoring: "/monitoring",
    trash: "/trash",
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
    ispDetail: (ispId) => `/isps/${ispId}`,
    ispEdit: (ispId) => `/isps/${ispId}/edit`,
};

export function getSectionPath(sectionKey) {
    return {
        dashboard: APP_PATHS.dashboard,
        customers: APP_PATHS.customers,
        monitoring: APP_PATHS.monitoring,
        trash: APP_PATHS.trash,
    }[sectionKey] ?? APP_PATHS.customers;
}

export function normalizePathname(pathname) {
    const trimmedPath = pathname.replace(/\/+$/, "");
    return trimmedPath.length > 0 ? trimmedPath : "/";
}

export function parseAppRoute(pathname, search) {
    const normalizedPath = normalizePathname(pathname);
    const searchParams = new URLSearchParams(search);

    if (normalizedPath === "/") {
        return { type: "redirect", to: APP_PATHS.customers };
    }

    if (normalizedPath === APP_PATHS.login) {
        return { type: "login" };
    }

    if (normalizedPath === APP_PATHS.dashboard) {
        return { type: "section", sectionKey: "dashboard" };
    }

    if (normalizedPath === APP_PATHS.customers) {
        return { type: "section", sectionKey: "customers" };
    }

    if (normalizedPath === APP_PATHS.monitoring) {
        return { type: "section", sectionKey: "monitoring" };
    }

    if (normalizedPath === APP_PATHS.trash) {
        return { type: "section", sectionKey: "trash" };
    }

    if (normalizedPath === APP_PATHS.customerCreate) {
        return {
            type: "customer-create",
            sectionKey: "customers",
            contextIspId: searchParams.get("isp"),
        };
    }

    if (normalizedPath === APP_PATHS.ispCreate) {
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
        };
    }

    return { type: "not-found", sectionKey: "customers" };
}

export function resolveCustomerByIdentifier(customers, identifier) {
    if (identifier === null || identifier === undefined || identifier === "") {
        return null;
    }

    const trimmedIdentifier = String(identifier).trim();
    const numericIdentifier = Number(trimmedIdentifier);

    return customers.find((item) => {
        const matchesId = Number.isFinite(numericIdentifier) && Number(item.id) === numericIdentifier;
        const matchesCustomerCode = String(item.customerId ?? "").trim() === trimmedIdentifier;
        return matchesId || matchesCustomerCode;
    }) ?? null;
}

export function resolveIspByIdentifier(isps, identifier) {
    if (identifier === null || identifier === undefined || identifier === "") {
        return null;
    }

    const trimmedIdentifier = String(identifier).trim();
    const numericIdentifier = Number(trimmedIdentifier);

    return isps.find((item) => Number.isFinite(numericIdentifier) && Number(item.id) === numericIdentifier)
        ?? null;
}
