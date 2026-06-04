export {
    normalizePathname,
} from "../roles/admin/routes";
import { APP_ROLES } from "../roles";
import {
    ADMIN_PATHS,
    getAdminSectionPath,
    parseAdminRoute,
} from "../roles/admin/routes";
import {
    ISP_PATHS,
    getIspSectionPath,
    parseIspRoute,
} from "../roles/isp/routes";
import {
    TEKNISI_PATHS,
    getTeknisiSectionPath,
    parseTeknisiRoute,
} from "../roles/teknisi/routes";

const routeRegistry = {
    [APP_ROLES.guest]: {
        paths: ADMIN_PATHS,
        getSectionPath: getAdminSectionPath,
        parseRoute: parseAdminRoute,
    },
    [APP_ROLES.admin]: {
        paths: ADMIN_PATHS,
        getSectionPath: getAdminSectionPath,
        parseRoute: parseAdminRoute,
    },
    [APP_ROLES.teknisi]: {
        paths: TEKNISI_PATHS,
        getSectionPath: getTeknisiSectionPath,
        parseRoute: parseTeknisiRoute,
    },
    [APP_ROLES.isp]: {
        paths: ISP_PATHS,
        getSectionPath: getIspSectionPath,
        parseRoute: parseIspRoute,
    },
};

function getRouteModule(roleKey = APP_ROLES.guest) {
    return routeRegistry[roleKey] ?? routeRegistry[APP_ROLES.guest];
}

export const APP_PATHS = ADMIN_PATHS;

export function getAppPaths(roleKey = APP_ROLES.guest) {
    return getRouteModule(roleKey).paths;
}

export function getSectionPath(sectionKey, roleKey = APP_ROLES.guest) {
    return getRouteModule(roleKey).getSectionPath(sectionKey);
}

export function parseAppRoute(pathname, search, roleKey = APP_ROLES.guest) {
    return getRouteModule(roleKey).parseRoute(pathname, search);
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
