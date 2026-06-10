export const teknisiMenuItems = [
    { key: "monitoring", label: "Monitoring", icon: "monitor_heart" },
    { key: "customers", label: "Pelanggan", icon: "groups" },
    { key: "todos", label: "Tindak Lanjut", icon: "task_alt" },
    { key: "trash", label: "Tempat Sampah", icon: "delete", separated: true },
];

export const teknisiRoleConfig = {
    key: "teknisi",
    label: "Teknisi",
    profileTitle: "Teknisi",
    profileSubtitle: "Operasional",
    defaultSection: "monitoring",
    menuItems: teknisiMenuItems,
    capabilities: {
        canCreateIsp: false,
        canCreateTenant: false,
        canEditIsp: false,
        canDeleteIsp: false,
        canEditTenant: false,
        canDeleteTenant: false,
    },
    allowedSections: ["monitoring", "customers", "todos", "trash"],
    allowedRouteTypes: [
        "redirect",
        "login",
        "section",
        "monitoring-fullscreen",
        "customer-jalur-planner",
        "customer-jalur-fullscreen",
        "customer-jalur",
        "customer-detail",
        "isp-detail",
        "not-found",
    ],
};
