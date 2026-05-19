import { supabase } from './supabase';

/**
 * API Service untuk Supabase REST API
 * Menggantikan fetch calls ke backend NestJS dengan Supabase client
 */

const LIST_PAGE_SIZE = 500;
const QUERY_CHUNK_SIZE = 100;

const chunkArray = (items, size = QUERY_CHUNK_SIZE) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const fetchInChunks = async (items, fetchChunk, size = QUERY_CHUNK_SIZE) => {
  const chunkResults = await Promise.all(
    chunkArray(items, size)
      .filter((chunk) => chunk.length > 0)
      .map((chunk) => fetchChunk(chunk))
  );

  return chunkResults.flatMap((data) => Array.isArray(data) ? data : []);
};

const getErrorText = (error) => [
  error?.message,
  error?.details,
  error?.hint,
  error?.code,
  error?.status,
].filter(Boolean).join(' ').toLowerCase();

const getApiErrorFields = (text) => {
  const fields = new Set();

  if (text.includes('email') || text.includes('user already registered') || text.includes('already been registered')) {
    fields.add('userEmail');
  }
  if (text.includes('name') || text.includes('nama')) {
    fields.add('name');
  }
  if (text.includes('customer_code') || text.includes('customer code')) {
    fields.add('customerCode');
  }
  if (text.includes('contract_number') || text.includes('contract number')) {
    fields.add('contractNumber');
  }
  if (text.includes('invoice_number') || text.includes('invoice number')) {
    fields.add('invoiceNumber');
  }
  if (text.includes('nomor_dokumen') || text.includes('document number') || text.includes('dokumen')) {
    fields.add('documentNumber');
  }
  if (text.includes('contract_period_start') || text.includes('period_start') || text.includes('start_date')) {
    fields.add('contractPeriodStart');
  }
  if (text.includes('contract_period_end') || text.includes('period_end') || text.includes('end_date')) {
    fields.add('contractPeriodEnd');
  }
  if (text.includes('isp_id') || text.includes('isp') || text.includes('foreign key')) {
    fields.add('selectedIspId');
  }

  return Array.from(fields);
};

export const getApiErrorDetails = (error, fallbackMessage = 'Terjadi kesalahan. Silakan coba lagi.') => {
  const text = getErrorText(error);
  const status = Number(error?.status ?? 0);
  const code = String(error?.code ?? '');
  const fields = getApiErrorFields(text);

  if (text.includes('user already registered') || text.includes('already been registered') || text.includes('email address already')) {
    return {
      message: 'Email akun sudah terdaftar. Gunakan email lain atau hubungkan data ke akun yang sudah ada.',
      fields: fields.includes('userEmail') ? fields : ['userEmail'],
    };
  }

  if (code === '23505' || status === 409 || text.includes('duplicate key value') || text.includes('already exists')) {
    if (text.includes('isps') || text.includes('isp')) {
      return {
        message: 'Nama atau email ISP sudah terdaftar. Periksa kembali field yang ditandai.',
        fields: fields.length > 0 ? fields : ['name', 'userEmail'],
      };
    }
    if (text.includes('customers') || text.includes('customer') || text.includes('pelanggan')) {
      return {
        message: 'Data pelanggan/lokasi sudah terdaftar. Periksa kembali field yang ditandai.',
        fields: fields.length > 0 ? fields : ['name'],
      };
    }
    if (text.includes('invoice')) {
      return {
        message: 'Data invoice sudah terdaftar. Periksa kembali nomor atau periode invoice.',
        fields: fields.length > 0 ? fields : ['invoiceNumber'],
      };
    }
    if (text.includes('contract')) {
      return {
        message: 'Data kontrak sudah terdaftar. Periksa kembali nomor atau periode kontrak.',
        fields: fields.length > 0 ? fields : ['contractNumber'],
      };
    }
    if (text.includes('document') || text.includes('dokumen')) {
      return {
        message: 'Data dokumen sudah terdaftar. Periksa kembali nomor dokumen yang digunakan.',
        fields: fields.length > 0 ? fields : ['documentNumber'],
      };
    }
    return {
      message: 'Data sudah terdaftar. Periksa kembali field yang ditandai.',
      fields,
    };
  }

  if (code === '23503' || text.includes('foreign key')) {
    return {
      message: 'Data referensi tidak valid. Pastikan data terkait masih tersedia sebelum menyimpan.',
      fields: fields.length > 0 ? fields : ['selectedIspId'],
    };
  }

  if (code === '23502' || text.includes('not-null') || text.includes('null value')) {
    return {
      message: 'Ada data wajib yang belum diisi. Periksa kembali field yang ditandai.',
      fields,
    };
  }

  if (code === '42501' || text.includes('permission denied') || text.includes('row-level security')) {
    return {
      message: 'Anda tidak memiliki izin untuk melakukan aksi ini.',
      fields: [],
    };
  }

  if (code === '23514' || text.includes('invalid input') || text.includes('violates check constraint')) {
    return {
      message: 'Format data tidak valid. Periksa kembali field yang ditandai.',
      fields,
    };
  }

  return {
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
    fields,
  };
};

export const formatApiError = (error, fallbackMessage = 'Terjadi kesalahan. Silakan coba lagi.') => getApiErrorDetails(error, fallbackMessage).message;

const getCurrentActor = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return {
    user,
    actor: {
      actor_user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      actor_role: user?.user_metadata?.role ?? 'guest',
    },
  };
};

const getBrowserContext = () => {
  if (typeof window === 'undefined') return {};
  return {
    user_agent: window.navigator?.userAgent ?? null,
  };
};

const createActivityLog = async ({ metadata = {}, ...payload }) => {
  try {
    const { actor } = await getCurrentActor();
    if (!actor.actor_user_id) return null;

    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        ...actor,
        ...getBrowserContext(),
        ...payload,
        entity_id: payload.entity_id !== undefined && payload.entity_id !== null ? String(payload.entity_id) : null,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to write activity log:', error);
    return null;
  }
};

const pickChangedFields = (before = {}, after = {}, fields = []) => {
  const changedFields = [];
  const beforeValues = {};
  const afterValues = {};

  fields.forEach((field) => {
    const beforeValue = before?.[field] ?? null;
    const afterValue = after?.[field] ?? null;
    if (beforeValue !== afterValue) {
      changedFields.push(field);
      beforeValues[field] = beforeValue;
      afterValues[field] = afterValue;
    }
  });

  return {
    changed_fields: changedFields,
    before: beforeValues,
    after: afterValues,
  };
};

const ACTIVITY_ENTITY_CONFIG = {
  isps: { entityType: 'isp', nameFields: ['name'] },
  customers: { entityType: 'customer', nameFields: ['name'] },
  contracts: { entityType: 'contract', nameFields: ['contract_number'] },
  invoices: { entityType: 'invoice', nameFields: ['invoice_number'] },
  documents: { entityType: 'document', nameFields: ['nomor_dokumen', 'jenis_dokumen'] },
  customer_route_versions: { entityType: 'route', nameFields: ['change_note', 'flow_status', 'version_number'] },
};

const getEntityDisplayName = (row, fallback = 'Data') => {
  if (!row) return fallback;
  return row.name
    ?? row.contract_number
    ?? row.invoice_number
    ?? row.nomor_dokumen
    ?? row.jenis_dokumen
    ?? row.change_note
    ?? (row.version_number ? `Jalur v${row.version_number}` : null)
    ?? row.flow_status
    ?? fallback;
};

const getNotificationSeverityRank = (severity) => ({ critical: 0, warning: 1, info: 2 }[severity] ?? 3);

const mapAlertToNotification = (alert, index) => {
  const alertCode = alert.code || alert.type || 'notification';
  const customerId = Number(alert.customerId);
  const targetTab = alertCode.includes('invoice') || alertCode.includes('payment')
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
    createdAt: alert.createdAt || new Date().toISOString(),
    readAt: null,
    resolvedAt: null,
  };
};

const getNotificationTargetPath = (customerId, tab = 'overview') => (
  customerId ? `/customers/${customerId}${tab !== 'overview' ? `?tab=${tab}` : ''}` : null
);

const addDaysToIsoDate = (dateValue, dayOffset) => {
  if (!dateValue) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
};

