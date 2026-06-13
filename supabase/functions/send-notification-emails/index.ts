import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type NotificationItem = {
  id: string;
  type: string;
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  customerId?: number | null;
  customerName?: string | null;
  ispId?: number | null;
  ispName?: string | null;
  actionLabel: string;
  targetPath: string;
  dueDate?: string | null;
  createdAt: string;
};

type Recipient = {
  id: string;
  email: string;
  role: "super_admin" | "admin" | "teknisi" | "isp";
  displayName: string;
  ispId: number | null;
};

type DeliveryInsert = {
  notification_key: string;
  recipient_user_id: string;
  recipient_email: string;
  recipient_role: string;
  notification_type: string;
  notification_code: string;
  severity: string;
  target_path: string;
  status: string;
  provider: string;
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  attempted_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

type RecipientFilter = {
  userId: string | null;
  email: string | null;
};

type RequestAuth = {
  privileged: boolean;
  selfUserId: string | null;
  selfEmail: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-email-job-secret",
};

const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").replace(/\/+$/, "");
const emailFrom = Deno.env.get("EMAIL_FROM") || "";
const emailProvider = (Deno.env.get("EMAIL_PROVIDER") || "resend").trim().toLowerCase();
const brevoApiKey = Deno.env.get("BREVO_API_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
const jobSecret = Deno.env.get("EMAIL_JOB_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || getDefaultSecretKey();

function getDefaultSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!rawSecretKeys) return "";

  try {
    const secretKeys = JSON.parse(rawSecretKeys);
    return typeof secretKeys?.default === "string" ? secretKeys.default : "";
  } catch {
    return "";
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and service role/secret key are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDaysToIsoDate = (dateValue: string | null | undefined, dayOffset: number) => {
  if (!dateValue) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
};

const getDaysUntilIsoDate = (dateValue: string | null | undefined, baseDateValue = todayIso()) => {
  if (!dateValue) return null;
  const targetDate = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  const baseDate = new Date(`${String(baseDateValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(baseDate.getTime())) return null;
  return Math.ceil((targetDate.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));
};

const isActiveStatus = (status: unknown) => {
  const value = String(status || "").trim().toLowerCase();
  return !["berhenti", "nonaktif", "inactive", "stopped"].includes(value);
};

const targetUrl = (path: string) => `${appBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

const createCustomerNotification = (input: {
  code: string;
  type: string;
  severity?: NotificationItem["severity"];
  title: string;
  message: string;
  customerId: number;
  customerName: string;
  targetTab?: string;
  actionLabel?: string;
  dueDate?: string | null;
  ispIds?: number[];
}): NotificationItem => {
  const targetTab = input.targetTab || "overview";
  const dueSuffix = input.dueDate ? `-${input.dueDate}` : "";
  return {
    id: `${input.code}-${input.customerId}${dueSuffix}`,
    type: input.type,
    code: input.code,
    severity: input.severity || "warning",
    title: input.title,
    message: input.message,
    customerId: input.customerId,
    customerName: input.customerName,
    ispId: null,
    actionLabel: input.actionLabel || "Buka Detail",
    targetPath: `/customers/${input.customerId}${targetTab !== "overview" ? `?tab=${targetTab}` : ""}`,
    dueDate: input.dueDate || null,
    createdAt: new Date().toISOString(),
    ...(input.ispIds ? { metadata: { ispIds: input.ispIds } } : {}),
  } as NotificationItem;
};

const createIspNotification = (input: {
  code: string;
  type: string;
  severity?: NotificationItem["severity"];
  title: string;
  message: string;
  ispId: number;
  ispName: string;
  targetTab?: string;
  actionLabel?: string;
  rowId?: number | null;
  followUpId?: number | null;
}): NotificationItem => {
  const parts = [input.code, input.ispId, input.rowId, input.followUpId]
    .filter((part) => part !== null && part !== undefined && part !== "");
  const targetTab = input.targetTab || "overview";

  return {
    id: parts.join("-"),
    type: input.type,
    code: input.code,
    severity: input.severity || "warning",
    title: input.title,
    message: input.message,
    customerId: null,
    customerName: null,
    ispId: input.ispId,
    ispName: input.ispName,
    actionLabel: input.actionLabel || "Buka ISP",
    targetPath: `/isps/${input.ispId}${targetTab !== "overview" ? `?tab=${targetTab}` : ""}`,
    dueDate: null,
    createdAt: new Date().toISOString(),
  };
};

async function listAuthRecipients(): Promise<Recipient[]> {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users || []));
    if ((data?.users || []).length < 1000) break;
  }

  const roleUsers = users
    .map((user) => {
      const role = String(user.user_metadata?.role || "").trim().toLowerCase();
      if (!["super_admin", "admin", "teknisi", "isp"].includes(role) || !user.email) return null;
      return {
        id: user.id,
        email: user.email,
        role: role as Recipient["role"],
        displayName: String(user.user_metadata?.display_name || user.email),
        ispId: null,
      };
    })
    .filter(Boolean) as Recipient[];

  const ispUserIds = roleUsers.filter((user) => user.role === "isp").map((user) => user.id);
  if (ispUserIds.length === 0) return roleUsers;

  const { data, error } = await supabase
    .from("isp_user_accounts")
    .select("auth_user_id,isp_id")
    .in("auth_user_id", ispUserIds);
  if (error) throw error;

  const ispIdByUserId = new Map(
    (data || []).map((row) => [String(row.auth_user_id), Number(row.isp_id)]),
  );

  return roleUsers.map((user) => ({
    ...user,
    ispId: user.role === "isp" ? ispIdByUserId.get(user.id) || null : null,
  }));
}

function getBearerToken(req: Request) {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
}

async function getRequestAuth(req: Request): Promise<RequestAuth> {
  const providedSecret = req.headers.get("x-email-job-secret") || "";
  const bearerToken = getBearerToken(req);

  if (jobSecret && (providedSecret === jobSecret || bearerToken === jobSecret)) {
    return {
      privileged: true,
      selfUserId: null,
      selfEmail: null,
    };
  }

  if (!bearerToken) {
    return {
      privileged: false,
      selfUserId: null,
      selfEmail: null,
    };
  }

  const { data, error } = await supabase.auth.getUser(bearerToken);
  if (error || !data?.user) {
    return {
      privileged: false,
      selfUserId: null,
      selfEmail: null,
    };
  }

  return {
    privileged: false,
    selfUserId: data.user.id,
    selfEmail: data.user.email?.trim().toLowerCase() || null,
  };
}

function getRecipientFilter(body: Record<string, unknown>): RecipientFilter {
  const userId = typeof body?.recipientUserId === "string" ? body.recipientUserId.trim() : "";
  const email = typeof body?.recipientEmail === "string" ? body.recipientEmail.trim().toLowerCase() : "";

  return {
    userId: userId || null,
    email: email || null,
  };
}

function getRecipientAccessError(auth: RequestAuth, filter: RecipientFilter) {
  if (auth.privileged) return null;

  if (!auth.selfUserId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders,
    });
  }

  if (filter.userId && filter.userId !== auth.selfUserId) {
    return Response.json({ error: "Forbidden recipientUserId" }, {
      status: 403,
      headers: corsHeaders,
    });
  }

  if (filter.email && filter.email !== auth.selfEmail) {
    return Response.json({ error: "Forbidden recipientEmail" }, {
      status: 403,
      headers: corsHeaders,
    });
  }

  return null;
}

function resolveRecipientFilter(auth: RequestAuth, filter: RecipientFilter): RecipientFilter {
  if (auth.privileged) return filter;

  return {
    userId: filter.userId || auth.selfUserId,
    email: filter.email || auth.selfEmail,
  };
}

function applyRecipientFilter(recipients: Recipient[], filter: RecipientFilter) {
  if (!filter.userId && !filter.email) return recipients;

  return recipients.filter((recipient) => {
    if (filter.userId && recipient.id !== filter.userId) return false;
    if (filter.email && recipient.email.trim().toLowerCase() !== filter.email) return false;
    return true;
  });
}

async function getCustomerIspIdsByCustomerId() {
  const { data, error } = await supabase
    .from("customer_isp_memberships")
    .select("customer_id,isp_id");
  if (error) throw error;

  const result = new Map<number, number[]>();
  (data || []).forEach((row) => {
    const customerId = Number(row.customer_id);
    const ispId = Number(row.isp_id);
    if (!Number.isFinite(customerId) || !Number.isFinite(ispId)) return;
    result.set(customerId, [...(result.get(customerId) || []), ispId]);
  });
  return result;
}

async function getLatestRouteCustomerIds() {
  const { data, error } = await supabase
    .from("customer_route_versions")
    .select("customer_id,flow_status,version_number,created_at")
    .order("customer_id", { ascending: true })
    .order("version_number", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const customerIds = new Set<number>();
  (data || []).forEach((row) => {
    const customerId = Number(row.customer_id);
    if (Number.isFinite(customerId) && row.flow_status && !customerIds.has(customerId)) {
      customerIds.add(customerId);
    }
  });
  return customerIds;
}

async function buildCustomerNotifications(): Promise<NotificationItem[]> {
  const [customerIspIdsByCustomerId, routeCustomerIds] = await Promise.all([
    getCustomerIspIdsByCustomerId(),
    getLatestRouteCustomerIds(),
  ]);

  const [customersResult, incompleteInvoicesResult, missingFileInvoicesResult] = await Promise.all([
    supabase
      .from("customers")
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
          deleted_at,
          versions:contract_versions(
            id,
            contract_id,
            customer_id,
            contract_number,
            version_number,
            start_date,
            end_date,
            renewal_file_url,
            response_file_url,
            renewalFollowUps:contract_version_renewal_follow_ups(
              id,
              version_id,
              split_order,
              status,
              renewal_file_url,
              response_file_url,
              response_decision,
              created_at,
              updated_at
            )
          )
        ),
        documents(id,contract_id,jenis_dokumen,file_url,deleted_at)
      `)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("id,customer_id,invoice_number,amount,due_date,period_end_date,status,schedule_status")
      .in("status", ["belum_bayar", "terlambat", "belum_ditagih"])
      .eq("schedule_status", "active")
      .is("deleted_at", null)
      .or("due_date.is.null,amount.lte.0"),
    supabase
      .from("invoices")
      .select("id,customer_id,invoice_number,amount,due_date,period_end_date,status,schedule_status,invoice_file_url,payment_proof_file_url")
      .in("status", ["belum_bayar", "terlambat", "belum_ditagih"])
      .eq("schedule_status", "active")
      .is("deleted_at", null)
      .or("due_date.not.is.null,period_end_date.not.is.null")
      .or("invoice_file_url.is.null,invoice_file_url.eq.")
      .or("payment_proof_file_url.is.null,payment_proof_file_url.eq."),
  ]);

  if (customersResult.error) throw customersResult.error;
  if (incompleteInvoicesResult.error) throw incompleteInvoicesResult.error;
  if (missingFileInvoicesResult.error) throw missingFileInvoicesResult.error;

  const invoiceById = new Map<number, Record<string, unknown>>();
  (incompleteInvoicesResult.data || []).forEach((invoice) => {
    invoiceById.set(Number(invoice.id), { ...invoice, isIncomplete: true, isMissingFiles: false });
  });
  (missingFileInvoicesResult.data || []).forEach((invoice) => {
    invoiceById.set(Number(invoice.id), {
      ...(invoiceById.get(Number(invoice.id)) || invoice),
      ...invoice,
      isMissingFiles: true,
    });
  });

  const invoicesByCustomerId = new Map<number, Record<string, unknown>[]>();
  Array.from(invoiceById.values()).forEach((invoice) => {
    const customerId = Number(invoice.customer_id);
    if (!Number.isFinite(customerId)) return;
    invoicesByCustomerId.set(customerId, [...(invoicesByCustomerId.get(customerId) || []), invoice]);
  });

  const today = todayIso();
  const notifications: NotificationItem[] = [];

  (customersResult.data || []).forEach((customer) => {
    const customerId = Number(customer.id);
    const customerName = customer.name || `Pelanggan #${customerId}`;
    const ispIds = customerIspIdsByCustomerId.get(customerId) || [];
    if (!isActiveStatus(customer.status)) return;

    if (Number(customer.activation_fee_amount || 0) > 0 && !customer.activation_fee_paid_at) {
      notifications.push(createCustomerNotification({
        code: "activation_fee_unpaid",
        type: "activation_fee",
        title: "Biaya aktivasi belum dibayar",
        message: `${customerName} masih memiliki biaya aktivasi outstanding.`,
        customerId,
        customerName,
        ispIds,
      }));
    }

    const contracts = Array.isArray(customer.contracts) ? customer.contracts : [];
    const activeContract = contracts.find((contract) => String(contract.status || "").toLowerCase() === "aktif")
      || contracts[0];
    if (activeContract) {
      const versions = Array.isArray(activeContract.versions) ? activeContract.versions : [];
      const datedVersions = versions
        .filter((version) => String(version?.start_date || "").slice(0, 10) && String(version?.end_date || "").slice(0, 10))
        .sort((left, right) => {
          const startDiff = String(right?.start_date || "").slice(0, 10)
            .localeCompare(String(left?.start_date || "").slice(0, 10));
          if (startDiff !== 0) return startDiff;
          return Number(right?.version_number || 0) - Number(left?.version_number || 0);
        });
      const activeVersion = datedVersions.find((version) => {
        const startDate = String(version?.start_date || "").slice(0, 10);
        const endDate = String(version?.end_date || "").slice(0, 10);
        return startDate <= today && endDate >= today;
      }) || datedVersions[0] || null;
      const periodEnd = String(activeVersion?.end_date || activeContract.end_date || "").slice(0, 10);
      const daysUntilEnd = getDaysUntilIsoDate(periodEnd, today);
      const renewalFollowUps = Array.isArray(activeVersion?.renewalFollowUps)
        ? activeVersion.renewalFollowUps
        : [];
      const hasRenewalUpload = Boolean(
        String(activeVersion?.renewal_file_url || "").trim()
        || renewalFollowUps.some((followUp) => String(followUp?.renewal_file_url || "").trim()),
      );
      const hasResponse = Boolean(
        String(activeVersion?.response_file_url || "").trim()
        || renewalFollowUps.some((followUp) => String(followUp?.response_file_url || "").trim()),
      );
      const renewalContractNumber = String(
        activeVersion?.contract_number
        || activeContract.contract_number
        || "Kontrak",
      ).trim();
      const renewalKey = activeVersion?.id
        ? `version-${activeVersion.id}`
        : `contract-${activeContract.id || customerId}`;

      if (periodEnd && Number.isFinite(daysUntilEnd)) {
        if ((daysUntilEnd as number) <= 0 && !hasResponse) {
          notifications.push(createCustomerNotification({
            code: `renewal_overdue_${renewalKey}`,
            type: "contract_renewal",
            severity: "critical",
            title: "Kontrak tenant sudah berakhir",
            message: `${renewalContractNumber} untuk ${customerName} telah berakhir pada ${periodEnd}. Perpanjangan/tanggapan belum lengkap.`,
            customerId,
            customerName,
            targetTab: "contracts",
            actionLabel: "Buka Kontrak",
            dueDate: periodEnd,
            ispIds,
          }));
        } else if ((daysUntilEnd as number) <= 30 && (daysUntilEnd as number) > 0 && !hasResponse) {
          notifications.push(createCustomerNotification({
            code: `renewal_h1_warning_${renewalKey}`,
            type: "contract_renewal",
            severity: "critical",
            title: "Kontrak akan berakhir dalam 1 bulan",
            message: `${renewalContractNumber} untuk ${customerName} akan berakhir dalam ${daysUntilEnd} hari. ${hasRenewalUpload ? "Belum ada tanggapan perpanjangan." : "Segera upload surat perpanjangan kontrak."}`,
            customerId,
            customerName,
            targetTab: "contracts",
            actionLabel: "Buka Kontrak",
            dueDate: periodEnd,
            ispIds,
          }));
        } else if ((daysUntilEnd as number) <= 60 && (daysUntilEnd as number) > 30 && hasRenewalUpload && !hasResponse) {
          notifications.push(createCustomerNotification({
            code: `renewal_h2_warning_${renewalKey}`,
            type: "contract_renewal",
            title: "Kontrak akan berakhir dalam 2 bulan",
            message: `${renewalContractNumber} untuk ${customerName} akan berakhir dalam ${daysUntilEnd} hari. Surat perpanjangan sudah diupload, menunggu tanggapan lokasi.`,
            customerId,
            customerName,
            targetTab: "contracts",
            actionLabel: "Buka Kontrak",
            dueDate: periodEnd,
            ispIds,
          }));
        } else if ((daysUntilEnd as number) <= 90 && (daysUntilEnd as number) > 60 && !hasRenewalUpload) {
          notifications.push(createCustomerNotification({
            code: `renewal_h3_warning_${renewalKey}`,
            type: "contract_renewal",
            title: "Kontrak akan berakhir dalam 3 bulan",
            message: `${renewalContractNumber} untuk ${customerName} akan berakhir dalam ${daysUntilEnd} hari. Segera buat dan upload surat perpanjangan kontrak.`,
            customerId,
            customerName,
            targetTab: "contracts",
            actionLabel: "Buka Kontrak",
            dueDate: periodEnd,
            ispIds,
          }));
        }
      }

      const contractNumber = String(activeContract.contract_number || "").trim();
      if (!contractNumber || contractNumber.startsWith("NO-BAK-")) {
        notifications.push(createCustomerNotification({
          code: "contract_number_missing",
          type: "contract_admin",
          title: "Nomor kontrak belum diisi",
          message: `${customerName} belum memiliki nomor kontrak final.`,
          customerId,
          customerName,
          targetTab: "contracts",
          actionLabel: "Buka Kontrak",
          ispIds,
        }));
      }

      const documents = Array.isArray(customer.documents) ? customer.documents : [];
      const activeContractDocuments = documents.filter((document) => (
        Number(document.contract_id) === Number(activeContract.id)
        && !document.deleted_at
        && String(document.file_url || "").trim()
      ));
      const hasContractFile = activeContractDocuments.some((document) => (
        String(document.jenis_dokumen || "").trim().toLowerCase() === "kontrak"
      ));
      const hasBakFile = activeContractDocuments.some((document) => (
        String(document.jenis_dokumen || "").trim().toLowerCase() === "bak"
      ));

      if (!hasContractFile) {
        notifications.push(createCustomerNotification({
          code: "contract_file_missing",
          type: "contract_admin",
          title: "Berkas kontrak belum diunggah",
          message: `${customerName} belum memiliki berkas kontrak yang diunggah.`,
          customerId,
          customerName,
          targetTab: "contracts",
          actionLabel: "Upload Kontrak",
          ispIds,
        }));
      }
      if (!hasBakFile) {
        notifications.push(createCustomerNotification({
          code: "bak_missing",
          type: "contract_admin",
          title: "BAK belum tersedia",
          message: `${customerName} belum memiliki Berita Acara Koneksi/BAK.`,
          customerId,
          customerName,
          targetTab: "contracts",
          actionLabel: "Buka Kontrak",
          ispIds,
        }));
      }
    }

    if (!routeCustomerIds.has(customerId)) {
      notifications.push(createCustomerNotification({
        code: "missing_route",
        type: "route_setup",
        title: "Data jalur belum lengkap",
        message: `${customerName} belum memiliki data jalur aktif.`,
        customerId,
        customerName,
        targetTab: "jalur",
        actionLabel: "Buka Jalur",
        ispIds,
      }));
    }

    (invoicesByCustomerId.get(customerId) || []).forEach((invoice) => {
      const dueDate = String(invoice.due_date || invoice.period_end_date || "");
      const amount = Number(invoice.amount || 0);
      if (invoice.isIncomplete && (!dueDate || amount <= 0)) {
        notifications.push(createCustomerNotification({
          code: "invoice_setup_incomplete",
          type: "invoice_setup",
          title: "Lengkapi set date dan jumlah dibayar",
          message: `${customerName} memiliki invoice yang belum lengkap tanggal jatuh tempo atau nominalnya.`,
          customerId,
          customerName,
          targetTab: "invoices",
          actionLabel: "Buka Invoice",
          ispIds,
        }));
      }

      const reminderDate = addDaysToIsoDate(dueDate, -7);
      if (invoice.isMissingFiles && dueDate && reminderDate && reminderDate <= today) {
        notifications.push(createCustomerNotification({
          code: "invoice_h_minus_7",
          type: "invoice_reminder",
          title: "Reminder bulan jatuh tempo",
          message: `${customerName} sudah memasuki reminder bulan jatuh tempo. Upload invoice pembayaran diperlukan.`,
          customerId,
          customerName,
          targetTab: "invoices",
          actionLabel: "Buka Invoice",
          dueDate,
          ispIds,
        }));
      }
    });
  });

  return notifications;
}

async function buildIspNotifications(): Promise<NotificationItem[]> {
  const [ispsResult, contractRowsResult] = await Promise.all([
    supabase
      .from("isps")
      .select("id,name,status,contract_reference,contract_start_date,contract_period_start,contract_period_end,bak_file_url,contract_file_url")
      .is("deleted_at", null),
    supabase
      .from("isp_contract_rows")
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
      .is("deleted_at", null)
      .eq("renewal_status", "active"),
  ]);

  if (ispsResult.error) throw ispsResult.error;
  if (contractRowsResult.error) throw contractRowsResult.error;

  const rowsByIspId = new Map<number, Record<string, unknown>[]>();
  (contractRowsResult.data || []).forEach((row) => {
    const ispId = Number(row.isp_id);
    if (!Number.isFinite(ispId)) return;
    rowsByIspId.set(ispId, [...(rowsByIspId.get(ispId) || []), row]);
  });

  const notifications: NotificationItem[] = [];
  const today = todayIso();

  (ispsResult.data || []).forEach((isp) => {
    const ispId = Number(isp.id);
    const ispName = isp.name || `ISP #${ispId}`;
    if (!isActiveStatus(isp.status)) return;

    const contractRows = rowsByIspId.get(ispId) || [];
    const coverage = {
      hasReference: contractRows.some((row) => String(row.contract_reference || "").trim()),
      hasStartDate: contractRows.some((row) => row.contract_start_date),
      hasPeriod: contractRows.some((row) => row.period_start && row.period_end),
      hasBakFile: contractRows.some((row) => String(row.bak_file_url || "").trim()),
      hasContractFile: contractRows.some((row) => String(row.contract_file_url || "").trim()),
    };

    if (!String(isp.contract_reference || "").trim() && !coverage.hasReference) {
      notifications.push(createIspNotification({
        code: "isp_contract_reference_missing",
        type: "isp_contract",
        title: "Nomor kontrak ISP belum diisi",
        message: `${ispName} belum memiliki nomor kontrak/referensi kontrak.`,
        ispId,
        ispName,
        targetTab: "contracts",
      }));
    }
    if (!isp.contract_start_date && !coverage.hasStartDate) {
      notifications.push(createIspNotification({
        code: "isp_contract_start_missing",
        type: "isp_contract",
        title: "Awal kontrak ISP belum diisi",
        message: `${ispName} belum memiliki tanggal awal kontrak.`,
        ispId,
        ispName,
        targetTab: "contracts",
      }));
    }
    if ((!isp.contract_period_start || !isp.contract_period_end) && !coverage.hasPeriod) {
      notifications.push(createIspNotification({
        code: "isp_contract_period_missing",
        type: "isp_contract",
        title: "Periode berjalan ISP belum lengkap",
        message: `${ispName} belum memiliki periode berjalan awal dan akhir yang lengkap.`,
        ispId,
        ispName,
        targetTab: "contracts",
      }));
    }
    if (!String(isp.bak_file_url || "").trim() && !coverage.hasBakFile) {
      notifications.push(createIspNotification({
        code: "isp_bak_missing",
        type: "isp_document",
        title: "BAK ISP belum diupload",
        message: `${ispName} belum memiliki file BAK.`,
        ispId,
        ispName,
        targetTab: "contracts",
      }));
    }
    if (!String(isp.contract_file_url || "").trim() && !coverage.hasContractFile) {
      notifications.push(createIspNotification({
        code: "isp_contract_file_missing",
        type: "isp_document",
        title: "File kontrak ISP belum diupload",
        message: `${ispName} belum memiliki file kontrak.`,
        ispId,
        ispName,
        targetTab: "contracts",
      }));
    }

    contractRows.forEach((row) => {
      const periodEnd = String(row.period_end || "");
      if (!periodEnd) return;

      const followUps = Array.isArray(row.renewalFollowUps) ? row.renewalFollowUps : [];
      const sortedFollowUps = [...followUps].sort((left, right) => {
        const splitDiff = Number(right?.split_order || 0) - Number(left?.split_order || 0);
        if (splitDiff !== 0) return splitDiff;
        return String(right?.updated_at || right?.created_at || "")
          .localeCompare(String(left?.updated_at || left?.created_at || ""));
      });
      const pendingResponseFollowUp = sortedFollowUps.find((followUp) => (
        followUp?.status !== "completed"
        && String(followUp?.renewal_file_url || "").trim()
        && !String(followUp?.response_file_url || "").trim()
      )) || null;
      const latestFollowUp = pendingResponseFollowUp || sortedFollowUps[0] || null;
      const hasRenewalFile = Boolean(
        String(row.renewal_file_url || "").trim()
        || sortedFollowUps.some((followUp) => String(followUp?.renewal_file_url || "").trim()),
      );
      const hasResponseFile = Boolean(
        String(row.response_file_url || "").trim()
        || sortedFollowUps.some((followUp) => String(followUp?.response_file_url || "").trim()),
      );

      if (today > periodEnd && !hasResponseFile) {
        notifications.push(createIspNotification({
          code: "isp_renewal_overdue",
          type: "isp_renewal",
          severity: "critical",
          title: "Kontrak ISP belum diperpanjang",
          message: `Kontrak ${row.contract_reference || "ISP"} untuk ${ispName} telah berakhir pada ${periodEnd}. Status: Belum Diperpanjang.`,
          ispId,
          ispName,
          rowId: Number(row.id),
          followUpId: latestFollowUp?.id ? Number(latestFollowUp.id) : null,
          targetTab: "contracts",
        }));
        return;
      }

      const threeMonthsBefore = addDaysToIsoDate(periodEnd, -90);
      const twoMonthsBefore = addDaysToIsoDate(periodEnd, -60);
      const oneMonthBefore = addDaysToIsoDate(periodEnd, -30);

      if (oneMonthBefore && today >= oneMonthBefore && today < periodEnd && hasRenewalFile && !hasResponseFile) {
        notifications.push(createIspNotification({
          code: "isp_renewal_warning_1m",
          type: "isp_renewal",
          severity: "critical",
          title: "Peringatan ke-3: Kontrak akan berakhir dalam 1 bulan",
          message: `Kontrak ${row.contract_reference || "ISP"} untuk ${ispName} akan berakhir pada ${periodEnd}. Belum ada tanggapan dari ISP.`,
          ispId,
          ispName,
          rowId: Number(row.id),
          followUpId: pendingResponseFollowUp?.id ? Number(pendingResponseFollowUp.id) : null,
          targetTab: "contracts",
        }));
      } else if (twoMonthsBefore && today >= twoMonthsBefore && today < periodEnd && hasRenewalFile && !hasResponseFile) {
        notifications.push(createIspNotification({
          code: "isp_renewal_warning_2m",
          type: "isp_renewal",
          title: "Peringatan ke-2: Menunggu tanggapan perpanjangan",
          message: `Kontrak ${row.contract_reference || "ISP"} untuk ${ispName} akan berakhir pada ${periodEnd}. Surat perpanjangan sudah dikirim, menunggu tanggapan ISP.`,
          ispId,
          ispName,
          rowId: Number(row.id),
          followUpId: pendingResponseFollowUp?.id ? Number(pendingResponseFollowUp.id) : null,
          targetTab: "contracts",
        }));
      } else if (threeMonthsBefore && today >= threeMonthsBefore && today < periodEnd && !hasRenewalFile) {
        notifications.push(createIspNotification({
          code: "isp_renewal_warning_3m",
          type: "isp_renewal",
          title: "Kontrak ISP akan berakhir dalam 3 bulan",
          message: `Kontrak ${row.contract_reference || "ISP"} untuk ${ispName} akan berakhir pada ${periodEnd}. Segera buat surat perpanjangan.`,
          ispId,
          ispName,
          rowId: Number(row.id),
          followUpId: latestFollowUp?.id ? Number(latestFollowUp.id) : null,
          targetTab: "contracts",
        }));
      }
    });
  });

  return notifications;
}

function getNotificationIspIds(notification: NotificationItem) {
  const metadata = notification as NotificationItem & { metadata?: { ispIds?: number[] } };
  if (Number.isFinite(Number(notification.ispId))) return [Number(notification.ispId)];
  if (Array.isArray(metadata.metadata?.ispIds)) return metadata.metadata.ispIds;
  return [];
}

const ADMIN_CONTRACT_NOTIFICATION_TYPES = new Set(["contract_renewal"]);

function isAdminContractNotification(notification: NotificationItem) {
  return ADMIN_CONTRACT_NOTIFICATION_TYPES.has(notification.type);
}

function canReceiveNotification(recipient: Recipient, notification: NotificationItem) {
  if (recipient.role === "super_admin") return true;
  if (recipient.role === "admin") {
    return isAdminContractNotification(notification);
  }
  if (recipient.role === "teknisi") {
    return notification.type === "route_setup";
  }
  if (recipient.role === "isp") {
    if (!recipient.ispId) return false;
    return getNotificationIspIds(notification).includes(recipient.ispId);
  }
  return false;
}

async function getExistingDeliveryKeys(notificationIds: string[], recipientIds: string[]) {
  if (notificationIds.length === 0 || recipientIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from("notification_email_deliveries")
    .select("notification_key,recipient_user_id")
    .eq("status", "sent")
    .in("notification_key", notificationIds)
    .in("recipient_user_id", recipientIds);
  if (error) throw error;

  return new Set((data || []).map((row) => `${row.notification_key}:${row.recipient_user_id}`));
}

function buildEmailHtml(notification: NotificationItem, recipient: Recipient) {
  const link = targetUrl(notification.targetPath);
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
      <p>Halo ${recipient.displayName},</p>
      <p>Ada notifikasi ${notification.severity} untuk role <strong>${recipient.role}</strong>.</p>
      <h2 style="margin:16px 0 8px">${notification.title}</h2>
      <p>${notification.message}</p>
      <p style="margin:20px 0">
        <a href="${link}" style="background:#d4af37;color:#111827;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">
          ${notification.actionLabel}
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280">Kode: ${notification.id}</p>
    </div>
  `;
}

function parseEmailAddress(value: string) {
  const trimmedValue = value.trim();
  const namedMatch = trimmedValue.match(/^(.*?)\s*<([^<>@\s]+@[^<>@\s]+)>$/);
  if (namedMatch) {
    return {
      name: namedMatch[1].trim().replace(/^"|"$/g, "") || undefined,
      email: namedMatch[2].trim(),
    };
  }

  return {
    name: undefined,
    email: trimmedValue,
  };
}

async function sendResendEmail(notification: NotificationItem, recipient: Recipient) {
  if (!resendApiKey || !emailFrom) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required to send email.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: recipient.email,
      subject: `[KIMA] ${notification.title}`,
      html: buildEmailHtml(notification, recipient),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Resend error ${response.status}`);
  }
  return typeof payload?.id === "string" ? payload.id : null;
}

