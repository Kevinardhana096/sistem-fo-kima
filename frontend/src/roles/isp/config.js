export const ispMenuItems = [];

export const ispRoleConfig = {
    key: "isp",
    label: "ISP",
    profileTitle: "User ISP",
    profileSubtitle: "Mitra",
    defaultSection: "isp-detail",
    menuItems: ispMenuItems,
    capabilities: {
        canCreateIsp: false,
        canCreateTenant: true,
        canEditIsp: false,
        canDeleteIsp: false,
        canEditTenant: false,
        canDeleteTenant: false,
    },
    allowedSections: [],
    allowedRouteTypes: [
        "redirect",
        "login",
        "customer-create",
        "customer-detail",
        "isp-detail",
        "not-found",
    ],
};