const createDerivedNotification = ({ code, type, severity = 'warning', title, message, customerId, customerName, actionLabel = 'Buka Detail', targetTab = 'overview', dueDate = null }) => ({
  id: `${code}-${customerId ?? 'general'}${dueDate ? `-${dueDate}` : ''}`,
  source: 'derived',
  type,
  code,
  severity,
  title,
  message,
  customerId: customerId ?? null,
  customerName: customerName ?? null,
  actionLabel,
  targetPath: getNotificationTargetPath(customerId, targetTab),
  dueDate,
  createdAt: new Date().toISOString(),
  readAt: null,
  resolvedAt: null,
});

const createIspDerivedNotification = ({ code, type, severity = 'warning', title, message, ispId, ispName, actionLabel = 'Buka ISP' }) => ({
  id: `${code}-${ispId ?? 'general'}`,
  source: 'derived',
  type,
  code,
  severity,
  title,
  message,
  customerId: null,
  ispId: ispId ?? null,
  customerName: ispName ?? null,
  actionLabel,
  targetPath: ispId ? `/isps/${ispId}` : null,
  dueDate: null,
  createdAt: new Date().toISOString(),
  readAt: null,
  resolvedAt: null,
});

const getIspDerivedNotifications = async () => {
  const [ispsResult, missingBakResult, missingContractResult] = await Promise.all([
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
  ]);

  if (ispsResult.error) throw ispsResult.error;
  if (missingBakResult.error) throw missingBakResult.error;
  if (missingContractResult.error) throw missingContractResult.error;

  const missingBakIds = new Set((missingBakResult.data || []).map((isp) => Number(isp.id)));
  const missingContractIds = new Set((missingContractResult.data || []).map((isp) => Number(isp.id)));

  return (ispsResult.data || []).flatMap((isp) => {
    const ispId = isp.id;
    const ispName = isp.name || `ISP #${ispId}`;
    const ispStatus = String(isp.status || '').trim().toLowerCase();
    if (['berhenti', 'nonaktif'].includes(ispStatus)) return [];

    const notifications = [];
    if (!String(isp.contract_reference || '').trim()) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_reference_missing',
        type: 'isp_contract',
        title: 'Nomor kontrak ISP belum diisi',
        message: `${ispName} belum memiliki nomor kontrak/referensi kontrak.`,
        ispId,
        ispName,
      }));
    }
    if (!isp.contract_start_date) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_start_missing',
        type: 'isp_contract',
        title: 'Awal kontrak ISP belum diisi',
        message: `${ispName} belum memiliki tanggal awal kontrak.`,
        ispId,
        ispName,
      }));
    }
    if (!isp.contract_period_start || !isp.contract_period_end) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_period_missing',
        type: 'isp_contract',
        title: 'Periode berjalan ISP belum lengkap',
        message: `${ispName} belum memiliki periode berjalan awal dan akhir yang lengkap.`,
        ispId,
        ispName,
      }));
    }
    if (missingBakIds.has(Number(ispId))) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_bak_missing',
        type: 'isp_document',
        title: 'BAK ISP belum diupload',
        message: `${ispName} belum memiliki file BAK.`,
        ispId,
        ispName,
        actionLabel: 'Buka Dokumen',
      }));
    }
    if (missingContractIds.has(Number(ispId))) {
      notifications.push(createIspDerivedNotification({
        code: 'isp_contract_file_missing',
        type: 'isp_document',
        title: 'File kontrak ISP belum diupload',
        message: `${ispName} belum memiliki file kontrak.`,
        ispId,
        ispName,
        actionLabel: 'Buka Dokumen',
      }));
    }

    return notifications;
  });
};

