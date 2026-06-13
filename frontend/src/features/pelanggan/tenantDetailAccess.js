export const resolveTenantDetailAccess = (currentRole = "admin") => {
  const isAdminRole = currentRole === "admin" || currentRole === "super_admin";
  const isTeknisi = currentRole === "teknisi";
  const isIsp = currentRole === "isp";

  return {
    isTeknisi,
    isIsp,
    canManageRoute: isAdminRole || isTeknisi,
    canManageTenantContracts: isAdminRole,
  };
};
