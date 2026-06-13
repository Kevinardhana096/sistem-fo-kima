import { adminRoleConfig, superAdminRoleConfig } from "./admin/config";
import { ispRoleConfig } from "./isp/config";
import { teknisiRoleConfig } from "./teknisi/config";

export const APP_ROLES = {
    guest: "guest",
    superAdmin: "super_admin",
    admin: "admin",
    teknisi: "teknisi",
    isp: "isp",
};

const guestRoleConfig = {
    key: "guest",
    label: "Guest",
    profileTitle: "Guest",
    profileSubtitle: "Belum login",
    defaultSection: "customers",
    menuItems: [],
    capabilities: {
        canCreateIsp: false,
        canCreateTenant: false,
        canEditIsp: false,
        canDeleteIsp: false,
        canEditTenant: false,
        canDeleteTenant: false,
    },
    allowedSections: [],
    allowedRouteTypes: ["redirect", "login", "admin-register", "not-found"],
};

export const roleConfigs = {
    [APP_ROLES.guest]: guestRoleConfig,
    [APP_ROLES.superAdmin]: superAdminRoleConfig,
    [APP_ROLES.admin]: adminRoleConfig,
    [APP_ROLES.teknisi]: teknisiRoleConfig,
    [APP_ROLES.isp]: ispRoleConfig,
};

export function getRoleConfig(roleKey) {
    return roleConfigs[roleKey] ?? roleConfigs[APP_ROLES.guest];
}

export function canAccessSection(roleKey, sectionKey) {
    const roleConfig = getRoleConfig(roleKey);
    return roleConfig.allowedSections.includes(sectionKey);
}

export function canAccessRoute(roleKey, route) {
    const roleConfig = getRoleConfig(roleKey);

    if (!roleConfig.allowedRouteTypes.includes(route.type)) {
        return false;
    }

    if (route.type === "section" && route.sectionKey) {
        return canAccessSection(roleKey, route.sectionKey);
    }

    return true;
}