const getDerivedNotifications = async () => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const baseInvoiceColumns = 'id,customer_id,invoice_number,amount,due_date,period_end_date,status,schedule_status';
  const [customersResult, incompleteInvoicesResult, missingFileInvoicesResult] = await Promise.all([
    supabase
      .from('customers')
      .select(`
        id,
        name,
        status,
        activation_fee_amount,
        activation_fee_paid_at,
        contracts(id, contract_number, status),
        routeVersions:customer_route_versions(version_number, flow_status, created_at)
      `)
      .is('deleted_at', null),
    supabase
      .from('invoices')
      .select(baseInvoiceColumns)
      .in('status', ['belum_bayar', 'terlambat', 'belum_ditagih'])
      .eq('schedule_status', 'active')
      .or('due_date.is.null,amount.lte.0'),
    supabase
      .from('invoices')
      .select(baseInvoiceColumns)
      .in('status', ['belum_bayar', 'terlambat', 'belum_ditagih'])
      .eq('schedule_status', 'active')
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

  return (customersResult.data || []).flatMap((customer) => {
    const customerId = customer.id;
    const customerName = customer.name || `Pelanggan #${customerId}`;
    const customerStatus = String(customer.status || '').trim().toLowerCase();
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

    const latestRoute = Array.isArray(customer.routeVersions)
      ? [...customer.routeVersions].sort((left, right) => {
        const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
        if (versionDiff !== 0) return versionDiff;
        return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
      })[0]
      : null;
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

    const invoices = invoicesByCustomerId.get(customer.id) || [];
    invoices.forEach((invoice) => {
        const dueDate = invoice.due_date || invoice.period_end_date || null;
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
            title: 'Peringatan H-7 pembayaran',
            message: `${customerName} mendekati jatuh tempo. Upload invoice pembayaran diperlukan.`,
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
};

const upsertNotificationState = async (notificationKey, values) => {
  const { user } = await getCurrentActor();
  if (!user?.id || !notificationKey) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('notification_states')
    .upsert({
      notification_key: notificationKey,
      actor_user_id: user.id,
      ...values,
      updated_at: now,
    }, { onConflict: 'notification_key,actor_user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const notificationsApi = {
  async list({ year = new Date().getUTCFullYear(), limit = 30, includeResolved = false } = {}) {
    const { user } = await getCurrentActor();
    const [result, customerDerivedNotifications, ispDerivedNotifications] = await Promise.all([
      monitoringApi.getAlerts({ year }),
      getDerivedNotifications(),
      getIspDerivedNotifications(),
    ]);
    const alerts = Array.isArray(result) ? result : (result?.alerts ?? []);
    const notifications = [
      ...alerts.map(mapAlertToNotification),
      ...customerDerivedNotifications,
      ...ispDerivedNotifications,
    ];
    const notificationKeys = notifications.map((item) => item.id);
    let stateByKey = new Map();

    if (user?.id && notificationKeys.length > 0) {
      const { data: states, error: statesError } = await supabase
        .from('notification_states')
        .select('notification_key,read_at,resolved_at')
        .eq('actor_user_id', user.id)
        .in('notification_key', notificationKeys);

      if (statesError) throw statesError;
      stateByKey = new Map((states || []).map((state) => [state.notification_key, state]));
    }

    return notifications
      .map((notification) => {
        const state = stateByKey.get(notification.id);
        return {
          ...notification,
          readAt: state?.read_at ?? null,
          resolvedAt: state?.resolved_at ?? null,
        };
      })
      .filter((notification) => includeResolved || !notification.resolvedAt)
      .sort((left, right) => {
        const unreadDiff = Number(Boolean(left.readAt)) - Number(Boolean(right.readAt));
        if (unreadDiff !== 0) return unreadDiff;
        const severityDiff = getNotificationSeverityRank(left.severity) - getNotificationSeverityRank(right.severity);
        if (severityDiff !== 0) return severityDiff;
        return String(left.customerName || '').localeCompare(String(right.customerName || ''));
      })
      .slice(0, limit);
  },

  async markRead(notificationKey) {
    return upsertNotificationState(notificationKey, { read_at: new Date().toISOString() });
  },

  async markResolved(notificationKey) {
    const now = new Date().toISOString();
    return upsertNotificationState(notificationKey, { read_at: now, resolved_at: now });
  },
};

const activityLogsApi = {
  async list({ search = '', entityType = '', action = '', dateFrom = '', dateTo = '', limit = 100 } = {}) {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq('entity_type', entityType);
    if (action) query = query.eq('action', action);
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
    if (search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`actor_email.ilike.${term},action.ilike.${term},entity_name.ilike.${term},description.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    return createActivityLog(payload);
  },
};

// ============================================================================
// CUSTOMERS API
// ============================================================================

const mapInvoiceFollowUp = (followUp) => ({
  ...followUp,
  invoiceId: followUp.invoiceId ?? followUp.invoice_id ?? null,
  splitOrder: followUp.splitOrder ?? followUp.split_order ?? 1,
  invoiceNumber: followUp.invoiceNumber ?? followUp.invoice_number ?? null,
  invoiceFileUrl: followUp.invoiceFileUrl ?? followUp.invoice_file_url ?? null,
});

const mapContractVersionRenewalFollowUp = (followUp) => ({
  ...followUp,
  versionId: followUp.versionId ?? followUp.version_id ?? null,
  splitOrder: followUp.splitOrder ?? followUp.split_order ?? 1,
  renewalFileUrl: followUp.renewalFileUrl ?? followUp.renewal_file_url ?? null,
  renewalFileName: followUp.renewalFileName ?? followUp.renewal_file_name ?? null,
  responseFileUrl: followUp.responseFileUrl ?? followUp.response_file_url ?? null,
  responseFileName: followUp.responseFileName ?? followUp.response_file_name ?? null,
  responseStatus: followUp.responseStatus ?? followUp.response_decision ?? null,
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
  paymentProofFileUrl: invoice.paymentProofFileUrl ?? invoice.payment_proof_file_url ?? null,
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
  sequenceNumber: point.sequenceNumber ?? point.order_number ?? 0,
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

const normalizeBillingSchedule = (mode, customEvery, customUnit) => {
  if (mode === '3bulanan') return { billing_every: 3, billing_unit: 'bulan' };
  if (mode === 'custom') {
    return {
      billing_every: Math.max(1, Number(customEvery || 1)),
      billing_unit: customUnit || 'bulan',
    };
  }
  return { billing_every: 1, billing_unit: 'bulan' };
};

const getCustomerCode = () => {
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return `CUST-${timestamp}`;
};

const assignIfPresent = (payload, source, keys, targetKey, transform = (value) => value) => {
  const key = keys.find((item) => Object.prototype.hasOwnProperty.call(source, item));
  if (!key) return;
  payload[targetKey] = transform(source[key]);
};

const withUpdatedAt = (payload) => ({
  ...payload,
  updated_at: new Date().toISOString(),
});

const mapDocumentPayload = (documentData = {}) => {
  const payload = {};
  assignIfPresent(payload, documentData, ['customer_id', 'customerId'], 'customer_id');
  assignIfPresent(payload, documentData, ['contract_id', 'contractId'], 'contract_id');
  assignIfPresent(payload, documentData, ['contract_version_id', 'contractVersionId'], 'contract_version_id');
  assignIfPresent(payload, documentData, ['contract_number', 'contractNumber'], 'contract_number');
  assignIfPresent(payload, documentData, ['jenis_dokumen', 'jenisDokumen'], 'jenis_dokumen');
  assignIfPresent(payload, documentData, ['nomor_dokumen', 'nomorDokumen'], 'nomor_dokumen');
  assignIfPresent(payload, documentData, ['tanggal_dokumen', 'tanggalDokumen'], 'tanggal_dokumen');
  assignIfPresent(payload, documentData, ['file_url', 'fileUrl'], 'file_url');
  return payload;
};

const mapInvoicePayload = (invoiceData = {}) => {
  const payload = {};
  assignIfPresent(payload, invoiceData, ['customer_id', 'customerId'], 'customer_id');
  assignIfPresent(payload, invoiceData, ['invoice_number', 'invoiceNumber'], 'invoice_number');
  assignIfPresent(payload, invoiceData, ['contract_id', 'contractId'], 'contract_id');
  assignIfPresent(payload, invoiceData, ['contract_version_id', 'contractVersionId'], 'contract_version_id');
  assignIfPresent(payload, invoiceData, ['contract_number', 'contractNumber'], 'contract_number');
  assignIfPresent(payload, invoiceData, ['period_month', 'periodMonth'], 'period_month');
  assignIfPresent(payload, invoiceData, ['period_year', 'periodYear'], 'period_year');
  assignIfPresent(payload, invoiceData, ['period_start_date', 'periodStartDate'], 'period_start_date');
  assignIfPresent(payload, invoiceData, ['period_end_date', 'periodEndDate'], 'period_end_date');
  assignIfPresent(payload, invoiceData, ['due_date', 'dueDate'], 'due_date');
  assignIfPresent(payload, invoiceData, ['amount'], 'amount', (value) => Number(value || 0));
  assignIfPresent(payload, invoiceData, ['status'], 'status');
  assignIfPresent(payload, invoiceData, ['schedule_version', 'scheduleVersion'], 'schedule_version');
  assignIfPresent(payload, invoiceData, ['schedule_status', 'scheduleStatus'], 'schedule_status');
  assignIfPresent(payload, invoiceData, ['document_id', 'documentId'], 'document_id');
  assignIfPresent(payload, invoiceData, ['paid_at', 'paidAt'], 'paid_at');
  assignIfPresent(payload, invoiceData, ['invoice_file_url', 'invoiceFileUrl'], 'invoice_file_url');
  assignIfPresent(payload, invoiceData, ['payment_proof_file_url', 'paymentProofFileUrl'], 'payment_proof_file_url');
  return payload;
};

const mapContractPayload = (contractData = {}) => {
  const payload = {};
  assignIfPresent(payload, contractData, ['customer_id', 'customerId'], 'customer_id');
  assignIfPresent(payload, contractData, ['contract_number', 'contractNumber'], 'contract_number');
  assignIfPresent(payload, contractData, ['start_date', 'startDate'], 'start_date');
  assignIfPresent(payload, contractData, ['end_date', 'endDate'], 'end_date');
  assignIfPresent(payload, contractData, ['core_type', 'coreType'], 'core_type');
  assignIfPresent(payload, contractData, ['core_total', 'coreTotal'], 'core_total', (value) => Number(value || 0));
  assignIfPresent(payload, contractData, ['sharing_ratio', 'sharingRatio'], 'sharing_ratio');
  assignIfPresent(payload, contractData, ['status'], 'status');
  assignIfPresent(payload, contractData, ['billing_every', 'billingEvery'], 'billing_every', (value) => Number(value || 1));
  assignIfPresent(payload, contractData, ['billing_unit', 'billingUnit'], 'billing_unit');
  return payload;
};

const mapContractVersionPayload = (versionData = {}) => {
  const payload = {};
  assignIfPresent(payload, versionData, ['contract_id', 'contractId'], 'contract_id');
  assignIfPresent(payload, versionData, ['customer_id', 'customerId'], 'customer_id');
  assignIfPresent(payload, versionData, ['version_number', 'versionNumber'], 'version_number');
  assignIfPresent(payload, versionData, ['start_date', 'startDate'], 'start_date');
  assignIfPresent(payload, versionData, ['end_date', 'endDate'], 'end_date');
  assignIfPresent(payload, versionData, ['core_type', 'coreType'], 'core_type');
  assignIfPresent(payload, versionData, ['core_total', 'coreTotal'], 'core_total', (value) => Number(value || 0));
  assignIfPresent(payload, versionData, ['shared_core_ratio', 'sharedCoreRatio'], 'shared_core_ratio');
  assignIfPresent(payload, versionData, ['bak_document_id', 'bakDocumentId'], 'bak_document_id');
  assignIfPresent(payload, versionData, ['renewal_file_url', 'renewalFileUrl'], 'renewal_file_url');
  assignIfPresent(payload, versionData, ['renewal_file_name', 'renewalFileName'], 'renewal_file_name');
  assignIfPresent(payload, versionData, ['response_file_url', 'responseFileUrl'], 'response_file_url');
  assignIfPresent(payload, versionData, ['response_file_name', 'responseFileName'], 'response_file_name');
  assignIfPresent(payload, versionData, ['monthly_amount', 'monthlyAmount'], 'monthly_amount', (value) => Number(value || 0));
  assignIfPresent(payload, versionData, ['yearly_amount', 'yearlyAmount'], 'yearly_amount', (value) => Number(value || 0));
  assignIfPresent(payload, versionData, ['remarks'], 'remarks');
  return payload;
};

const mapIspContractRowPayload = (rowData = {}) => {
  const payload = {};
  assignIfPresent(payload, rowData, ['isp_id', 'ispId'], 'isp_id');
  assignIfPresent(payload, rowData, ['contract_reference', 'contractReference'], 'contract_reference');
  assignIfPresent(payload, rowData, ['period_start', 'periodStart', 'start_date', 'startDate'], 'period_start');
  assignIfPresent(payload, rowData, ['period_end', 'periodEnd', 'end_date', 'endDate'], 'period_end');
  assignIfPresent(payload, rowData, ['renewal_status', 'renewalStatus'], 'renewal_status');
  assignIfPresent(payload, rowData, ['bak_file_url', 'bakFileUrl'], 'bak_file_url');
  assignIfPresent(payload, rowData, ['bak_file_name', 'bakFileName'], 'bak_file_name');
  assignIfPresent(payload, rowData, ['renewal_file_url', 'renewalFileUrl'], 'renewal_file_url');
  assignIfPresent(payload, rowData, ['renewal_file_name', 'renewalFileName'], 'renewal_file_name');
  assignIfPresent(payload, rowData, ['response_file_url', 'responseFileUrl'], 'response_file_url');
  assignIfPresent(payload, rowData, ['response_file_name', 'responseFileName'], 'response_file_name');
  assignIfPresent(payload, rowData, ['contract_file_url', 'contractFileUrl'], 'contract_file_url');
  assignIfPresent(payload, rowData, ['contract_file_name', 'contractFileName'], 'contract_file_name');
  return payload;
};

const mapInvoiceFollowUpPayload = (followUpData = {}) => {
  const payload = {};
  assignIfPresent(payload, followUpData, ['invoice_id', 'invoiceId'], 'invoice_id');
  assignIfPresent(payload, followUpData, ['split_order', 'splitOrder'], 'split_order');
  assignIfPresent(payload, followUpData, ['source'], 'source');
  assignIfPresent(payload, followUpData, ['trigger_code', 'triggerCode'], 'trigger_code');
  assignIfPresent(payload, followUpData, ['title'], 'title');
  assignIfPresent(payload, followUpData, ['description'], 'description');
  assignIfPresent(payload, followUpData, ['status'], 'status');
  assignIfPresent(payload, followUpData, ['invoice_number', 'invoiceNumber'], 'invoice_number');
  assignIfPresent(payload, followUpData, ['invoice_file_url', 'invoiceFileUrl'], 'invoice_file_url');
  return payload;
};

const mapRenewalFollowUpPayload = (followUpData = {}) => {
  const payload = {};
  assignIfPresent(payload, followUpData, ['version_id', 'versionId'], 'version_id');
  assignIfPresent(payload, followUpData, ['row_id', 'rowId'], 'row_id');
  assignIfPresent(payload, followUpData, ['split_order', 'splitOrder'], 'split_order');
  assignIfPresent(payload, followUpData, ['source'], 'source');
  assignIfPresent(payload, followUpData, ['trigger_code', 'triggerCode'], 'trigger_code');
  assignIfPresent(payload, followUpData, ['title'], 'title');
  assignIfPresent(payload, followUpData, ['description'], 'description');
  assignIfPresent(payload, followUpData, ['status'], 'status');
  assignIfPresent(payload, followUpData, ['renewal_file_url', 'renewalFileUrl'], 'renewal_file_url');
  assignIfPresent(payload, followUpData, ['renewal_file_name', 'renewalFileName'], 'renewal_file_name');
  assignIfPresent(payload, followUpData, ['response_file_url', 'responseFileUrl'], 'response_file_url');
  assignIfPresent(payload, followUpData, ['response_file_name', 'responseFileName'], 'response_file_name');
  assignIfPresent(payload, followUpData, ['response_decision', 'responseDecision', 'response_status', 'responseStatus'], 'response_decision');
  return payload;
};

const mapRouteHistoryPayload = (customerId, historyData = {}) => ({
  customer_id: customerId,
  operation: historyData.operation ?? historyData.title ?? null,
  note: historyData.note ?? historyData.description ?? null,
  snapshot_before: historyData.snapshot_before ?? historyData.snapshotBefore ?? null,
  snapshot_after: historyData.snapshot_after ?? historyData.snapshotAfter ?? historyData.metadata ?? null,
});

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

const CUSTOMER_DETAIL_SELECT = `
  id,
  customer_code,
  isp_name,
  name,
  status,
  activation_fee_amount,
  activation_fee_paid_at,
  contract_start_date,
  notes,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  ispMemberships:customer_isp_memberships(
    id,
    customer_id,
    isp_id,
    created_at,
    updated_at,
    isp:isps(
      id,
      name,
      status,
      logo_url,
      contract_reference,
      contract_start_date,
      contract_period_start,
      contract_period_end,
      paket,
      jumlah,
      billing_period_mode,
      billing_custom_every,
      billing_custom_unit,
      activation_fee_amount,
      activation_fee_paid_at,
      created_at,
      updated_at
    )
  ),
  contracts(
    id,
    customer_id,
    contract_number,
    start_date,
    end_date,
    core_type,
    core_total,
    sharing_ratio,
    status,
    billing_every,
    billing_unit,
    created_at,
    updated_at,
    deleted_at,
    deleted_by,
    versions:contract_versions(
      id,
      contract_id,
      customer_id,
      version_number,
      start_date,
      end_date,
      core_type,
      core_total,
      shared_core_ratio,
      bak_document_id,
      renewal_file_url,
      renewal_file_name,
      response_file_url,
      response_file_name,
      monthly_amount,
      yearly_amount,
      remarks,
      created_at,
      updated_at,
      deleted_at,
      deleted_by,
      renewalFollowUps:contract_version_renewal_follow_ups(
        id,
        version_id,
        split_order,
        source,
        trigger_code,
        title,
        description,
        status,
        renewal_file_url,
        renewal_file_name,
        response_file_url,
        response_file_name,
        response_decision,
        created_at,
        updated_at
      )
    )
  ),
  invoices(
    id,
    customer_id,
    invoice_number,
    contract_id,
    contract_version_id,
    contract_number,
    period_month,
    period_year,
    period_start_date,
    period_end_date,
    due_date,
    amount,
    status,
    schedule_version,
    schedule_status,
    document_id,
    paid_at,
    invoice_file_url,
    payment_proof_file_url,
    created_at,
    updated_at,
    deleted_at,
    deleted_by,
    invoiceFollowUps:invoice_follow_ups(
      id,
      invoice_id,
      split_order,
      source,
      trigger_code,
      title,
      description,
      status,
      invoice_number,
      invoice_file_url,
      created_at,
      updated_at
    )
  ),
  documents(
    id,
    customer_id,
    contract_id,
    contract_version_id,
    contract_number,
    jenis_dokumen,
    nomor_dokumen,
    tanggal_dokumen,
    file_url,
    created_at,
    deleted_at,
    deleted_by
  ),
  routeVersions:customer_route_versions(
    id,
    customer_id,
    version_number,
    flow_status,
    change_mode,
    change_note,
    based_on_version_id,
    created_at,
    updated_at,
    deleted_at,
    deleted_by,
    points:customer_route_points(
      id,
      route_version_id,
      order_number,
      path_name,
      point_type,
      note,
      created_at,
      updated_at,
      deleted_at,
      deleted_by
    )
  ),
  routeHistory:customer_route_history(
    id,
    customer_id,
    operation,
    note,
    snapshot_before,
    snapshot_after,
    created_at
  )
`;

export const customersApi = {
  // Get all customers
  async getAll({ limit = LIST_PAGE_SIZE, offset = 0 } = {}) {
    const from = Math.max(0, Number(offset) || 0);
    const to = from + Math.max(1, Number(limit) || LIST_PAGE_SIZE) - 1;

    const { data: customers, error, count } = await supabase
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
        created_at,
        updated_at,
        ispMemberships:customer_isp_memberships(
          isp:isps(id,name,status,logo_url)
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!Array.isArray(customers) || customers.length === 0) {
      return {
        data: [],
        count: count ?? 0,
        limit: Math.max(1, Number(limit) || LIST_PAGE_SIZE),
        offset: from,
        hasMore: false,
      };
    }

    const customerIds = customers.map((customer) => customer.id).filter(Boolean);

    const [contracts, routeVersions] = await Promise.all([
      fetchInChunks(customerIds, async (ids) => {
        const { data, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id,
            customer_id,
            contract_number,
            start_date,
            end_date,
            core_type,
            core_total,
            sharing_ratio,
            status,
            billing_every,
            billing_unit,
            created_at,
            updated_at,
            versions:contract_versions(
              id,
              contract_id,
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
          `)
          .in('customer_id', ids);

        if (contractsError) throw contractsError;
        return data || [];
      }),
      fetchInChunks(customerIds, async (ids) => {
        const { data, error: routesError } = await supabase
          .from('customer_route_versions')
          .select('id, customer_id, version_number, flow_status, created_at')
          .in('customer_id', ids);

        if (routesError) throw routesError;
        return data || [];
      }),
    ]);

    const contractsByCustomerId = new Map();
    contracts.forEach((contract) => {
      const list = contractsByCustomerId.get(contract.customer_id) || [];
      list.push(contract);
      contractsByCustomerId.set(contract.customer_id, list);
    });

    const routeVersionsByCustomerId = new Map();
    routeVersions.forEach((routeVersion) => {
      const list = routeVersionsByCustomerId.get(routeVersion.customer_id) || [];
      list.push(routeVersion);
      routeVersionsByCustomerId.set(routeVersion.customer_id, list);
    });

    const rows = customers.map((customer) => {
      const customerRouteVersions = routeVersionsByCustomerId.get(customer.id) || [];
      const latestRouteVersion = [...customerRouteVersions].sort((left, right) => {
        const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
        if (versionDiff !== 0) return versionDiff;
        return getDateValue(right.created_at) - getDateValue(left.created_at);
      })[0];

      return {
        ...customer,
        contracts: contractsByCustomerId.get(customer.id) || [],
        routeVersions: customerRouteVersions,
        routeStatus: latestRouteVersion?.flow_status ?? 'aktif',
        invoices: [],
      };
    });

    return {
      data: rows,
      count: count ?? rows.length,
      limit: Math.max(1, Number(limit) || LIST_PAGE_SIZE),
      offset: from,
      hasMore: from + rows.length < (count ?? rows.length),
    };
  },

  // Get customer by ID
  async getById(id) {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapCustomerDetail(data);
  },

  // Create customer
  async create(customerData) {
    const now = new Date().toISOString();
    const ispIds = Array.isArray(customerData.ispIds)
      ? customerData.ispIds.map((id) => Number(id)).filter(Number.isFinite)
      : [];
    const primaryIspId = ispIds[0] ?? null;

    let ispName = customerData.ispName ?? customerData.isp_name ?? null;
    if (!ispName && primaryIspId) {
      const { data: ispData, error: ispError } = await supabase
        .from('isps')
        .select('name')
        .eq('id', primaryIspId)
        .single();

      if (ispError) throw ispError;
      ispName = ispData?.name ?? null;
    }

    const customerCode = customerData.customer_code ?? customerData.customerCode ?? getCustomerCode();
    const customerPayload = {
      customer_code: customerCode,
      isp_name: ispName || 'Provider Mandiri',
      name: customerData.name,
      status: customerData.status || 'aktif',
      activation_fee_amount: Number(customerData.activationFeeAmount ?? customerData.activation_fee_amount ?? 0),
      contract_start_date: customerData.contractStartDate ?? customerData.contract_start_date ?? customerData.contractPeriodStart ?? null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(customerPayload)
      .select()
      .single();

    if (error) throw error;

    try {
      if (ispIds.length > 0) {
        const membershipPayload = ispIds.map((ispId) => ({
          customer_id: data.id,
          isp_id: ispId,
          updated_at: now,
        }));
        const { error: membershipError } = await supabase
          .from('customer_isp_memberships')
          .insert(membershipPayload);

        if (membershipError) throw membershipError;
      }

      if (customerData.contractPeriodStart && customerData.contractPeriodEnd) {
        const isCore = customerData.paket === 'core';
        const billingSchedule = normalizeBillingSchedule(
          customerData.billingPeriodMode,
          customerData.billingCustomEvery,
          customerData.billingCustomUnit,
        );
        const contractNumber = customerData.contractNumber
          ?? customerData.contract_number
          ?? `NO-BAK-${customerCode}-${String(customerData.contractPeriodStart).replaceAll('-', '')}`;

        const { error: contractError } = await supabase
          .from('contracts')
          .insert({
            customer_id: data.id,
            contract_number: contractNumber,
            start_date: customerData.contractPeriodStart,
            end_date: customerData.contractPeriodEnd,
            core_type: isCore ? 'core' : 'sharing_core',
            core_total: isCore ? Math.max(0, Number(customerData.jumlah || 0)) : 0,
            sharing_ratio: isCore ? null : customerData.contractSharingRatio ?? null,
            status: 'aktif',
            ...billingSchedule,
            updated_at: now,
          });

        if (contractError) throw contractError;
      }
    } catch (relatedError) {
      await supabase.from('customers').delete().eq('id', data.id);
      throw relatedError;
    }

    await createActivityLog({
      action: 'customer.created',
      entity_type: 'customer',
      entity_id: data.id,
      entity_name: data.name,
      description: `Menambahkan pelanggan baru ${data.name}`,
      metadata: {
        customer_code: data.customer_code,
        isp_name: data.isp_name,
        status: data.status,
      },
    });

    return data;
  },

  // Update customer
  async update(id, customerData) {
    const { data: previousCustomer, error: previousError } = await supabase
      .from('customers')
      .select('id,name,status,isp_name,customer_code')
      .eq('id', id)
      .single();

    if (previousError) throw previousError;

    const { data, error } = await supabase
      .from('customers')
      .update({
        name: customerData.name,
        status: customerData.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const statusChanged = previousCustomer?.status !== data?.status;
    await createActivityLog({
      action: statusChanged ? 'customer.status_changed' : 'customer.updated',
      entity_type: 'customer',
      entity_id: data.id,
      entity_name: data.name,
      description: statusChanged
        ? `Mengubah status pelanggan ${data.name}`
        : `Mengubah data pelanggan ${data.name}`,
      metadata: pickChangedFields(previousCustomer, data, ['name', 'status', 'isp_name', 'customer_code']),
    });

    return data;
  },

  // Delete customer (soft delete)
  async delete(id) {
    const { user } = await getCurrentActor();
    const deletedAt = new Date().toISOString();
    const { data: previousCustomer, error: previousError } = await supabase
      .from('customers')
      .select('id,name,status,isp_name,customer_code')
      .eq('id', id)
      .single();

    if (previousError) throw previousError;

    const { error } = await supabase
      .from('customers')
      .update({
        deleted_at: deletedAt,
        deleted_by: user?.id
      })
      .eq('id', id);

    if (error) throw error;

    await createActivityLog({
      action: 'customer.deleted',
      entity_type: 'customer',
      entity_id: id,
      entity_name: previousCustomer?.name,
      description: `Menghapus pelanggan ${previousCustomer?.name || id}`,
      metadata: {
        before: previousCustomer,
        deleted_at: deletedAt,
        deleted_by: user?.id ?? null,
      },
    });
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
  responseStatus: followUp.responseStatus ?? followUp.response_decision ?? null,
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
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractReference')) payload.contract_reference = ispData.contractReference || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_reference')) payload.contract_reference = ispData.contract_reference || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractStartDate')) payload.contract_start_date = ispData.contractStartDate || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_start_date')) payload.contract_start_date = ispData.contract_start_date || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractPeriodStart')) payload.contract_period_start = ispData.contractPeriodStart || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_period_start')) payload.contract_period_start = ispData.contract_period_start || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractPeriodEnd')) payload.contract_period_end = ispData.contractPeriodEnd || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_period_end')) payload.contract_period_end = ispData.contract_period_end || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'bakFileDataUrl')) payload.bak_file_url = ispData.bakFileDataUrl || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'bakFileUrl')) payload.bak_file_url = ispData.bakFileUrl || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'bak_file_url')) payload.bak_file_url = ispData.bak_file_url || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'bakFileName')) payload.bak_file_name = ispData.bakFileName || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'bak_file_name')) payload.bak_file_name = ispData.bak_file_name || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractFileDataUrl')) payload.contract_file_url = ispData.contractFileDataUrl || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractFileUrl')) payload.contract_file_url = ispData.contractFileUrl || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_file_url')) payload.contract_file_url = ispData.contract_file_url || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contractFileName')) payload.contract_file_name = ispData.contractFileName || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'contract_file_name')) payload.contract_file_name = ispData.contract_file_name || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'packageName')) {
    payload.paket = String(ispData.packageName).toLowerCase() === 'core' ? 'core' : 'shared';
  }
  if (Object.prototype.hasOwnProperty.call(ispData, 'paket')) payload.paket = ispData.paket;
  if (Object.prototype.hasOwnProperty.call(ispData, 'packageQuantity')) payload.jumlah = Number(ispData.packageQuantity || 0);
  if (Object.prototype.hasOwnProperty.call(ispData, 'jumlah')) payload.jumlah = ispData.jumlah;
  if (Object.prototype.hasOwnProperty.call(ispData, 'billingPeriodMode')) payload.billing_period_mode = ispData.billingPeriodMode || 'monthly';
  if (Object.prototype.hasOwnProperty.call(ispData, 'billing_period_mode')) payload.billing_period_mode = ispData.billing_period_mode || 'monthly';
  if (Object.prototype.hasOwnProperty.call(ispData, 'activationFeeAmount')) payload.activation_fee_amount = Number(ispData.activationFeeAmount || 0);
  if (Object.prototype.hasOwnProperty.call(ispData, 'activation_fee_amount')) payload.activation_fee_amount = Number(ispData.activation_fee_amount || 0);
  if (Object.prototype.hasOwnProperty.call(ispData, 'userEmail')) payload.user_id = ispData.userEmail || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'user_id')) payload.user_id = ispData.user_id || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'passwordPlain')) payload.password_plain = ispData.passwordPlain || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'userPassword')) payload.password_plain = ispData.userPassword || null;
  if (Object.prototype.hasOwnProperty.call(ispData, 'password_plain')) payload.password_plain = ispData.password_plain || null;

  return payload;
};

