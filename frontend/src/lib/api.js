import { supabase } from './supabase';

/**
 * API Service untuk Supabase REST API
 * Menggantikan fetch calls ke backend NestJS dengan Supabase client
 */

// ============================================================================
// CUSTOMERS API
// ============================================================================

const mapInvoiceFollowUp = (followUp) => ({
  ...followUp,
  invoiceId: followUp.invoiceId ?? followUp.invoice_id ?? null,
  splitOrder: followUp.splitOrder ?? followUp.split_order ?? 1,
  invoiceNumber: followUp.invoiceNumber ?? followUp.invoice_number ?? null,
  invoiceFileUrl: followUp.invoiceFileUrl ?? followUp.invoice_file_url ?? null,
  invoiceFileName: followUp.invoiceFileName ?? followUp.invoice_file_name ?? null,
  paymentProofFileUrl: followUp.paymentProofFileUrl ?? followUp.payment_proof_file_url ?? null,
  paymentProofFileName: followUp.paymentProofFileName ?? followUp.payment_proof_file_name ?? null,
  paidAt: followUp.paidAt ?? followUp.paid_at ?? null,
});

const mapContractVersionRenewalFollowUp = (followUp) => ({
  ...followUp,
  versionId: followUp.versionId ?? followUp.version_id ?? null,
  splitOrder: followUp.splitOrder ?? followUp.split_order ?? 1,
  renewalFileUrl: followUp.renewalFileUrl ?? followUp.renewal_file_url ?? null,
  renewalFileName: followUp.renewalFileName ?? followUp.renewal_file_name ?? null,
  responseFileUrl: followUp.responseFileUrl ?? followUp.response_file_url ?? null,
  responseFileName: followUp.responseFileName ?? followUp.response_file_name ?? null,
  responseStatus: followUp.responseStatus ?? followUp.response_status ?? null,
});

const mapContractVersion = (version) => ({
  ...version,
  contractId: version.contractId ?? version.contract_id ?? null,
  versionNumber: version.versionNumber ?? version.version_number ?? 1,
  startDate: version.startDate ?? version.start_date ?? null,
  endDate: version.endDate ?? version.end_date ?? null,
  coreType: version.coreType ?? version.core_type ?? null,
  coreTotal: version.coreTotal ?? version.core_total ?? null,
  sharedCoreRatio: version.sharedCoreRatio ?? version.shared_core_ratio ?? null,
  monthlyAmount: version.monthlyAmount ?? version.monthly_amount ?? null,
  yearlyAmount: version.yearlyAmount ?? version.yearly_amount ?? null,
  bakDocumentId: version.bakDocumentId ?? version.bak_document_id ?? null,
  renewalFollowUps: Array.isArray(version.renewalFollowUps)
    ? version.renewalFollowUps.map(mapContractVersionRenewalFollowUp)
    : [],
});

const mapCustomerContract = (contract) => ({
  ...contract,
  customerId: contract.customerId ?? contract.customer_id ?? null,
  contractNumber: contract.contractNumber ?? contract.contract_number ?? null,
  startDate: contract.startDate ?? contract.start_date ?? null,
  endDate: contract.endDate ?? contract.end_date ?? null,
  coreType: contract.coreType ?? contract.core_type ?? null,
  coreTotal: contract.coreTotal ?? contract.core_total ?? null,
  sharingRatio: contract.sharingRatio ?? contract.sharing_ratio ?? null,
  billingEvery: contract.billingEvery ?? contract.billing_every ?? null,
  billingUnit: contract.billingUnit ?? contract.billing_unit ?? null,
  versions: Array.isArray(contract.versions)
    ? contract.versions.map(mapContractVersion).sort((left, right) => Number(right.versionNumber ?? 0) - Number(left.versionNumber ?? 0))
    : [],
});

const mapCustomerInvoice = (invoice) => ({
  ...invoice,
  customerId: invoice.customerId ?? invoice.customer_id ?? null,
  contractId: invoice.contractId ?? invoice.contract_id ?? null,
  periodYear: invoice.periodYear ?? invoice.period_year ?? null,
  periodMonth: invoice.periodMonth ?? invoice.period_month ?? null,
  periodStartDate: invoice.periodStartDate ?? invoice.period_start_date ?? null,
  periodEndDate: invoice.periodEndDate ?? invoice.period_end_date ?? null,
  invoiceNumber: invoice.invoiceNumber ?? invoice.invoice_number ?? null,
  invoiceFileUrl: invoice.invoiceFileUrl ?? invoice.invoice_file_url ?? null,
  invoiceFileName: invoice.invoiceFileName ?? invoice.invoice_file_name ?? null,
  paymentProofFileUrl: invoice.paymentProofFileUrl ?? invoice.payment_proof_file_url ?? null,
  paymentProofFileName: invoice.paymentProofFileName ?? invoice.payment_proof_file_name ?? null,
  paidAt: invoice.paidAt ?? invoice.paid_at ?? null,
  dueDate: invoice.dueDate ?? invoice.due_date ?? null,
  scheduleStatus: invoice.scheduleStatus ?? invoice.schedule_status ?? null,
  invoiceFollowUps: Array.isArray(invoice.invoiceFollowUps)
    ? invoice.invoiceFollowUps.map(mapInvoiceFollowUp)
    : [],
});

