export const resolveTenantDetailAccess = (currentRole = "admin") => {
  const isTeknisi = currentRole === "teknisi";
  const isIsp = currentRole === "isp";

  return {
    isTeknisi,
    isIsp,
    canManageRoute: currentRole === "admin" || isTeknisi,
    canManageTenantContracts: currentRole === "admin",
  };
};