const mapIsp = (isp) => isp ? ({
  ...isp,
  logoUrl: isp.logoUrl ?? isp.logo_url ?? null,
  contractReference: isp.contractReference ?? isp.contract_reference ?? null,
  contractStartDate: isp.contractStartDate ?? isp.contract_start_date ?? null,
  contractPeriodStart: isp.contractPeriodStart ?? isp.contract_period_start ?? null,
  contractPeriodEnd: isp.contractPeriodEnd ?? isp.contract_period_end ?? null,
  bakFileUrl: isp.bakFileUrl ?? isp.bak_file_url ?? null,
  bakFileName: isp.bakFileName ?? isp.bak_file_name ?? null,
  contractFileUrl: isp.contractFileUrl ?? isp.contract_file_url ?? null,
  contractFileName: isp.contractFileName ?? isp.contract_file_name ?? null,
  userId: isp.userId ?? isp.user_id ?? null,
  userEmail: isp.userEmail ?? isp.user_id ?? null,
  passwordPlain: isp.passwordPlain ?? isp.password_plain ?? null,
  accountMappings: Array.isArray(isp.accountMappings)
    ? isp.accountMappings
    : Array.isArray(isp.isp_user_accounts)
      ? isp.isp_user_accounts
	      : [],
}) : isp;