const mapCustomerDocument = (document) => ({
  ...document,
  customerId: document.customerId ?? document.customer_id ?? null,
  contractId: document.contractId ?? document.contract_id ?? null,
  jenisDokumen: document.jenisDokumen ?? document.jenis_dokumen ?? null,
  nomorDokumen: document.nomorDokumen ?? document.nomor_dokumen ?? null,
  tanggalDokumen: document.tanggalDokumen ?? document.tanggal_dokumen ?? null,
  fileUrl: document.fileUrl ?? document.file_url ?? null,
  fileName: document.fileName ?? document.file_name ?? null,
});

const mapRoutePoint = (point) => ({
  ...point,
  routeVersionId: point.routeVersionId ?? point.route_version_id ?? null,
  pointType: point.pointType ?? point.point_type ?? null,
  sequenceNumber: point.sequenceNumber ?? point.sequence_number ?? 0,
});

const mapRouteVersion = (version) => ({
  ...version,
  customerId: version.customerId ?? version.customer_id ?? null,
  versionNumber: version.versionNumber ?? version.version_number ?? 1,
  flowStatus: version.flowStatus ?? version.flow_status ?? null,
  changeNote: version.changeNote ?? version.change_note ?? null,
  points: Array.isArray(version.points)
    ? version.points.map(mapRoutePoint).sort((left, right) => Number(left.sequenceNumber ?? 0) - Number(right.sequenceNumber ?? 0))
    : [],
});

const mapRouteHistory = (history) => ({
  ...history,
  customerId: history.customerId ?? history.customer_id ?? null,
  routeVersionId: history.routeVersionId ?? history.route_version_id ?? null,
  fromStatus: history.fromStatus ?? history.from_status ?? null,
  toStatus: history.toStatus ?? history.to_status ?? null,
  changeNote: history.changeNote ?? history.change_note ?? null,
});

