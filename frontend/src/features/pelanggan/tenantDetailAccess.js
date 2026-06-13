export const resolveTenantDetailAccess = (currentRole = "admin") => {
  const isSuperAdmin = currentRole === "super_admin";
  const isAdmin = currentRole === "admin";
  const isTeknisi = currentRole === "teknisi";
  const isIsp = currentRole === "isp";

  return {
    isAdmin,
    isSuperAdmin,
    isTeknisi,
    isIsp,
    canViewOverview: isSuperAdmin || isIsp,
    canViewTenantContracts: isSuperAdmin || isAdmin,
    canViewInvoices: isSuperAdmin || isIsp,
    canViewRoute: isSuperAdmin || isTeknisi || isIsp,
    canViewDocuments: isSuperAdmin || isIsp,
    canManageRoute: isSuperAdmin || isTeknisi,
    canManageTenantContracts: isSuperAdmin,
  };
};
