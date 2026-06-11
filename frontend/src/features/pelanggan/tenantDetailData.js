import api from "../../lib/api";

export const tenantDetailData = Object.freeze({
  customers: api.customers,
  invoices: api.invoices,
  contracts: api.contracts,
  contractVersions: api.contractVersions,
  documents: api.documents,
  customerRoutes: api.customerRoutes,
  invoiceFollowUps: api.invoiceFollowUps,
  contractVersionRenewalFollowUps: api.contractVersionRenewalFollowUps,
});