async function sendBrevoEmail(notification: NotificationItem, recipient: Recipient) {
  if (!brevoApiKey || !emailFrom) {
    throw new Error("BREVO_API_KEY and EMAIL_FROM are required to send email.");
  }

  const sender = parseEmailAddress(emailFrom);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{
        email: recipient.email,
        name: recipient.displayName || undefined,
      }],
      subject: `[KIMA] ${notification.title}`,
      htmlContent: buildEmailHtml(notification, recipient),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.code || `Brevo error ${response.status}`);
  }
  return typeof payload?.messageId === "string" ? payload.messageId : null;
}

async function sendEmail(notification: NotificationItem, recipient: Recipient) {
  if (emailProvider === "brevo") {
    return sendBrevoEmail(notification, recipient);
  }

  if (emailProvider === "resend") {
    return sendResendEmail(notification, recipient);
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${emailProvider}`);
}

async function recordDelivery(delivery: DeliveryInsert) {
  const { error } = await supabase
    .from("notification_email_deliveries")
    .upsert(delivery, { onConflict: "notification_key,recipient_user_id" });
  if (error) throw error;
}

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);
  const requestedForce = Boolean(body?.force);
  const limit = Math.max(1, Math.min(Number(body?.limit || 100), 500));
  const auth = await getRequestAuth(req);
  const force = auth.privileged && requestedForce;
  const requestedRecipientFilter = getRecipientFilter(body);
  const accessError = getRecipientAccessError(auth, requestedRecipientFilter);
  if (accessError) {
    if (!jobSecret && !getBearerToken(req)) {
      return Response.json({
        error: "EMAIL_JOB_SECRET is required for scheduled jobs, or a valid user JWT is required for self-service sends.",
      }, { status: 500, headers: corsHeaders });
    }
    return accessError;
  }
  const recipientFilter = resolveRecipientFilter(auth, requestedRecipientFilter);

  const [allRecipients, customerNotifications, ispNotifications] = await Promise.all([
    listAuthRecipients(),
    buildCustomerNotifications(),
    buildIspNotifications(),
  ]);
  const recipients = applyRecipientFilter(allRecipients, recipientFilter);
  const notifications = [...customerNotifications, ...ispNotifications].slice(0, limit);
  const existingKeys = force
    ? new Set<string>()
    : await getExistingDeliveryKeys(
      notifications.map((notification) => notification.id),
      recipients.map((recipient) => recipient.id),
    );

  const attempts = [];
  for (const notification of notifications) {
    const scopedRecipients = recipients.filter((recipient) => canReceiveNotification(recipient, notification));
    for (const recipient of scopedRecipients) {
      const deliveryKey = `${notification.id}:${recipient.id}`;
      if (existingKeys.has(deliveryKey)) continue;

      const attemptedAt = new Date().toISOString();
      let status = dryRun ? "dry_run" : "sent";
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (!dryRun) {
        try {
          providerMessageId = await sendEmail(notification, recipient);
        } catch (error) {
          status = "failed";
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      }

      await recordDelivery({
        notification_key: notification.id,
        recipient_user_id: recipient.id,
        recipient_email: recipient.email,
        recipient_role: recipient.role,
        notification_type: notification.type,
        notification_code: notification.code,
        severity: notification.severity,
        target_path: notification.targetPath,
        status,
        provider: emailProvider,
        provider_message_id: providerMessageId,
        error_message: errorMessage,
        sent_at: status === "sent" ? attemptedAt : null,
        attempted_at: attemptedAt,
        updated_at: attemptedAt,
        metadata: {
          title: notification.title,
          message: notification.message,
          customerId: notification.customerId || null,
          customerName: notification.customerName || null,
          ispId: notification.ispId || null,
          ispName: notification.ispName || null,
          targetUrl: targetUrl(notification.targetPath),
          dryRun,
        },
      });

      attempts.push({
        notificationKey: notification.id,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        status,
        errorMessage,
      });
    }
  }

  return Response.json({
    dryRun,
    force,
    selfService: !auth.privileged,
    recipientFilter,
    notificationCount: notifications.length,
    recipientCount: recipients.length,
    attemptedCount: attempts.length,
    sentCount: attempts.filter((attempt) => attempt.status === "sent").length,
    failedCount: attempts.filter((attempt) => attempt.status === "failed").length,
    attempts,
  }, { headers: corsHeaders });
}

Deno.serve((req) => handleRequest(req).catch((error) => (
  Response.json({
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500, headers: corsHeaders })
)));
