export const adminMenuItems = [
    { key: "todos", label: "Tindak Lanjut", icon: "task_alt" },
];

export const superAdminMenuItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "customers", label: "Pelanggan", icon: "groups" },
    { key: "monitoring", label: "Monitoring", icon: "monitor_heart" },
    { key: "todos", label: "Tindak Lanjut", icon: "task_alt" },
    { key: "activity", label: "Log Aktivitas", icon: "manage_history" },
    { key: "trash", label: "Tempat Sampah", icon: "delete", separated: true },
];

export const adminRoleConfig = {
    key: "admin",
    label: "Administrator",
    profileTitle: "Administrator",
    profileSubtitle: "Kontrak",
    defaultSection: "todos",
    menuItems: adminMenuItems,
    capabilities: {
        canCreateIsp: false,
        canCreateTenant: false,
        canEditIsp: false,
        canDeleteIsp: false,
        canEditTenant: false,
        canDeleteTenant: false,
    },
    allowedSections: ["todos"],
    allowedRouteTypes: [
        "redirect",
        "login",
        "section",
        "customer-detail",
        "not-found",
    ],
};

export const superAdminRoleConfig = {
    key: "super_admin",
    label: "Super Admin",
    profileTitle: "Super Admin",
    profileSubtitle: "Akses Penuh",
    defaultSection: "dashboard",
    menuItems: superAdminMenuItems,
    capabilities: {
        canCreateIsp: true,
        canCreateTenant: true,
        canEditIsp: true,
        canDeleteIsp: true,
        canEditTenant: true,
        canDeleteTenant: true,
    },
    allowedSections: ["dashboard", "customers", "monitoring", "trash", "todos", "activity"],
    allowedRouteTypes: [
        "redirect",
        "login",
        "admin-register",
        "section",
        "monitoring-fullscreen",
        "customer-create",
        "isp-create",
        "customer-edit",
        "customer-jalur-planner",
        "customer-jalur-fullscreen",
        "customer-jalur",
        "customer-detail",
        "isp-edit",
        "isp-detail",
        "not-found",
    ],
};
