import { ADMIN_PATHS, normalizePathname } from "../admin/routes";

export const ISP_PATHS = {
    login: ADMIN_PATHS.login,
    adminRegister: ADMIN_PATHS.adminRegister,
    customerCreate: ADMIN_PATHS.customerCreate,
    customerDetail: ADMIN_PATHS.customerDetail,
    ispDetail: ADMIN_PATHS.ispDetail,
};

export function getIspSectionPath() {
    return ISP_PATHS.login;
}

export function parseIspRoute(pathname, search) {
    const normalizedPath = normalizePathname(pathname);
    const searchParams = new URLSearchParams(search);

    if (normalizedPath === "/") {
        return { type: "redirect", to: ISP_PATHS.login };
    }

    if (normalizedPath === ISP_PATHS.login) {
        return { type: "login" };
    }

    if (normalizedPath === ISP_PATHS.customerCreate) {
        return {
            type: "customer-create",
            sectionKey: "isp-detail",
            contextIspId: searchParams.get("isp"),
        };
    }

    const customerDetailMatch = normalizedPath.match(/^\/customers\/([^/]+)$/);
    if (customerDetailMatch) {
        return {
            type: "customer-detail",
            sectionKey: "isp-detail",
            customerId: customerDetailMatch[1],
            initialTab: searchParams.get("tab") || "overview",
            contextIspId: searchParams.get("isp"),
        };
    }

    const ispDetailMatch = normalizedPath.match(/^\/isps\/([^/]+)$/);
    if (ispDetailMatch) {
        return {
            type: "isp-detail",
            sectionKey: "isp-detail",
            ispId: ispDetailMatch[1],
            initialTab: searchParams.get("tab") || "overview",
        };
    }

    return { type: "not-found", sectionKey: "isp-detail" };
}