const getDateValue = (value) => {
  const timestamp = value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getLatestContractVersion = (contract) => (
  Array.isArray(contract?.versions)
    ? [...contract.versions].sort((left, right) => {
      const versionDiff = Number(right.versionNumber ?? right.version_number ?? 0) - Number(left.versionNumber ?? left.version_number ?? 0);
      if (versionDiff !== 0) {
        return versionDiff;
      }

      return getDateValue(right.endDate ?? right.end_date ?? right.startDate ?? right.start_date)
        - getDateValue(left.endDate ?? left.end_date ?? left.startDate ?? left.start_date);
    })[0]
    : null
);

const getContractLatestPeriodTimestamp = (contract) => {
  const latestVersion = getLatestContractVersion(contract);
  return getDateValue(
    latestVersion?.endDate
      ?? latestVersion?.end_date
      ?? latestVersion?.startDate
      ?? latestVersion?.start_date
      ?? contract?.endDate
      ?? contract?.end_date
      ?? contract?.startDate
      ?? contract?.start_date,
  );
};

const mapCustomerDetail = (customer) => {
  const contracts = Array.isArray(customer.contracts)
    ? customer.contracts.map(mapCustomerContract).sort((left, right) => getContractLatestPeriodTimestamp(right) - getContractLatestPeriodTimestamp(left))
    : [];
  const activeContract = contracts[0] ?? null;
  const initialContract = [...contracts].sort((left, right) => getDateValue(left.startDate ?? left.start_date) - getDateValue(right.startDate ?? right.start_date))[0] ?? null;
  const latestContractVersion = getLatestContractVersion(activeContract);
  const routeVersions = Array.isArray(customer.routeVersions)
    ? customer.routeVersions.map(mapRouteVersion).sort((left, right) => Number(right.versionNumber ?? 0) - Number(left.versionNumber ?? 0))
    : [];
  const activeRouteVersion = routeVersions[0] ?? null;

  return {
    ...customer,
    customerId: customer.customerId ?? customer.customer_code ?? `CUST-${customer.id}`,
    activationFeeAmount: customer.activationFeeAmount ?? customer.activation_fee_amount ?? 0,
    activationFeePaidAt: customer.activationFeePaidAt ?? customer.activation_fee_paid_at ?? null,
    contractStartDate: customer.contractStartDate ?? customer.contract_start_date ?? initialContract?.startDate ?? null,
    contractPeriodStart: customer.contractPeriodStart ?? customer.contract_period_start ?? latestContractVersion?.startDate ?? activeContract?.startDate ?? null,
    contractPeriodEnd: customer.contractPeriodEnd ?? customer.contract_period_end ?? latestContractVersion?.endDate ?? activeContract?.endDate ?? null,
    isps: Array.isArray(customer.ispMemberships)
      ? customer.ispMemberships.map(membership => mapIsp(membership.isp)).filter(Boolean)
      : [],
    contracts,
    contractVersions: contracts.flatMap(contract => (
      Array.isArray(contract.versions)
        ? contract.versions.map(version => ({
          ...version,
          contractId: version.contractId ?? contract.id,
          contractNumber: version.contractNumber ?? contract.contractNumber,
          contractStartDate: contract.startDate ?? contract.start_date ?? null,
          contractEndDate: contract.endDate ?? contract.end_date ?? null,
          contractCoreType: contract.coreType ?? contract.core_type ?? null,
          contractCoreTotal: contract.coreTotal ?? contract.core_total ?? null,
          contractSharingRatio: contract.sharingRatio ?? contract.sharing_ratio ?? null,
        }))
        : []
    )),
    invoices: Array.isArray(customer.invoices) ? customer.invoices.map(mapCustomerInvoice) : [],
    latestDocuments: Array.isArray(customer.documents) ? customer.documents.map(mapCustomerDocument) : [],
    route: {
      activeFlowStatus: activeRouteVersion?.flowStatus ?? 'aktif',
      points: activeRouteVersion?.points ?? [],
      versions: routeVersions,
      history: Array.isArray(customer.routeHistory) ? customer.routeHistory.map(mapRouteHistory) : [],
    },
  };
};

export const customersApi = {
  // Get all customers
  async getAll() {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        ispMemberships:customer_isp_memberships(
          isp:isps(*)
        ),
        contracts(
          *,
          versions:contract_versions(*)
        ),
        invoices(*),
        routeVersions:customer_route_versions(*)
      `)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get customer by ID
  async getById(id) {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        ispMemberships:customer_isp_memberships(
          isp:isps(*)
        ),
        contracts(
          *,
          versions:contract_versions(
            *,
            renewalFollowUps:contract_version_renewal_follow_ups(*)
          )
        ),
        invoices(
          *,
          invoiceFollowUps:invoice_follow_ups(*)
        ),
        documents(*),
        routeVersions:customer_route_versions(
          *,
          points:customer_route_points(*)
        ),
        routeHistory:customer_route_history(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapCustomerDetail(data);
  },

  // Create customer
  async create(customerData) {
    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update customer
  async update(id, customerData) {
    const { data, error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete customer
  async delete(id) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// ISPs API
// ============================================================================

const mapIspRenewalFollowUp = (followUp) => ({
  ...followUp,
  rowId: followUp.rowId ?? followUp.row_id ?? null,
  splitOrder: followUp.splitOrder ?? followUp.split_order ?? 1,
  renewalFileUrl: followUp.renewalFileUrl ?? followUp.renewal_file_url ?? null,
  renewalFileName: followUp.renewalFileName ?? followUp.renewal_file_name ?? null,
  responseFileUrl: followUp.responseFileUrl ?? followUp.response_file_url ?? null,
  responseFileName: followUp.responseFileName ?? followUp.response_file_name ?? null,
  responseStatus: followUp.responseStatus ?? followUp.response_status ?? null,
});

const mapIspContractRow = (row) => ({
  ...row,
  contractReference: row.contractReference ?? row.contract_reference ?? row.contract_number ?? null,
  contractFileUrl: row.contractFileUrl ?? row.contract_file_url ?? null,
  contractFileName: row.contractFileName ?? row.contract_file_name ?? null,
  contractStartDate: row.contractStartDate ?? row.contract_start_date ?? null,
  periodStart: row.periodStart ?? row.period_start ?? row.start_date ?? null,
  periodEnd: row.periodEnd ?? row.period_end ?? row.end_date ?? null,
  bakFileUrl: row.bakFileUrl ?? row.bak_file_url ?? null,
  bakFileName: row.bakFileName ?? row.bak_file_name ?? null,
  responseFileUrl: row.responseFileUrl ?? row.response_file_url ?? null,
  responseFileName: row.responseFileName ?? row.response_file_name ?? null,
  responseStatus: row.responseStatus ?? row.response_status ?? null,
  renewalStatus: row.renewalStatus ?? row.renewal_status ?? null,
  renewalFollowUps: Array.isArray(row.renewalFollowUps)
    ? row.renewalFollowUps.map(mapIspRenewalFollowUp)
    : [],
});

const mapIspPayload = (ispData = {}) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(ispData, 'name')) payload.name = ispData.name;
  if (Object.prototype.hasOwnProperty.call(ispData, 'status')) payload.status = ispData.status;
  if (Object.prototype.hasOwnProperty.call(ispData, 'logoUrl')) payload.logo_url = ispData.logoUrl;
  if (Object.prototype.hasOwnProperty.call(ispData, 'logo_url')) payload.logo_url = ispData.logo_url;
  if (Object.prototype.hasOwnProperty.call(ispData, 'packageName')) {
    payload.paket = String(ispData.packageName).toLowerCase() === 'core' ? 'core' : 'shared';
  }
  if (Object.prototype.hasOwnProperty.call(ispData, 'paket')) payload.paket = ispData.paket;
  if (Object.prototype.hasOwnProperty.call(ispData, 'packageQuantity')) payload.jumlah = Number(ispData.packageQuantity || 0);
  if (Object.prototype.hasOwnProperty.call(ispData, 'jumlah')) payload.jumlah = ispData.jumlah;

  return payload;
};

const mapIsp = (isp) => isp ? ({
  ...isp,
  logoUrl: isp.logoUrl ?? isp.logo_url ?? null,
  contractReference: isp.contractReference ?? isp.contract_reference ?? null,
}) : isp;

export const ispsApi = {
  // Get all ISPs
  async getAll() {
    const { data, error } = await supabase
      .from('isps')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data.map(mapIsp) : [];
  },

  // Get ISP by ID
  async getById(id) {
    const { data, error } = await supabase
      .from('isps')
      .select(`
        *,
        contractRows:isp_contract_rows(
          *,
          renewalFollowUps:isp_renewal_follow_ups(*)
        ),
        customerMemberships:customer_isp_memberships(
          customer:customers(
            *,
            contracts(
              *,
              versions:contract_versions(*)
            ),
            routeVersions:customer_route_versions(*)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      ...mapIsp(data),
      contractRows: Array.isArray(data.contractRows)
        ? data.contractRows.map(mapIspContractRow)
        : [],
      tenants: data.customerMemberships?.map(membership => membership.customer).filter(Boolean) || [],
    };
  },

  // Create ISP
  async create(ispData) {
    const { data, error } = await supabase
      .from('isps')
      .insert(mapIspPayload(ispData))
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update ISP
  async update(id, ispData) {
    const { data, error } = await supabase
      .from('isps')
      .update(mapIspPayload(ispData))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete ISP
  async delete(id) {
    const { error } = await supabase
      .from('isps')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// MONITORING API
// ============================================================================

export const monitoringApi = {
  // Get billing monitoring data
  async getBilling({ year, isp, status }) {
    // Get all active customers with their contracts and invoices
    let query = supabase
      .from('customers')
      .select(`
        id,
        customer_code,
        isp_name,
        name,
        status,
        activation_fee_amount,
        activation_fee_paid_at,
        contract_start_date,
        notes,
        ispMemberships:customer_isp_memberships(
          isp:isps(*)
        ),
        contracts(
          id,
          contract_number,
          start_date,
          end_date,
          core_type,
          core_total,
          sharing_ratio,
          status,
          versions:contract_versions(
            id,
            version_number,
            start_date,
            end_date,
            core_type,
            core_total,
            shared_core_ratio,
            monthly_amount,
            yearly_amount,
            remarks
          )
        ),
        invoices!inner(
          id,
          invoice_number,
          contract_id,
          period_year,
          period_month,
          amount,
          status,
          schedule_status
        ),
        routeVersions:customer_route_versions(
          flow_status
        )
      `)
      .eq('status', 'aktif')
      .eq('invoices.period_year', year)
      .eq('invoices.schedule_status', 'active');

    const { data: customers, error } = await query;

    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = new Date().getUTCMonth() + 1;
    const selectedYear = Number(year);

    const getDateValue = (value) => {
      const timestamp = value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getLatestVersion = (contract) => (
      Array.isArray(contract?.versions)
        ? [...contract.versions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.end_date ?? right.start_date) - getDateValue(left.end_date ?? left.start_date);
        })[0]
        : null
    );

    const getCurrentContract = (contracts = []) => {
      const sortedContracts = [...contracts].sort((left, right) => {
        const leftStart = getDateValue(left.start_date);
        const rightStart = getDateValue(right.start_date);
        if (rightStart !== leftStart) return rightStart - leftStart;
        return getDateValue(right.end_date) - getDateValue(left.end_date);
      });

      return sortedContracts.find(contract => contract.start_date <= today && contract.end_date >= today)
        ?? sortedContracts.find(contract => contract.start_date > today)
        ?? sortedContracts[0]
        ?? null;
    };

    const isMonthInsideContract = (contract, month) => {
      if (!contract?.start_date || !contract?.end_date) return false;
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEndDate = new Date(Date.UTC(selectedYear, month, 0));
      const monthEnd = monthEndDate.toISOString().slice(0, 10);
      return monthEnd >= contract.start_date && monthStart <= contract.end_date;
    };

    // Transform data to match backend format
    const rows = customers.map(customer => {
      const customerIsps = customer.ispMemberships?.map(m => m.isp).filter(Boolean) || [];
      const ispNames = customerIsps.map(isp => isp.name).filter(Boolean);
      const currentContract = getCurrentContract(customer.contracts || []);
      const latestVersion = getLatestVersion(currentContract);
      const currentMonthInvoice = customer.invoices?.find(
        inv => inv.period_year === selectedYear
          && inv.period_month === currentMonth
          && inv.schedule_status === 'active'
          && (!currentContract?.id || inv.contract_id === currentContract.id)
      );

      // Build months array (12 months)
      const months = Array.from({ length: 12 }, (_, monthIndex) => {
        const month = monthIndex + 1;
        if (currentContract && !isMonthInsideContract(currentContract, month)) {
          return 'di_luar_periode';
        }
        const invoice = customer.invoices?.find(
          inv => inv.period_year === selectedYear
            && inv.period_month === month
            && inv.schedule_status === 'active'
            && (!currentContract?.id || inv.contract_id === currentContract.id)
        );
        return invoice ? invoice.status : 'belum_ditagih';
      });

      return {
        customerId: customer.id,
        customerCode: customer.customer_code,
        ispName: ispNames.length > 0 ? ispNames.join(', ') : customer.isp_name || '-',
        ispNames,
        ispContractStart: customer.contract_start_date || null,
        customerName: customer.name,
        customerStatus: customer.status,
        contractNumber: currentContract?.contract_number?.startsWith('NO-BAK-') ? '-' : currentContract?.contract_number || null,
        currentInvoiceNumber: currentMonthInvoice?.invoice_number || null,
        routeStatus: customer.routeVersions?.[0]?.flow_status || null,
        activationFeeAmount: Number(customer.activation_fee_amount || 0),
        activationFeePaidAt: customer.activation_fee_paid_at,
        contractStart: latestVersion?.start_date || currentContract?.start_date || null,
        contractEnd: latestVersion?.end_date || currentContract?.end_date || null,
        coreType: latestVersion?.core_type || currentContract?.core_type || null,
        coreTotal: latestVersion?.core_total ?? currentContract?.core_total ?? null,
        sharingRatio: latestVersion?.shared_core_ratio || currentContract?.sharing_ratio || null,
        monthlyAmount: Number(latestVersion?.monthly_amount || 0),
        yearlyAmount: Number(latestVersion?.yearly_amount || 0),
        notes: customer.notes || null,
        contractRemarks: latestVersion?.remarks || null,
        months,
      };
    });

    // Apply filters
    let filteredRows = rows;

    if (isp) {
      const normalizedIspFilter = isp.trim().toLowerCase();
      filteredRows = filteredRows.filter(row =>
        [row.ispName, ...(row.ispNames || [])]
          .join(' ')
          .toLowerCase()
          .includes(normalizedIspFilter)
      );
    }

    if (status) {
      filteredRows = filteredRows.filter(row => row.months.includes(status));
    }

    // Build summary
    const summary = {
      lunas: 0,
      belum_bayar: 0,
      terlambat: 0,
      belum_ditagih: 0,
    };

    filteredRows.forEach(row => {
      row.months.forEach(monthStatus => {
        if (summary[monthStatus] !== undefined) {
          summary[monthStatus] += 1;
        }
      });
    });

    return {
      year,
      appliedFilters: {
        isp: isp || null,
        status: status || null,
      },
      summary,
      rows: filteredRows,
    };
  },

  async getHistory({ year, isp }) {
    const selectedYear = Number(year);
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;
    const today = new Date().toISOString().slice(0, 10);

    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        id,
        customer_code,
        isp_name,
        name,
        status,
        contract_start_date,
        ispMemberships:customer_isp_memberships(
          isp:isps(*)
        ),
        contracts(
          id,
          contract_number,
          start_date,
          end_date,
          core_type,
          core_total,
          sharing_ratio,
          status,
          versions:contract_versions(
            id,
            version_number,
            start_date,
            end_date,
            core_type,
            core_total,
            shared_core_ratio,
            monthly_amount,
            yearly_amount,
            remarks
          )
        ),
        invoices(
          id,
          invoice_number,
          contract_id,
          period_year,
          period_month,
          period_start_date,
          period_end_date,
          amount,
          status,
          schedule_status
        ),
        routeVersions:customer_route_versions(
          version_number,
          flow_status,
          created_at
        )
      `)
      .eq('status', 'berhenti');

    if (error) throw error;

    const getDateValue = (value) => {
      const timestamp = value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getLatestVersion = (contract) => (
      Array.isArray(contract?.versions)
        ? [...contract.versions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.end_date ?? right.start_date) - getDateValue(left.end_date ?? left.start_date);
        })[0]
        : null
    );

    const getLatestRouteVersion = (customer) => (
      Array.isArray(customer?.routeVersions)
        ? [...customer.routeVersions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.created_at) - getDateValue(left.created_at);
        })[0]
        : null
    );

    const rows = (customers || []).flatMap(customer => {
      const customerIsps = customer.ispMemberships?.map(m => m.isp).filter(Boolean) || [];
      const ispNames = customerIsps.map(item => item.name).filter(Boolean);
      const ispName = ispNames.length > 0 ? ispNames.join(', ') : customer.isp_name || '-';
      const latestRouteVersion = getLatestRouteVersion(customer);

      return (customer.contracts || [])
        .filter(contract => contract.start_date <= yearEnd && contract.end_date >= yearStart && contract.end_date < today)
        .map(contract => {
          const latestVersion = getLatestVersion(contract);
          const contractInvoices = (customer.invoices || [])
            .filter(invoice => invoice.contract_id === contract.id && invoice.schedule_status === 'active')
            .sort((left, right) => {
              const yearDiff = Number(right.period_year ?? 0) - Number(left.period_year ?? 0);
              if (yearDiff !== 0) return yearDiff;
              return Number(right.period_month ?? 0) - Number(left.period_month ?? 0);
            });
          const lastInvoice = contractInvoices[0];
          const selectedYearInvoices = contractInvoices.filter(invoice => Number(invoice.period_year) === selectedYear);

          return {
            customerId: customer.id,
            customerCode: customer.customer_code,
            customerName: customer.name,
            customerStatus: customer.status,
            routeStatus: latestRouteVersion?.flow_status || null,
            ispName,
            ispNames,
            ispContractStart: customer.contract_start_date || null,
            contractId: contract.id,
            contractNumber: contract.contract_number?.startsWith('NO-BAK-') ? '-' : contract.contract_number || null,
            lastInvoiceNumber: lastInvoice?.invoice_number || null,
            contractStart: latestVersion?.start_date || contract.start_date || null,
            contractEnd: latestVersion?.end_date || contract.end_date || null,
            coreType: latestVersion?.core_type || contract.core_type || null,
            coreTotal: latestVersion?.core_total ?? contract.core_total ?? null,
            sharingRatio: latestVersion?.shared_core_ratio || contract.sharing_ratio || null,
            monthlyAmount: Number(latestVersion?.monthly_amount || 0),
            yearlyAmount: Number(latestVersion?.yearly_amount || 0),
            invoiceCount: contractInvoices.length,
            selectedYearInvoiceCount: selectedYearInvoices.length,
            lastInvoiceStatus: lastInvoice?.status || null,
          };
        });
    });

    let filteredRows = rows;

    if (isp) {
      const normalizedIspFilter = isp.trim().toLowerCase();
      filteredRows = filteredRows.filter(row =>
        [row.ispName, ...(row.ispNames || [])]
          .join(' ')
          .toLowerCase()
          .includes(normalizedIspFilter)
      );
    }

    return {
      year,
      rows: filteredRows.sort((left, right) => getDateValue(right.contractEnd) - getDateValue(left.contractEnd)),
    };
  },

  // Get alerts
  async getAlerts({ year }) {
    const selectedYear = Number(year);
    const today = new Date().toISOString().slice(0, 10);
    const warningDate = new Date();
    warningDate.setUTCDate(warningDate.getUTCDate() + 90);
    const warningDateIso = warningDate.toISOString().slice(0, 10);

    const [contractsResult, invoicesResult, routesResult] = await Promise.all([
      supabase
        .from('contracts')
        .select(`
          id,
          contract_number,
          end_date,
          status,
          customer:customers(id, name, status)
        `)
        .gte('end_date', today)
        .lte('end_date', warningDateIso)
        .eq('status', 'aktif'),
      supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          period_year,
          period_month,
          amount,
          status,
          customer:customers(id, name, status)
        `)
        .eq('period_year', selectedYear)
        .eq('schedule_status', 'active')
        .in('status', ['belum_bayar', 'terlambat']),
      supabase
        .from('customers')
        .select(`
          id,
          name,
          status,
          routeVersions:customer_route_versions(version_number, flow_status, created_at)
        `)
        .eq('status', 'aktif')
    ]);

    if (contractsResult.error) throw contractsResult.error;
    if (invoicesResult.error) throw invoicesResult.error;
    if (routesResult.error) throw routesResult.error;

    const getDateValue = (value) => {
      const timestamp = value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const alerts = [];

    (contractsResult.data || []).forEach(contract => {
      alerts.push({
        code: 'contract_expiring',
        type: 'contract_expiring',
        customerId: contract.customer?.id,
        customerName: contract.customer?.name || 'Customer',
        title: 'Kontrak akan berakhir',
        message: `${contract.customer?.name || 'Customer'} berakhir pada ${contract.end_date}`,
        severity: 'warning',
      });
    });

    (invoicesResult.data || []).forEach(invoice => {
      const isOverdue = invoice.status === 'terlambat';
      alerts.push({
        code: isOverdue ? 'payment_overdue' : 'invoice_not_uploaded',
        type: 'invoice_attention',
        customerId: invoice.customer?.id,
        customerName: invoice.customer?.name || 'Customer',
        title: 'Invoice perlu perhatian',
        message: `${invoice.customer?.name || 'Customer'} invoice ${invoice.invoice_number || '-'} ${invoice.status}`,
        severity: isOverdue ? 'critical' : 'warning',
      });
    });

    (routesResult.data || []).forEach(customer => {
      const latestRoute = Array.isArray(customer.routeVersions)
        ? [...customer.routeVersions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.created_at) - getDateValue(left.created_at);
        })[0]
        : null;
      const routeStatus = String(latestRoute?.flow_status || 'aktif').trim().toLowerCase();
      if (['gangguan', 'perbaikan', 'maintenance'].includes(routeStatus)) {
        alerts.push({
          code: 'route_attention',
          type: 'route_attention',
          customerId: customer.id,
          customerName: customer.name || 'Customer',
          title: 'Jalur perlu perhatian',
          message: `${customer.name || 'Customer'} jalur ${routeStatus}`,
          severity: routeStatus === 'gangguan' ? 'critical' : 'warning',
        });
      }
    });

    return {
      year,
      alerts,
    };
  },

  // Get insights
  async getInsights({ year }) {
    const selectedYear = Number(year);
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, customer_id, period_month, amount, status, schedule_status')
      .eq('period_year', selectedYear)
      .eq('schedule_status', 'active');

    if (error) throw error;

    const months = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      revenuePaid: 0,
      revenueProjected: 0,
      activeRentals: 0,
    }));

    (invoices || []).forEach(invoice => {
      const monthIndex = Number(invoice.period_month) - 1;
      if (monthIndex < 0 || monthIndex > 11) return;
      const amount = Number(invoice.amount || 0);
      months[monthIndex].revenueProjected += amount;
      if (invoice.status === 'lunas') months[monthIndex].revenuePaid += amount;
      months[monthIndex].activeRentals += 1;
    });

    const totals = months.reduce((acc, month) => ({
      revenuePaid: acc.revenuePaid + month.revenuePaid,
      revenueProjected: acc.revenueProjected + month.revenueProjected,
      activeRentals: acc.activeRentals + month.activeRentals,
    }), { revenuePaid: 0, revenueProjected: 0, activeRentals: 0 });

    return {
      year,
      months,
      totals: {
        revenuePaid: totals.revenuePaid,
        revenueProjected: totals.revenueProjected,
        estimatedProfit: 0,
        averageActiveRentals: Math.round(totals.activeRentals / 12),
      },
    };
  },

  async getDashboardMetrics({ year }) {
    const selectedYear = Number(year);
    const today = new Date().toISOString().slice(0, 10);
    const startYear = selectedYear - 4;

    const [customersResult, ispsResult] = await Promise.all([
      supabase
        .from('customers')
        .select(`
          id,
          customer_code,
          name,
          status,
          contract_start_date,
          created_at,
          contracts(
            id,
            start_date,
            end_date,
            core_type,
            core_total,
            sharing_ratio,
            status,
            versions:contract_versions(version_number, start_date, end_date, core_type, core_total, shared_core_ratio)
          ),
          routeVersions:customer_route_versions(version_number, flow_status, created_at)
        `),
      supabase
        .from('isps')
        .select('id, name, status, paket, jumlah, created_at')
    ]);

    if (customersResult.error) throw customersResult.error;
    if (ispsResult.error) throw ispsResult.error;

    const customers = customersResult.data || [];
    const isps = ispsResult.data || [];
    const getDateValue = (value) => {
      const timestamp = value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };
    const normalizeStatus = (status) => String(status ?? '').trim().toLowerCase();
    const isStoppedStatus = (status) => ['berhenti', 'nonaktif'].includes(normalizeStatus(status));
    const isContractInPeriod = (contract, start, end) => contract?.start_date <= end && contract?.end_date >= start;
    const getLatestVersion = (contract) => (
      Array.isArray(contract?.versions)
        ? [...contract.versions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.end_date ?? right.start_date) - getDateValue(left.end_date ?? left.start_date);
        })[0]
        : null
    );
    const getRelevantContract = (contracts = []) => {
      const sortedContracts = [...contracts].sort((left, right) => {
        const startDiff = getDateValue(right.start_date) - getDateValue(left.start_date);
        if (startDiff !== 0) return startDiff;
        return getDateValue(right.end_date) - getDateValue(left.end_date);
      });
      return sortedContracts.find(contract => contract.start_date <= today && contract.end_date >= today)
        ?? sortedContracts.find(contract => contract.start_date > today)
        ?? sortedContracts[0]
        ?? null;
    };
    const getLatestRouteVersion = (customer) => (
      Array.isArray(customer?.routeVersions)
        ? [...customer.routeVersions].sort((left, right) => {
          const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
          if (versionDiff !== 0) return versionDiff;
          return getDateValue(right.created_at) - getDateValue(left.created_at);
        })[0]
        : null
    );

    const totalCoreCapacity = 384;

    const sharingRatios = ['1/2', '1/4', '1/8', '1/16', '1/32'];
    const sharingCounts = Object.fromEntries(sharingRatios.map(ratio => [ratio, 0]));
    const sharingTrend = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      name: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][index],
      '1:2': 0,
      '1:4': 0,
      '1:8': 0,
      '1:16': 0,
      '1:32': 0,
    }));
    const routeStatus = { aktif: 0, gangguan: 0, perbaikan: 0, nonaktif: 0, total: 0 };
    let totalCoreUsed = 0;
    let coreLocationCount = 0;

    customers.forEach(customer => {
      const customerStatus = normalizeStatus(customer.status);
      const relevantContract = getRelevantContract(customer.contracts || []);
      const latestVersion = getLatestVersion(relevantContract);
      const coreType = latestVersion?.core_type || relevantContract?.core_type || null;
      const coreTotal = Number(latestVersion?.core_total ?? relevantContract?.core_total ?? 0);
      const sharingRatio = latestVersion?.shared_core_ratio || relevantContract?.sharing_ratio || null;
      const currentOrFuture = relevantContract && relevantContract.end_date >= today;

      if (currentOrFuture && !isStoppedStatus(customerStatus)) {
        if (coreType === 'core') {
          totalCoreUsed += coreTotal;
          coreLocationCount += 1;
        } else if (coreType === 'sharing_core' && sharingRatio) {
          sharingCounts[sharingRatio] = (sharingCounts[sharingRatio] || 0) + 1;
        }
      }

      (customer.contracts || []).forEach(contract => {
        const version = getLatestVersion(contract);
        const ratio = version?.shared_core_ratio || contract.sharing_ratio;
        const type = version?.core_type || contract.core_type;
        if (type !== 'sharing_core' || !ratio) return;
        sharingTrend.forEach((monthData, index) => {
          const month = index + 1;
          const monthStart = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
          const monthEnd = new Date(Date.UTC(selectedYear, month, 0)).toISOString().slice(0, 10);
          if (!isContractInPeriod(contract, monthStart, monthEnd)) return;
          const chartKey = ratio.replace('/', ':');
          if (Object.prototype.hasOwnProperty.call(monthData, chartKey)) monthData[chartKey] += 1;
        });
      });

      const latestRoute = getLatestRouteVersion(customer);
      const effectiveRouteStatus = isStoppedStatus(customerStatus)
        ? 'nonaktif'
        : normalizeStatus(latestRoute?.flow_status || 'aktif');
      const routeKey = ['perbaikan', 'maintenance'].includes(effectiveRouteStatus) ? 'perbaikan' : effectiveRouteStatus;
      if (Object.prototype.hasOwnProperty.call(routeStatus, routeKey)) routeStatus[routeKey] += 1;
      else routeStatus.aktif += 1;
      routeStatus.total += 1;
    });

    const growthYears = Array.from({ length: 5 }, (_, index) => startYear + index);
    const tenantGrowth = growthYears.map(growthYear => ({
      year: String(growthYear),
      count: customers.filter(customer => {
        const sourceDate = customer.contract_start_date || customer.created_at;
        return sourceDate && Number(String(sourceDate).slice(0, 4)) <= growthYear;
      }).length,
    }));
    const ispGrowth = growthYears.map(growthYear => ({
      year: String(growthYear),
      count: isps.filter(isp => {
        const sourceDate = isp.created_at;
        return sourceDate && Number(String(sourceDate).slice(0, 4)) <= growthYear;
      }).length,
    }));

    return {
      year,
      capacityCore: {
        total: totalCoreCapacity,
        used: totalCoreUsed,
        available: Math.max(totalCoreCapacity - totalCoreUsed, 0),
        availablePercent: totalCoreCapacity > 0 ? Math.round(((totalCoreCapacity - totalCoreUsed) / totalCoreCapacity) * 100) : 0,
      },
      coreRentals: {
        totalCoreUsed,
        locationCount: coreLocationCount,
      },
      sharingCounts,
      sharingTrend,
      routeStatus,
      growth: {
        tenant: tenantGrowth,
        isp: ispGrowth,
      },
    };
  },
};