const ISP_DETAIL_SELECT = `
  id,
  name,
  status,
  contract_reference,
  contract_start_date,
  contract_period_start,
  contract_period_end,
  paket,
  jumlah,
  billing_period_mode,
  billing_custom_every,
  billing_custom_unit,
  activation_fee_amount,
  activation_fee_paid_at,
  created_at,
  updated_at,
  logo_url,
  contract_file_name,
  contract_file_url,
  user_id,
  password_plain,
  deleted_at,
  deleted_by,
  bak_file_url,
  bak_file_name,
  contractRows:isp_contract_rows(
    id,
    isp_id,
    contract_reference,
    period_start,
    period_end,
    renewal_status,
    bak_file_url,
    bak_file_name,
    renewal_file_url,
    renewal_file_name,
    response_file_url,
    response_file_name,
    contract_file_name,
    contract_file_url,
    created_at,
    updated_at,
    deleted_at,
    deleted_by,
    renewalFollowUps:isp_renewal_follow_ups(
      id,
      row_id,
      split_order,
      source,
      trigger_code,
      title,
      description,
      status,
      renewal_file_url,
      renewal_file_name,
      response_file_url,
      response_file_name,
      response_decision,
      created_at,
      updated_at
    )
  ),
  accountMappings:isp_user_accounts(
    id,
    auth_user_id,
    isp_id,
    email,
    display_name,
    created_at,
    updated_at
  ),
  customerMemberships:customer_isp_memberships(
    id,
    customer_id,
    isp_id,
    customer:customers(
      id,
      customer_code,
      isp_name,
      name,
      status,
      activation_fee_amount,
      activation_fee_paid_at,
      contract_start_date,
      notes,
      created_at,
      updated_at,
      deleted_at,
      deleted_by,
      contracts(
        id,
        customer_id,
        contract_number,
        start_date,
        end_date,
        core_type,
        core_total,
        sharing_ratio,
        status,
        billing_every,
        billing_unit,
        created_at,
        updated_at,
        deleted_at,
        deleted_by,
        versions:contract_versions(
          id,
          contract_id,
          customer_id,
          version_number,
          start_date,
          end_date,
          core_type,
          core_total,
          shared_core_ratio,
          monthly_amount,
          yearly_amount,
          remarks,
          created_at,
          updated_at,
          deleted_at,
          deleted_by
        )
      ),
      routeVersions:customer_route_versions(
        id,
        customer_id,
        version_number,
        flow_status,
        created_at,
        updated_at,
        deleted_at,
        deleted_by
      )
    )
  )
`;

