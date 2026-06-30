const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Replicate utility functions from api.js & utils.js
const TYPE_LABELS = {
    contract_expiring: "Kontrak Lokasi",
    contract_admin: "Kontrak Lokasi",
    invoice_attention: "Invoice",
    invoice_setup: "Invoice",
    invoice_reminder: "Invoice",
    route_attention: "Jalur",
    route_setup: "Jalur",
    activation_fee: "Aktivasi",
    payment_overdue: "Invoice",
    invoice_not_uploaded: "Invoice",
    isp_contract: "Kontrak ISP",
    isp_document: "Dokumen ISP",
    isp_renewal: "Perpanjangan ISP",
};

const getTypeLabel = (n) => TYPE_LABELS[n.type] || TYPE_LABELS[n.code] || n.type || "Umum";

function addDaysToIsoDate(dateStr, days) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveCustomerOperationalStatus(customer, todayIso) {
  // simple mock
  return customer.status || 'aktif';
}

function resolveInvoiceDueMonthIsoDate(startDateStr) {
  if (!startDateStr) return null;
  const date = new Date(startDateStr + 'T00:00:00.000Z');
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function getIspContractRowCoverage(rows = []) {
  return {
    hasReference: rows.some((row) => String(row.contract_reference || '').trim()),
    hasStartDate: rows.some((row) => row.contract_start_date),
    hasPeriod: rows.some((row) => row.period_start && row.period_end),
    hasBakFile: rows.some((row) => row.bak_file_url && String(row.bak_file_url).trim()),
    hasContractFile: rows.some((row) => row.contract_file_url && String(row.contract_file_url).trim()),
  };
}

function createIspDerivedNotification({ code, type, severity = 'warning', title, message, ispId, ispName, rowId = null, followUpId = null, actionType = null, actionLabel = 'Buka', targetTab = null }) {
  return {
    id: `${code}-${ispId}${rowId ? `-${rowId}` : ''}`,
    source: 'isp_derived',
    type,
    code,
    severity,
    title,
    message,
    ispId,
    customerName: ispName, // matching customerName key in frontend
    actionLabel,
    targetPath: `/isps/${ispId}${targetTab ? `?tab=${targetTab}` : ''}`,
    rowId,
    followUpId,
    actionType,
  };
}

function createDerivedNotification({ code, type, severity = 'warning', title, message, customerId, customerName, actionLabel = 'Buka', targetTab = null, dueDate = null }) {
  return {
    id: `${code}-${customerId}`,
    source: 'customer_derived',
    type,
    code,
    severity,
    title,
    message,
    customerId,
    customerName,
    actionLabel,
    targetPath: `/customers/${customerId}${targetTab ? `?tab=${targetTab}` : ''}`,
    dueDate,
  };
}

const mapAlertToNotification = (alert, index) => {
  const alertCode = alert.code || alert.type || 'notification';
  const customerId = Number(alert.customerId);
  const targetTab = alertCode.includes('contract')
    ? 'contracts'
    : alertCode.includes('invoice') || alertCode.includes('payment')
    ? 'invoices'
    : alertCode.includes('route')
      ? 'jalur'
      : 'overview';
  const targetPath = Number.isFinite(customerId)
    ? `/customers/${customerId}${targetTab !== 'overview' ? `?tab=${targetTab}` : ''}`
    : null;

  return {
    id: `${alertCode}-${alert.customerId ?? 'general'}-${index}`,
    source: 'monitoring',
    type: alert.type || alertCode,
    code: alertCode,
    severity: alert.severity || 'warning',
    title: alert.title || 'Notifikasi',
    message: alert.message || alert.title || 'Ada data yang perlu ditindaklanjuti.',
    customerId: Number.isFinite(customerId) ? customerId : null,
    customerName: alert.customerName || null,
    actionLabel: targetTab === 'invoices'
      ? 'Buka Invoice'
      : targetTab === 'jalur'
        ? 'Buka Jalur'
        : 'Buka Detail',
    targetPath,
    dueDate: alert.dueDate || null,
  };
};

function resolveActiveContractPeriodForAlert(contract, todayIso) {
  const activeVersion = (contract.versions || [])
    .filter(v => !v.deleted_at)
    .sort((l, r) => Number(r.version_number ?? 0) - Number(l.version_number ?? 0))
    .find((version) => {
      const startDate = String(version?.start_date ?? '').slice(0, 10);
      const endDate = String(version?.end_date ?? '').slice(0, 10);
      return startDate && endDate && startDate <= todayIso && endDate >= todayIso;
    });
  const source = activeVersion ?? contract;
  const endDate = String(source?.end_date ?? '').slice(0, 10);
  const startDate = String(source?.start_date ?? '').slice(0, 10);

  return {
    startDate,
    endDate,
    contractNumber: source?.contract_number ?? contract?.contract_number ?? null,
    versionId: activeVersion?.id ?? null,
  };
}

async function getLatestRouteVersionByCustomerId() {
  const { data, error } = await supabase
    .from('customer_route_versions')
    .select(`
      id,
      customer_id,
      flow_status,
      version_number,
      customer:customers(id, name, status)
    `)
    .is('deleted_at', null);

  if (error) throw error;
  const map = new Map();
  (data || []).forEach(row => {
    const existing = map.get(row.customer_id);
    if (!existing || Number(row.version_number) > Number(existing.version_number)) {
      map.set(row.customer_id, row);
    }
  });
  return map;
}

async function run() {
  console.log("Fetching notifications from API simulator...");
  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedYear = new Date().getUTCFullYear();

  // 1. Alerts
  const warningDate = new Date();
  warningDate.setUTCDate(warningDate.getUTCDate() + 90);
  const warningDateIso = warningDate.toISOString().slice(0, 10);

  const [contractsResult, invoicesResult] = await Promise.all([
    supabase
      .from('contracts')
      .select(`
        id,
        contract_number,
        start_date,
        end_date,
        status,
        versions:contract_versions(
          id,
          contract_number,
          version_number,
          start_date,
          end_date,
          deleted_at
        ),
        customer:customers(id, name, status)
      `)
      .eq('status', 'aktif')
      .is('deleted_at', null),
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
      .in('status', ['belum_bayar', 'terlambat'])
      .is('deleted_at', null),
  ]);

  if (contractsResult.error) throw contractsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;

  const routeByCustomerId = await getLatestRouteVersionByCustomerId();

  const alerts = [];

  (contractsResult.data || []).forEach(contract => {
    const activePeriod = resolveActiveContractPeriodForAlert(contract, todayIso);
    if (!activePeriod.endDate || activePeriod.endDate < todayIso || activePeriod.endDate > warningDateIso) {
      return;
    }

    const contractLabel = activePeriod.contractNumber || contract.contract_number || 'Kontrak';
    alerts.push({
      code: 'contract_expiring',
      type: 'contract_expiring',
      customerId: contract.customer?.id,
      customerName: contract.customer?.name || 'Customer',
      title: 'Kontrak akan berakhir',
      message: `${contract.customer?.name || 'Customer'} ${contractLabel} berakhir pada ${activePeriod.endDate}`,
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

  routeByCustomerId.forEach((latestRoute) => {
    const routeStatus = String(latestRoute?.flow_status || 'aktif').trim().toLowerCase();
    const customerStatus = String(latestRoute?.customer?.status || '').trim().toLowerCase();
    if (customerStatus === 'aktif' && ['gangguan', 'perbaikan', 'maintenance'].includes(routeStatus)) {
      const customerId = Number(latestRoute.customer_id);
      const customerName = latestRoute.customer?.name || 'Customer';
      alerts.push({
        code: 'route_attention',
        type: 'route_attention',
        customerId,
        customerName,
        title: 'Jalur perlu perhatian',
        message: `${customerName} jalur ${routeStatus}`,
        severity: routeStatus === 'gangguan' ? 'critical' : 'warning',
      });
    }
  });

  const alertsMapped = alerts.map(mapAlertToNotification);

  // 2. Customer derived notifications
  const baseInvoiceColumns = 'id,customer_id,invoice_number,amount,due_date,period_start_date,period_end_date,status,schedule_status';
  const [customersResult, incompleteInvoicesResult, missingFileInvoicesResult] = await Promise.all([
    supabase
      .from('customers')
      .select(`
        id,
        name,
        status,
        activation_fee_amount,
        activation_fee_paid_at,
        contracts(
          id,
          contract_number,
          status,
          start_date,
          end_date,
          versions:contract_versions(id, start_date, end_date, deleted_at)
        ),
        documents(id, contract_id, jenis_dokumen, file_url, deleted_at)
      `)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select(baseInvoiceColumns)
      .in('status', ['belum_bayar', 'terlambat', 'belum_ditagih'])
      .eq('schedule_status', 'active')
      .is('deleted_at', null)
      .or('due_date.is.null,amount.lte.0'),
    supabase
      .from('invoices')
      .select(baseInvoiceColumns)
      .in('status', ['belum_bayar', 'terlambat', 'belum_ditagih'])
      .eq('schedule_status', 'active')
      .is('deleted_at', null)
      .or('due_date.not.is.null,period_end_date.not.is.null')
      .or('invoice_file_url.is.null,invoice_file_url.eq.')
      .or('payment_proof_file_url.is.null,payment_proof_file_url.eq.'),
  ]);

  if (customersResult.error) throw customersResult.error;
  if (incompleteInvoicesResult.error) throw incompleteInvoicesResult.error;
  if (missingFileInvoicesResult.error) throw missingFileInvoicesResult.error;

  const invoicesByCustomerId = new Map();
  const invoicesById = new Map();
  (incompleteInvoicesResult.data || []).forEach((invoice) => {
    invoicesById.set(invoice.id, { ...invoice, isIncomplete: true, isMissingFiles: false });
  });
  (missingFileInvoicesResult.data || []).forEach((invoice) => {
    invoicesById.set(invoice.id, {
      ...(invoicesById.get(invoice.id) || invoice),
      ...invoice,
      isMissingFiles: true,
    });
  });

  Array.from(invoicesById.values()).forEach((invoice) => {
    const list = invoicesByCustomerId.get(invoice.customer_id) || [];
    list.push(invoice);
    invoicesByCustomerId.set(invoice.customer_id, list);
  });

  const customerDerivedNotifications = (customersResult.data || []).flatMap((customer) => {
    const customerId = customer.id;
    const customerName = customer.name || `Pelanggan #${customerId}`;
    const customerStatus = resolveCustomerOperationalStatus(customer, todayIso);
    const notifications = [];

    if (customerStatus === 'aktif' && Number(customer.activation_fee_amount || 0) > 0 && !customer.activation_fee_paid_at) {
      notifications.push(createDerivedNotification({
        code: 'activation_fee_unpaid',
        type: 'activation_fee',
        severity: 'warning',
        title: 'Biaya aktivasi belum dibayar',
        message: `${customerName} masih memiliki biaya aktivasi outstanding.`,
        customerId,
        customerName,
        actionLabel: 'Buka Detail',
      }));
    }

    const contracts = Array.isArray(customer.contracts) ? customer.contracts : [];
    const activeContract = contracts.find((contract) => String(contract.status || '').toLowerCase() === 'aktif') ?? contracts[0];
    const contractNumber = String(activeContract?.contract_number || '').trim();
    if (customerStatus === 'aktif' && activeContract && (!contractNumber || contractNumber.startsWith('NO-BAK-'))) {
      notifications.push(createDerivedNotification({
        code: 'contract_number_missing',
        type: 'contract_admin',
        severity: 'warning',
        title: 'Nomor kontrak belum diisi',
        message: `${customerName} belum memiliki nomor kontrak final.`,
        customerId,
        customerName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }

    if (customerStatus === 'aktif' && activeContract) {
      const activeContractId = Number(activeContract.id);
      const documents = Array.isArray(customer.documents) ? customer.documents : [];
      const activeContractDocuments = documents.filter((document) => (
        Number(document.contract_id) === activeContractId
        && !document.deleted_at
        && String(document.file_url || '').trim()
      ));
      const hasContractFile = activeContractDocuments.some((document) => (
        String(document.jenis_dokumen || '').trim().toLowerCase() === 'kontrak'
      ));
      const hasBakFile = activeContractDocuments.some((document) => (
        String(document.jenis_dokumen || '').trim().toLowerCase() === 'bak'
      ));

      if (!hasContractFile) {
        notifications.push(createDerivedNotification({
          code: 'contract_file_missing',
          type: 'contract_admin',
          severity: 'warning',
          title: 'Berkas kontrak belum diunggah',
          message: `${customerName} belum memiliki berkas kontrak yang diunggah.`,
          customerId,
          customerName,
          actionLabel: 'Upload Kontrak',
          targetTab: 'contracts',
        }));
      }

      if (!hasBakFile) {
        notifications.push(createDerivedNotification({
          code: 'bak_missing',
          type: 'contract_admin',
          severity: 'warning',
          title: 'BAK belum tersedia',
          message: `${customerName} belum memiliki Berita Acara Koneksi/BAK.`,
          customerId,
          customerName,
          actionLabel: 'Buka Kontrak',
          targetTab: 'contracts',
        }));
      }
    }

    const latestRoute = routeByCustomerId.get(Number(customerId)) ?? null;
    if (customerStatus === 'aktif' && !latestRoute?.flow_status) {
      notifications.push(createDerivedNotification({
        code: 'missing_route',
        type: 'route_setup',
        severity: 'warning',
        title: 'Data jalur belum lengkap',
        message: `${customerName} belum memiliki data jalur aktif.`,
        customerId,
        customerName,
        actionLabel: 'Buka Jalur',
        targetTab: 'jalur',
      }));
    }

    const invoices = customerStatus === 'aktif' ? invoicesByCustomerId.get(customer.id) || [] : [];
    invoices.forEach((invoice) => {
        const dueDate = invoice.due_date || (invoice.period_start_date ? resolveInvoiceDueMonthIsoDate(invoice.period_start_date) : null) || invoice.period_end_date || null;
        const amount = Number(invoice.amount || 0);

        if (invoice.isIncomplete && (!dueDate || amount <= 0)) {
          notifications.push(createDerivedNotification({
            code: 'invoice_setup_incomplete',
            type: 'invoice_setup',
            severity: 'warning',
            title: 'Lengkapi set date dan jumlah dibayar',
            message: `${customerName} memiliki invoice yang belum lengkap tanggal jatuh tempo atau nominalnya.`,
            customerId,
            customerName,
            actionLabel: 'Buka Invoice',
            targetTab: 'invoices',
          }));
        }

        const reminderDate = addDaysToIsoDate(dueDate, -7);
        if (invoice.isMissingFiles && dueDate && reminderDate && reminderDate <= todayIso) {
          notifications.push(createDerivedNotification({
            code: 'invoice_h_minus_7',
            type: 'invoice_reminder',
            severity: 'warning',
            title: 'Reminder bulan jatuh tempo',
            message: `${customerName} sudah memasuki reminder bulan jatuh tempo. Upload invoice pembayaran diperlukan.`,
            customerId,
            customerName,
            actionLabel: 'Buka Invoice',
            targetTab: 'invoices',
            dueDate,
          }));
        }
      });

    return notifications;
  });

  // 3. ISP derived notifications
  const [ispsResult, missingBakResult, missingContractResult, contractRowsResult] = await Promise.all([
    supabase
      .from('isps')
      .select('id,name,status,contract_reference,contract_start_date,contract_period_start,contract_period_end')
      .is('deleted_at', null),
    supabase
      .from('isps')
      .select('id')
      .is('deleted_at', null)
      .or('bak_file_url.is.null,bak_file_url.eq.'),
    supabase
      .from('isps')
      .select('id')
      .is('deleted_at', null)
      .or('contract_file_url.is.null,contract_file_url.eq.'),
    supabase
      .from('isp_contract_rows')
      .select(`
        id,
        isp_id,
        contract_reference,
        contract_start_date,
        period_start,
        period_end,
        renewal_status,
        bak_file_url,
        contract_file_url,
        renewal_file_url,
        response_file_url,
        renewalFollowUps:isp_renewal_follow_ups(
          id,
          row_id,
          split_order,
          status,
          renewal_file_url,
          response_file_url,
          response_decision,
          created_at,
          updated_at
        )
      `)
      .is('deleted_at', null)
      .eq('renewal_status', 'active'),
  ]);

  if (ispsResult.error) throw ispsResult.error;
  if (missingBakResult.error) throw missingBakResult.error;
  if (missingContractResult.error) throw missingContractResult.error;
  if (contractRowsResult.error) throw contractRowsResult.error;

  const missingBakIds = new Set((missingBakResult.data || []).map((isp) => Number(isp.id)));
  const missingContractIds = new Set((missingContractResult.data || []).map((isp) => Number(isp.id)));

  const contractRowsByIspId = new Map();
  (contractRowsResult.data || []).forEach((row) => {
    const ispId = Number(row.isp_id);
    if (!contractRowsByIspId.has(ispId)) {
      contractRowsByIspId.set(ispId, []);
    }
    contractRowsByIspId.get(ispId).push(row);
  });

  const getActiveContractRowCoverage = (ispId) => getIspContractRowCoverage(contractRowsByIspId.get(Number(ispId)) || []);

  const ispDerivedNotifications = (ispsResult.data || []).flatMap((isp) => {
    const ispId = isp.id;
    const ispName = isp.name || `ISP #${ispId}`;
    const ispStatus = String(isp.status || '').trim().toLowerCase();
    if (['berhenti', 'nonaktif'].includes(ispStatus)) return [];
    const activeContractRowCoverage = getActiveContractRowCoverage(ispId);

    const notifications = [];
    if (!String(isp.contract_reference || '').trim() && !activeContractRowCoverage.hasReference) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_reference_missing',
        type: 'isp_contract',
        title: 'Nomor kontrak ISP belum diisi',
        message: `${ispName} belum memiliki nomor kontrak/referensi kontrak.`,
        ispId,
        ispName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }
    if (!isp.contract_start_date && !activeContractRowCoverage.hasStartDate) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_start_missing',
        type: 'isp_contract',
        title: 'Awal kontrak ISP belum diisi',
        message: `${ispName} belum memiliki tanggal awal kontrak.`,
        ispId,
        ispName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }
    if ((!isp.contract_period_start || !isp.contract_period_end) && !activeContractRowCoverage.hasPeriod) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_period_missing',
        type: 'isp_contract',
        title: 'Periode berjalan ISP belum lengkap',
        message: `${ispName} belum memiliki periode berjalan awal dan akhir yang lengkap.`,
        ispId,
        ispName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }
    if (missingBakIds.has(Number(ispId)) && !activeContractRowCoverage.hasBakFile) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_bak_missing',
        type: 'isp_document',
        title: 'BAK ISP belum diupload',
        message: `${ispName} belum memiliki file BAK.`,
        ispId,
        ispName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }
    if (missingContractIds.has(Number(ispId)) && !activeContractRowCoverage.hasContractFile) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_file_missing',
        type: 'isp_document',
        title: 'File kontrak ISP belum diupload',
        message: `${ispName} belum memiliki file kontrak.`,
        ispId,
        ispName,
        actionLabel: 'Buka Kontrak',
        targetTab: 'contracts',
      }));
    }

    const contractRows = contractRowsByIspId.get(Number(ispId)) || [];
    contractRows.forEach((row) => {
      const periodEnd = row.period_end;
      if (!periodEnd) return;

      const threeMonthsBefore = addDaysToIsoDate(periodEnd, -90);
      const twoMonthsBefore = addDaysToIsoDate(periodEnd, -60);
      const oneMonthBefore = addDaysToIsoDate(periodEnd, -30);
      const followUps = Array.isArray(row.renewalFollowUps) ? row.renewalFollowUps : [];
      const sortedFollowUps = [...followUps].sort((left, right) => {
        const splitDiff = Number(right?.split_order ?? 0) - Number(left?.split_order ?? 0);
        if (splitDiff !== 0) return splitDiff;
        return String(right?.updated_at ?? right?.created_at ?? '').localeCompare(String(left?.updated_at ?? left?.created_at ?? ''));
      });
      const pendingResponseFollowUp = sortedFollowUps.find((followUp) => (
        followUp?.status !== 'completed'
        && followUp?.renewal_file_url
        && String(followUp.renewal_file_url).trim()
        && !(followUp?.response_file_url && String(followUp.response_file_url).trim())
      )) ?? null;
      const latestFollowUp = pendingResponseFollowUp ?? sortedFollowUps[0] ?? null;
      const hasRenewalFile = !!(
        (row.renewal_file_url && String(row.renewal_file_url).trim())
        || sortedFollowUps.some((followUp) => followUp?.renewal_file_url && String(followUp.renewal_file_url).trim())
      );
      const hasResponseFile = !!(
        (row.response_file_url && String(row.response_file_url).trim())
        || sortedFollowUps.some((followUp) => followUp?.response_file_url && String(followUp.response_file_url).trim())
      );

      if (todayIso > periodEnd && !hasResponseFile) {
        notifications.push(createIspDerivedNotification({
          code: 'isp_renewal_overdue',
          type: 'isp_renewal',
          severity: 'critical',
          title: 'Kontrak ISP belum diperpanjang',
          message: `Kontrak ${row.contract_reference || 'ISP'} untuk ${ispName} telah berakhir pada ${periodEnd}. Status: Belum Diperpanjang.`,
          ispId,
          ispName,
          rowId: row.id,
          followUpId: latestFollowUp?.id ?? null,
          actionType: hasRenewalFile ? 'response' : 'renewal',
          actionLabel: 'Buka Kontrak',
          targetTab: 'contracts',
        }));
      } else if (todayIso >= oneMonthBefore && todayIso < periodEnd && hasRenewalFile && !hasResponseFile) {
        notifications.push(createIspDerivedNotification({
          code: 'isp_renewal_warning_1m',
          type: 'isp_renewal',
          severity: 'critical',
          title: 'Peringatan ke-3: Kontrak akan berakhir dalam 1 bulan',
          message: `Kontrak ${row.contract_reference || 'ISP'} untuk ${ispName} akan berakhir pada ${periodEnd}. Belum ada tanggapan dari ISP.`,
          ispId,
          ispName,
          rowId: row.id,
          followUpId: pendingResponseFollowUp?.id ?? latestFollowUp?.id ?? null,
          actionType: 'response',
          actionLabel: 'Buka Kontrak',
          targetTab: 'contracts',
        }));
      } else if (todayIso >= twoMonthsBefore && todayIso < periodEnd && hasRenewalFile && !hasResponseFile) {
        notifications.push(createIspDerivedNotification({
          code: 'isp_renewal_warning_2m',
          type: 'isp_renewal',
          title: 'Peringatan ke-2: Menunggu tanggapan perpanjangan',
          message: `Kontrak ${row.contract_reference || 'ISP'} untuk ${ispName} akan berakhir pada ${periodEnd}. Surat perpanjangan sudah dikirim, menunggu tanggapan ISP.`,
          ispId,
          ispName,
          rowId: row.id,
          followUpId: pendingResponseFollowUp?.id ?? latestFollowUp?.id ?? null,
          actionType: 'response',
          actionLabel: 'Buka Kontrak',
          targetTab: 'contracts',
        }));
      } else if (todayIso >= threeMonthsBefore && todayIso < periodEnd && !hasRenewalFile) {
        notifications.push(createIspDerivedNotification({
          code: 'isp_renewal_warning_3m',
          type: 'isp_renewal',
          title: 'Kontrak ISP akan berakhir dalam 3 bulan',
          message: `Kontrak ${row.contract_reference || 'ISP'} untuk ${ispName} akan berakhir pada ${periodEnd}. Segera buat surat perpanjangan.`,
          ispId,
          ispName,
          rowId: row.id,
          followUpId: latestFollowUp?.id ?? null,
          actionType: 'renewal',
          actionLabel: 'Buka Kontrak',
          targetTab: 'contracts',
        }));
      }
    });

    return notifications;
  });

  const allNotifications = [
    ...alertsMapped,
    ...customerDerivedNotifications,
    ...ispDerivedNotifications,
  ];

  console.log(`TOTAL GENERATED: ${allNotifications.length}`);
  
  // count active / isp / lokasi
  let active = 0;
  let active_isp = 0;
  let active_lokasi = 0;
  
  allNotifications.forEach(n => {
    // assume not resolved because we haven't checked notification_states
    active++;
    const isISP = n.type?.startsWith("isp_") || n.code?.startsWith("isp_") || getTypeLabel(n).includes("ISP");
    if (isISP) {
      active_isp++;
    } else {
      active_lokasi++;
    }
  });
  
  console.log(`ACTIVE (NO STATE CHECK): ${active}`);
  console.log(`- ISP: ${active_isp}`);
  console.log(`- LOKASI: ${active_lokasi}`);
  
  // check states
  const keys = allNotifications.map(n => n.id);
  if (keys.length > 0) {
    const { data: states } = await supabase
      .from('notification_states')
      .select('notification_key,read_at,resolved_at')
      .in('notification_key', keys);
      
    console.log(`Found states in DB: ${states ? states.length : 0}`);
    const resolvedKeys = new Set((states || []).filter(s => s.resolved_at).map(s => s.notification_key));
    
    let active_checked = 0;
    let active_isp_checked = 0;
    let active_lokasi_checked = 0;
    
    allNotifications.forEach(n => {
      if (!resolvedKeys.has(n.id)) {
        active_checked++;
        const isISP = n.type?.startsWith("isp_") || n.code?.startsWith("isp_") || getTypeLabel(n).includes("ISP");
        if (isISP) {
          active_isp_checked++;
        } else {
          active_lokasi_checked++;
        }
      }
    });
    
    console.log(`ACTIVE (WITH STATE CHECK): ${active_checked}`);
    console.log(`- ISP: ${active_isp_checked}`);
    console.log(`- LOKASI: ${active_lokasi_checked}`);
  }
}

run().catch(console.error);