// ============================================================================
// DOCUMENTS API
// ============================================================================

export const documentsApi = {
  // Get documents by customer ID
  async getByCustomerId(customerId) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('tanggal_dokumen', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Create document
  async create(documentData) {
    const { data, error } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete document
  async delete(id) {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// INVOICES API
// ============================================================================

export const invoicesApi = {
  // Get invoices by customer ID
  async getByCustomerId(customerId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Create invoice
  async create(invoiceData) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update invoice
  async update(id, invoiceData) {
    const { data, error } = await supabase
      .from('invoices')
      .update(invoiceData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete invoice
  async delete(id) {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// CONTRACTS API
// ============================================================================

export const contractsApi = {
  // Get contracts by customer ID
  async getByCustomerId(customerId) {
    const { data, error } = await supabase
      .from('contracts')
      .select(`
        *,
        versions:contract_versions(*)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Create contract
  async create(contractData) {
    const { data, error } = await supabase
      .from('contracts')
      .insert(contractData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update contract
  async update(id, contractData) {
    const { data, error } = await supabase
      .from('contracts')
      .update(contractData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete contract
  async delete(id) {
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// CONTRACT VERSIONS API
// ============================================================================

export const contractVersionsApi = {
  // Get versions by contract ID
  async getByContractId(contractId) {
    const { data, error } = await supabase
      .from('contract_versions')
      .select('*')
      .eq('contract_id', contractId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Create contract version
  async create(versionData) {
    const { data, error } = await supabase
      .from('contract_versions')
      .insert(versionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update contract version
  async update(id, versionData) {
    const { data, error } = await supabase
      .from('contract_versions')
      .update(versionData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete contract version
  async delete(id) {
    const { error } = await supabase
      .from('contract_versions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// ============================================================================
// CUSTOMER ROUTES API
// ============================================================================

export const customerRoutesApi = {
  async replace(customerId, { flowStatus = 'aktif', changeNote = null, points = [] } = {}) {
    const { data: version, error: versionError } = await supabase
      .from('customer_route_versions')
      .insert({
        customer_id: customerId,
        flow_status: flowStatus,
        change_note: changeNote,
      })
      .select()
      .single();

    if (versionError) throw versionError;

    if (points.length > 0) {
      const { error: pointsError } = await supabase
        .from('customer_route_points')
        .insert(points.map((point, index) => ({
          route_version_id: version.id,
          path_name: point.pathName ?? point.path_name ?? null,
          point_type: point.pointType ?? point.point_type ?? null,
          note: point.note ?? null,
          order_number: point.orderNumber ?? point.order_number ?? index + 1,
        })));

      if (pointsError) throw pointsError;
    }

    return version;
  },

  async addHistory(customerId, historyData) {
    const { data, error } = await supabase
      .from('customer_route_history')
      .insert({
        customer_id: customerId,
        title: historyData.title ?? null,
        description: historyData.description ?? null,
        date: historyData.date ?? null,
        actor: historyData.actor ?? null,
        metadata: historyData.metadata ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// CUSTOMER ISP MEMBERSHIPS API
// ============================================================================

export const customerIspMembershipsApi = {
  async removeByCustomer(customerId, { mode = 'selected', ispId = null, ispIds = [] } = {}) {
    let query = supabase
      .from('customer_isp_memberships')
      .delete()
      .eq('customer_id', customerId);

    if (mode === 'this' && ispId) {
      query = query.eq('isp_id', ispId);
    } else if (mode === 'selected') {
      query = query.in('isp_id', ispIds);
    }

    const { error } = await query;
    if (error) throw error;
  },
};

// ============================================================================
// ISP CONTRACT ROWS API
// ============================================================================

export const ispContractRowsApi = {
  async update(id, rowData) {
    const { data, error } = await supabase
      .from('isp_contract_rows')
      .update(rowData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// INVOICE FOLLOW UPS API
// ============================================================================

export const invoiceFollowUpsApi = {
  async update(id, followUpData) {
    const { data, error } = await supabase
      .from('invoice_follow_ups')
      .update(followUpData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// CONTRACT VERSION RENEWAL FOLLOW UPS API
// ============================================================================

export const contractVersionRenewalFollowUpsApi = {
  async create(versionId) {
    const { data, error } = await supabase
      .from('contract_version_renewal_follow_ups')
      .insert({ version_id: versionId, source: 'manual' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, followUpData) {
    const { data, error } = await supabase
      .from('contract_version_renewal_follow_ups')
      .update(followUpData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// ISP RENEWAL FOLLOW UPS API
// ============================================================================

export const ispRenewalFollowUpsApi = {
  async create(rowId) {
    const { data, error } = await supabase
      .from('isp_renewal_follow_ups')
      .insert({ row_id: rowId, source: 'manual' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, followUpData) {
    const { data, error } = await supabase
      .from('isp_renewal_follow_ups')
      .update(followUpData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Export all APIs
export default {
  customers: customersApi,
  isps: ispsApi,
  monitoring: monitoringApi,
  documents: documentsApi,
  invoices: invoicesApi,
  contracts: contractsApi,
  contractVersions: contractVersionsApi,
  customerRoutes: customerRoutesApi,
  customerIspMemberships: customerIspMembershipsApi,
  invoiceFollowUps: invoiceFollowUpsApi,
  contractVersionRenewalFollowUps: contractVersionRenewalFollowUpsApi,
  ispContractRows: ispContractRowsApi,
  ispRenewalFollowUps: ispRenewalFollowUpsApi,
};