export const ispsApi = {
  // Get all ISPs
  async getAll() {
    const { data, error } = await supabase
      .from('isps')
      .select('id,name,status,logo_url,contract_reference,contract_start_date,contract_period_start,contract_period_end,bak_file_name,contract_file_name,paket,jumlah,billing_period_mode,activation_fee_amount,created_at,updated_at,user_id')
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data.map(mapIsp) : [];
  },

  // Get ISP by ID
  async getById(id) {
    const { data, error } = await supabase
      .from('isps')
      .select(ISP_DETAIL_SELECT)
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
    const payload = {
      billing_period_mode: 'monthly',
      activation_fee_amount: 0,
      ...mapIspPayload(ispData),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('isps')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    let authAccountRequested = false;
    if (ispData.userEmail && ispData.userPassword) {
      authAccountRequested = true;
      try {
        const { error: rpcError } = await supabase.rpc('upsert_isp_account', {
          p_isp_id: data.id,
          p_email: ispData.userEmail.trim().toLowerCase(),
          p_password: ispData.userPassword,
          p_name: ispData.name
        });
        if (rpcError) {
          console.error('Failed to create ISP account via RPC:', rpcError);
        }
      } catch (err) {
        console.error('Failed to create ISP account via RPC (exception):', err);
      }
    }

    await createActivityLog({
      action: 'isp.created',
      entity_type: 'isp',
      entity_id: data.id,
      entity_name: data.name,
      description: `Menambahkan ISP ${data.name}`,
      metadata: {
        status: data.status,
        auth_account_requested: authAccountRequested,
        auth_account_email: ispData.userEmail ? ispData.userEmail.trim().toLowerCase() : null,
      },
    });

    return data;
  },

  // Update ISP
  async update(id, ispData) {
    const { data: previousIsp, error: previousError } = await supabase
      .from('isps')
      .select('id,name,status,contract_reference,contract_start_date,contract_period_start,contract_period_end,paket,jumlah,billing_period_mode,activation_fee_amount,user_id')
      .eq('id', id)
      .single();

    if (previousError) throw previousError;

    const { data, error } = await supabase
      .from('isps')
      .update({
        ...mapIspPayload(ispData),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let authAccountSynced = false;
    if (ispData.userEmail) {
      try {
        const { error: rpcError } = await supabase.rpc('upsert_isp_account', {
          p_isp_id: id,
          p_email: ispData.userEmail.trim().toLowerCase(),
          p_password: ispData.userPassword || null,
          p_name: ispData.name || data.name
        });
        if (rpcError) {
          console.error('Failed to upsert ISP account via RPC:', rpcError);
          throw new Error('Gagal sinkronisasi akun login: ' + rpcError.message);
        }
        authAccountSynced = true;
      } catch (err) {
        console.error('Failed to upsert ISP account via RPC (exception):', err);
        throw err instanceof Error ? err : new Error('Gagal sinkronisasi akun login.');
      }
    }

    await createActivityLog({
      action: 'isp.updated',
      entity_type: 'isp',
      entity_id: data.id,
      entity_name: data.name,
      description: `Mengubah data ISP ${data.name}`,
      metadata: {
        ...pickChangedFields(previousIsp, data, ['name', 'status', 'contract_reference', 'contract_start_date', 'contract_period_start', 'contract_period_end', 'paket', 'jumlah', 'billing_period_mode', 'activation_fee_amount', 'user_id']),
        auth_account_synced: authAccountSynced,
        auth_account_email: ispData.userEmail ? ispData.userEmail.trim().toLowerCase() : null,
      },
    });

    return data;
  },

  // Delete ISP (soft delete with cascade to customers)
  async delete(id) {
    const { user } = await getCurrentActor();
    const now = new Date().toISOString();
    const { data: previousIsp, error: previousError } = await supabase
      .from('isps')
      .select('id,name,status,user_id')
      .eq('id', id)
      .single();

    if (previousError) throw previousError;

    // Step 1: Get all customers related to this ISP via memberships
    const { data: memberships, error: membershipError } = await supabase
      .from('customer_isp_memberships')
      .select('customer_id')
      .eq('isp_id', id);

    if (membershipError) throw membershipError;

    const customerIds = memberships?.map(m => m.customer_id) || [];

    // Step 2: Soft delete all related customers
    if (customerIds.length > 0) {
      const { error: customersError } = await supabase
        .from('customers')
        .update({ 
          deleted_at: now,
          deleted_by: user?.id 
        })
        .in('id', customerIds);

      if (customersError) throw customersError;
    }

    // Step 3: Soft delete the ISP
    const { error } = await supabase
      .from('isps')
      .update({ 
        deleted_at: now,
        deleted_by: user?.id 
      })
      .eq('id', id);

    if (error) throw error;

    await createActivityLog({
      action: 'isp.deleted',
      entity_type: 'isp',
      entity_id: id,
      entity_name: previousIsp?.name,
      description: `Menghapus ISP ${previousIsp?.name || id}`,
      metadata: {
        before: previousIsp,
        deleted_at: now,
        deleted_by: user?.id ?? null,
        deleted_customers_count: customerIds.length,
        deleted_customer_ids: customerIds,
      },
    });

    return { deletedCustomersCount: customerIds.length };
  },
};

// ============================================================================
// MONITORING API
// ============================================================================

export const monitoringApi = {
  // Get billing monitoring data
  async getBilling({ year, isp, status }) {
    const { data: customers, error } = await supabase
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
          isp:isps(id,name,status,logo_url)
        )
      `)
      .eq('status', 'aktif');

    if (error) throw error;
    if (!Array.isArray(customers) || customers.length === 0) {
      return {
        year,
        appliedFilters: {
          isp: isp || null,
          status: status || null,
        },
        summary: {
          lunas: 0,
          belum_bayar: 0,
          terlambat: 0,
          belum_ditagih: 0,
        },
        rows: [],
      };
    }

    const customerIds = customers.map((customer) => customer.id).filter(Boolean);

    const [contracts, invoices, routeVersions] = await Promise.all([
      fetchInChunks(customerIds, async (ids) => {
        const { data, error: contractsError } = await supabase
          .from('contracts')
          .select(`
            id,
            customer_id,
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
          `)
          .in('customer_id', ids);

        if (contractsError) throw contractsError;
        return data || [];
      }),
      fetchInChunks(customerIds, async (ids) => {
        const { data, error: invoicesError } = await supabase
          .from('invoices')
          .select('id, customer_id, invoice_number, contract_id, period_year, period_month, amount, status, schedule_status')
          .eq('period_year', year)
          .eq('schedule_status', 'active')
          .in('customer_id', ids);

        if (invoicesError) throw invoicesError;
        return data || [];
      }),
      fetchInChunks(customerIds, async (ids) => {
        const { data, error: routesError } = await supabase
          .from('customer_route_versions')
          .select('id, customer_id, version_number, flow_status, created_at')
          .in('customer_id', ids);

        if (routesError) throw routesError;
        return data || [];
      }),
    ]);

    const contractsByCustomerId = new Map();
    contracts.forEach((contract) => {
      const list = contractsByCustomerId.get(contract.customer_id) || [];
      list.push(contract);
      contractsByCustomerId.set(contract.customer_id, list);
    });

    const invoicesByCustomerId = new Map();
    invoices.forEach((invoice) => {
      const list = invoicesByCustomerId.get(invoice.customer_id) || [];
      list.push(invoice);
      invoicesByCustomerId.set(invoice.customer_id, list);
    });

    const routeVersionsByCustomerId = new Map();
    routeVersions.forEach((routeVersion) => {
      const list = routeVersionsByCustomerId.get(routeVersion.customer_id) || [];
      list.push(routeVersion);
      routeVersionsByCustomerId.set(routeVersion.customer_id, list);
    });

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

    const getLatestRouteVersion = (customerRouteVersions = []) => (
      [...customerRouteVersions].sort((left, right) => {
        const versionDiff = Number(right.version_number ?? 0) - Number(left.version_number ?? 0);
        if (versionDiff !== 0) return versionDiff;
        return getDateValue(right.created_at) - getDateValue(left.created_at);
      })[0] ?? null
    );

    // Transform data to match backend format
    const rows = customers.map(customer => {
      const customerIsps = customer.ispMemberships?.map(m => m.isp).filter(Boolean) || [];
      const ispNames = customerIsps.map(isp => isp.name).filter(Boolean);
      const customerContracts = contractsByCustomerId.get(customer.id) || [];
      const customerInvoices = invoicesByCustomerId.get(customer.id) || [];
      const latestRouteVersion = getLatestRouteVersion(routeVersionsByCustomerId.get(customer.id) || []);
      const currentContract = getCurrentContract(customerContracts);
      const latestVersion = getLatestVersion(currentContract);
      const currentMonthInvoice = customerInvoices.find(
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
        const invoice = customerInvoices.find(
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
        routeStatus: latestRouteVersion?.flow_status || null,
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
      const baseRow = {
        customerId: customer.id,
        customerCode: customer.customer_code,
        customerName: customer.name,
        customerStatus: customer.status,
        routeStatus: latestRouteVersion?.flow_status || null,
        ispName,
        ispNames,
        ispContractStart: customer.contract_start_date || null,
      };
      const contractsInHistory = (customer.contracts || [])
        .filter(contract => contract.start_date <= yearEnd && contract.end_date >= yearStart && contract.end_date < today);

      if (contractsInHistory.length === 0) {
        const customerInvoices = (customer.invoices || [])
          .filter(invoice => invoice.schedule_status === 'active')
          .sort((left, right) => {
            const yearDiff = Number(right.period_year ?? 0) - Number(left.period_year ?? 0);
            if (yearDiff !== 0) return yearDiff;
            return Number(right.period_month ?? 0) - Number(left.period_month ?? 0);
          });
        const lastInvoice = customerInvoices[0];
        const selectedYearInvoices = customerInvoices.filter(invoice => Number(invoice.period_year) === selectedYear);

        return [{
          ...baseRow,
          contractId: null,
          contractNumber: null,
          lastInvoiceNumber: lastInvoice?.invoice_number || null,
          contractStart: customer.contract_start_date || null,
          contractEnd: null,
          coreType: null,
          coreTotal: null,
          sharingRatio: null,
          monthlyAmount: 0,
          yearlyAmount: 0,
          invoiceCount: customerInvoices.length,
          selectedYearInvoiceCount: selectedYearInvoices.length,
          lastInvoiceStatus: lastInvoice?.status || null,
        }];
      }

      return contractsInHistory.map(contract => {
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
          ...baseRow,
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
      supabase
        .from('customers')
        .select(`
          id,
          name,
          status,
          routeVersions:customer_route_versions(version_number, flow_status, created_at)
        `)
        .eq('status', 'aktif')
        .is('deleted_at', null)
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
        `)
        .is('deleted_at', null),
      supabase
        .from('isps')
        .select('id, name, status, paket, jumlah, created_at')
        .is('deleted_at', null)
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
    const coreTrend = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      name: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][index],
      count: 0,
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
        const total = Number(version?.core_total ?? contract.core_total ?? 0);
        
        sharingTrend.forEach((monthData, index) => {
          const month = index + 1;
          const monthStart = `${selectedYear}-${String(month).padStart(2, '0')}-01`;
          const monthEnd = new Date(Date.UTC(selectedYear, month, 0)).toISOString().slice(0, 10);
          if (!isContractInPeriod(contract, monthStart, monthEnd)) return;
          
          if (type === 'sharing_core' && ratio) {
            const chartKey = ratio.replace('/', ':');
            if (Object.prototype.hasOwnProperty.call(monthData, chartKey)) monthData[chartKey] += 1;
          } else if (type === 'core') {
            coreTrend[index].count += total;
          }
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
      coreTrend,
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
      .insert(mapDocumentPayload(documentData))
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
      .insert(withUpdatedAt(mapInvoicePayload(invoiceData)))
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update invoice
  async update(id, invoiceData) {
    const { data, error } = await supabase
      .from('invoices')
      .update(withUpdatedAt(mapInvoicePayload(invoiceData)))
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
      .insert(withUpdatedAt(mapContractPayload(contractData)))
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update contract
  async update(id, contractData) {
    const { data, error } = await supabase
      .from('contracts')
      .update(withUpdatedAt(mapContractPayload(contractData)))
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
    const contractId = versionData.contract_id ?? versionData.contractId;
    let payload = mapContractVersionPayload(versionData);

    if (contractId && (!payload.customer_id || !payload.version_number || !payload.core_type)) {
      const [{ data: contract, error: contractError }, { data: latestVersions, error: versionError }] = await Promise.all([
        supabase
          .from('contracts')
          .select('customer_id, core_type, core_total, sharing_ratio')
          .eq('id', contractId)
          .single(),
        supabase
          .from('contract_versions')
          .select('version_number')
          .eq('contract_id', contractId)
          .order('version_number', { ascending: false })
          .limit(1),
      ]);

      if (contractError) throw contractError;
      if (versionError) throw versionError;

      const nextVersionNumber = Number(latestVersions?.[0]?.version_number ?? 0) + 1;
      const coreType = payload.core_type
        ?? (payload.shared_core_ratio ? 'sharing_core' : contract?.core_type)
        ?? 'core';

      payload = {
        ...payload,
        customer_id: payload.customer_id ?? contract?.customer_id,
        version_number: payload.version_number ?? nextVersionNumber,
        core_type: coreType,
        core_total: payload.core_total ?? (coreType === 'core' ? Number(contract?.core_total ?? 0) : 0),
        monthly_amount: payload.monthly_amount ?? 0,
        yearly_amount: payload.yearly_amount ?? 0,
      };
    }

    const { data, error } = await supabase
      .from('contract_versions')
      .insert(withUpdatedAt(payload))
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update contract version
  async update(id, versionData) {
    const { data, error } = await supabase
      .from('contract_versions')
      .update(withUpdatedAt(mapContractVersionPayload(versionData)))
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
    const now = new Date().toISOString();
    const { data: latestVersions, error: latestVersionError } = await supabase
      .from('customer_route_versions')
      .select('version_number')
      .eq('customer_id', customerId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (latestVersionError) throw latestVersionError;
    const nextVersionNumber = Number(latestVersions?.[0]?.version_number ?? 0) + 1;

    const { data: version, error: versionError } = await supabase
      .from('customer_route_versions')
      .insert({
        customer_id: customerId,
        version_number: nextVersionNumber,
        flow_status: flowStatus,
        change_mode: nextVersionNumber === 1 ? 'initial' : 'ubah_jalur',
        change_note: changeNote,
        updated_at: now,
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
          updated_at: now,
        })));

      if (pointsError) throw pointsError;
    }

    return version;
  },

  async addHistory(customerId, historyData) {
    const { data, error } = await supabase
      .from('customer_route_history')
      .insert(mapRouteHistoryPayload(customerId, historyData))
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
      .update(withUpdatedAt(mapIspContractRowPayload(rowData)))
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
      .update(withUpdatedAt(mapInvoiceFollowUpPayload(followUpData)))
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
      .update(withUpdatedAt(mapRenewalFollowUpPayload(followUpData)))
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
      .update(withUpdatedAt(mapRenewalFollowUpPayload(followUpData)))
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// TRASH API (Soft Delete Management)
// ============================================================================

export const trashApi = {
  // Get all soft-deleted items
  async list() {
    const [isps, customers, contracts, invoices, documents, routes] = await Promise.all([
      supabase
        .from('isps')
        .select('id, name, status, created_at, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      
      supabase
        .from('customers')
        .select('id, name, customer_code, isp_name, status, created_at, deleted_at, deleted_by')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      
      supabase
        .from('contracts')
        .select('id, contract_number, customer_id, start_date, end_date, created_at, deleted_at, deleted_by, customers(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      
      supabase
        .from('invoices')
        .select('id, invoice_number, customer_id, period_year, period_month, amount, created_at, deleted_at, deleted_by, customers(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      
      supabase
        .from('documents')
        .select('id, nomor_dokumen, jenis_dokumen, customer_id, file_url, created_at, deleted_at, deleted_by, customers(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      
      supabase
        .from('customer_route_versions')
        .select('id, customer_id, version_number, flow_status, change_note, created_at, deleted_at, deleted_by, customers(name)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ]);

    const queryErrors = [isps, customers, contracts, invoices, documents, routes]
      .map((result) => result.error)
      .filter(Boolean);
    if (queryErrors.length > 0) {
      throw queryErrors[0];
    }

    return {
      isps: isps.data || [],
      customers: customers.data || [],
      contracts: contracts.data || [],
      invoices: invoices.data || [],
      documents: documents.data || [],
      routes: routes.data || [],
    };
  },

  // Restore item (set deleted_at to null)
  async restore(table, id) {
    const config = ACTIVITY_ENTITY_CONFIG[table];
    let previousItem = null;

    if (config) {
      const { data, error: previousError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (previousError) throw previousError;
      previousItem = data;
    }

    const { error } = await supabase
      .from(table)
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id);

    if (error) throw error;

    if (config) {
      const entityName = getEntityDisplayName(previousItem, `${config.entityType} ${id}`);
      await createActivityLog({
        action: `${config.entityType}.restored`,
        entity_type: config.entityType,
        entity_id: id,
        entity_name: entityName,
        description: `Memulihkan ${entityName} dari Trash`,
        metadata: {
          table,
          before: previousItem,
        },
      });
    }
  },

  // Permanent delete (hard delete from database)
  async deletePermanently(table, id) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Empty trash (delete all soft-deleted items permanently)
  async emptyTrash() {
    const tables = ['isps', 'customers', 'contracts', 'invoices', 'documents', 'customer_route_versions'];
    
    const results = await Promise.allSettled(
      tables.map(table =>
        supabase
          .from(table)
          .delete()
          .not('deleted_at', 'is', null)
      )
    );

    const errors = results
      .map((result) => result.status === 'rejected' ? result.reason : result.value?.error)
      .filter(Boolean);
    if (errors.length > 0) {
      throw new Error(`Failed to empty trash: ${errors.map((error) => error.message ?? String(error)).join(', ')}`);
    }

    return { success: true };
  },

  // Get trash statistics
  async getStats() {
    const [isps, customers, contracts, invoices, documents, routes] = await Promise.all([
      supabase.from('isps').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('customers').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('contracts').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('documents').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
      supabase.from('customer_route_versions').select('id', { count: 'exact', head: true }).not('deleted_at', 'is', null),
    ]);

    const countErrors = [isps, customers, contracts, invoices, documents, routes]
      .map((result) => result.error)
      .filter(Boolean);
    if (countErrors.length > 0) {
      throw countErrors[0];
    }

    // Get last cleared timestamp (oldest deleted_at)
    const { data: lastCleared } = await supabase
      .from('isps')
      .select('deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: true })
      .limit(1)
      .single();

    return {
      lastClearedAt: lastCleared?.deleted_at || new Date().toISOString(),
      totalItems: (isps.count || 0) + (customers.count || 0) + (contracts.count || 0) + 
                  (invoices.count || 0) + (documents.count || 0) + (routes.count || 0),
      breakdown: {
        ISP: isps.count || 0,
        Lokasi: customers.count || 0,
        Kontrak: contracts.count || 0,
        Invoice: invoices.count || 0,
        Dokumen: documents.count || 0,
        Jalur: routes.count || 0,
      }
    };
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
  trash: trashApi,
  notifications: notificationsApi,
  activityLogs: activityLogsApi,
  ispContractRows: ispContractRowsApi,
  ispRenewalFollowUps: ispRenewalFollowUpsApi,
};
