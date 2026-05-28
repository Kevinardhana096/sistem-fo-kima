import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import {
  FieldInput,
  FieldSelect,
  SummaryCard,
} from "../../components/shared/AppShared";
import FoRoutePlanner from "./components/FoRoutePlanner";
import {
  documentTypeLabelMap,
  timelineIconMap,
} from "../../app/constants";
import {
  addDaysToIsoDate,
  buildInvoiceScheduleRows,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPackageRatio,
  isOpenableFileUrl,
  resolveCustomerContractPeriodInfo,
  resolveCustomerPackageInfo,
  toTitleCase,
} from "../../app/utils";
import api from "../../lib/api";
import { uploadFileForRecord } from "../../lib/files";

const ROUTE_OPERATION_LABEL_MAP = {
  add: "Tambah Titik",
  update: "Edit Titik",
  delete: "Hapus Titik",
  reorder: "Atur Ulang Urutan",
  status: "Ubah Status Jalur",
  replace: "Setel Ulang Jalur",
  commit: "Simpan Jalur",
};

const ROUTE_META_PREFIX = "[FO_ROUTE_META]";

const INVOICE_STATUS_OPTIONS = [
  { value: "belum_ditagih", label: "Belum Ditagih" },
  { value: "belum_bayar", label: "Belum Bayar" },
  { value: "terlambat", label: "Terlambat" },
  { value: "lunas", label: "Lunas" },
];

function encodeRoutePlannerMeta(routeMeta) {
  if (!routeMeta || typeof routeMeta !== "object") {
    return "";
  }

  try {
    return `${ROUTE_META_PREFIX}${btoa(unescape(encodeURIComponent(JSON.stringify(routeMeta))))}`;
  } catch {
    return "";
  }
}

function decodeRoutePlannerMeta(encodedValue) {
  if (typeof encodedValue !== "string" || !encodedValue.trim()) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(escape(atob(encodedValue.trim()))));
  } catch {
    return null;
  }
}

function sanitizeRoutePlannerMeta(routeMeta) {
  const geometryCoordinates = Array.isArray(routeMeta?.geometryCoordinates)
    ? routeMeta.geometryCoordinates.filter(
      (coordinate) =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(Number(coordinate[0])) &&
        Number.isFinite(Number(coordinate[1])),
    )
    : [];

  return {
    profile:
      typeof routeMeta?.profile === "string" ? routeMeta.profile : undefined,
    source: typeof routeMeta?.source === "string" ? routeMeta.source : "planner",
    mode: typeof routeMeta?.mode === "string" ? routeMeta.mode : "manual",
    distance: Number(routeMeta?.distance ?? 0),
    duration: Number(routeMeta?.duration ?? 0),
    geometryCoordinates,
    roads: Array.isArray(routeMeta?.roads) ? routeMeta.roads : [],
  };
}

function splitRoutePointNote(note) {
  const rawNote = typeof note === "string" ? note : "";
  const metadataIndex = rawNote.indexOf(ROUTE_META_PREFIX);

  if (metadataIndex < 0) {
    return {
      displayNote: rawNote.trim(),
      routeMeta: null,
    };
  }

  const displayNote = rawNote.slice(0, metadataIndex).trim();
  const routeMeta = decodeRoutePlannerMeta(
    rawNote.slice(metadataIndex + ROUTE_META_PREFIX.length),
  );

  return {
    displayNote,
    routeMeta,
  };
}

function mergeRoutePlannerMetaIntoNote(note, routeMeta) {
  const { displayNote } = splitRoutePointNote(note);
  const encodedMeta = encodeRoutePlannerMeta(sanitizeRoutePlannerMeta(routeMeta));

  if (!encodedMeta) {
    return displayNote;
  }

  return displayNote ? `${displayNote}\n${encodedMeta}` : encodedMeta;
}

function attachRoutePlannerMetaToDraftPoints(points, routeMeta) {
  return (Array.isArray(points) ? points : []).map((point, index) => ({
    ...point,
    note:
      index === 0
        ? mergeRoutePlannerMetaIntoNote(point?.note, routeMeta)
        : splitRoutePointNote(point?.note).displayNote,
  }));
}

function extractRoutePlannerMetaFromPoints(points) {
  for (const point of Array.isArray(points) ? points : []) {
    const { routeMeta } = splitRoutePointNote(point?.note);
    const normalizedMeta = sanitizeRoutePlannerMeta(routeMeta);
    if (normalizedMeta.geometryCoordinates.length >= 2) {
      return normalizedMeta;
    }
  }

  return null;
}

function normalizeDraftRoutePoints(points) {
  const sourcePoints = Array.isArray(points) ? points : [];

  return sourcePoints.map((point, index) => ({
    ...point,
    id: point?.id ?? `draft-restored-${Date.now()}-${index}`,
    pathName:
      typeof point?.pathName === "string" && point.pathName.trim()
        ? point.pathName.trim()
        : `Titik ${index + 1}`,
    pointType:
      point?.pointType === "awal" ||
        point?.pointType === "transit" ||
        point?.pointType === "tujuan"
        ? point.pointType
        : index === 0
          ? "awal"
          : index === sourcePoints.length - 1
            ? "tujuan"
            : "transit",
    note: typeof point?.note === "string" ? point.note : "",
    orderNumber: Number(point?.orderNumber ?? index + 1),
  }));
}

function toUtcDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
}

function getMonthlyPeriodsBetween(startDate, endDate) {
  const start = toUtcDate(startDate);
  const end = toUtcDate(endDate);

  if (!start || !end || start.getTime() > end.getTime()) {
    return [];
  }

  const periods = [];
  let cursorStart = new Date(start.getTime());

  while (cursorStart.getTime() <= end.getTime()) {
    const nextMonthStart = new Date(Date.UTC(
      cursorStart.getUTCFullYear(),
      cursorStart.getUTCMonth() + 1,
      cursorStart.getUTCDate(),
    ));
    const cursorEnd = new Date(Math.min(
      end.getTime(),
      nextMonthStart.getTime() - 86400000,
    ));

    periods.push({
      periodStartDate: toIsoDate(cursorStart),
      periodEndDate: toIsoDate(cursorEnd),
      periodYear: cursorStart.getUTCFullYear(),
      periodMonth: cursorStart.getUTCMonth() + 1,
    });

    cursorStart = new Date(nextMonthStart.getTime());
  }

  return periods;
}

function buildHistoricalInvoiceNumber(baseInvoiceNumber, period, shouldAppendPeriodSuffix) {
  const normalizedBase = String(baseInvoiceNumber ?? "").trim();

  if (!normalizedBase) return "";
  if (!shouldAppendPeriodSuffix) return normalizedBase;

  const suffix = `${period.periodYear}${String(period.periodMonth).padStart(2, "0")}`;
  if (normalizedBase.endsWith(`-${suffix}`)) {
    return normalizedBase;
  }

  return `${normalizedBase}-${suffix}`;
}

function alignRecurringDateToPeriod(period, templateDate, fallbackDate) {
  const template = toUtcDate(templateDate);
  const periodEnd = toUtcDate(period?.periodEndDate);
  const fallback = String(fallbackDate ?? "").trim() || period?.periodEndDate || "";

  if (!template || !periodEnd) {
    return fallback;
  }

  const targetYear = periodEnd.getUTCFullYear();
  const targetMonth = periodEnd.getUTCMonth();
  const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(template.getUTCDate(), maxDay);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}

function getInvoiceFollowUps(invoice) {
  const followUps = Array.isArray(invoice?.invoiceFollowUps)
    ? invoice.invoiceFollowUps
    : [];
  return [...followUps].sort(
    (left, right) =>
      Number(left?.splitOrder ?? 0) - Number(right?.splitOrder ?? 0),
  );
}

function isInvoicePaid(invoice) {
  return String(invoice?.status ?? "").toLowerCase() === "lunas" ||
    isOpenableFileUrl(invoice?.paymentProofFileUrl) ||
    (typeof invoice?.paidAt === "string" && invoice.paidAt.trim().length > 0);
}

function hasUploadedInvoiceSplit(invoice) {
  return getInvoiceFollowUps(invoice).some((followUp) =>
    isOpenableFileUrl(followUp?.invoiceFileUrl),
  );
}

function hasAnyUploadedInvoiceFile(invoice) {
  return isOpenableFileUrl(invoice?.invoiceFileUrl) || hasUploadedInvoiceSplit(invoice);
}

function getInvoiceSetupWarnings(invoice) {
  const warnings = [];
  const dueDate = String(invoice?.workflowDueDate ?? invoice?.dueDate ?? "").trim();
  const amount = Number(invoice?.workflowAmount ?? invoice?.amount ?? 0);

  if (!dueDate) {
    warnings.push({
      code: "missing_due_date",
      message: "Segera mengatur tanggal terakhir pembayaran.",
    });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    warnings.push({
      code: "missing_amount",
      message: "Mengatur nominal jumlah pembayaran.",
    });
  }

  return warnings;
}

function getInvoiceWorkflowMeta(
  invoice,
  rowsForSequence = [],
  todayIso = new Date().toISOString().slice(0, 10),
) {
  const followUps = getInvoiceFollowUps(invoice);
  const firstFollowUp = followUps.find((followUp) => Number(followUp?.splitOrder ?? 0) === 1) ?? null;
  const secondFollowUp = followUps.find((followUp) => Number(followUp?.splitOrder ?? 0) === 2) ?? null;
  const setupWarnings = getInvoiceSetupWarnings(invoice);
  const dueDate = String(invoice?.workflowDueDate ?? invoice?.dueDate ?? "").trim();
  const h7Date = dueDate ? addDaysToIsoDate(dueDate, -7) : "";
  const h3Date = dueDate ? addDaysToIsoDate(dueDate, -3) : "";
  const hasMainInvoiceFile = isOpenableFileUrl(invoice?.invoiceFileUrl);
  const firstWarningUploaded = isOpenableFileUrl(firstFollowUp?.invoiceFileUrl);
  const secondWarningUploaded = isOpenableFileUrl(secondFollowUp?.invoiceFileUrl);
  const paid = isInvoicePaid(invoice);
  const h7Reached = Boolean(h7Date && h7Date <= todayIso);
  const h3Reached = Boolean(h3Date && h3Date <= todayIso);
  const dueDateReached = Boolean(dueDate && dueDate <= todayIso);
  const hasAnyInvoiceFile = hasMainInvoiceFile || firstWarningUploaded || secondWarningUploaded;
  const hasBlockingPreviousUnpaid = rowsForSequence.some(
    (candidate) => candidate.paymentOrder < invoice.paymentOrder && !isInvoicePaid(candidate),
  );

  if (paid) {
    return {
      key: "paid",
      label: "Lunas",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: false,
      canUploadFirstWarning: false,
      canUploadSecondWarning: false,
      canMarkPaid: false,
    };
  }

  if (setupWarnings.length > 0) {
    return {
      key: "pending_setup",
      label: "Lengkapi Data",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: false,
      canUploadFirstWarning: false,
      canUploadSecondWarning: false,
      canMarkPaid: false,
    };
  }

  if (dueDateReached && (secondWarningUploaded || h3Reached)) {
    return {
      key: "warning_unpaid",
      label: "Warning Belum Bayar",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: false,
      canUploadFirstWarning: false,
      canUploadSecondWarning: h3Reached && !secondWarningUploaded,
      canMarkPaid: hasAnyInvoiceFile,
    };
  }

  if (h3Reached && !hasBlockingPreviousUnpaid && (hasMainInvoiceFile || firstWarningUploaded) && !secondWarningUploaded) {
    return {
      key: "warning_required_h3",
      label: "Peringatan Kedua",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: false,
      canUploadFirstWarning: false,
      canUploadSecondWarning: true,
      canMarkPaid: hasAnyInvoiceFile,
    };
  }

  if (hasAnyInvoiceFile) {
    return {
      key: "waiting_payment_confirmation",
      label: "Menunggu Konfirmasi Pembayaran",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: false,
      canUploadFirstWarning: false,
      canUploadSecondWarning: h3Reached && !secondWarningUploaded,
      canMarkPaid: true,
    };
  }

  if (h7Reached && !hasBlockingPreviousUnpaid) {
    return {
      key: "warning_required_h7",
      label: "Peringatan Pertama",
      setupWarnings,
      firstFollowUp,
      secondFollowUp,
      hasMainInvoiceFile,
      firstWarningUploaded,
      secondWarningUploaded,
      hasAnyInvoiceFile,
      canUploadMainInvoice: true,
      canUploadFirstWarning: true,
      canUploadSecondWarning: false,
      canMarkPaid: false,
    };
  }

  return {
    key: "pending",
    label: "Menunggu Jadwal",
    setupWarnings,
    firstFollowUp,
    secondFollowUp,
    hasMainInvoiceFile,
    firstWarningUploaded,
    secondWarningUploaded,
    hasAnyInvoiceFile,
    canUploadMainInvoice: false,
    canUploadFirstWarning: false,
    canUploadSecondWarning: false,
    canMarkPaid: false,
  };
}

function resolveInvoiceStatusMeta(invoice) {
  const workflowMeta = invoice?.workflowMeta ?? getInvoiceWorkflowMeta(invoice);
  const badgeClassByKey = {
    paid: "bg-emerald-100 text-emerald-700",
    warning_unpaid: "bg-rose-100 text-rose-700",
    warning_required_h3: "bg-orange-100 text-orange-700",
    warning_required_h7: "bg-amber-100 text-amber-700",
    waiting_payment_confirmation: "bg-blue-100 text-blue-700",
    pending_setup: "bg-rose-100 text-rose-700",
    pending: "bg-slate-100 text-slate-700",
  };

  return {
    key: workflowMeta.key,
    label: workflowMeta.label,
    badgeClass: badgeClassByKey[workflowMeta.key] ?? "bg-slate-100 text-slate-700",
  };
}

function GlassSelect({ label, value, onChange, options, placeholder = "Pilih opsi" }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative space-y-2">
      {label && (
        <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-white/20">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          className="group flex h-12 w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-3xl px-4 text-[11px] font-black uppercase tracking-widest text-white outline-none transition-all focus:border-gold-accent/40 focus:bg-white/[0.04]"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span className={selectedOption ? "text-white" : "text-white/20"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span
            className={`material-symbols-outlined text-gold-accent transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          >
            expand_more
          </span>
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[60]"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 right-0 top-full z-[70] mt-2 animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0f18]/95 backdrop-blur-2xl shadow-2xl duration-200">
              <div className="no-scrollbar max-h-60 overflow-y-auto p-2 space-y-1">
                {options.map((opt) => (
                  <button
                    className={`w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${
                      value === opt.value
                        ? "bg-gold-accent text-[#0f141e] shadow-gold-glow"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GlassInput({ label, icon, ...props }) {
  return (
    <div className="relative space-y-2">
      {label && (
        <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-white/20">
          {label}
        </label>
      )}
      <div className="group relative">
        <input
          {...props}
          className={`h-12 w-full rounded-xl border border-white/5 bg-white/[0.01] backdrop-blur-3xl ${icon ? "pl-12" : "px-4"} pr-4 text-[11px] font-black uppercase tracking-widest text-white outline-none transition-all focus:border-gold-accent/40 focus:bg-white/[0.04] ${props.type === "date" ? "[color-scheme:dark]" : ""}`}
        />
        {icon && (
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within:text-gold-accent pointer-events-none">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

function formatDisplayContractNumber(contractNumber) {
  const normalizedNumber = String(contractNumber ?? "").trim();
  if (
    !normalizedNumber
    || normalizedNumber.startsWith("NO-BAK-")
    || normalizedNumber.startsWith("CTR-")
  ) {
    return "-";
  }
  return normalizedNumber;
}

function TenantDetailPage({
  customer,
  initialTab = "overview",
  onBack,
  onEditTenant,
  onNavigate,
  onLogout,
  onOpenRoutePlanner,
  onRefreshAll,
  routeViewMode = "embedded",
  backLabel = "Kembali ke Workspace",
  hideSidebar = false,
  canEditTenant = true,
  canDeleteTenant = true,
  currentRole = "admin",
}) {
  const isTeknisi = currentRole === "teknisi";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState("");
  const [documentDraft, setDocumentDraft] = useState({
    jenisDokumen: "penawaran",
    nomorDokumen: "",
    tanggalDokumen: "",
    contractVersionId: "",
    customJenisDokumen: "",
    fileUrl: "",
    uploadedFileName: "",
    uploadedFile: null,
  });
  const [documentError, setDocumentError] = useState("");
  const [documentFeedback, setDocumentFeedback] = useState("");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isUploadingContractFile, setIsUploadingContractFile] = useState(false);
  const [isUploadingBakFile, setIsUploadingBakFile] = useState(false);
  const [versionEditor, setVersionEditor] = useState(null);
  const [versionError, setVersionError] = useState("");
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ispPopupOpen, setIspPopupOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  const [invoiceSetDateMode, setInvoiceSetDateMode] = useState("manual");
  const [invoiceFixedDueDay, setInvoiceFixedDueDay] = useState("1");
  const [invoicePaymentOrderSort, setInvoicePaymentOrderSort] = useState("asc");
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [invoiceFeedback, setInvoiceFeedback] = useState("");
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [invoiceEditingId, setInvoiceEditingId] = useState(null);
  const [historicalArchiveDraft, setHistoricalArchiveDraft] = useState({
    periodStartDate: "",
    periodEndDate: "",
    contractNumber: "",
    invoiceNumber: "",
    dueDate: "",
    paidAt: "",
    amount: "250000",
    packageType: "sharing_core",
    ratio: "1:32",
    coreTotal: "",
    remarks: "",
  });
  const [billingEditor, setBillingEditor] = useState(null);
  const [billingError, setBillingError] = useState("");
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [isMarkingActivationFeePaid, setIsMarkingActivationFeePaid] = useState(false);
  const [contractNumberInputs, setContractNumberInputs] = useState({});
  const [isSavingContractNumber, setIsSavingContractNumber] = useState(false);
  const [editingContractNumberRows, setEditingContractNumberRows] = useState({});
  const [emptyContractNumberRows, setEmptyContractNumberRows] = useState({});
  const [emptyBakRows, setEmptyBakRows] = useState({});
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState("");
  const [routeError, setRouteError] = useState("");
  const [routeChangeNote, setRouteChangeNote] = useState("");
  const [isRouteDrafting, setIsRouteDrafting] = useState(false);
  const [draftRoutePoints, setDraftRoutePoints] = useState([]);
  const [draftRouteStatus, setDraftRouteStatus] = useState("aktif");

  const emptyStateStorageKey = `tenant-contract-empty-state-${customer.id}`;
  const routeDraftStorageKey = `tenant-route-draft-${customer.id}`;
  const isStandaloneJalurView = routeViewMode !== "embedded";
  const isPlannerJalurView = routeViewMode === "planner";

  const loadDetail = useCallback(async () => {
    setError("");
    try {
      const detailResult = await api.customers.getById(customer.id);
      setDetail(detailResult ?? null);
      // TODO: Implement timeline API
      setTimeline([]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat memuat tenant.",
      );
    }
  }, [customer.id]);

  useEffect(() => {
    setActiveTab(isStandaloneJalurView ? "jalur" : initialTab);
    void loadDetail();
  }, [initialTab, isStandaloneJalurView, loadDetail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(emptyStateStorageKey);
      if (!rawValue) {
        setEmptyContractNumberRows({});
        setEmptyBakRows({});
        return;
      }

      const parsedValue = JSON.parse(rawValue);
      setEmptyContractNumberRows(parsedValue?.contractNumberRows ?? {});
      setEmptyBakRows(parsedValue?.bakRows ?? {});
    } catch {
      setEmptyContractNumberRows({});
      setEmptyBakRows({});
    }
  }, [emptyStateStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      emptyStateStorageKey,
      JSON.stringify({
        contractNumberRows: emptyContractNumberRows,
        bakRows: emptyBakRows,
      }),
    );
  }, [emptyBakRows, emptyContractNumberRows, emptyStateStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(routeDraftStorageKey);
      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue);
      const restoredPoints = normalizeDraftRoutePoints(parsedValue?.points);

      if (restoredPoints.length < 2) {
        window.localStorage.removeItem(routeDraftStorageKey);
        return;
      }

      setDraftRoutePoints(restoredPoints);
      setDraftRouteStatus(
        parsedValue?.flowStatus === "nonaktif" ||
          parsedValue?.flowStatus === "gangguan"
          ? parsedValue.flowStatus
          : "aktif",
      );
      setRouteChangeNote(
        typeof parsedValue?.changeNote === "string" ? parsedValue.changeNote : "",
      );
      setIsRouteDrafting(true);
      setRouteFeedback(
        "Draft jalur FO sebelumnya dipulihkan. Anda bisa lanjut review atau aktifkan jalur baru.",
      );
    } catch {
      window.localStorage.removeItem(routeDraftStorageKey);
    }
  }, [routeDraftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isRouteDrafting || draftRoutePoints.length < 2) {
      window.localStorage.removeItem(routeDraftStorageKey);
      return;
    }

    window.localStorage.setItem(
      routeDraftStorageKey,
      JSON.stringify({
        flowStatus: draftRouteStatus,
        changeNote: routeChangeNote,
        points: draftRoutePoints,
      }),
    );
  }, [
    draftRoutePoints,
    draftRouteStatus,
    isRouteDrafting,
    routeChangeNote,
    routeDraftStorageKey,
  ]);

  const tenantName = detail?.name ?? customer?.name;
  const packageInfo = resolveCustomerPackageInfo(detail ?? customer);
  const contractPeriodInfo = resolveCustomerContractPeriodInfo(detail ?? customer);
  const isps = Array.isArray(detail?.isps) ? detail.isps : [];
  const contract = Array.isArray(detail?.contracts)
    ? ([...detail.contracts].sort((left, right) => {
        const leftDate = new Date(`${String(left?.endDate ?? left?.end_date ?? left?.startDate ?? left?.start_date ?? "").slice(0, 10)}T00:00:00.000Z`).getTime();
        const rightDate = new Date(`${String(right?.endDate ?? right?.end_date ?? right?.startDate ?? right?.start_date ?? "").slice(0, 10)}T00:00:00.000Z`).getTime();
        return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
      })[0] ?? null)
    : null;
  const versions = useMemo(
    () => (Array.isArray(detail?.contractVersions) ? detail.contractVersions : []),
    [detail?.contractVersions],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const invoices = useMemo(
    () => (Array.isArray(detail?.invoices) ? detail.invoices : []),
    [detail?.invoices],
  );
  const contractsList = useMemo(
    () => (Array.isArray(detail?.contracts) ? detail.contracts : []),
    [detail?.contracts],
  );
  const contractById = useMemo(() => {
    const map = new Map();
    contractsList.forEach((item) => {
      const key = Number(item?.id);
      if (Number.isFinite(key)) {
        map.set(key, item);
      }
    });
    return map;
  }, [contractsList]);
  const contractVersionById = useMemo(() => {
    const map = new Map();
    versions.forEach((item) => {
      const key = Number(item?.id);
      if (Number.isFinite(key)) {
        map.set(key, item);
      }
    });
    return map;
  }, [versions]);
  const resolveInvoiceContractPeriodEnd = useCallback((invoice) => {
    const versionKey = Number(invoice?.contractVersionId ?? invoice?.contract_version_id);
    if (Number.isFinite(versionKey)) {
      const version = contractVersionById.get(versionKey);
      const versionEndDate = version?.endDate ?? version?.end_date ?? null;
      if (versionEndDate) {
        return versionEndDate;
      }
    }

    const contractKey = Number(invoice?.contractId ?? invoice?.contract_id);
    if (Number.isFinite(contractKey)) {
      const contractRow = contractById.get(contractKey);
      const contractEndDate = contractRow?.endDate ?? contractRow?.end_date ?? null;
      if (contractEndDate) {
        return contractEndDate;
      }
    }

    return null;
  }, [contractById, contractVersionById]);
  const shouldArchiveInvoice = useCallback((invoice) => {
    const contractPeriodEnd = resolveInvoiceContractPeriodEnd(invoice);
    const contractKey = Number(invoice?.contractId ?? invoice?.contract_id);
    if (Number.isFinite(contractKey)) {
      const contractRow = contractById.get(contractKey);
      const contractEndDate = contractRow?.endDate ?? contractRow?.end_date ?? null;
      const resolvedContractEnd = contractPeriodEnd ?? contractEndDate;
      const contractStatus = String(contractRow?.status ?? "").toLowerCase();

      // Keep invoices from the still-running contract window in the active cycle table,
      // even if their persisted schedule status was previously marked as history.
      if (
        contractRow &&
        contractStatus !== "expired" &&
        contractStatus !== "nonaktif" &&
        (!resolvedContractEnd || resolvedContractEnd >= todayIso)
      ) {
        return false;
      }

      if (contractPeriodEnd && contractPeriodEnd < todayIso) {
        return true;
      }

      if (
        contractRow &&
        (
          contractStatus === "expired" ||
          contractStatus === "nonaktif" ||
          (contractEndDate && contractEndDate < todayIso)
        )
      ) {
        return true;
      }
    }

    if (invoice?.scheduleStatus === "history") {
      return true;
    }

    return false;
  }, [contractById, resolveInvoiceContractPeriodEnd, todayIso]);
  const activeInvoices = useMemo(() => {
    return invoices.filter((invoice) => !shouldArchiveInvoice(invoice));
  }, [invoices, shouldArchiveInvoice]);

  const historyInvoices = useMemo(() => {
    return invoices.filter((invoice) => shouldArchiveInvoice(invoice));
  }, [invoices, shouldArchiveInvoice]);
  const todoSummary = detail?.todoSummary ?? {
    priority: [],
    needAction: [],
    info: [],
    counts: {},
  };
  const latestDocuments = Array.isArray(detail?.latestDocuments)
    ? detail.latestDocuments
    : [];
  const allDocuments = latestDocuments; // Now includes all documents uploaded by user
  const contractDocumentByContractId = useMemo(() => {
    const docs = Array.isArray(allDocuments) ? [...allDocuments] : [];
    docs.sort((a, b) =>
      String(b?.tanggalDokumen ?? "").localeCompare(
        String(a?.tanggalDokumen ?? ""),
      ),
    );

    const map = new Map();
    docs.forEach((doc) => {
      if (String(doc?.jenisDokumen ?? "").toLowerCase() !== "kontrak") {
        return;
      }
      const key = Number(doc?.contractId);
      if (!Number.isFinite(key)) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, doc);
      }
    });
    return map;
  }, [allDocuments]);
  const bakDocumentByContractId = useMemo(() => {
    const docs = Array.isArray(allDocuments) ? [...allDocuments] : [];
    docs.sort((a, b) =>
      String(b?.tanggalDokumen ?? "").localeCompare(
        String(a?.tanggalDokumen ?? ""),
      ),
    );

    const map = new Map();
    docs.forEach((doc) => {
      if (String(doc?.jenisDokumen ?? "").toLowerCase() !== "bak") {
        return;
      }
      const key = Number(doc?.contractId);
      if (!Number.isFinite(key)) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, doc);
      }
    });
    return map;
  }, [allDocuments]);
  const bakDocumentByVersionId = useMemo(() => {
    const docs = Array.isArray(allDocuments) ? [...allDocuments] : [];
    docs.sort((a, b) =>
      String(b?.tanggalDokumen ?? "").localeCompare(
        String(a?.tanggalDokumen ?? ""),
      ),
    );

    const map = new Map();
    docs.forEach((doc) => {
      if (String(doc?.jenisDokumen ?? "").toLowerCase() !== "bak") {
        return;
      }
      const key = Number(doc?.contractVersionId ?? doc?.contract_version_id);
      if (!Number.isFinite(key)) {
        return;
      }
      if (!map.has(key)) {
        map.set(key, doc);
      }
    });
    return map;
  }, [allDocuments]);
  const activationFeePaidAt =
    detail?.activationFeePaidAt ?? customer?.activationFeePaidAt ?? null;
  const activationFeeAmount = Number(
    detail?.activationFeeAmount ?? customer?.activationFeeAmount ?? 0,
  );
  const activeRouteStatus = detail?.route?.activeFlowStatus ?? "aktif";
  const routePoints = useMemo(
    () => (Array.isArray(detail?.route?.points) ? detail.route.points : []),
    [detail?.route?.points],
  );
  const routeVersions = Array.isArray(detail?.route?.versions)
    ? detail.route.versions
    : [];
  const routeHistory = useMemo(
    () => (Array.isArray(detail?.route?.history) ? detail.route.history : []),
    [detail?.route?.history],
  );
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([]); // Default closed as requested
  const previewSourcePoints =
    isRouteDrafting && draftRoutePoints.length > 0 ? draftRoutePoints : routePoints;

  const activeAwalPoint =
    routePoints.find((point) => point.pointType === "awal") ?? null;
  const activeTujuanPoint =
    routePoints.find((point) => point.pointType === "tujuan") ?? null;
  const transitPointIds = routePoints
    .filter((point) => point.pointType === "transit")
    .map((point) => point.id);
  const activeRoutePlannerMeta = useMemo(
    () => extractRoutePlannerMetaFromPoints(previewSourcePoints),
    [previewSourcePoints],
  );
  const previewGeometryCoordinates =
    activeRoutePlannerMeta?.geometryCoordinates ?? [];
  const previewRoads = activeRoutePlannerMeta?.roads ?? [];
  // Ruas jalan yang unik & punya nama, mendukung draft maupun aktif
  const displayNamedRoads = useMemo(() => {
    const roads = Array.isArray(activeRoutePlannerMeta?.roads)
      ? activeRoutePlannerMeta.roads
      : [];
    return roads.reduce((acc, road) => {
      if (
        road?.name &&
        road.name.trim() &&
        !acc.some((r) => r.name === road.name)
      ) {
        const lowerName = road.name.toLowerCase();
        if (
          lowerName !== "tanpa nama jalan" &&
          !lowerName.includes("segmen manual")
        ) {
          acc.push(road);
        }
      }
      return acc;
    }, []);
  }, [activeRoutePlannerMeta]);
  const previewRoutePoints = useMemo(
    () =>
      previewSourcePoints
        .map((point, index, list) => {
          const noteText = splitRoutePointNote(point?.note).displayNote;
          const coordinateMatch = noteText.match(
            /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
          );
          const latSource =
            point?.lat ?? point?.latitude ?? coordinateMatch?.[1];
          const lngSource =
            point?.lng ?? point?.longitude ?? coordinateMatch?.[2];
          const lat = Number(latSource);
          const lng = Number(lngSource);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          return {
            id: point.id ?? `preview-${index}`,
            lat,
            lng,
            label: point.pathName ?? "",
            pointType: point.pointType,
            role:
              point.pointType === "awal"
                ? "provider"
                : point.pointType === "tujuan"
                  ? "customer"
                  : index === list.length - 1
                    ? "customer"
                    : "waypoint",
          };
        })
        .filter(Boolean),
    [previewSourcePoints],
  );
  useEffect(() => {
    setContractNumberInputs({});
  }, [contract?.id]);

  const sortedInvoices = useMemo(() => {
    const nextItems = [...activeInvoices];
    nextItems.sort((left, right) => {
      const leftKey = `${left.periodYear}-${String(left.periodMonth).padStart(2, "0")}`;
      const rightKey = `${right.periodYear}-${String(right.periodMonth).padStart(2, "0")}`;

      if (leftKey === rightKey) {
        return Number(left.id ?? 0) - Number(right.id ?? 0);
      }

      return leftKey.localeCompare(rightKey);
    });
    return nextItems;
  }, [activeInvoices]);

  const sortedHistoryInvoices = useMemo(() => {
    const nextItems = [...historyInvoices];
    nextItems.sort((left, right) => {
      const leftKey = `${left.periodYear}-${String(left.periodMonth).padStart(2, "0")}`;
      const rightKey = `${right.periodYear}-${String(right.periodMonth).padStart(2, "0")}`;

      if (leftKey === rightKey) {
        return Number(left.id ?? 0) - Number(right.id ?? 0);
      }

      return leftKey.localeCompare(rightKey);
    });
    return nextItems;
  }, [historyInvoices]);

  const invoiceRows = useMemo(() => {
    const baseRows = sortedInvoices.map((invoice, index) => ({
      ...invoice,
      paymentOrder: index + 1,
    }));

    return baseRows.map((invoice) => {
      const workflowMeta = getInvoiceWorkflowMeta(invoice, baseRows, todayIso);
      return {
        ...invoice,
        workflowMeta,
        statusMeta: resolveInvoiceStatusMeta({ ...invoice, workflowMeta }),
      };
    });
  }, [sortedInvoices, todayIso]);

  const historyInvoiceRows = useMemo(
    () =>
      sortedHistoryInvoices.map((invoice, index) => ({
        ...invoice,
        paymentOrder: index + 1,
        statusMeta: resolveInvoiceStatusMeta(invoice),
      })),
    [sortedHistoryInvoices],
  );

  const displayInvoiceRows = useMemo(() => {
    const items = [...invoiceRows];
    items.sort((left, right) => {
      if (invoicePaymentOrderSort === "desc") {
        return right.paymentOrder - left.paymentOrder;
      }

      return left.paymentOrder - right.paymentOrder;
    });
    return items;
  }, [invoiceRows, invoicePaymentOrderSort]);

  const displayHistoryInvoiceRows = useMemo(() => {
    const items = [...historyInvoiceRows];
    items.sort((left, right) => right.paymentOrder - left.paymentOrder);
    return items;
  }, [historyInvoiceRows]);

  const historicalArchiveMonthlyPeriods = useMemo(() => (
    getMonthlyPeriodsBetween(
      historicalArchiveDraft.periodStartDate,
      historicalArchiveDraft.periodEndDate,
    )
  ), [
    historicalArchiveDraft.periodEndDate,
    historicalArchiveDraft.periodStartDate,
  ]);

  const historicalArchiveInvoicePreview = useMemo(() => {
    const baseInvoiceNumber = String(historicalArchiveDraft.invoiceNumber ?? "").trim();
    if (!baseInvoiceNumber || historicalArchiveMonthlyPeriods.length === 0) {
      return "";
    }

    const firstInvoiceNumber = buildHistoricalInvoiceNumber(
      baseInvoiceNumber,
      historicalArchiveMonthlyPeriods[0],
      historicalArchiveMonthlyPeriods.length > 1,
    );

    if (historicalArchiveMonthlyPeriods.length === 1) {
      return firstInvoiceNumber;
    }

    const lastInvoiceNumber = buildHistoricalInvoiceNumber(
      baseInvoiceNumber,
      historicalArchiveMonthlyPeriods[historicalArchiveMonthlyPeriods.length - 1],
      true,
    );

    return `${firstInvoiceNumber} s/d ${lastInvoiceNumber}`;
  }, [historicalArchiveDraft.invoiceNumber, historicalArchiveMonthlyPeriods]);

  useEffect(() => {
    setInvoiceDrafts((previousDrafts) => {
      const nextDrafts = {};

      invoiceRows.forEach((invoice) => {
        const previousDraft = previousDrafts[invoice.id] ?? {};
        const normalizedAmount = Number.isFinite(Number(invoice.amount))
          ? String(Math.max(0, Math.round(Number(invoice.amount))))
          : "0";
        const previousFollowUpDrafts = previousDraft.followUps ?? {};
        const nextFollowUpDrafts = {};

        getInvoiceFollowUps(invoice).forEach((followUp) => {
          const draftKey = String(followUp.id);
          nextFollowUpDrafts[draftKey] = {
            invoiceNumber: String(
              previousFollowUpDrafts[draftKey]?.invoiceNumber ??
              followUp?.invoiceNumber ??
              "",
            ),
          };
        });

        nextFollowUpDrafts.initial = {
          invoiceNumber: String(
            previousFollowUpDrafts.initial?.invoiceNumber ??
            invoice?.invoiceNumber ??
            "",
          ),
        };

        nextDrafts[invoice.id] = {
          invoiceNumber: previousDraft.invoiceNumber ?? String(invoice.invoiceNumber ?? ""),
          dueDate: previousDraft.dueDate ?? String(invoice.dueDate ?? ""),
          amount: previousDraft.amount ?? normalizedAmount,
          status: previousDraft.status ?? String(invoice.status ?? "belum_ditagih"),
          followUps: nextFollowUpDrafts,
        };
      });

      return nextDrafts;
    });
  }, [invoiceRows]);

  const workflowInvoiceRows = useMemo(
    () =>
      invoiceRows.map((invoice) => {
        const draft = invoiceDrafts[invoice.id] ?? {};
        const dueDateValue =
          typeof draft.dueDate === "string"
            ? draft.dueDate.trim().slice(0, 10)
            : "";
        const amountSource =
          draft.amount !== undefined
            ? Number(draft.amount)
            : Number(invoice.amount ?? 0);
        const amountValue = Number.isFinite(amountSource) ? amountSource : 0;
        const activeReminderSplits = getInvoiceFollowUps(invoice).filter(
          (followUp) =>
            followUp?.status !== "completed" &&
            !isOpenableFileUrl(followUp?.invoiceFileUrl),
        );

        const rowWithDraft = {
          ...invoice,
          workflowDueDate: dueDateValue,
          workflowAmount: amountValue,
          activeReminderSplits,
        };

        const workflowMeta = getInvoiceWorkflowMeta(rowWithDraft, invoiceRows);

        return {
          ...rowWithDraft,
          workflowMeta,
          statusMeta: resolveInvoiceStatusMeta({ ...rowWithDraft, workflowMeta }),
        };
      }),
    [invoiceRows, invoiceDrafts],
  );

  const paidInvoiceCount = invoiceRows.filter(
    (invoice) => invoice.statusMeta.key === "paid",
  ).length;
  const unpaidInvoiceCount = workflowInvoiceRows.filter((invoice) =>
    ["waiting_payment_confirmation", "warning_required_h7", "warning_required_h3", "warning_unpaid"].includes(invoice.statusMeta.key),
  ).length;
  const pendingInvoiceCount = invoiceRows.filter(
    (invoice) => invoice.statusMeta.key === "pending",
  ).length;
  const setupIncompleteCount = workflowInvoiceRows.filter((invoice) => {
    const dueDate =
      typeof invoice?.workflowDueDate === "string"
        ? invoice.workflowDueDate
        : "";
    const amountValue = Number(invoice?.workflowAmount ?? 0);
    return !dueDate || amountValue <= 0;
  }).length;

  const nextActionInvoice =
    workflowInvoiceRows.find((invoice) =>
      ["pending_setup", "warning_required_h7", "warning_required_h3", "warning_unpaid"].includes(invoice.workflowMeta?.key),
    ) ?? null;

  const nextActionMeta = (() => {
    if (!nextActionInvoice) {
      return null;
    }

    const dueDate =
      typeof nextActionInvoice?.workflowDueDate === "string"
        ? nextActionInvoice.workflowDueDate
        : "";

    if (nextActionInvoice.workflowMeta?.key === "pending_setup") {
      return {
        type: "invoice_setup_incomplete",
        title: `Lengkapi pembayaran ke-${nextActionInvoice.paymentOrder}`,
        message: nextActionInvoice.workflowMeta.setupWarnings.map((warning) => warning.message).join(" "),
        dueDate,
      };
    }

    if (nextActionInvoice.workflowMeta?.key === "warning_required_h3") {
      return {
        type: "upload_h_minus_3",
        title: `Peringatan H-3 pembayaran ke-${nextActionInvoice.paymentOrder}`,
        message: "Pembayaran belum dikonfirmasi. Upload invoice peringatan kedua melalui split upload.",
        dueDate,
      };
    }

    if (nextActionInvoice.workflowMeta?.key === "warning_unpaid") {
      return {
        type: "warning_unpaid",
        title: `Warning Belum Bayar pembayaran ke-${nextActionInvoice.paymentOrder}`,
        message: "Peringatan maksimal sudah tercapai dan pembayaran belum dikonfirmasi.",
        dueDate,
      };
    }

    return {
      type: "upload_h_minus_7",
      title: `Peringatan H-7 pembayaran ke-${nextActionInvoice.paymentOrder}`,
      message:
        "Mendekati jatuh tempo. Isi nomor invoice lalu upload invoice peringatan pertama untuk pembayaran ini.",
      dueDate,
    };
  })();

  const primaryContractRowMarkerId =
    versions.length > 0
      ? `version-${versions[0]?.id ?? 0}`
      : contract
        ? `contract-${contract.id}`
        : null;
  const activeContractId = Number(contract?.id);
  const activeContractDocument = Number.isFinite(activeContractId)
    ? contractDocumentByContractId.get(activeContractId)
    : null;
  const activeBakDocument = Number.isFinite(activeContractId)
    ? bakDocumentByContractId.get(activeContractId)
    : null;
  const activeContractFileUrl = String(activeContractDocument?.fileUrl ?? "");
  const hasActiveContractFile = isOpenableFileUrl(activeContractFileUrl);
  const hasActiveBakFile = Boolean(activeBakDocument);
  const activeContractRowId = contract ? `contract-${contract.id}` : null;
  const hasContractNumberValue = Boolean(
    String(contract?.contractNumber ?? "").trim(),
  );
  const isContractNumberExplicitlyEmpty = Object.values(
    emptyContractNumberRows,
  ).some(Boolean);
  const isBakExplicitlyEmpty = activeContractRowId
    ? Boolean(emptyBakRows[activeContractRowId])
    : false;

  const backendPriorityTodos = Array.isArray(todoSummary.priority)
    ? todoSummary.priority.filter(
      (item) => item.code !== "required_document_missing",
    )
    : [];
  const backendNeedActionTodos = Array.isArray(todoSummary.needAction)
    ? todoSummary.needAction.filter(
      (item) =>
        ![
          "required_document_missing",
          "invoice_not_uploaded",
          "payment_pending",
          "invoice_amount_missing",
        ].includes(item.code),
    )
    : [];

  const derivedPriorityTodos = [];

  const derivedNeedActionTodos = [];
  if (setupIncompleteCount > 0) {
    derivedNeedActionTodos.push({
      id: "derived-setup-incomplete",
      code: "invoice_setup_incomplete",
      title: "Lengkapi set date dan jumlah dibayar",
      message: `Set date (terakhir pembayaran) dan jumlah dibayar belum diisi pada ${setupIncompleteCount} pembayaran.`,
      dueDate: null,
    });
  }

  if (!activationFeePaidAt) {
    derivedNeedActionTodos.push({
      id: `derived-activation-unpaid-${customer.id}`,
      code: "activation_fee_unpaid_local",
      title: "Biaya aktivasi belum dibayar",
      message: `Biaya aktivasi masih outstanding sebesar ${formatCurrency(activationFeeAmount)}.`,
      dueDate: null,
    });
  }

  if (nextActionMeta) {
    derivedNeedActionTodos.push({
      id: `derived-next-action-${nextActionInvoice?.id ?? "none"}`,
      code: "invoice_next_action",
      title: nextActionMeta.title,
      message: nextActionMeta.message,
      dueDate: nextActionMeta.dueDate,
    });
  }

  if (contract && !hasContractNumberValue && !isContractNumberExplicitlyEmpty) {
    derivedNeedActionTodos.push({
      id: `derived-contract-number-missing-${customer.id}`,
      code: "contract_number_missing_local",
      title: "Nomor kontrak belum diisi",
      message:
        "Isi nomor kontrak lokasi atau tandai memang kosong jika datanya memang tidak ada.",
      dueDate: null,
    });
  }

  if (contract && !hasActiveContractFile) {
    derivedNeedActionTodos.push({
      id: `derived-contract-file-missing-${customer.id}`,
      code: "contract_file_missing_local",
      title: "Berkas kontrak belum diunggah",
      message: "Upload berkas kontrak agar arsip legal lokasi lengkap.",
      dueDate: null,
    });
  }

  if (contract && !hasActiveBakFile && !isBakExplicitlyEmpty) {
    derivedNeedActionTodos.push({
      id: `derived-bak-missing-${customer.id}`,
      code: "bak_missing_local",
      title: "BAK belum tersedia",
      message: "Upload Berita Acara Koneksi/BAK atau tandai tidak perlu jika tidak diwajibkan.",
      dueDate: null,
    });
  }

  // Contract renewal warnings (H-3, H-2, H-1 months)
  if (contract?.endDate) {
    const endDate = new Date(contract.endDate);
    const today = new Date(todayIso);
    const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

    const primaryContract = Array.isArray(detail?.contracts)
      ? detail.contracts.find((contractRow) => Number(contractRow?.id) === Number(contract.id))
      : null;
    const renewalFollowUps = Array.isArray(primaryContract?.versions)
      ? primaryContract.versions.flatMap((version) => (
          Array.isArray(version?.renewalFollowUps) ? version.renewalFollowUps : []
        ))
      : [];
    const hasRenewalUpload = renewalFollowUps.some((followUp) => followUp?.renewalFileUrl);
    const hasResponse = renewalFollowUps.some((followUp) => followUp?.responseFileUrl);

    // H-3 months warning (90 days before end)
    if (daysUntilEnd <= 90 && daysUntilEnd > 60 && !hasRenewalUpload) {
      derivedNeedActionTodos.push({
        id: `derived-renewal-h3-${customer.id}`,
        code: "renewal_h3_warning",
        title: "Kontrak akan berakhir dalam 3 bulan",
        message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-3 bulan). Segera buat dan upload surat perpanjangan kontrak.`,
        dueDate: contract.endDate,
      });
    }

    // H-2 months warning (60 days before end)
    if (daysUntilEnd <= 60 && daysUntilEnd > 30 && hasRenewalUpload && !hasResponse) {
      derivedNeedActionTodos.push({
        id: `derived-renewal-h2-${customer.id}`,
        code: "renewal_h2_warning",
        title: "Kontrak akan berakhir dalam 2 bulan",
        message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-2 bulan). Surat perpanjangan sudah diupload. Menunggu tanggapan dari lokasi.`,
        dueDate: contract.endDate,
      });
    }

    // H-1 month warning (30 days before end)
    if (daysUntilEnd <= 30 && daysUntilEnd > 0 && !hasResponse) {
      derivedNeedActionTodos.push({
        id: `derived-renewal-h1-${customer.id}`,
        code: "renewal_h1_warning",
        title: "Kontrak akan berakhir dalam 1 bulan",
        message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-1 bulan). ${hasRenewalUpload ? 'Belum ada tanggapan perpanjangan. Segera follow up dengan lokasi.' : 'Segera upload surat perpanjangan kontrak!'}`,
        dueDate: contract.endDate,
      });
    }
  }

  const displayPriorityTodos = [
    ...backendPriorityTodos,
    ...derivedPriorityTodos,
  ];
  const displayNeedActionTodos = [
    ...backendNeedActionTodos,
    ...derivedNeedActionTodos,
  ];
  const totalActionItems =
    displayPriorityTodos.length + displayNeedActionTodos.length;

  const displayTimeline = useMemo(() => {
    const nonInvoiceTimeline = timeline.filter(
      (event) => event?.type !== "invoice",
    );
    const synthesizedTimeline = [];

    if (pendingInvoiceCount > 0) {
      synthesizedTimeline.push({
        id: `invoice-pending-summary-${customer.id}`,
        customerId: customer.id,
        date: todayIso,
        type: "todo",
        title: `Invoice belum ditagih (${pendingInvoiceCount})`,
        description: `${pendingInvoiceCount} invoice belum diunggah dan digabung dalam satu ringkasan.`,
      });
    }

    if (nextActionMeta) {
      synthesizedTimeline.push({
        id: `invoice-hminus7-${nextActionInvoice?.id ?? "none"}`,
        customerId: customer.id,
        date: todayIso,
        type: "todo",
        title: nextActionMeta.title,
        description: nextActionMeta.message,
      });
    }

    const toTimestamp = (value) => {
      const normalized =
        typeof value === "string" && value.trim().length > 0
          ? value.slice(0, 10)
          : todayIso;
      const timestamp = new Date(`${normalized}T00:00:00.000Z`).getTime();
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const sortedNonInvoiceTimeline = [...nonInvoiceTimeline].sort(
      (left, right) => toTimestamp(right.date) - toTimestamp(left.date),
    );

    return [...synthesizedTimeline, ...sortedNonInvoiceTimeline];
  }, [
    customer.id,
    nextActionMeta,
    nextActionInvoice?.id,
    pendingInvoiceCount,
    timeline,
    todayIso,
  ]);

  const billingEvery = Number(contract?.billingEvery ?? 1);
  const billingUnitLabel = toTitleCase(contract?.billingUnit ?? "bulan");
  const getFirstDayOfNextMonth = (dateValue) => {
    if (!dateValue) return "";
    const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  };
  const getRowPeriodTime = (row) => {
    const rawDate = row?.periodEnd ?? row?.periodStart ?? "";
    const timestamp = new Date(`${String(rawDate).slice(0, 10)}T00:00:00.000Z`).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const getContractPackageDisplay = (coreType) => {
    const normalizedCoreType = String(coreType ?? "").toLowerCase();
    const isSharingPackage = normalizedCoreType.includes("shar") || normalizedCoreType === "shared";

    return isSharingPackage ? "SHARING CORE" : "CORE";
  };
  const resolveContractSharedRatio = (contractRow) => (
    contractRow?.sharingRatio
      ?? contractRow?.sharing_ratio
      ?? null
  );
  const resolveContractPackageType = (contractRow) => (
    resolveContractSharedRatio(contractRow)
      ? "sharing_core"
      : contractRow?.coreType
      ?? contractRow?.core_type
      ?? "core"
  );
  const resolveContractActualValue = (contractRow) => {
    const sharedRatio = resolveContractSharedRatio(contractRow);
    const normalizedCoreType = String(resolveContractPackageType(contractRow)).toLowerCase();
    const isSharingPackage = normalizedCoreType.includes("shar") || normalizedCoreType === "shared";

    if (isSharingPackage) {
      return formatPackageRatio(sharedRatio) ?? "-";
    }

    return contractRow?.coreTotal
      ?? contractRow?.core_total
      ?? "-";
  };
  const resolveContractMonthlyAmount = useCallback((contractRow, version = null) => {
    const directMonthlyAmount = Number(
      version?.monthlyAmount
      ?? version?.monthly_amount
      ?? contractRow?.monthlyAmount
      ?? contractRow?.monthly_amount
      ?? 0,
    );
    if (Number.isFinite(directMonthlyAmount) && directMonthlyAmount > 0) {
      return directMonthlyAmount;
    }

    const yearlyAmount = Number(
      version?.yearlyAmount
      ?? version?.yearly_amount
      ?? contractRow?.yearlyAmount
      ?? contractRow?.yearly_amount
      ?? 0,
    );
    if (Number.isFinite(yearlyAmount) && yearlyAmount > 0) {
      return Math.round(yearlyAmount / 12);
    }

    const periodStart = String(version?.startDate ?? version?.start_date ?? contractRow?.startDate ?? contractRow?.start_date ?? "").slice(0, 10);
    const periodEnd = String(version?.endDate ?? version?.end_date ?? contractRow?.endDate ?? contractRow?.end_date ?? "").slice(0, 10);
    const targetVersionId = Number(version?.id ?? NaN);
    const targetContractId = Number(contractRow?.id ?? NaN);
    const invoiceMatch = invoices.find((invoice) => {
      const invoiceVersionId = Number(invoice?.contractVersionId ?? invoice?.contract_version_id ?? NaN);
      const invoiceContractId = Number(invoice?.contractId ?? invoice?.contract_id ?? NaN);
      const invoicePeriodStart = String(invoice?.periodStartDate ?? invoice?.period_start_date ?? "").slice(0, 10);
      const amount = Number(invoice?.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return false;
      }

      if (Number.isFinite(targetVersionId) && invoiceVersionId === targetVersionId) {
        return true;
      }

      if (!Number.isFinite(targetVersionId) && Number.isFinite(targetContractId) && invoiceContractId === targetContractId) {
        if (!periodStart || !periodEnd) {
          return true;
        }
        return invoicePeriodStart >= periodStart && invoicePeriodStart <= periodEnd;
      }

      return false;
    });

    const inferredAmount = Number(invoiceMatch?.amount ?? 0);
    return Number.isFinite(inferredAmount) && inferredAmount > 0 ? inferredAmount : null;
  }, [invoices]);
  const contractsForTable = Array.isArray(detail?.contracts)
    ? [...detail.contracts].sort((left, right) => (
        getRowPeriodTime({ periodEnd: left?.endDate ?? left?.end_date, periodStart: left?.startDate ?? left?.start_date })
        - getRowPeriodTime({ periodEnd: right?.endDate ?? right?.end_date, periodStart: right?.startDate ?? right?.start_date })
      ))
    : [];
  const getContractRowNote = (periodStart, periodEnd) => {
    if (periodStart && periodEnd && periodStart <= todayIso && periodEnd >= todayIso) {
      return "Kontrak Beroperasi";
    }
    if (periodStart && periodStart > todayIso) {
      return "Akan Berjalan";
    }
    return "Riwayat Perubahan";
  };
  const buildContractTableRow = ({ contractRow, version = null, id, number }) => {
    const periodStart = version?.startDate ?? version?.start_date ?? contractRow.startDate ?? contractRow.start_date ?? "";
    const periodEnd = version?.endDate ?? version?.end_date ?? contractRow.endDate ?? contractRow.end_date ?? "";
    const rowSource = version
      ? {
          ...contractRow,
          coreType: version.coreType ?? version.core_type ?? contractRow.coreType ?? contractRow.core_type,
          coreTotal: version.coreTotal ?? version.core_total ?? contractRow.coreTotal ?? contractRow.core_total,
          sharingRatio: version.sharedCoreRatio ?? version.shared_core_ratio ?? contractRow.sharingRatio ?? contractRow.sharing_ratio,
        }
      : contractRow;

    const note = getContractRowNote(periodStart, periodEnd);

    const versionContractNumber = version
      ? (
          version?.contractNumber
          ?? version?.contract_number
          ?? contractRow.contractNumber
          ?? contractRow.contract_number
        )
      : (contractRow.contractNumber ?? contractRow.contract_number);

    return {
      id,
      contractId: contractRow.id ?? null,
      versionId: version?.id ?? null,
      number,
      contractNumber: formatDisplayContractNumber(versionContractNumber),
      note,
      isHistory: note === "Riwayat Perubahan",
      isFuture: note === "Akan Berjalan",
      isActive: note === "Kontrak Beroperasi",
      periodStart,
      periodEnd,
      paket: getContractPackageDisplay(resolveContractPackageType(rowSource)),
      jumlahPaket: resolveContractActualValue(rowSource),
      monthlyAmount: resolveContractMonthlyAmount(contractRow, version),
      yearlyAmount: version?.yearlyAmount ?? version?.yearly_amount ?? null,
      hasBak: Boolean(
        version?.id
          ? bakDocumentByVersionId.get(Number(version.id))
          : (contractRow.id ? bakDocumentByContractId.get(Number(contractRow.id)) : null),
      ),
      bakDocumentId: (
        version?.id
          ? bakDocumentByVersionId.get(Number(version.id))?.id
          : (contractRow.id ? bakDocumentByContractId.get(Number(contractRow.id))?.id : null)
      ) ?? null,
      bakFileUrl: (
        version?.id
          ? bakDocumentByVersionId.get(Number(version.id))?.fileUrl
          : (contractRow.id ? bakDocumentByContractId.get(Number(contractRow.id))?.fileUrl : null)
      ) ?? null,
      bakNumber: (
        version?.id
          ? bakDocumentByVersionId.get(Number(version.id))?.nomorDokumen
          : (contractRow.id ? bakDocumentByContractId.get(Number(contractRow.id))?.nomorDokumen : null)
      ) ?? null,
      renewalFollowUps: Array.isArray(version?.renewalFollowUps)
        ? version.renewalFollowUps
        : [],
    };
  };
  const contractRowsForTable = contractsForTable.flatMap((contractRow) => {
    const versionRows = Array.isArray(contractRow.versions)
      ? [...contractRow.versions]
        .sort((left, right) => (
          getRowPeriodTime({ periodEnd: left?.endDate ?? left?.end_date, periodStart: left?.startDate ?? left?.start_date })
          - getRowPeriodTime({ periodEnd: right?.endDate ?? right?.end_date, periodStart: right?.startDate ?? right?.start_date })
        ))
        .map((version) => buildContractTableRow({
          contractRow,
          version,
          id: `version-${version.id ?? `${contractRow.id}-${version.startDate ?? version.start_date ?? "unknown"}`}`,
          number: 0,
        }))
      : [];

    const baseRow = buildContractTableRow({
      contractRow,
      id: `contract-${contractRow.id ?? "unknown"}`,
      number: 0,
    });

    if (versionRows.length > 0) {
      const basePeriodKey = `${baseRow.periodStart ?? ""}::${baseRow.periodEnd ?? ""}`;
      const hasMatchingVersionPeriod = versionRows.some((row) => (
        `${row.periodStart ?? ""}::${row.periodEnd ?? ""}` === basePeriodKey
      ));

      if (hasMatchingVersionPeriod) {
        return versionRows;
      }

      const earliestVersionStart = [...versionRows]
        .map((row) => String(row.periodStart ?? "").slice(0, 10))
        .filter(Boolean)
        .sort()[0] ?? null;
      const basePeriodStart = String(baseRow.periodStart ?? "").slice(0, 10);
      const shouldForceLegacyContractNumber = Boolean(
        earliestVersionStart
        && basePeriodStart
        && basePeriodStart < earliestVersionStart,
      );

      return [
        {
          ...baseRow,
          // When the base legacy period predates all explicit renewal versions,
          // do not inherit the latest contract number from the parent contract row.
          contractNumber: shouldForceLegacyContractNumber ? "-" : baseRow.contractNumber,
        },
        ...versionRows,
      ];
    }

    return [baseRow];
  }).sort((left, right) => getRowPeriodTime(right) - getRowPeriodTime(left))
    .map((row, index) => ({ ...row, number: index + 1 }));

  const toggleContractNumberEmptyMark = (rowId) => {
    setEmptyContractNumberRows((previous) => ({
      ...previous,
      [rowId]: !previous[rowId],
    }));
  };

  const toggleBakEmptyMark = (rowId) => {
    setEmptyBakRows((previous) => ({
      ...previous,
      [rowId]: !previous[rowId],
    }));
  };

  const openBillingEditor = () => {
    if (!contract?.id) {
      setError(
        "Kontrak beroperasi tidak ditemukan untuk update periode tagihan.",
      );
      return;
    }

    setBillingEditor({
      billingEvery: String(contract?.billingEvery ?? 1),
      billingUnit: String(contract?.billingUnit ?? "bulan"),
    });
    setBillingError("");
  };

  const recalculateUnpaidInvoiceSchedule = async (nextBillingCycle) => {
    if (!contract?.id || !contract?.startDate || !contract?.endDate) {
      return;
    }

    const scheduleRows = buildInvoiceScheduleRows(
      contract.startDate,
      contract.endDate,
      nextBillingCycle,
    );
    const unpaidRows = invoiceRows.filter((invoice) => !isInvoicePaid(invoice));
    const paidRows = invoiceRows.filter(isInvoicePaid);
    const paidPeriodKeys = new Set(
      paidRows.map((invoice) => `${invoice.periodStartDate ?? ""}-${invoice.periodEndDate ?? ""}`),
    );
    const availableScheduleRows = scheduleRows.filter(
      (row) => !paidPeriodKeys.has(`${row.periodStartDate}-${row.periodEndDate}`),
    );

    await Promise.all(
      availableScheduleRows.map((row, index) => {
        const existingInvoice = unpaidRows[index] ?? null;
        const periodDate = new Date(`${row.periodStartDate}T00:00:00.000Z`);
        const periodYear = Number.isFinite(periodDate.getTime())
          ? periodDate.getUTCFullYear()
          : null;
        const periodMonth = Number.isFinite(periodDate.getTime())
          ? periodDate.getUTCMonth() + 1
          : null;
        const payload = {
          customerId: customer.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber ?? null,
          periodStartDate: row.periodStartDate,
          periodEndDate: row.periodEndDate,
          periodYear,
          periodMonth,
          scheduleStatus: "active",
        };

        if (existingInvoice) {
          return api.invoices.update(existingInvoice.id, payload);
        }

        return api.invoices.create({
          ...payload,
          amount: 0,
          status: "belum_ditagih",
        });
      }),
    );

    const surplusRows = unpaidRows.slice(availableScheduleRows.length);
    await Promise.all(
      surplusRows.map((invoice) =>
        api.invoices.update(invoice.id, { scheduleStatus: "history" }),
      ),
    );
  };

  const handleSaveBillingCycle = async (event) => {
    event.preventDefault();
    if (!contract?.id || !billingEditor) {
      return;
    }

    const billingEvery = Number(billingEditor.billingEvery);
    if (!Number.isFinite(billingEvery) || billingEvery <= 0) {
      setBillingError("Periode tagihan harus berupa angka lebih dari 0.");
      return;
    }

    if (
      !["hari", "bulan", "tahun"].includes(String(billingEditor.billingUnit))
    ) {
      setBillingError("Satuan periode tagihan tidak valid.");
      return;
    }

    setIsSavingBilling(true);
    setBillingError("");
    setError("");
    setInvoiceFeedback("");

    try {
      await api.contracts.update(contract.id, {
        billingEvery,
        billingUnit: billingEditor.billingUnit,
      });
      await recalculateUnpaidInvoiceSchedule({
        every: billingEvery,
        unit: billingEditor.billingUnit,
      });

      setBillingEditor(null);
      setInvoiceFeedback(
        "Periode tagihan berhasil diperbarui. Invoice aktif yang belum lunas disesuaikan otomatis; periksa ulang Jumlah Dibayar dan Tanggal Terakhir Pembayaran. Invoice yang sudah lunas tidak dihitung ulang.",
      );
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setBillingError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memperbarui periode tagihan.",
      );
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleMarkActivationFeePaid = async () => {
    setIsMarkingActivationFeePaid(true);
    setError("");
    setDocumentFeedback("");

    try {
      await api.customers.update(customer.id, {
        activationFeePaidAt: new Date().toISOString(),
      });
      setDocumentFeedback("Biaya aktivasi berhasil ditandai sudah dibayar.");
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menandai biaya aktivasi sudah dibayar.",
      );
    } finally {
      setIsMarkingActivationFeePaid(false);
    }
  };

  const handleRevertActivationFeePaid = async () => {
    if (!window.confirm("Batalkan status lunas biaya aktivasi? To do pembayaran akan muncul kembali.")) {
      return;
    }

    setIsMarkingActivationFeePaid(true);
    setError("");
    setDocumentFeedback("");

    try {
      await api.customers.update(customer.id, {
        activationFeePaidAt: null,
      });
      setDocumentFeedback("Status biaya aktivasi dikembalikan menjadi belum dibayar.");
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal membatalkan status lunas biaya aktivasi.",
      );
    } finally {
      setIsMarkingActivationFeePaid(false);
    }
  };

  const handleSaveContractNumber = async (row) => {
    const normalizedContractNumber = String(contractNumberInputs[row.id] ?? "").trim();
    if (!normalizedContractNumber) {
      setError("Nomor kontrak wajib diisi sebelum disimpan.");
      return;
    }

    setIsSavingContractNumber(true);
    setError("");

    try {
      if (row.versionId) {
        await api.contractVersions.update(row.versionId, {
          contractNumber: normalizedContractNumber,
        });
      } else if (row.contractId) {
        await api.contracts.update(row.contractId, {
          contractNumber: normalizedContractNumber,
        });
      } else {
        setError("Data kontrak tidak valid untuk update nomor kontrak.");
        return;
      }

      setEmptyContractNumberRows((previous) => ({ ...previous, [row.id]: false }));
      setContractNumberInputs((previous) => {
        const nextInputs = { ...previous };
        delete nextInputs[row.id];
        return nextInputs;
      });
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menyimpan nomor kontrak.",
      );
    } finally {
      setIsSavingContractNumber(false);
    }
  };

  const openVersionEditor = () => {
    const latestVersion = versions[0];
    const packageType = latestVersion?.sharedCoreRatio ?? contract?.sharingRatio ? "sharing_core" : "core";
    const monthlyAmount = Number(latestVersion?.monthlyAmount ?? latestVersion?.monthly_amount ?? 0);
    setVersionEditor({
      reason: "ubah_paket",
      customReason: "",
      contractNumber: "",
      requestedDate: todayIso,
      packageType,
      coreTotal: String(latestVersion?.coreTotal ?? latestVersion?.core_total ?? contract?.coreTotal ?? contract?.core_total ?? ""),
      ratio: latestVersion?.sharedCoreRatio ?? contract?.sharingRatio ?? "1:8",
      monthlyAmount: monthlyAmount > 0 ? String(monthlyAmount) : "",
      yearlyAmount: monthlyAmount > 0 ? String(monthlyAmount * 12) : "",
    });
    setVersionError("");
  };

  const handleCreateVersion = async (event) => {
    event.preventDefault();
    if (!contract || !versionEditor) {
      return;
    }
    const isSharingPackage = versionEditor.packageType === "sharing_core";
    const monthlyAmount = Number(versionEditor.monthlyAmount);
    const yearlyAmount = Number(versionEditor.yearlyAmount || monthlyAmount * 12);
    const coreTotal = Number(versionEditor.coreTotal);

    if (!versionEditor.requestedDate) {
      setVersionError("Tanggal perubahan paket wajib diisi.");
      return;
    }
    if (contract.endDate && versionEditor.requestedDate > contract.endDate) {
      setVersionError("Tanggal perubahan paket melewati akhir kontrak.");
      return;
    }
    if (isSharingPackage && !/^[1-9]\d*:[1-9]\d*$/.test(String(versionEditor.ratio ?? "").trim())) {
      setVersionError("Rasio shared core tidak valid.");
      return;
    }
    if (!isSharingPackage && (!Number.isFinite(coreTotal) || coreTotal <= 0)) {
      setVersionError("Jumlah core wajib lebih dari 0.");
      return;
    }
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      setVersionError("Nominal bulanan wajib lebih dari 0.");
      return;
    }
    if (
      (versionEditor.reason ?? "ubah_paket") === "lainnya" &&
      !String(versionEditor.customReason ?? "").trim()
    ) {
      setVersionError("Alasan lain wajib diisi.");
      return;
    }
    setIsSubmittingVersion(true);
    setVersionError("");
    setDocumentFeedback("");
    try {
      const result = await api.contractVersions.changePackageMidPeriod({
        contractId: contract.id,
        requestedDate: versionEditor.requestedDate,
        contractNumber: String(versionEditor.contractNumber ?? "").trim() || undefined,
        coreType: versionEditor.packageType,
        coreTotal: isSharingPackage ? 0 : coreTotal,
        sharedCoreRatio: isSharingPackage ? String(versionEditor.ratio ?? "").trim() : null,
        monthlyAmount,
        yearlyAmount: Number.isFinite(yearlyAmount) && yearlyAmount > 0 ? yearlyAmount : monthlyAmount * 12,
        remarks: (versionEditor.reason ?? "ubah_paket") === "lainnya"
          ? String(versionEditor.customReason ?? "").trim()
          : `Ubah paket efektif ${getFirstDayOfNextMonth(versionEditor.requestedDate)}.`,
      });
      setVersionEditor(null);
      setDocumentFeedback(
        `Paket baru aktif mulai ${formatDate(result.newEffectiveStart)}. ${result.updatedInvoiceCount} invoice belum lunas diperbarui.`,
      );

      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setVersionError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat membuat perubahan paket.",
      );
    } finally {
      setIsSubmittingVersion(false);
    }
  };

  const handleUploadDocument = async (event) => {
    event.preventDefault();
    if (!(documentDraft.uploadedFile instanceof File)) {
      setDocumentError("Upload dokumen wajib dipilih terlebih dahulu.");
      return;
    }
    setIsUploadingDocument(true);
    setDocumentError("");
    setDocumentFeedback("");
    try {
      const fileUrl = await uploadFileForRecord(documentDraft.uploadedFile, ["customers", customer.id, "documents"]);
      await api.documents.create({
        customer_id: customer.id,
        contract_id: contract?.id ?? null,
        contract_version_id: documentDraft.contractVersionId ? Number(documentDraft.contractVersionId) : null,
        contract_number: contract?.contractNumber ?? contract?.contract_number ?? null,
        jenis_dokumen: documentDraft.jenisDokumen,
        nomor_dokumen: documentDraft.nomorDokumen.trim() || null,
        tanggal_dokumen: documentDraft.tanggalDokumen || null,
        file_url: fileUrl,
      });
      setDocumentFeedback("Dokumen berhasil diunggah.");
      setDocumentDraft({
        jenisDokumen: "penawaran",
        nomorDokumen: "",
        tanggalDokumen: "",
        contractVersionId: "",
        customJenisDokumen: "",
        fileUrl: "",
        uploadedFileName: "",
        uploadedFile: null,
      });
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setDocumentError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat mengunggah dokumen.",
      );
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleUploadContractFile = async ({ contractId, file }) => {
    if (!contractId) {
      setError("Kontrak beroperasi tidak ditemukan untuk upload berkas kontrak.");
      return;
    }
    if (!(file instanceof File)) {
      setError("File kontrak wajib dipilih terlebih dahulu.");
      return;
    }

    setIsUploadingContractFile(true);
    setError("");
    setDocumentFeedback("");
    try {
      const fileUrl = await uploadFileForRecord(file, ["customers", customer.id, "contracts"]);
      await api.documents.create({
        customer_id: customer.id,
        contract_id: contractId,
        contract_number: String(contract?.contractNumber ?? contract?.contract_number ?? "").trim() || null,
        jenis_dokumen: "kontrak",
        tanggal_dokumen: todayIso,
        file_url: fileUrl,
      });

      setDocumentFeedback("Berkas kontrak berhasil diunggah.");
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat mengunggah berkas kontrak.",
      );
    } finally {
      setIsUploadingContractFile(false);
    }
  };

  const handleUploadBakFile = async ({ row, file }) => {
    if (!file) return;
    setIsUploadingBakFile(true);
    setError("");
    try {
      const fileUrl = await uploadFileForRecord(file, ["customers", customer.id, "bak"]);
      if (row.bakDocumentId) {
        await api.documents.update(row.bakDocumentId, { file_url: fileUrl });
      } else {
        await api.documents.create({
          customer_id: customer.id,
          contract_id: row.contractId ?? null,
          contract_version_id: row.versionId ?? null,
          jenis_dokumen: "BAK",
          tanggal_dokumen: todayIso,
          file_url: fileUrl,
        });
      }
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah berkas BAK.");
    } finally {
      setIsUploadingBakFile(false);
    }
  };

  const handleDeleteTenant = async () => {
    setIsDeletingTenant(true);
    setDeleteError("");
    try {
      await api.customers.delete(customer.id);
      setDeleteModalOpen(false);
      onBack?.();
      await onRefreshAll?.();
    } catch (requestError) {
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat menghapus lokasi.",
      );
    } finally {
      setIsDeletingTenant(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteError("");
    setDeleteModalOpen(true);
  };

  const routePointTypeLabelMap = {
    awal: "Awal",
    transit: "Transit",
    tujuan: "Tujuan",
  };

  const routePointTypeMeta = {
    awal: {
      label: "Awal",
      icon: "trip_origin",
      helper: "Titik sumber/aliran masuk",
    },
    transit: {
      label: "Transit",
      icon: "route",
      helper: "Lintasan yang dilewati",
    },
    tujuan: {
      label: "Tujuan",
      icon: "flag",
      helper: "Titik akhir/aliran keluar",
    },
  };

  const routeHistoryRows = useMemo(
    () =>
      routeHistory.map((item) => {
        const beforePoints = Array.isArray(item?.snapshotBefore?.points)
          ? item.snapshotBefore.points
          : [];
        const afterPoints = Array.isArray(item?.snapshotAfter?.points)
          ? item.snapshotAfter.points
          : [];

        const summarizePoints = (points) => {
          if (!points.length) {
            return "-";
          }

          return points
            .map((point) => `${point.orderNumber}. ${point.pathName}`)
            .join(" -> ");
        };

        return {
          ...item,
          changeNumber: routeHistory.length - routeHistory.indexOf(item),
          operationLabel:
            ROUTE_OPERATION_LABEL_MAP[item?.operation] ??
            toTitleCase(item?.operation ?? "perubahan"),
          beforeSummary: summarizePoints(beforePoints),
          afterSummary: summarizePoints(afterPoints),
          beforePoints,
          afterPoints,
          beforeCount: beforePoints.length,
          afterCount: afterPoints.length,
          beforeStatus: item?.snapshotBefore?.flowStatus ?? "-",
          afterStatus: item?.snapshotAfter?.flowStatus ?? "-",
        };
      }),
    [routeHistory],
  );

  const toggleHistoryExpand = (id) => {
    setExpandedHistoryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const runRouteMutation = async (body, successMessage) => {
    setRouteBusy(true);
    setRouteError("");
    setRouteFeedback("");

    try {
      let nextPoints = [...routePoints];

      if (body.operation === "delete") {
        nextPoints = nextPoints.filter((point) => String(point.id) !== String(body.pointId));
      } else if (body.operation === "reorder" && Array.isArray(body.orderedPointIds)) {
        const pointById = new Map(nextPoints.map((point) => [point.id, point]));
        nextPoints = body.orderedPointIds.map((id) => pointById.get(id)).filter(Boolean);
      } else if (Array.isArray(body.points)) {
        nextPoints = body.points;
      }

      await api.customerRoutes.replace(customer.id, {
        flowStatus: body.flowStatus ?? activeRouteStatus,
        changeNote: routeChangeNote.trim() || "Perubahan struktur jalur dari halaman tenant.",
        points: nextPoints.map((point, index) => ({
          pathName: point.pathName,
          pointType: point.pointType,
          note: point.note,
          orderNumber: index + 1,
        })),
      });

      setRouteFeedback(successMessage);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setRouteError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat memproses jalur.",
      );
    } finally {
      setRouteBusy(false);
    }
  };

  const handleCommitDraft = async () => {
    if (!routeChangeNote.trim()) {
      setRouteError(
        "Catatan perubahan wajib diisi untuk menyimpan struktur baru.",
      );
      return;
    }

    setRouteBusy(true);
    setRouteError("");
    try {
      await api.customerRoutes.replace(customer.id, {
        flowStatus: draftRouteStatus,
        changeNote: routeChangeNote,
        points: (Array.isArray(draftRoutePoints) ? draftRoutePoints : []).map(
          (p, idx) => ({
            pathName: p.pathName,
            pointType: p.pointType,
            note: p.note,
            orderNumber: idx + 1,
          }),
        ),
      });

      setRouteChangeNote("");
      setIsRouteDrafting(false);
      setDraftRoutePoints([]);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(routeDraftStorageKey);
      }
      setRouteFeedback("Jalur baru berhasil disimpan dan dicatat ke riwayat.");
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setRouteError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menyimpan jalur.",
      );
    } finally {
      setRouteBusy(false);
    }
  };

  const startDraftingSession = () => {
    setDraftRoutePoints([...routePoints]);
    setDraftRouteStatus(activeRouteStatus);
    setIsRouteDrafting(true);
    setRouteError("");
  };

  const cancelDraftingSession = () => {
    setIsRouteDrafting(false);
    setDraftRoutePoints([]);
    setRouteChangeNote("");
    setRouteError("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(routeDraftStorageKey);
    }
  };

  const handleDraftMove = (pointId, direction) => {
    setDraftRoutePoints((prev) => {
      const point = prev.find((p) => String(p.id) === String(pointId));
      if (!point || point.pointType !== "transit") return prev;

      const transitPoints = prev.filter((p) => p.pointType === "transit");
      const currentIndex = transitPoints.findIndex(
        (p) => String(p.id) === String(pointId),
      );
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= transitPoints.length) return prev;

      const newTransitPoints = [...transitPoints];
      const [moved] = newTransitPoints.splice(currentIndex, 1);
      newTransitPoints.splice(targetIndex, 0, moved);

      const awalPoint = prev.find((p) => p.pointType === "awal");
      const tujuanPoint = prev.find((p) => p.pointType === "tujuan");

      const newList = [];
      if (awalPoint) newList.push(awalPoint);
      newList.push(...newTransitPoints);
      if (tujuanPoint) newList.push(tujuanPoint);

      return newList.map((p, idx) => ({ ...p, orderNumber: idx + 1 }));
    });
  };

  const handleDraftDelete = (pointId) => {
    setDraftRoutePoints((prev) =>
      prev
        .filter(
          (p) => String(p.id) !== String(pointId) || p.pointType !== "transit",
        )
        .map((p, idx) => ({ ...p, orderNumber: idx + 1 })),
    );
  };


  const handleDeleteAllHistory = async () => {
    if (
      !confirm(
        "Hapus seluruh riwayat jalur tenant ini? Tindakan ini tidak dapat dibatalkan.",
      )
    )
      return;

    setRouteBusy(true);
    setRouteError("");
    setRouteFeedback("");
    try {
      setRouteFeedback("Penghapusan riwayat jalur langsung belum tersedia di mode Supabase direct access.");
      await loadDetail();
    } catch (requestError) {
      setRouteError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menghapus semua riwayat.",
      );
    } finally {
      setRouteBusy(false);
    }
  };

  const handleDeleteRoutePoint = async (pointId) => {
    if (isRouteDrafting) {
      handleDraftDelete(pointId);
      return;
    }
    await runRouteMutation(
      {
        operation: "delete",
        pointId,
      },
      "Titik jalur berhasil dihapus.",
    );
  };

  const handleMoveRoutePoint = async (pointId, direction) => {
    if (isRouteDrafting) {
      handleDraftMove(pointId, direction);
      return;
    }
    const currentIndex = transitPointIds.findIndex((id) => id === pointId);

    if (currentIndex < 0) {
      return;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= transitPointIds.length) {
      return;
    }

    const reorderedTransitIds = [...transitPointIds];
    const [item] = reorderedTransitIds.splice(currentIndex, 1);
    reorderedTransitIds.splice(targetIndex, 0, item);

    const nextOrder = [];
    if (activeAwalPoint) {
      nextOrder.push(activeAwalPoint.id);
    }

    nextOrder.push(...reorderedTransitIds);

    if (activeTujuanPoint) {
      nextOrder.push(activeTujuanPoint.id);
    }

    const coveredIds = new Set(nextOrder);
    routePoints.forEach((point) => {
      if (!coveredIds.has(point.id)) {
        nextOrder.push(point.id);
      }
    });

    await runRouteMutation(
      {
        operation: "reorder",
        orderedPointIds: nextOrder,
      },
      "Urutan titik jalur berhasil diperbarui.",
    );
  };


  const handleApplyPlannedRoute = (plannedPoints, plannerMeta) => {
    if (!Array.isArray(plannedPoints) || plannedPoints.length < 2) {
      setRouteError(
        "Minimal dua titik diperlukan untuk menerapkan hasil planner.",
      );
      return;
    }

    const distanceKm = Number(plannerMeta?.distance ?? 0) / 1000;
    const durationMinutes = Number(plannerMeta?.duration ?? 0) / 60;
    const routeSummary = [
      "Perencanaan rute FO via Valhalla",
      Number.isFinite(distanceKm) && distanceKm > 0
        ? `jarak ${distanceKm.toFixed(2)} km`
        : null,
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? `estimasi ${Math.round(durationMinutes)} menit`
        : null,
      plannerMeta?.profile ? `profile ${plannerMeta.profile}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    setIsRouteDrafting(true);
    setDraftRoutePoints(
      attachRoutePlannerMetaToDraftPoints(
        plannedPoints.map((point, index) => ({
          ...point,
          id: point?.id ?? `draft-planner-${Date.now()}-${index}`,
          orderNumber: index + 1,
        })),
        plannerMeta,
      ),
    );
    setDraftRouteStatus(activeRouteStatus);
    if (!routeChangeNote.trim()) {
      setRouteChangeNote(routeSummary);
    }
    setRouteError("");
    setRouteFeedback(
      "Rute dari FO Route Planner diterapkan ke Draft Jalur. Silakan review lalu simpan.",
    );
  };

  const updateInvoiceDraftField = (invoiceId, field, value) => {
    setInvoiceDrafts((previousDrafts) => ({
      ...previousDrafts,
      [invoiceId]: {
        ...(previousDrafts[invoiceId] ?? {}),
        [field]: value,
      },
    }));
  };

  const updateInvoiceFollowUpDraftField = (invoiceId, followUpKey, field, value) => {
    setInvoiceDrafts((previousDrafts) => {
      const currentDraft = previousDrafts[invoiceId] ?? {};
      const currentFollowUps = currentDraft.followUps ?? {};
      return {
        ...previousDrafts,
        [invoiceId]: {
          ...currentDraft,
          followUps: {
            ...currentFollowUps,
            [followUpKey]: {
              ...(currentFollowUps[followUpKey] ?? {}),
              [field]: value,
            },
          },
        },
      };
    });
  };

  const getInvoiceDraft = (invoice) => {
    const existingDraft = invoiceDrafts[invoice.id] ?? {};

    return {
      invoiceNumber: String(existingDraft.invoiceNumber ?? invoice?.invoiceNumber ?? ""),
      dueDate: String(existingDraft.dueDate ?? invoice?.dueDate ?? ""),
      amount: String(
        existingDraft.amount ??
        (Number.isFinite(Number(invoice.amount))
          ? Math.max(0, Math.round(Number(invoice.amount)))
          : 0),
      ),
      status: String(existingDraft.status ?? invoice?.status ?? "belum_ditagih"),
      followUps: existingDraft.followUps ?? {},
    };
  };

  const getInvoiceFollowUpDraft = (invoice, followUp = null) => {
    const draft = getInvoiceDraft(invoice);
    const followUpKey = followUp?.id ? String(followUp.id) : "initial";
    const fallbackKey = followUp?.splitOrder ? `warning-${followUp.splitOrder}` : followUpKey;
    return {
      invoiceNumber: String(
        draft.followUps?.[followUpKey]?.invoiceNumber ??
        draft.followUps?.[fallbackKey]?.invoiceNumber ??
        followUp?.invoiceNumber ??
        "",
      ),
    };
  };

  const resetInvoiceDraftFromSource = (invoice) => {
    const nextFollowUpDrafts = {};
    getInvoiceFollowUps(invoice).forEach((followUp) => {
      nextFollowUpDrafts[String(followUp.id)] = {
        invoiceNumber: String(followUp?.invoiceNumber ?? ""),
      };
    });
    nextFollowUpDrafts.initial = { invoiceNumber: String(invoice?.invoiceNumber ?? "") };

    setInvoiceDrafts((previousDrafts) => ({
      ...previousDrafts,
      [invoice.id]: {
        invoiceNumber: String(invoice?.invoiceNumber ?? ""),
        dueDate: String(invoice?.dueDate ?? ""),
        status: String(invoice?.status ?? "belum_ditagih"),
        amount: String(
          Number.isFinite(Number(invoice.amount))
            ? Math.max(0, Math.round(Number(invoice.amount)))
            : 0,
        ),
        followUps: nextFollowUpDrafts,
      },
    }));
  };

  const validateInvoiceDraftBase = (draft) => {
    if (!draft.dueDate) {
      return "Set date (tanggal terakhir pembayaran) wajib diisi sebelum upload invoice.";
    }

    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Jumlah dibayar wajib diisi lebih dari 0 sebelum upload invoice.";
    }

    return null;
  };

  const validateInvoiceDraftForUpload = (draft, followUpDraft) => {
    if (!followUpDraft.invoiceNumber.trim()) {
      return "Nomor invoice wajib diisi bersamaan saat upload invoice.";
    }

    return validateInvoiceDraftBase(draft);
  };

  const updateHistoricalArchiveDraftField = (field, value) => {
    setHistoricalArchiveDraft((previousDraft) => ({
      ...previousDraft,
      [field]: value,
    }));
  };

  const handleCreateHistoricalArchive = async (event) => {
    event.preventDefault();
    if (!contract?.id) {
      setError("Kontrak utama tidak ditemukan untuk membuat arsip periode lama.");
      return;
    }

    const isSharingPackage = historicalArchiveDraft.packageType === "sharing_core";
    const amount = Number(historicalArchiveDraft.amount);
    const coreTotal = Number(historicalArchiveDraft.coreTotal);
    const periodStartDate = String(historicalArchiveDraft.periodStartDate ?? "").trim();
    const periodEndDate = String(historicalArchiveDraft.periodEndDate ?? "").trim();
    const invoiceNumber = String(historicalArchiveDraft.invoiceNumber ?? "").trim();
    const contractNumber = String(historicalArchiveDraft.contractNumber ?? "").trim();
    const dueDate = String(historicalArchiveDraft.dueDate || historicalArchiveDraft.periodEndDate || "").trim();
    const paidAt = String(historicalArchiveDraft.paidAt || dueDate || "").trim();

    if (!periodStartDate || !periodEndDate || periodStartDate > periodEndDate) {
      setError("Periode arsip tidak valid.");
      return;
    }
    if (!invoiceNumber) {
      setError("Nomor invoice arsip wajib diisi.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Nominal invoice arsip wajib lebih dari 0.");
      return;
    }
    if (isSharingPackage && !/^[1-9]\d*[:/][1-9]\d*$/.test(String(historicalArchiveDraft.ratio ?? "").trim())) {
      setError("Rasio shared core arsip tidak valid.");
      return;
    }
    if (!isSharingPackage && (!Number.isFinite(coreTotal) || coreTotal <= 0)) {
      setError("Jumlah core arsip wajib lebih dari 0.");
      return;
    }

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const monthlyPeriods = getMonthlyPeriodsBetween(periodStartDate, periodEndDate);
      if (monthlyPeriods.length === 0) {
        throw new Error("Periode arsip tidak dapat dipecah menjadi invoice bulanan.");
      }

      const normalizedRatio = String(historicalArchiveDraft.ratio ?? "").trim().replace("/", ":");
      const contractVersion = await api.contractVersions.create({
        contractId: contract.id,
        customerId: customer.id,
        contractNumber: contractNumber || null,
        startDate: periodStartDate,
        endDate: periodEndDate,
        coreType: historicalArchiveDraft.packageType,
        coreTotal: isSharingPackage ? 0 : coreTotal,
        sharedCoreRatio: isSharingPackage ? normalizedRatio : null,
        monthlyAmount: amount,
        yearlyAmount: amount * Math.max(monthlyPeriods.length, 1),
        remarks: String(historicalArchiveDraft.remarks ?? "").trim() || "Arsip periode lama.",
      });

      const shouldAppendPeriodSuffix = monthlyPeriods.length > 1;
      await Promise.all(
        monthlyPeriods.map((period) => {
          const periodDueDate = alignRecurringDateToPeriod(period, dueDate, period.periodEndDate);
          const periodPaidAt = alignRecurringDateToPeriod(period, paidAt, periodDueDate);

          return api.invoices.create({
            customerId: customer.id,
            contractId: contract.id,
            contractVersionId: contractVersion?.id ?? null,
            contractNumber: contractNumber || null,
            invoiceNumber: buildHistoricalInvoiceNumber(invoiceNumber, period, shouldAppendPeriodSuffix),
            periodStartDate: period.periodStartDate,
            periodEndDate: period.periodEndDate,
            periodYear: period.periodYear,
            periodMonth: period.periodMonth,
            dueDate: periodDueDate,
            amount,
            status: "lunas",
            scheduleStatus: "history",
            paidAt: periodPaidAt,
          });
        }),
      );

      setHistoricalArchiveDraft({
        periodStartDate: "",
        periodEndDate: "",
        contractNumber: "",
        invoiceNumber: "",
        dueDate: "",
        paidAt: "",
        amount: "250000",
        packageType: "sharing_core",
        ratio: "1:32",
        coreTotal: "",
        remarks: "",
      });
      setInvoiceFeedback(`Arsip periode lama berhasil ditambahkan menjadi ${monthlyPeriods.length} invoice bulanan.`);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambahkan arsip periode lama.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleSaveInvoiceRow = async (invoice) => {
    const draft = getInvoiceDraft(invoice);
    const amount = Number(draft.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Jumlah dibayar harus berupa angka dan tidak boleh negatif.");
      return;
    }

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const selectedStatus = INVOICE_STATUS_OPTIONS.some((option) => option.value === draft.status)
        ? draft.status
        : "belum_ditagih";
      const nextPaidAt = selectedStatus === "lunas"
        ? (invoice.paidAt || new Date().toISOString())
        : null;
      const followUpPayload = getInvoiceFollowUps(invoice).map((followUp) => ({
        id: followUp.id,
        invoiceNumber:
          getInvoiceFollowUpDraft(invoice, followUp).invoiceNumber.trim() ||
          null,
      }));

      await api.invoices.update(invoice.id, {
        invoice_number: String(draft.invoiceNumber ?? "").trim() || null,
        due_date: draft.dueDate || null,
        amount,
        status: selectedStatus,
        paid_at: nextPaidAt,
      });
      await Promise.all(
        followUpPayload.map((followUp) =>
          api.invoiceFollowUps.update(followUp.id, {
            invoice_number: followUp.invoiceNumber,
          }),
        ),
      );
      setInvoiceEditingId((current) =>
        current === invoice.id ? null : current,
      );
      setInvoiceFeedback(`Invoice #${invoice.id} berhasil diperbarui.`);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menyimpan invoice.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const getOrCreateInvoiceFollowUp = async (invoice, splitOrder) => {
    const existingFollowUp = getInvoiceFollowUps(invoice).find(
      (followUp) => Number(followUp?.splitOrder ?? 0) === splitOrder,
    );

    if (existingFollowUp) {
      return existingFollowUp;
    }

    return api.invoiceFollowUps.create({
      invoiceId: invoice.id,
      splitOrder,
      source: "manual",
      triggerCode: splitOrder === 2 ? "h_minus_3" : "h_minus_7",
      title: splitOrder === 2 ? "Peringatan H-3" : "Peringatan H-7",
      description:
        splitOrder === 2
          ? "Invoice peringatan kedua sebelum tanggal terakhir pembayaran."
          : "Invoice peringatan pertama sebelum tanggal terakhir pembayaran.",
    });
  };

  const handleUploadInvoiceFile = async (invoice, file, splitOrder = null) => {
    if (!file) {
      return;
    }

    const workflowMeta = invoice.workflowMeta ?? getInvoiceWorkflowMeta(invoice, workflowInvoiceRows);
    const draft = getInvoiceDraft(invoice);
    const targetFollowUp = splitOrder
      ? getInvoiceFollowUps(invoice).find(
        (followUp) => Number(followUp?.splitOrder ?? 0) === Number(splitOrder),
      ) ?? { splitOrder }
      : null;
    const followUpDraft = splitOrder
      ? getInvoiceFollowUpDraft(invoice, targetFollowUp)
      : { invoiceNumber: draft.invoiceNumber };
    const validationMessage = validateInvoiceDraftForUpload(
      draft,
      followUpDraft,
    );
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (splitOrder === 2 && !workflowMeta.canUploadSecondWarning) {
      setError("Split upload peringatan kedua hanya tersedia pada tahap peringatan H-3.");
      return;
    }

    if (!splitOrder && !workflowMeta.canUploadMainInvoice && !workflowMeta.canUploadFirstWarning) {
      setError("Upload invoice belum tersedia untuk jadwal pembayaran ini.");
      return;
    }

    const amount = Number(draft.amount);

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const invoiceFileUrl = await uploadFileForRecord(file, ["customers", customer.id, "invoices"]);
      if (splitOrder) {
        const followUp = await getOrCreateInvoiceFollowUp(invoice, splitOrder);
        await api.invoiceFollowUps.update(followUp.id, {
          invoiceNumber: followUpDraft.invoiceNumber.trim(),
          invoiceFileUrl,
        });
      } else {
        await api.invoices.update(invoice.id, {
          invoiceNumber: followUpDraft.invoiceNumber.trim(),
          dueDate: draft.dueDate,
          amount,
          invoiceFileUrl,
        });
      }
      setInvoiceEditingId((current) =>
        current === invoice.id ? null : current,
      );
      setInvoiceFeedback(`Invoice #${invoice.id} berhasil diunggah.`);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengunggah invoice.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleUploadPaymentProof = async (invoice, file) => {
    if (!file) {
      return;
    }

    if (!hasAnyUploadedInvoiceFile(invoice)) {
      setError("Upload invoice terlebih dahulu sebelum upload bukti bayar.");
      return;
    }

    const draft = getInvoiceDraft(invoice);
    const validationMessage = validateInvoiceDraftBase(draft);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const paymentProofFileUrl = await uploadFileForRecord(file, ["customers", customer.id, "payment-proofs"]);
      await api.invoices.update(invoice.id, {
        paymentProofFileUrl,
        paidAt: new Date().toISOString(),
        status: "lunas",
      });
      setInvoiceFeedback(
        `Bukti bayar invoice #${invoice.id} berhasil diunggah.`,
      );
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengunggah bukti bayar.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleMarkInvoicePaid = async (invoice) => {
    if (!hasAnyUploadedInvoiceFile(invoice)) {
      setError("Upload invoice terlebih dahulu sebelum konfirmasi pembayaran.");
      return;
    }

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const paidAt = new Date().toISOString();
      await api.invoices.update(invoice.id, { paidAt, status: "lunas" });
      setInvoiceFeedback(`Invoice #${invoice.id} ditandai sudah bayar.`);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengonfirmasi pembayaran.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleApplyGlobalSetDate = async () => {
    const requestedDay = Number(invoiceFixedDueDay);
    if (
      !Number.isFinite(requestedDay) ||
      requestedDay < 1 ||
      requestedDay > 31
    ) {
      setError("Tanggal rutin harus diisi 1 sampai 31.");
      return;
    }

    if (invoiceRows.length === 0) {
      setError("Belum ada invoice untuk diterapkan set date.");
      return;
    }

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const dueDateByInvoiceId = {};

      await Promise.all(
        invoiceRows.map((invoice) => {
          const year = Number(invoice.periodYear);
          const month = Number(invoice.periodMonth);
          const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
          const normalizedDay = Math.min(
            Math.max(Math.round(requestedDay), 1),
            maxDay,
          );
          const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(normalizedDay).padStart(2, "0")}`;

          dueDateByInvoiceId[invoice.id] = dueDate;

          return api.invoices.update(invoice.id, { due_date: dueDate });
        }),
      );

      setInvoiceDrafts((previousDrafts) => {
        const nextDrafts = { ...previousDrafts };

        invoiceRows.forEach((invoice) => {
          const previousDraft = previousDrafts[invoice.id] ?? {};
          const baseAmount =
            previousDraft.amount ??
            (Number.isFinite(Number(invoice.amount))
              ? String(Math.max(0, Math.round(Number(invoice.amount))))
              : "0");

          nextDrafts[invoice.id] = {
            invoiceNumber: String(previousDraft.invoiceNumber ?? ""),
            dueDate: dueDateByInvoiceId[invoice.id] ?? "",
            amount: String(baseAmount),
          };
        });

        return nextDrafts;
      });

      setInvoiceFeedback(
        "Set date global berhasil diterapkan ke semua invoice.",
      );
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menerapkan set date global.",
      );
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleAddTenantRenewalSplit = async (row) => {
    if (!row?.contractId || !row?.versionId) {
      setError(
        "Versi kontrak tenant belum tersedia untuk split tindak lanjut.",
      );
      return;
    }

    setError("");
    try {
      await api.contractVersionRenewalFollowUps.create(row.versionId);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menambah split tindak lanjut tenant.",
      );
    }
  };

  const handleUploadTenantRenewal = async (row, file, followUpId = null) => {
    if (!file || !row?.contractId || !row?.versionId) {
      return;
    }

    setError("");
    try {
      const renewalFileUrl = await uploadFileForRecord(file, ["customers", customer.id, "renewals"]);
      if (followUpId) {
        await api.contractVersionRenewalFollowUps.update(followUpId, {
          renewal_file_url: renewalFileUrl,
          renewal_file_name: file.name,
        });
      } else {
        const followUp = await api.contractVersionRenewalFollowUps.create(row.versionId);
        await api.contractVersionRenewalFollowUps.update(followUp.id, {
          renewal_file_url: renewalFileUrl,
          renewal_file_name: file.name,
        });
      }
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengunggah berkas perpanjangan tenant.",
      );
    }
  };

  const handleRespondTenantRenewal = async (
    row,
    decision,
    file,
    followUpId = null,
  ) => {
    if (!file || !row?.contractId || !row?.versionId) {
      return;
    }

    setError("");
    try {
      const responseFileUrl = await uploadFileForRecord(file, ["customers", customer.id, "renewal-responses"]);
      if (followUpId) {
        await api.contractVersionRenewalFollowUps.update(followUpId, {
          response_file_url: responseFileUrl,
          response_file_name: file.name,
          response_status: decision,
        });
      } else {
        const followUp = await api.contractVersionRenewalFollowUps.create(row.versionId);
        await api.contractVersionRenewalFollowUps.update(followUp.id, {
          response_file_url: responseFileUrl,
          response_file_name: file.name,
          response_status: decision,
        });
      }
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengunggah tanggapan tenant.",
      );
    }
  };

  const hasInitialTenantRenewalUpload = (row) => {
    const followUps = Array.isArray(row?.renewalFollowUps)
      ? row.renewalFollowUps
      : [];
    return followUps.some((followUp) =>
      isOpenableFileUrl(followUp?.renewalFileUrl),
    );
  };

  const renderTenantRenewalFollowUps = (row, columnType) => {
    const followUps = Array.isArray(row?.renewalFollowUps)
      ? row.renewalFollowUps
      : [];

    if (followUps.length === 0) {
      if (columnType === "renewal") {
        return (
          <label className="relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all cursor-pointer backdrop-blur-md">
            <span className="material-symbols-outlined text-[13px]">upload_file</span>
            Upload
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => void handleUploadTenantRenewal(row, e.target.files?.[0] ?? null)} />
          </label>
        );
      }
      return <span className="text-[10px] font-black text-white/20">—</span>;
    }

    return (
      <div className="flex flex-col gap-2">
        {followUps.map((followUp) => {
          const hasRenewalFile = isOpenableFileUrl(followUp?.renewalFileUrl);
          const hasResponseFile = isOpenableFileUrl(followUp?.responseFileUrl);
          return (
            <div key={followUp.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-gold-accent/60">Split {followUp.splitOrder}</span>
                <span className="text-[8px] font-bold text-white/20 uppercase">{followUp.source === "auto" ? "Auto" : followUp.source === "manual" ? "Manual" : "Upload"}</span>
              </div>
              {columnType === "renewal" ? (
                hasRenewalFile ? (
                  <a href={followUp.renewalFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[8px] font-black text-gold-accent uppercase tracking-widest hover:underline underline-offset-2">
                    <span className="material-symbols-outlined text-[11px]">open_in_new</span>Lihat
                  </a>
                ) : (
                  <label className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all cursor-pointer backdrop-blur-md">
                    <span className="material-symbols-outlined text-[11px]">upload_file</span>Upload
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => void handleUploadTenantRenewal(row, e.target.files?.[0] ?? null, followUp.id)} />
                  </label>
                )
              ) : (
                hasResponseFile ? (
                  <a href={followUp.responseFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest hover:underline underline-offset-2">
                    <span className="material-symbols-outlined text-[11px]">open_in_new</span>Tanggapan
                  </a>
                ) : hasRenewalFile ? (
                  <div className="flex items-center gap-1.5">
                    <label className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-[#0f141e] transition-all cursor-pointer backdrop-blur-md">
                      Lanjut<input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => void handleRespondTenantRenewal(row, "lanjut", e.target.files?.[0] ?? null, followUp.id)} />
                    </label>
                    <label className="relative inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all cursor-pointer backdrop-blur-md">
                      Tidak<input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => void handleRespondTenantRenewal(row, "tidak", e.target.files?.[0] ?? null, followUp.id)} />
                    </label>
                  </div>
                ) : (
                  <span className="text-[8px] font-bold text-white/20">Menunggu upload</span>
                )
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isPlannerJalurView) {
    return (
      <AppShell
        activeSection="customers"
        onNavigate={onNavigate}
        onLogout={onLogout}
        hideSidebar={true}
        full={true}
      >
        <div className="relative h-dvh w-full overflow-hidden bg-slate-950 font-manrope antialiased">
          {/* Combined Top Overlay UI - Optimized for Mobile */}
          <div className="absolute inset-x-0 top-0 z-[1000] flex items-start justify-center pointer-events-none pt-4 md:pt-6 pb-4 md:pb-6 pl-4 sm:pl-[332px] lg:pl-[362px] xl:pl-[392px] pr-[120px] sm:pr-[160px]">
            {/* Back Button - Positioned to the right */}
            <div className="absolute right-4 top-4 md:right-6 md:top-6">
              <button
                className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-2xl glass-card backdrop-blur-xl border border-white/10 px-4 font-black text-white shadow-glass-depth transition-all hover:border-gold-accent hover:text-gold-accent hover:scale-105 active:scale-95 md:h-12 md:px-5"
                onClick={onBack}
                type="button"
              >
                <span className="hidden sm:block text-[10px] uppercase tracking-widest md:text-sm">Kembali</span>
                <span className="material-symbols-outlined text-lg md:text-xl">
                  arrow_back
                </span>
              </button>
            </div>

            {/* Header Info Panel - Centered and more compact */}
            <header className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-2xl bg-slate-900/80 px-4 py-2 shadow-2xl backdrop-blur-md border border-white/10 md:p-4 min-w-0 max-w-[calc(100vw-180px)] sm:max-w-[280px] md:max-w-[260px] lg:max-w-[420px] xl:max-w-[560px] 2xl:max-w-none">
              <h1 className="text-[10px] md:text-sm font-black text-white uppercase tracking-[0.1em] md:tracking-[0.2em] truncate max-w-full text-center">
                {tenantName}
              </h1>
              <div className="flex items-center gap-1.5 md:gap-3 text-[8px] md:text-[10px] font-bold text-white/60 max-w-full">
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary border border-primary/30 uppercase tracking-tighter shrink-0">
                  {(detail?.paket || customer?.paket || "CORE")}
                </span>
                <span className="hidden md:block w-1 h-1 rounded-full bg-white/20 backdrop-blur-md shrink-0"></span>
                <span className="uppercase tracking-widest hidden md:block truncate">
                  ISP: {isps.length > 0 ? isps.map((item) => item.name).join(", ") : "-"}
                </span>
              </div>
            </header>
          </div>

          {/* Map Container */}
          <div className="h-full w-full">
            <FoRoutePlanner
              disabled={routeBusy}
              initialControlPoints={previewRoutePoints}
              initialRouteMeta={activeRoutePlannerMeta}
              onApplyPlannedRoute={(plannedPoints, plannerMeta) => {
                handleApplyPlannedRoute(plannedPoints, plannerMeta);
                window.setTimeout(() => onBack?.(), 800);
              }}
              mode="full"
              providerIconUrl={isps[0]?.logoUrl || ""}
              customerIconUrl={detail?.logo_url || ""}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      activeSection="customers"
      onNavigate={onNavigate}
      onLogout={onLogout}
      hideSidebar={hideSidebar}
      currentRole={currentRole}
    >
           <div className="flex flex-col gap-2">
            {/* Top Bar: Back & Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-gold-accent transition-all group"
                        onClick={onBack}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-[10px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        {backLabel}
                    </button>
                </div>

                {!isTeknisi && (
                    <div className="flex items-center gap-2">
                        {!isPlannerJalurView && onOpenRoutePlanner && (
                            <button
                                className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                onClick={() => onOpenRoutePlanner?.(detail ?? customer)}
                                title="Buka planner jalur FO"
                                type="button"
                            >
                                <span className="material-symbols-outlined text-[10px]">route</span>
                                Atur Jalur FO
                            </button>
                        )}
                        <button
                            className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-sm group text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                            onClick={() => void Promise.all([loadDetail(), onRefreshAll?.()])}
                            title="Refresh Data"
                        >
                            <span className="material-symbols-outlined text-[10px] group-hover:rotate-180 transition-transform duration-500">sync</span>
                            Refresh
                        </button>
                        {canEditTenant && (
                            <button
                                className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest"
                                onClick={() => onEditTenant?.(detail ?? customer)}
                                title="Edit Tenant"
                            >
                                <span className="material-symbols-outlined text-[10px]">edit_note</span>
                                Edit Lokasi
                            </button>
                        )}
                        {canDeleteTenant && (
                            <button
                                className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest"
                                onClick={handleOpenDeleteModal}
                                title="Hapus Tenant"
                            >
                                <span className="material-symbols-outlined text-[10px]">delete_forever</span>
                                Hapus Lokasi
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── ISP POPUP STATE ─────────────────────────────────────── */}
            {ispPopupOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={() => setIspPopupOpen(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-[#0a0f18]/80 backdrop-blur-md" />

                    {/* Modal */}
                    <div
                        className="relative z-10 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1220]/95 shadow-2xl backdrop-blur-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Top accent */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-accent/40 to-transparent" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-accent/20 bg-gold-accent/10 text-gold-accent backdrop-blur-md">
                                    <span className="material-symbols-outlined text-lg">corporate_fare</span>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">Penyedia Layanan</p>
                                    <p className="text-sm font-black text-white uppercase tracking-tight">Akun ISP Terhubung</p>
                                </div>
                            </div>
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white backdrop-blur-md"
                                onClick={() => setIspPopupOpen(false)}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="h-px bg-white/[0.05]" />

                        {/* ISP List */}
                        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3 no-scrollbar">
                            {isps.length > 0 ? isps.map((ispItem) => (
                                <div
                                    key={ispItem.id}
                                    className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-gold-accent/20 hover:bg-white/[0.04]"
                                >
                                    <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gold-accent/[0.03] blur-2xl transition-all group-hover:bg-gold-accent/[0.06]" />
                                    <div className="relative flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {ispItem.logoUrl ? (
                                                <img
                                                    src={ispItem.logoUrl}
                                                    alt={ispItem.name}
                                                    className="h-10 w-10 rounded-xl object-cover border border-white/10 bg-white/5 shrink-0 backdrop-blur-md"
                                                />
                                            ) : (
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/30 backdrop-blur-md">
                                                    <span className="material-symbols-outlined text-xl">business</span>
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-white uppercase tracking-wide truncate">{ispItem.name}</p>
                                                {ispItem.contractReference && (
                                                    <p className="text-[9px] font-bold text-gold-accent/60 tracking-widest mt-0.5">
                                                        Ref: {ispItem.contractReference}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gold-accent/20 bg-gold-accent/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gold-accent transition-all hover:bg-gold-accent hover:text-[#0f141e] backdrop-blur-md"
                                            onClick={() => { setIspPopupOpen(false); onNavigate?.("isp-detail", ispItem); }}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                            Lihat
                                        </button>
                                    </div>
                                    {/* Meta row */}
                                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pl-[52px]">
                                        {ispItem.status && (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`h-1.5 w-1.5 rounded-full ${ispItem.status === "aktif" ? "bg-emerald-400" : "bg-white/20"}`} />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30">{ispItem.status}</span>
                                            </div>
                                        )}
                                        {ispItem.contractPeriodEnd && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[10px] text-white/20">event</span>
                                                <span className="text-[8px] font-bold text-white/30">s/d {formatDate(ispItem.contractPeriodEnd)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center gap-3 py-10 text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                                        <span className="material-symbols-outlined text-3xl text-white/20">corporate_fare</span>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Belum ada ISP terhubung</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="h-px bg-white/[0.05]" />
                        <div className="px-6 py-4">
                            <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest text-center">
                                {isps.length} ISP terhubung ke lokasi ini
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PROFILE CARD ─────────────────────────────────────────── */}
            {(() => {
                const rawStatus = (detail?.status ?? customer?.status ?? "aktif").toLowerCase();
                // Contract status
                let cLabel = "Beroperasi";
                let cIcon  = "check_circle";
                let cBg    = "bg-emerald-500/10";
                let cBorder = "border-emerald-500/20";
                let cText  = "text-emerald-400";
                let cDot   = "bg-emerald-400 shadow-emerald-glow";
                let cAnim  = "animate-pulse";
                if (rawStatus === "expired") {
                    cLabel = "Belum Diperpanjang";
                    cIcon  = "warning";
                    cBg    = "bg-[#ff2400]/10";
                    cBorder = "border-[#ff2400]/20";
                    cText  = "text-[#ff2400]";
                    cDot   = "bg-[#ff2400] shadow-[0_0_10px_rgba(255,36,0,0.5)]";
                } else if (rawStatus === "berhenti") {
                    cLabel = "Berhenti";
                    cIcon  = "cancel";
                    cBg    = "bg-white/5";
                    cBorder = "border-white/10";
                    cText  = "text-white/30";
                    cDot   = "bg-white/20";
                    cAnim  = "";
                }

                // Route status
                const rawR = rawStatus === "berhenti" || rawStatus === "nonaktif" ? "nonaktif" : activeRouteStatus.toLowerCase();
                let rLabel = "Jalur Aktif";
                let rIcon  = "cable";
                let rBg    = "bg-emerald-500/10";
                let rBorder = "border-emerald-500/20";
                let rText  = "text-emerald-400";
                let rDot   = "bg-emerald-400 shadow-emerald-glow";
                let rAnim  = "animate-pulse";
                if (rawR === "nonaktif") {
                    rLabel = "Jalur Nonaktif";
                    rIcon  = "cable";
                    rBg    = "bg-white/5";
                    rBorder = "border-white/10";
                    rText  = "text-white/30";
                    rDot   = "bg-white/20";
                    rAnim  = "";
                } else if (rawR === "gangguan") {
                    rLabel = "Jalur Gangguan";
                    rIcon  = "report";
                    rBg    = "bg-[#ff2400]/10";
                    rBorder = "border-[#ff2400]/20";
                    rText  = "text-[#ff2400]";
                    rDot   = "bg-[#ff2400] shadow-[0_0_10px_rgba(255,36,0,0.5)]";
                } else if (rawR === "sedang perbaikan") {
                    rLabel = "Sedang Perbaikan";
                    rIcon  = "construction";
                    rBg    = "bg-amber-500/10";
                    rBorder = "border-amber-500/20";
                    rText  = "text-amber-400";
                    rDot   = "bg-amber-400 shadow-amber-glow";
                }

                const paketVal      = packageInfo.paket === "sharing_core" ? "SHARING CORE" : "CORE";
                const jumlahVal     = packageInfo.jumlah ?? "—";
                const alamatVal     = detail?.alamat || customer?.alamat || null;
                const periodStart   = contractPeriodInfo.contractPeriodStart;
                const periodEnd     = contractPeriodInfo.contractPeriodEnd;

                return (
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shadow-glass-depth">
                        {/* Ambient glow */}
                        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gold-accent/[0.04] blur-[100px]" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500/[0.03] blur-[80px]" />

                        {/* Top accent line */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-accent/30 to-transparent" />

                        <div className="relative p-4 md:p-5 space-y-4">

                            {/* ── Row 1: Identity + Status ── */}
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                {/* Left: icon + label + name + ISP info */}
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2.5 pb-1">
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">Lokasi Operasional</p>
                                        </div>
                                    </div>
                                    <h1 className="text-lg md:text-xl font-black tracking-tight text-white uppercase leading-tight">
                                        {tenantName}
                                    </h1>
                                    <p className="text-[11px] font-black text-white/40 tracking-widest uppercase">
                                        {formatDisplayContractNumber(versions?.[0]?.contractNumber ?? versions?.[0]?.contract_number ?? contract?.contractNumber ?? contract?.contract_number)}
                                    </p>
                                    {/* ISP info row */}
                                    <div className="flex items-center gap-3 pt-4">
                                        <span className="material-symbols-outlined text-[15px] text-gold-accent/50">corporate_fare</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                                            {isps.length > 0 ? isps.map((i) => i.name).join(", ") : "Provider Mandiri"}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: status pills */}
                                <div className="flex shrink-0 flex-wrap items-start gap-2">
                                    {/* Contract status pill */}
                                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 ${cBg} ${cBorder}`}>
                                        <span className={`material-symbols-outlined text-[12px] ${cText}`}>{cIcon}</span>
                                        <div>
                                            <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20">Kontrak</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${cText}`}>{cLabel}</p>
                                        </div>
                                        <span className={`h-1.5 w-1.5 rounded-full ${cDot} ${cAnim}`} />
                                    </div>

                                    {/* Route status pill */}
                                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 ${rBg} ${rBorder}`}>
                                        <span className={`material-symbols-outlined text-[12px] ${rText}`}>{rIcon}</span>
                                        <div>
                                            <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20">Jalur FO</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${rText}`}>{rLabel}</p>
                                        </div>
                                        <span className={`h-1.5 w-1.5 rounded-full ${rDot} ${rAnim}`} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Divider ── */}
                            <div className="h-px bg-white/[0.05]" />

                            {/* ── Row 2: Metadata grid ── */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-4">
                                {/* Paket */}
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Paket</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[12px] text-gold-accent/60">package_2</span>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wide">{paketVal}</p>
                                    </div>
                                </div>

                                {/* Jumlah */}
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Jumlah</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[12px] text-blue-400/60">speed</span>
                                        <p className="text-[11px] font-black text-white uppercase tracking-wide">{jumlahVal}</p>
                                    </div>
                                </div>

                                {/* Periode Awal Kontrak */}
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Periode Awal Kontrak</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[12px] text-emerald-400/60">event_available</span>
                                        <p className="text-[11px] font-black text-white tracking-wide">
                                            {contractPeriodInfo.contractStartDate ? formatDate(contractPeriodInfo.contractStartDate) : "—"}
                                        </p>
                                    </div>
                                </div>

                                {/* Periode Berjalan */}
                                <div className="space-y-1.5">
                                    <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Periode Berjalan</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[12px] text-sky-400/60">date_range</span>
                                        <p className="text-[11px] font-black text-white tracking-wide">
                                            {periodStart || periodEnd
                                                ? <>{periodStart ? formatDate(periodStart) : "—"}<span className="mx-1.5 text-white/20 font-normal">—</span>{periodEnd ? formatDate(periodEnd) : "—"}</>
                                                : "—"
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Row 3: Alamat (full width, only if exists) ── */}
                            {alamatVal && (
                                <div className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-[15px] text-gold-accent/40">pin_drop</span>
                                    <div>
                                        <p className="mb-0.5 text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Alamat Fisik</p>
                                        <p className="text-[11px] font-medium leading-relaxed text-white/50">{alamatVal}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom accent line */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
                    </div>
                );
            })()}

            {error && (
                <div className="rounded-2xl border border-[#ff2400]/20 bg-[#ff2400]/5 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#ff2400] animate-in fade-in slide-in-from-top-4">
                    {error}
                </div>
            )}

            {/* 2. TABS NAVIGATION */}
            <section className="glass-card backdrop-blur-xl rounded-2xl p-1 border-white/10 shadow-glass-depth relative overflow-hidden">
                <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
                <nav className="relative flex flex-wrap gap-1">
                    {[
                        { id: "overview", label: "Ringkasan", icon: "dashboard" },
                        { id: "contracts", label: "Kontrak", icon: "description" },
                        { id: "documents", label: "Dokumen", icon: "inventory_2" },
                        { id: "invoices", label: "Invoice & Penagihan", icon: "receipt_long" },
                        { id: "timeline", label: "Timeline", icon: "history" },
                        { id: "jalur", label: "Peta Jalur FO", icon: "map" },
                    ]
                    // If teknisi, hide some tabs
                    .filter(tab => !(isTeknisi && (tab.id === "documents" || tab.id === "invoices" || tab.id === "timeline")))
                    .map((tab) => (
                        <button
                            key={tab.id}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black tracking-[0.1em] transition-all duration-500 relative overflow-hidden ${activeTab === tab.id ? "text-white bg-gold-accent shadow-gold-glow" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                            onClick={() => setActiveTab(tab.id)}
                            type="button"
                        >
                            <span className={`material-symbols-outlined relative z-10 ${activeTab === tab.id ? "scale-110 text-white" : ""}`} style={{ fontSize: "18px" }}>{tab.icon}</span>
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </section>

        {activeTab === "overview" && (
            <div className="space-y-6">
                {/* ── Row 1: Stats strip ─────────────────────────────────── */}
                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {/* Invoice Bulanan */}
                    <div className="glass-card backdrop-blur-xl rounded-2xl p-3 border-white/10 shadow-glass-depth group relative overflow-hidden">
                        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gold-accent/5 blur-2xl group-hover:bg-gold-accent/10 transition-all duration-700 backdrop-blur-md" />
                        <p className="mb-3 text-[8px] font-black uppercase tracking-[0.3em] text-white/30">Invoice Bulanan</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white tracking-tighter">{invoiceRows.length}</span>
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Total</span>
                        </div>
                        <div className="mt-4 space-y-1.5">
                            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-emerald-400">Selesai</span>
                                <span className="text-white">{paidInvoiceCount}</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden backdrop-blur-md">
                                <div
                                    className="h-full bg-emerald-400 shadow-emerald-glow transition-all duration-1000"
                                    style={{ width: `${(paidInvoiceCount / (invoiceRows.length || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Butuh Perhatian */}
                    <div className="glass-card backdrop-blur-xl rounded-2xl p-3 border-white/10 shadow-glass-depth relative overflow-hidden">
                        <p className="mb-3 text-[8px] font-black uppercase tracking-[0.3em] text-white/30">Butuh Perhatian</p>
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${totalActionItems > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-white/5 text-white/20'}`}>
                                <span className="material-symbols-outlined text-xl">{totalActionItems > 0 ? 'warning' : 'check_circle'}</span>
                            </div>
                            <div>
                                <span className="text-3xl font-black text-white">{totalActionItems}</span>
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-0.5">Item Pending</p>
                            </div>
                        </div>
                    </div>

                    {/* Fee Aktivasi */}
                    <div className="glass-card backdrop-blur-xl rounded-2xl p-3 border-white/10 shadow-glass-depth">
                        <p className="mb-3 text-[8px] font-black uppercase tracking-[0.3em] text-white/30">Fee Aktivasi</p>
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${detail?.activationFeePaidAt ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#ff2400]/20 text-[#ff2400]'}`}>
                                <span className="material-symbols-outlined text-xl">{detail?.activationFeePaidAt ? 'verified' : 'pending'}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">{detail?.activationFeePaidAt ? "Lunas" : "Belum Lunas"}</span>
                                {detail?.activationFeePaidAt
                                    ? <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{formatDate(detail.activationFeePaidAt)}</p>
                                    : <p className="text-[10px] font-black text-[#ff2400]/70 mt-0.5">{formatCurrency(detail?.activationFeeAmount ?? customer?.activationFeeAmount)}</p>
                                }
                            </div>
                        </div>
                    </div>

                    {/* Periode Tagihan */}
                    <div className="glass-card backdrop-blur-xl rounded-2xl p-3 border-white/10 shadow-glass-depth">
                        <p className="mb-3 text-[8px] font-black uppercase tracking-[0.3em] text-white/30">Periode Tagihan</p>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400 backdrop-blur-md">
                                <span className="material-symbols-outlined text-xl">calendar_today</span>
                            </div>
                            <div>
                                <span className="text-sm font-black text-white">Setiap {billingEvery} {billingUnitLabel}</span>
                                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Auto-generate H-7</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
                    {/* Status Kelengkapan Berkas */}
                    <div className="glass-card backdrop-blur-xl rounded-premium p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-10 w-10 rounded-xl bg-gold-accent/10 border border-gold-accent/20 flex items-center justify-center text-gold-accent backdrop-blur-md">
                                <span className="material-symbols-outlined text-xl">fact_check</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white tracking-tight uppercase">Kelengkapan Berkas</h2>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">Kepatuhan administrasi sistem</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {(displayPriorityTodos.length > 0 || displayNeedActionTodos.length > 0) ? (
                                <>
                                    {displayPriorityTodos.length > 0 && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px flex-1 bg-gradient-to-r from-red-500/40 to-transparent" />
                                                <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Prioritas Tinggi</span>
                                            </div>
                                            {displayPriorityTodos.map((item) => (
                                                <div key={item.id} className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 group/item hover:bg-red-500/10 transition-all backdrop-blur-md">
                                                    <div className="flex gap-4">
                                                        <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-black text-white group-hover/item:text-red-400 transition-colors">{item.title}</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white/30 leading-relaxed">{item.message}</p>
                                                            {item.dueDate && (
                                                                <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase text-red-400/60">
                                                                    <span className="material-symbols-outlined text-[14px]">event_busy</span>
                                                                    Tenggat: {formatDate(item.dueDate)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {displayNeedActionTodos.length > 0 && (
                                        <div className="space-y-4 mt-8">
                                            <div className="flex items-center gap-3">
                                                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
                                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Perlu Tindakan</span>
                                            </div>
                                            {displayNeedActionTodos.map((item) => (
                                                <div key={item.id} className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 group/item hover:bg-amber-500/10 transition-all">
                                                    <div className="flex gap-4">
                                                        <span className="material-symbols-outlined text-amber-400 mt-0.5">warning</span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-black text-white group-hover/item:text-amber-400 transition-colors">{item.title}</p>
                                                            <p className="mt-1 text-[11px] font-bold text-white/30 leading-relaxed">{item.message}</p>
                                                            {item.code === "contract_number_missing_local" && (
                                                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                                                    <div className="relative group/input flex-1 min-w-[200px]">
                                                                        <input
                                                                            className="w-full h-10 px-4 rounded-xl bg-black/40 border border-white/5 text-xs text-white focus:border-amber-500/50 focus:outline-none transition-all placeholder:text-white/10"
                                                                            onChange={(event) => setContractNumberInputs((previous) => ({ ...previous, overview: event.target.value }))}
                                                                            placeholder="Nomor kontrak..."
                                                                            type="text"
                                                                            value={contractNumberInputs.overview ?? ""}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        className="h-10 px-4 rounded-xl bg-amber-500 text-[#0f141e] text-[10px] font-black uppercase tracking-widest shadow-gold-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                                                        disabled={isSavingContractNumber}
                                                                        onClick={() => void handleSaveContractNumber({ id: "overview", contractId: contract?.id })}
                                                                    >
                                                                        {isSavingContractNumber ? "Saving..." : "Simpan"}
                                                                    </button>
                                                                    <button
                                                                        className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all backdrop-blur-md"
                                                                        disabled={!primaryContractRowMarkerId || isSavingContractNumber}
                                                                        onClick={() => primaryContractRowMarkerId && toggleContractNumberEmptyMark(primaryContractRowMarkerId)}
                                                                    >
                                                                        Tandai Kosong
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 backdrop-blur-md">
                                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 backdrop-blur-md">
                                        <span className="material-symbols-outlined">verified</span>
                                    </div>
                                    <p className="text-sm font-black text-emerald-400 uppercase tracking-tight leading-tight">Seluruh berkas lengkap & terverifikasi</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Kanan: Biaya Aktivasi + Jejak Aktivitas */}
                    <div className="space-y-6">
                        {/* Biaya Aktivasi */}
                        <div className="glass-card backdrop-blur-xl rounded-2xl p-6 border-white/10 shadow-glass-depth">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-9 w-9 rounded-xl bg-gold-accent/10 border border-gold-accent/20 flex items-center justify-center text-gold-accent shrink-0 backdrop-blur-md">
                                    <span className="material-symbols-outlined text-lg">payments</span>
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-white tracking-tight uppercase">Biaya Aktivasi</h2>
                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">Administrasi penyambungan awal</p>
                                </div>
                            </div>
                            {activationFeePaidAt ? (
                                <div className="space-y-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4 backdrop-blur-md">
                                    <div className="flex items-center gap-4">
                                        <span className="material-symbols-outlined text-emerald-400 text-2xl shrink-0">verified_user</span>
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Status: Selesai</p>
                                            <p className="text-[10px] font-bold text-white/40 mt-0.5">Dibayar pada {formatDate(activationFeePaidAt)}</p>
                                        </div>
                                    </div>
                                    {canEditTenant && (
                                        <button
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-rose-300 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-50"
                                            disabled={isMarkingActivationFeePaid}
                                            onClick={() => void handleRevertActivationFeePaid()}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-sm">undo</span>
                                            {isMarkingActivationFeePaid ? "Menyimpan..." : "Batalkan Lunas"}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
                                    <div className="flex items-center gap-4">
                                        <span className="material-symbols-outlined text-amber-400 text-2xl shrink-0">pending_actions</span>
                                        <div>
                                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">Menunggu Pembayaran</p>
                                            <p className="text-lg font-black text-white tracking-tighter mt-0.5">
                                                {formatCurrency(activationFeeAmount)}
                                            </p>
                                        </div>
                                    </div>
                                    {canEditTenant && (
                                        <button
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-[10px] font-black uppercase tracking-widest text-[#0f141e] shadow-emerald-glow transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                            disabled={isMarkingActivationFeePaid}
                                            onClick={() => void handleMarkActivationFeePaid()}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-sm">price_check</span>
                                            {isMarkingActivationFeePaid ? "Menyimpan..." : "Tandai Sudah Dibayar"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Jejak Aktivitas */}
                        <div className="glass-card backdrop-blur-xl rounded-2xl p-6 border-white/10 shadow-glass-depth">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 backdrop-blur-md">
                                    <span className="material-symbols-outlined text-lg">history</span>
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-white tracking-tight uppercase">Jejak Aktivitas</h2>
                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">Riwayat operasional terakhir</p>
                                </div>
                            </div>
                            {displayTimeline.length > 0 ? (
                                <div className="relative pl-4 space-y-0">
                                    <div className="absolute left-[7px] top-1 bottom-4 w-px bg-white/5 backdrop-blur-md" />
                                    {displayTimeline.slice(0, 6).map((event, idx) => (
                                        <div key={event.id} className="flex gap-4 group/item relative pb-5 last:pb-0">
                                            <div className="shrink-0 pt-1">
                                                <div className={`w-3 h-3 rounded-full border-2 border-[#0f141e] transition-all duration-300 group-hover/item:scale-125 ${idx === 0 ? 'bg-emerald-400 shadow-emerald-glow' : 'bg-white/10'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">{formatDate(event.date)}</p>
                                                <h4 className="text-[11px] font-black text-white uppercase tracking-tight mt-0.5 group-hover/item:text-emerald-400 transition-colors">{event.title}</h4>
                                                <p className="text-[10px] font-medium text-white/30 leading-relaxed mt-0.5 line-clamp-2">{event.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center border border-dashed border-white/5 rounded-xl">
                                    <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest">Belum ada aktivitas tercatat</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        )}

        {activeTab === "jalur" && (
            <div className="space-y-10">
                <FoRoutePlanner
                    mode="preview"
                    onPreviewClick={() => onOpenRoutePlanner?.(detail ?? customer)}
                    previewGeometryCoordinates={previewGeometryCoordinates}
                    previewRoads={previewRoads}
                    previewPoints={previewRoutePoints}
                    providerIconUrl={isps[0]?.logoUrl || ""}
                    customerIconUrl={detail?.logo_url || ""}
                />

                {/* Header & Mode Selector */}
                <section className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/10 shadow-glass-depth">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="space-y-2">
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Manajemen Jalur Lintasan</h2>
                            <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Konfigurasi infrastruktur fiber optik tenant</p>
                        </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {!isRouteDrafting ? (
                                        <>
                                            {!isPlannerJalurView && (
                                                <button
                                                    className="h-12 px-6 flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm text-[10px] font-black uppercase tracking-widest group backdrop-blur-md"
                                                    onClick={() => onOpenRoutePlanner?.(detail ?? customer)}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-lg group-hover:rotate-12 transition-transform">route</span>
                                                    Buka Planner Jalur
                                                </button>
                                            )}

                                            <button
                                                className="h-12 px-6 flex items-center gap-3 rounded-xl bg-gold-accent/10 border border-gold-accent/20 text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition-all shadow-sm text-[10px] font-black uppercase tracking-widest backdrop-blur-md"
                                                onClick={startDraftingSession}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-lg">alt_route</span>
                                                Atur Struktur Jalur
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4">
                                            <div className="flex flex-col items-end mr-4">
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-accent animate-pulse">Sesi Penyuntingan Draft</span>
                                                <span className="text-[8px] font-bold text-white/20 uppercase">Jalur lama tetap aktif hingga disimpan</span>
                                            </div>
                                            <button
                                                className="h-12 px-6 rounded-xl border border-white/10 bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all backdrop-blur-md"
                                                onClick={cancelDraftingSession}
                                                type="button"
                                            >
                                                Batalkan
                                            </button>
                                            <button
                                                className="h-12 px-8 rounded-xl bg-emerald-500 text-[#0f141e] text-[10px] font-black uppercase tracking-widest shadow-emerald-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                                onClick={() => void handleCommitDraft()}
                                                disabled={routeBusy}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-lg mr-2">verified</span>
                                                {routeBusy ? "Menyimpan..." : "Aktifkan Jalur Baru"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

              {isRouteDrafting && (
                <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50/80 p-5 animate-in zoom-in-95 duration-300 shadow-inner">
                  <div className="flex items-center gap-3 text-amber-900 border-b border-amber-200 pb-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-700">
                      <span className="material-symbols-outlined">
                        edit_square
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-black">
                        Mode Penyuntingan Struktur Jalur
                      </p>
                      <p className="text-xs text-amber-700 font-medium italic">
                        Menyimpan akan membuat riwayat (versi) baru dan secara
                        otomatis mengaktifkan struktur ini sebagai jalur utama
                        tenant.
                      </p>
                    </div>
                  </div>

                  <div className="ml-0 max-w-2xl">
                    <label className="mb-1.5 block text-[11px] font-black uppercase tracking-widest text-amber-800">
                      Alasan Perubahan / Catatan Riwayat (Wajib)
                    </label>
                    <div className="flex gap-2">
                      <span className="material-symbols-outlined text-amber-400 mt-1.5">
                        draw
                      </span>
                      <input
                        className="w-full rounded-xl border-2 border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-amber-900 focus:border-amber-500 focus:outline-none shadow-sm transition-all placeholder:text-amber-300"
                        onChange={(event) =>
                          setRouteChangeNote(event.target.value)
                        }
                        placeholder="Contoh: Penyesuaian jalur akibat pembangunan jalan baru atau upgrade kabel..."
                        type="text"
                        value={routeChangeNote}
                      />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-8">
              <div className="space-y-8">
                {(routeError || routeFeedback) && (
                  <div
                    className={`rounded-lg border px-4 py-3 text-sm font-semibold animate-in slide-in-from-top-2 duration-300 shadow-sm ${routeError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                  >
                    {routeError || routeFeedback}
                  </div>
                )}


                                <div className="mt-8 space-y-8">
                                    <div className="glass-card backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-glass-depth">
                                        <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gold-accent">list_alt</span>
                                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Lineage Titik Jalur</h3>
                                            </div>
                                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest backdrop-blur-md">
                                                { (isRouteDrafting ? draftRoutePoints : routePoints).length } Titik
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-white/[0.01] border-b border-white/5">
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">#</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Identitas Titik</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Klasifikasi</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Catatan / Metadata</th>
                                                        <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30 text-right">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {(isRouteDrafting ? draftRoutePoints : routePoints).map((point) => (
                                                        <tr key={point.id} className="hover:bg-white/[0.02] transition-colors group/row">
                                                            <td className="px-8 py-5 text-xs font-black text-white/20 group-hover/row:text-gold-accent transition-colors">{point.orderNumber}</td>
                                                            <td className="px-8 py-5">
                                                                <p className="text-sm font-black text-white uppercase tracking-tight">{point.pathName}</p>
                                                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">ID: {point.id}</p>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                                                                    point.pointType === "awal" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                                                    point.pointType === "tujuan" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                                                    "bg-white/5 border-white/10 text-white/40"
                                                                }`}>
                                                                    <span className="material-symbols-outlined text-sm">{routePointTypeMeta[point.pointType]?.icon}</span>
                                                                    {routePointTypeLabelMap[point.pointType]}
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <p className="text-xs font-bold text-white/30 italic group-hover/row:text-white/60 transition-colors">
                                                                    {splitRoutePointNote(point.note).displayNote || "—"}
                                                                </p>
                                                            </td>
                                                            <td className="px-8 py-5 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 backdrop-blur-md"
                                                                        disabled={routeBusy || point.pointType !== "transit"}
                                                                        onClick={() => handleMoveRoutePoint(point.id, "up")}
                                                                    >
                                                                        <span className="material-symbols-outlined text-base">expand_less</span>
                                                                    </button>
                                                                    <button
                                                                        className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 backdrop-blur-md"
                                                                        disabled={routeBusy || point.pointType !== "transit"}
                                                                        onClick={() => handleMoveRoutePoint(point.id, "down")}
                                                                    >
                                                                        <span className="material-symbols-outlined text-base">expand_more</span>
                                                                    </button>
                                                                    <button
                                                                        className="w-8 h-8 rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all disabled:opacity-20"
                                                                        disabled={routeBusy || point.pointType !== "transit"}
                                                                        onClick={() => void handleDeleteRoutePoint(point.id)}
                                                                    >
                                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                        {/* Daftar Ruas Jalan */}
                        {displayNamedRoads.length > 0 && (
                            <section className="glass-card backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-glass-depth mt-8">
                                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-blue-400">alt_route</span>
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Topologi Ruas Jalan {isRouteDrafting ? "(DRAFT)" : "Aktif"}</h3>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest backdrop-blur-md">
                                        {displayNamedRoads.length} Ruas Terdeteksi
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white/[0.01] border-b border-white/5">
                                                <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">#</th>
                                                <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Nama Ruas Jalan</th>
                                                <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Panduan Lintasan</th>
                                                <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/30 text-right">Jarak</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {displayNamedRoads.map((road, index) => (
                                                <tr key={road?.id ?? `display-road-${index}`} className="hover:bg-white/[0.02] transition-colors group/row">
                                                    <td className="px-8 py-4 text-xs font-black text-white/20">{index + 1}</td>
                                                    <td className="px-8 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                                                            <span className="text-sm font-black text-white uppercase tracking-tight">{road.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-4 text-xs font-bold text-white/30 italic group-hover/row:text-white/60 transition-colors">
                                                        {road?.instruction || "—"}
                                                    </td>
                                                    <td className="px-8 py-4 text-right text-xs font-mono font-black text-gold-accent/60">
                                                        {Number.isFinite(Number(road?.distance)) && Number(road.distance) > 0 ? `${(Number(road.distance) / 1000).toFixed(2)} km` : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
              </div>

              {/* Riwayat Jalur Section */}
              <section className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/10 shadow-glass-depth mt-12 overflow-hidden relative">
                  <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />
                  
                  <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
                      <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                              <span className="material-symbols-outlined text-2xl">history_edu</span>
                          </div>
                          <div>
                              <h2 className="text-xl font-black text-white tracking-tight uppercase">Ledger Perubahan Jalur</h2>
                              <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Jejak audit topologi fiber optik</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                              <div className="h-8 px-3 rounded-l-xl bg-white/5 border border-white/10 flex items-center text-[9px] font-black text-white/40 uppercase tracking-widest backdrop-blur-md">{routeHistoryRows.length} Log</div>
                              <div className="h-8 px-3 rounded-r-xl bg-amber-500/20 border border-amber-500/20 flex items-center text-[9px] font-black text-amber-400 uppercase tracking-widest">{routeVersions.length} Versi</div>
                          </div>
                          <button
                              className="h-10 px-4 rounded-xl border border-[#ff2400]/20 bg-[#ff2400]/5 text-[#ff2400] text-[9px] font-black uppercase tracking-widest hover:bg-[#ff2400] hover:text-white transition-all"
                              disabled={routeBusy || routeHistoryRows.length === 0}
                              onClick={() => void handleDeleteAllHistory()}
                              type="button"
                          >
                              Reset Ledger
                          </button>
                      </div>
                  </div>

                  <div className="space-y-6 max-h-[1000px] overflow-y-auto pr-4 no-scrollbar">
                      {routeHistory.length === 0 ? (
                          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                              <span className="material-symbols-outlined text-5xl text-white/5 mb-4">history_toggle_off</span>
                              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Arsip riwayat masih kosong</p>
                          </div>
                      ) : (
                          routeHistoryRows.map((item) => {
                              const isExpanded = expandedHistoryIds.includes(item.id);
                              return (
                                  <div key={item.id} className={`rounded-2xl transition-all duration-500 border ${isExpanded ? 'bg-white/[0.03] border-white/10 shadow-glass-depth' : 'bg-transparent border-white/5 hover:border-white/10'}`}>
                                      <div 
                                          className="p-6 flex flex-wrap items-center justify-between gap-4 cursor-pointer group/header"
                                          onClick={() => toggleHistoryExpand(item.id)}
                                      >
                                          <div className="flex items-center gap-6">
                                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-amber-500 text-[#0f141e] shadow-gold-glow' : 'bg-white/5 text-white/20 group-hover/header:text-white'}`}>
                                                  <span className="text-sm font-black uppercase">V{item.changeNumber}</span>
                                              </div>
                                              <div>
                                                  <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{formatDateTime(item.createdAt)}</p>
                                                  <h4 className="text-sm font-black text-white uppercase tracking-tight group-hover/header:text-gold-accent transition-colors">
                                                      {item.changeReason || "Pemutakhiran Jalur Rutin"}
                                                  </h4>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-4">
                                              <div className="text-right hidden md:block">
                                                  <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Operator</p>
                                                  <p className="text-[10px] font-bold text-white/60 uppercase">{item.actorName || "SYSTEM"}</p>
                                              </div>
                                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-white/10 text-white rotate-180' : 'bg-white/5 text-white/20 group-hover/header:text-white'}`}>
                                                  <span className="material-symbols-outlined text-lg">expand_more</span>
                                              </div>
                                          </div>
                                      </div>

                                      {isExpanded && (
                                          <div className="px-6 pb-8 animate-in slide-in-from-top-4 duration-500">
                                              <div className="h-px bg-white/5 mb-8 backdrop-blur-md" />
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                  <div className="space-y-4">
                                                      <p className="text-[9px] font-black text-gold-accent uppercase tracking-widest mb-4">Topologi Lintasan</p>
                                                      <div className="relative pl-4 space-y-4 border-l border-white/5">
                                                          {item.points.map((p, idx) => (
                                                              <div key={p.id} className="relative flex items-center gap-4 group/p">
                                                                  <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 border-[#0f141e] ${idx === 0 ? 'bg-blue-400 shadow-blue-glow' : idx === item.points.length - 1 ? 'bg-emerald-400 shadow-emerald-glow' : 'bg-white/20'}`} />
                                                                  <div className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/5 group-hover/p:bg-white/[0.05] transition-all">
                                                                      <div className="flex items-center justify-between">
                                                                          <span className="text-[10px] font-black text-white/60 uppercase tracking-tight">{p.pathName}</span>
                                                                          <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{routePointTypeLabelMap[p.pointType]}</span>
                                                                      </div>
                                                                  </div>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  </div>
                                                  <div>
                                                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-4">Informasi Tambahan</p>
                                                      <div className="space-y-4">
                                                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                                                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2">Metadata Perubahan</p>
                                                              <p className="text-[11px] font-medium text-white/40 leading-relaxed italic">
                                                                  {item.changeDescription || "Tidak ada deskripsi teknis mendalam untuk versi ini."}
                                                              </p>
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              );
                          })
                      )}
                  </div>
              </section>
            </div>
          </div>
        )}
             {activeTab === "contracts" && (
            <div className="space-y-8">
                <section className="glass-card backdrop-blur-xl rounded-premium p-8 border-white/10 shadow-glass-depth">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
                        <div className="space-y-2">
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Manajemen Kontrak Tenant</h2>
                            <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Arsip legal dan perpanjangan layanan</p>
                        </div>
                        <button
                            className="h-12 px-6 flex items-center gap-3 rounded-xl bg-gold-accent text-[#0f141e] hover:scale-105 active:scale-95 transition-all shadow-gold-glow text-[10px] font-black uppercase tracking-widest"
                            onClick={openVersionEditor}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-lg">upgrade</span>
                            Ubah / Upgrade Paket
                        </button>
                    </div>

                    {documentFeedback && (
                        <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in-95 backdrop-blur-md">
                            <span className="material-symbols-outlined text-lg">verified</span>
                            {documentFeedback}
                        </div>
                    )}

                    {(() => {
                        if (!contract?.endDate) return null;
                        const endDate = new Date(contract.endDate);
                        const today = new Date(todayIso);
                        const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

                        const primaryContractRow = contractRowsForTable.find(row => row.contractId === contract.id);
                        const renewalFollowUps = Array.isArray(primaryContractRow?.renewalFollowUps) ? primaryContractRow.renewalFollowUps : [];
                        const hasRenewalUpload = renewalFollowUps.some((followUp) => followUp?.renewalFileUrl);
                        const hasResponse = renewalFollowUps.some((followUp) => followUp?.responseFileUrl);

                        let warningLevel = null;
                        let warningMessage = null;

                        if (daysUntilEnd <= 90 && daysUntilEnd > 60 && !hasRenewalUpload) {
                            warningLevel = "h3";
                            warningMessage = `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-3 bulan). Segera buat dan upload surat perpanjangan kontrak.`;
                        } else if (daysUntilEnd <= 60 && daysUntilEnd > 30 && hasRenewalUpload && !hasResponse) {
                            warningLevel = "h2";
                            warningMessage = `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-2 bulan). Surat perpanjangan sudah diupload. Menunggu tanggapan dari lokasi.`;
                        } else if (daysUntilEnd <= 30 && daysUntilEnd > 0 && !hasResponse) {
                            warningLevel = "h1";
                            warningMessage = `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-1 bulan). ${hasRenewalUpload ? 'Belum ada tanggapan perpanjangan. Segera follow up dengan lokasi.' : 'Segera upload surat perpanjangan kontrak!'}`;
                        }

                        if (!warningLevel) return null;

                        const warningStyles = warningLevel === "h1"
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : warningLevel === "h2"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                : "bg-blue-500/10 border-blue-500/20 text-blue-400";

                        return (
                            <div className={`mb-8 p-4 rounded-2xl border backdrop-blur-md ${warningStyles} text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in-95`}>
                                <span className="material-symbols-outlined text-lg">schedule</span>
                                {warningMessage}
                            </div>
                        );
                    })()}

                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left min-w-[1400px]">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">No</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Nomor Kontrak</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Berkas Kontrak</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Keterangan</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Periode Awal Kontrak</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Periode Berjalan Awal</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Periode Berjalan Akhir</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Paket</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Jumlah</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Nominal/Bulan</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">BAK</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Perpanjangan</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Tanggapan</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {contractRowsForTable.length === 0 && (
                                    <tr>
                                        <td className="px-5 py-12 text-center text-[10px] text-white/20 italic uppercase tracking-[0.2em]" colSpan="14">Belum ada data kontrak.</td>
                                    </tr>
                                )}
                                {contractRowsForTable.map((row) => {
                                    const isContractNumberMarkedEmpty = Boolean(emptyContractNumberRows[row.id]);
                                    const isBakMarkedEmpty = Boolean(emptyBakRows[row.id]);
                                    const contractDoc = row.contractId ? contractDocumentByContractId.get(Number(row.contractId)) : null;
                                    const contractFileUrl = String(contractDoc?.fileUrl ?? "");
                                    const hasContractFile = isOpenableFileUrl(contractFileUrl);

                                    // Keterangan badge
                                    const noteStyle = (() => {
                                        const n = (row.note ?? "").toLowerCase();
                                        if (n.includes("beroperasi") || n.includes("awal")) return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                                        if (n.includes("belum diperpanjang") || n.includes("expired")) return "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]";
                                        if (n.includes("berhenti")) return "bg-white/5 border-white/10 text-white/30";
                                        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
                                    })();

                                    const rowStateClass = row.isHistory
                                        ? "bg-white/[0.01] opacity-55 hover:bg-white/[0.015]"
                                        : row.isFuture
                                            ? "bg-blue-500/[0.03] hover:bg-blue-500/[0.05]"
                                            : "hover:bg-white/[0.02]";

                                    return (
                                        <tr key={row.id} className={`${rowStateClass} transition-colors group/row`}>

                                            {/* No */}
                                            <td className="px-5 py-4 text-[10px] font-black text-white/20">{row.number}</td>

                                            {/* Nomor Kontrak */}
                                            <td className="px-5 py-4">
                                                {row.contractNumber ? (
                                                    editingContractNumberRows[row.id] ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <input
                                                                className="h-8 w-36 rounded-lg border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/50 transition-all placeholder:text-white/10 backdrop-blur-md"
                                                                onChange={(e) => setContractNumberInputs((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                                                placeholder="No. kontrak..."
                                                                type="text"
                                                                value={contractNumberInputs[row.id] ?? ""}
                                                            />
                                                            <button
                                                                className="h-8 px-3 rounded-lg border border-gold-accent/20 bg-gold-accent/10 text-gold-accent text-[8px] font-black uppercase tracking-widest hover:bg-gold-accent hover:text-[#0f141e] transition-all disabled:opacity-40 backdrop-blur-md"
                                                                disabled={isSavingContractNumber}
                                                                onClick={() => void handleSaveContractNumber(row)}
                                                            >
                                                                Simpan
                                                            </button>
                                                            <button
                                                                className="h-8 px-2 rounded-lg border border-white/10 bg-white/5 text-white/40 text-[8px] font-black hover:bg-white/10 transition-all"
                                                                onClick={() => setEditingContractNumberRows((prev) => ({ ...prev, [row.id]: false }))}
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-black text-white uppercase tracking-tight">{row.contractNumber}</span>
                                                            <button
                                                                className="h-6 w-6 rounded-md border border-white/10 bg-white/5 flex items-center justify-center text-white/20 hover:text-gold-accent hover:border-gold-accent/30 transition-all"
                                                                onClick={() => { setContractNumberInputs((prev) => ({ ...prev, [row.id]: row.contractNumber })); setEditingContractNumberRows((prev) => ({ ...prev, [row.id]: true })); }}
                                                                title="Edit nomor kontrak"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">edit</span>
                                                            </button>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="space-y-2">
                                                        {!isContractNumberMarkedEmpty && (
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    className="h-8 w-36 rounded-lg border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/50 transition-all placeholder:text-white/10 backdrop-blur-md"
                                                                    onChange={(e) => setContractNumberInputs((previous) => ({ ...previous, [row.id]: e.target.value }))}
                                                                    placeholder="No. kontrak..."
                                                                    type="text"
                                                                    value={contractNumberInputs[row.id] ?? ""}
                                                                />
                                                                <button
                                                                    className="h-8 px-3 rounded-lg border border-gold-accent/20 bg-gold-accent/10 text-gold-accent text-[8px] font-black uppercase tracking-widest hover:bg-gold-accent hover:text-[#0f141e] transition-all disabled:opacity-40 backdrop-blur-md"
                                                                    disabled={isSavingContractNumber}
                                                                    onClick={() => void handleSaveContractNumber(row)}
                                                                >
                                                                    Simpan
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isContractNumberMarkedEmpty ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-white/20"}`}>
                                                                {isContractNumberMarkedEmpty ? "Kosong Terverifikasi" : "Belum Diisi"}
                                                            </span>
                                                            <button
                                                                className="text-[8px] font-black text-gold-accent/50 uppercase tracking-widest hover:text-gold-accent underline underline-offset-2"
                                                                onClick={() => toggleContractNumberEmptyMark(row.id)}
                                                            >
                                                                {isContractNumberMarkedEmpty ? "Batalkan" : "Tandai Kosong"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Berkas Kontrak */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${!row.contractId || isUploadingContractFile ? 'border-white/5 bg-white/[0.02] text-white/10 cursor-not-allowed' : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white'}`}>
                                                        <span className="material-symbols-outlined text-[13px]">upload_file</span>
                                                        {hasContractFile ? "Ganti" : "Upload"}
                                                        <input
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            disabled={!row.contractId || isUploadingContractFile}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadContractFile({ contractId: row.contractId, file: f }); }}
                                                            type="file"
                                                        />
                                                    </label>
                                                    {hasContractFile && (
                                                        <a
                                                            className="inline-flex items-center gap-1 text-[8px] font-black text-gold-accent uppercase tracking-widest hover:underline underline-offset-2"
                                                            href={contractFileUrl}
                                                            target="_blank" rel="noopener noreferrer"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                            Lihat
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Keterangan */}
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${noteStyle}`}>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                                                    {row.note || "—"}
                                                </span>
                                            </td>

                                            {/* Periode Awal Kontrak */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/60">
                                                    {contractPeriodInfo.contractStartDate ? formatDate(contractPeriodInfo.contractStartDate) : "—"}
                                                </span>
                                            </td>

                                            {/* Periode Berjalan Awal */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/60">{row.periodStart ? formatDate(row.periodStart) : "—"}</span>
                                            </td>

                                            {/* Periode Berjalan Akhir */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/60">{row.periodEnd ? formatDate(row.periodEnd) : "—"}</span>
                                            </td>

                                            {/* Paket */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white uppercase tracking-wide">{row.paket}</span>
                                            </td>

                                            {/* Jumlah */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/80">{row.jumlahPaket ?? "—"}</span>
                                            </td>

                                            {/* Nominal */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/70">
                                                    {Number(row.monthlyAmount ?? 0) > 0 ? formatCurrency(Number(row.monthlyAmount)) : "—"}
                                                </span>
                                            </td>

                                            {/* BAK */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${isUploadingBakFile ? 'border-white/5 bg-white/[0.02] text-white/10 cursor-not-allowed' : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white'}`}>
                                                        <span className="material-symbols-outlined text-[13px]">upload_file</span>
                                                        {isOpenableFileUrl(row.bakFileUrl) ? "Ganti" : "Upload"}
                                                        <input
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            disabled={isUploadingBakFile}
                                                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUploadBakFile({ row, file: f }); }}
                                                            type="file"
                                                        />
                                                    </label>
                                                    {isOpenableFileUrl(row.bakFileUrl) && (
                                                        <a
                                                            className="inline-flex items-center gap-1 text-[8px] font-black text-gold-accent uppercase tracking-widest hover:underline underline-offset-2"
                                                            href={row.bakFileUrl}
                                                            target="_blank" rel="noopener noreferrer"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                            Lihat
                                                        </a>
                                                    )}
                                                    {!isOpenableFileUrl(row.bakFileUrl) && !isBakMarkedEmpty && (
                                                        <button
                                                            className="block text-[8px] font-black text-gold-accent/50 uppercase tracking-widest hover:text-gold-accent underline underline-offset-2"
                                                            onClick={() => toggleBakEmptyMark(row.id)}
                                                        >
                                                            Tandai Tidak Perlu
                                                        </button>
                                                    )}
                                                    {isBakMarkedEmpty && (
                                                        <button
                                                            className="block text-[8px] font-black text-emerald-400/70 uppercase tracking-widest hover:text-emerald-400 underline underline-offset-2"
                                                            onClick={() => toggleBakEmptyMark(row.id)}
                                                        >
                                                            Batalkan
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Perpanjangan */}
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    {renderTenantRenewalFollowUps(row, "renewal")}
                                                    {hasInitialTenantRenewalUpload(row) && (
                                                        <button
                                                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all backdrop-blur-md"
                                                            onClick={() => void handleAddTenantRenewalSplit(row)}
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">add</span>
                                                            Split
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Tanggapan */}
                                            <td className="px-5 py-4">
                                                {renderTenantRenewalFollowUps(row, "response")}
                                            </td>

                                            {/* Aksi */}
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/20 hover:text-gold-accent hover:border-gold-accent/30 hover:bg-gold-accent/10 transition-all backdrop-blur-md"
                                                    onClick={openVersionEditor}
                                                    title="Edit"
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit_note</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        )}

        {activeTab === "invoices" && (
            <div className="space-y-10">
                {/* Billing Header & Controls */}
                <section className="glass-card backdrop-blur-xl rounded-premium p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                    <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl backdrop-blur-md" />
                    
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-8">
                        <div className="space-y-2">
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Manajemen Tagihan Bulanan</h2>
                            <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Monitoring siklus invoice dan rekonsiliasi bayar</p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            {/* Urutan Bayar — toggle pill */}
                            <div className="flex flex-col gap-2">
                                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Urutan Bayar</p>
                                <div className="flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.02]">
                                    {[
                                        { value: "asc",  label: "Awal ke Akhir", icon: "arrow_downward" },
                                        { value: "desc", label: "Akhir ke Awal", icon: "arrow_upward" },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${invoicePaymentOrderSort === opt.value ? 'bg-gold-accent text-[#0f141e] shadow-gold-glow' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                                            onClick={() => setInvoicePaymentOrderSort(opt.value)}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Set Date Mode — toggle pill */}
                            <div className="flex flex-col gap-2">
                                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Mode Set Tanggal</p>
                                <div className="flex items-center gap-1 p-1 rounded-xl border border-white/10 bg-white/[0.02]">
                                    {[
                                        { value: "manual",    label: "Satuan",  icon: "edit_note" },
                                        { value: "fixed_day", label: "Semua",   icon: "calendar_month" },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${invoiceSetDateMode === opt.value ? 'bg-gold-accent text-[#0f141e] shadow-gold-glow' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                                            onClick={() => setInvoiceSetDateMode(opt.value)}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input tanggal + terapkan — muncul saat mode Semua */}
                            {invoiceSetDateMode === "fixed_day" && (
                                <div className="flex items-end gap-2 animate-in slide-in-from-left-4 duration-200">
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Tanggal (1–31)</p>
                                        <input
                                            className="h-10 w-20 rounded-xl border border-white/10 bg-white/[0.02] text-center text-[11px] font-black text-white outline-none focus:border-gold-accent/50 transition-all"
                                            max="31"
                                            min="1"
                                            onChange={(e) => setInvoiceFixedDueDay(e.target.value)}
                                            type="number"
                                            value={invoiceFixedDueDay}
                                        />
                                    </div>
                                    <button
                                        className="h-10 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-[#0f141e] transition-all disabled:opacity-40 backdrop-blur-md"
                                        disabled={isSavingInvoice}
                                        onClick={() => void handleApplyGlobalSetDate()}
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-[14px] mr-1">check_circle</span>
                                        Terapkan Semua
                                    </button>
                                </div>
                            )}

                            {/* Rekonfigurasi Periode */}
                            <button
                                className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:bg-gold-accent/10 hover:border-gold-accent/20 hover:text-gold-accent transition-all text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                onClick={openBillingEditor}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-[14px]">tune</span>
                                Rekonfigurasi Periode
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-10">
                        {[
                            { label: "Pending Approval", val: pendingInvoiceCount, col: "white" },
                            { label: "Unpaid / Overdue", val: unpaidInvoiceCount, col: "#ff2400" },
                            { label: "Settled / Paid", val: paidInvoiceCount, col: "emerald-500" },
                            { label: "Next Sequence", val: nextActionMeta ? "Active" : "None", col: "blue-500" }
                        ].map((s, i) => (
                            <div key={i} className={`p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1`}>
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-40`}>{s.label}</span>
                                <span className={`text-2xl font-black text-white`}>{s.val}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {invoiceFeedback && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in-95 backdrop-blur-md">
                        <span className="material-symbols-outlined text-lg">verified</span>
                        {invoiceFeedback}
                    </div>
                )}

                {/* Active Invoice Table */}
                <section className="glass-card backdrop-blur-xl rounded-premium border-white/10 shadow-glass-depth overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-gold-accent">payments</span>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Siklus Pembayaran Aktif</h3>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest backdrop-blur-md">
                            {invoiceRows.length} Sequence
                        </span>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left min-w-[1400px]">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">No</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Pembayaran Ke</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Nomor Invoice</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Terakhir Bayar</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Jumlah Dibayar</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Status Pembayaran</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Waktu Terbayar</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Upload Invoice</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30">Bukti Bayar</th>
                                    <th className="px-5 py-4 text-[8px] font-black uppercase tracking-[0.2em] text-white/30 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {displayInvoiceRows.length === 0 && (
                                    <tr>
                                        <td className="px-5 py-12 text-center text-[10px] text-white/20 italic uppercase tracking-[0.2em]" colSpan="10">Belum ada invoice aktif.</td>
                                    </tr>
                                )}
                                {displayInvoiceRows.map((invoice, idx) => {
                                    const draft = getInvoiceDraft(invoice);
                                    const isEditingRow = invoiceEditingId === invoice.id;
                                    const isSetDateLockedByGlobal = invoiceSetDateMode === "fixed_day";
                                    const workflowMeta = invoice.workflowMeta ?? getInvoiceWorkflowMeta(invoice, workflowInvoiceRows);
                                    const statusMeta = invoice.statusMeta ?? resolveInvoiceStatusMeta({ ...invoice, workflowMeta });
                                    const hasInvoiceFile = isOpenableFileUrl(invoice?.invoiceFileUrl);
                                    const hasPaymentProof = isOpenableFileUrl(invoice?.paymentProofFileUrl);
                                    const hasAnyInvoiceFile = workflowMeta.hasAnyInvoiceFile;
                                    const secondWarningDraftKey = String(workflowMeta.secondFollowUp?.id ?? "warning-2");
                                    const secondWarningDraft = getInvoiceFollowUpDraft(invoice, workflowMeta.secondFollowUp ?? { id: secondWarningDraftKey, splitOrder: 2 });
                                    const canUploadInvoiceFile = !isSavingInvoice && (workflowMeta.canUploadMainInvoice || workflowMeta.canUploadFirstWarning || hasInvoiceFile);
                                    const canUploadSecondWarning = !isSavingInvoice && workflowMeta.canUploadSecondWarning;
                                    const canUploadPaymentProof = !isSavingInvoice && hasAnyInvoiceFile;
                                    const canMarkPaid = !isSavingInvoice && workflowMeta.canMarkPaid;

                                    const statusStyle = (() => {
                                        if (statusMeta.key === "paid") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                                        if (statusMeta.key === "warning_unpaid") return "bg-[#ff2400]/10 border-[#ff2400]/30 text-[#ff2400]";
                                        if (statusMeta.key === "warning_required_h3") return "bg-orange-500/10 border-orange-500/20 text-orange-300";
                                        if (statusMeta.key === "warning_required_h7") return "bg-amber-500/10 border-amber-500/20 text-amber-300";
                                        if (statusMeta.key === "waiting_payment_confirmation") return "bg-blue-500/10 border-blue-500/20 text-blue-300";
                                        if (statusMeta.key === "pending_setup") return "bg-rose-500/10 border-rose-500/20 text-rose-300";
                                        return "bg-white/5 border-white/10 text-white/30";
                                    })();

                                    return (
                                        <tr key={invoice.id} className={`transition-colors group/row ${isEditingRow ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>

                                            {/* No */}
                                            <td className="px-5 py-4 text-[10px] font-black text-white/20">{idx + 1}</td>

                                            {/* Pembayaran Ke */}
                                            <td className="px-5 py-4">
                                                <span className="text-sm font-black text-white">#{invoice.paymentOrder}</span>
                                            </td>

                                            {/* Nomor Invoice */}
                                            <td className="px-5 py-4">
                                                {isEditingRow ? (
                                                    <input
                                                        className="h-9 w-40 rounded-lg border border-white/20 bg-white/5 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/50 transition-all placeholder:text-white/10 backdrop-blur-md"
                                                        disabled={isSavingInvoice}
                                                        onChange={(e) => updateInvoiceDraftField(invoice.id, "invoiceNumber", e.target.value)}
                                                        placeholder="No. Invoice..."
                                                        type="text"
                                                        value={draft.invoiceNumber}
                                                    />
                                                ) : (
                                                    <span className="text-[11px] font-black text-white/60">
                                                        {invoice.invoiceNumber || <span className="text-white/20 italic font-normal">-</span>}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Terakhir Bayar (set date / due date) */}
                                            <td className="px-5 py-4">
                                                {isEditingRow ? (
                                                    <div className="space-y-1">
                                                        <input
                                                            className="h-9 w-36 rounded-lg border border-white/20 bg-white/5 px-3 text-[10px] font-bold text-white outline-none focus:border-gold-accent/50 transition-all [color-scheme:dark] backdrop-blur-md"
                                                            disabled={isSetDateLockedByGlobal || isSavingInvoice}
                                                            onChange={(e) => updateInvoiceDraftField(invoice.id, "dueDate", e.target.value)}
                                                            type="date"
                                                            value={draft.dueDate}
                                                        />
                                                        {isSetDateLockedByGlobal && (
                                                            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Global Locked</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <span className="text-[11px] font-black text-white/60">
                                                            {draft.dueDate ? formatDate(draft.dueDate) : <span className="text-white/20 italic font-normal">Belum diset</span>}
                                                        </span>
                                                        {workflowMeta.setupWarnings.some((warning) => warning.code === "missing_due_date") && (
                                                            <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest">Segera mengatur tanggal terakhir pembayaran.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Jumlah Dibayar */}
                                            <td className="px-5 py-4">
                                                {isEditingRow ? (
                                                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-white/20 bg-white/5 w-36 backdrop-blur-md">
                                                        <span className="text-[9px] font-black text-white/30 shrink-0">Rp</span>
                                                        <input
                                                            className="bg-transparent text-[10px] font-black text-white outline-none w-full"
                                                            disabled={isSavingInvoice}
                                                            onChange={(e) => updateInvoiceDraftField(invoice.id, "amount", e.target.value)}
                                                            type="number"
                                                            value={draft.amount}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <span className="text-[11px] font-black text-white/80">
                                                            {Number(draft.amount) > 0 ? formatCurrency(Number(draft.amount)) : <span className="text-white/20 italic font-normal">—</span>}
                                                        </span>
                                                        {workflowMeta.setupWarnings.some((warning) => warning.code === "missing_amount") && (
                                                            <p className="text-[8px] font-black text-rose-300 uppercase tracking-widest">Mengatur nominal jumlah pembayaran.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Pembayaran */}
                                            <td className="px-5 py-4">
                                                {isEditingRow ? (
                                                    <select
                                                        className="h-9 w-40 rounded-lg border border-white/20 bg-[#121824] px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-gold-accent/50 transition-all"
                                                        disabled={isSavingInvoice}
                                                        onChange={(e) => updateInvoiceDraftField(invoice.id, "status", e.target.value)}
                                                        value={draft.status}
                                                    >
                                                        {INVOICE_STATUS_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusStyle}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.key === "paid" ? "bg-emerald-400" : statusMeta.key === "warning_unpaid" ? "bg-[#ff2400]" : statusMeta.key === "warning_required_h3" ? "bg-orange-300" : statusMeta.key === "warning_required_h7" ? "bg-amber-300" : statusMeta.key === "waiting_payment_confirmation" ? "bg-blue-300" : "bg-white/20"}`} />
                                                        {statusMeta.label}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Waktu Terbayar */}
                                            <td className="px-5 py-4">
                                                <span className="text-[11px] font-black text-white/50">
                                                    {invoice.paidAt ? formatDate(invoice.paidAt) : <span className="text-white/20 italic font-normal">—</span>}
                                                </span>
                                            </td>

                                            {/* Upload Invoice */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${canUploadInvoiceFile ? 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white' : 'border-white/5 bg-white/[0.02] text-white/10 cursor-not-allowed'}`}>
                                                        <span className="material-symbols-outlined text-[13px]">upload_file</span>
                                                        {hasInvoiceFile ? "Ganti" : "Upload"}
                                                        <input
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            disabled={!canUploadInvoiceFile}
                                                            onChange={(e) => void handleUploadInvoiceFile(invoice, e.target.files?.[0] ?? null)}
                                                            type="file"
                                                        />
                                                    </label>
                                                    {hasInvoiceFile && (
                                                        <a
                                                            className="inline-flex items-center gap-1 text-[8px] font-black text-gold-accent uppercase tracking-widest hover:underline underline-offset-2"
                                                            href={invoice.invoiceFileUrl}
                                                            target="_blank" rel="noopener noreferrer"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                            Lihat
                                                        </a>
                                                    )}
                                                    {canUploadSecondWarning && (
                                                        <div className="mt-1 space-y-1 rounded-xl border border-orange-500/20 bg-orange-500/5 p-2">
                                                            <input
                                                                className="h-8 w-40 rounded-lg border border-orange-500/20 bg-black/20 px-2 text-[9px] font-bold text-white outline-none placeholder:text-white/10"
                                                                disabled={isSavingInvoice}
                                                                onChange={(e) => updateInvoiceFollowUpDraftField(invoice.id, secondWarningDraftKey, "invoiceNumber", e.target.value)}
                                                                placeholder="No. invoice kedua"
                                                                type="text"
                                                                value={secondWarningDraft.invoiceNumber}
                                                            />
                                                            <label className="relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 text-[8px] font-black uppercase tracking-widest text-orange-200 transition-all hover:border-orange-500/40">
                                                                <span className="material-symbols-outlined text-[13px]">upload_file</span>
                                                                Upload Peringatan 2
                                                                <input
                                                                    className="absolute inset-0 cursor-pointer opacity-0"
                                                                    disabled={!canUploadSecondWarning}
                                                                    onChange={(e) => void handleUploadInvoiceFile(invoice, e.target.files?.[0] ?? null, 2)}
                                                                    type="file"
                                                                />
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Bukti Bayar */}
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${canUploadPaymentProof ? 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white' : 'border-white/5 bg-white/[0.02] text-white/10 cursor-not-allowed'}`}>
                                                        <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                                                        {hasPaymentProof ? "Ganti" : "Upload"}
                                                        <input
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            disabled={!canUploadPaymentProof}
                                                            onChange={(e) => void handleUploadPaymentProof(invoice, e.target.files?.[0] ?? null)}
                                                            type="file"
                                                        />
                                                    </label>
                                                    {hasPaymentProof && (
                                                        <a
                                                            className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest hover:underline underline-offset-2"
                                                            href={invoice.paymentProofFileUrl}
                                                            target="_blank" rel="noopener noreferrer"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                            Lihat
                                                        </a>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Aksi */}
                                            <td className="px-5 py-4 text-right">
                                                {isEditingRow ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all backdrop-blur-md"
                                                            onClick={() => { setInvoiceEditingId(null); resetInvoiceDraftFromSource(invoice); }}
                                                        >
                                                            Batal
                                                        </button>
                                                        <button
                                                            className="h-8 px-3 rounded-lg bg-gold-accent text-[#0f141e] text-[8px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-gold-glow"
                                                            disabled={isSavingInvoice}
                                                            onClick={() => void handleSaveInvoiceRow(invoice)}
                                                        >
                                                            {isSavingInvoice ? "..." : "Simpan"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        {canMarkPaid && (
                                                            <button
                                                                className="h-8 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-[8px] font-black uppercase tracking-widest text-emerald-300 transition-all hover:border-emerald-500/40 hover:text-emerald-200 disabled:opacity-50"
                                                                disabled={!canMarkPaid}
                                                                onClick={() => void handleMarkInvoicePaid(invoice)}
                                                                title="Sudah Bayar"
                                                            >
                                                                Sudah Bayar
                                                            </button>
                                                        )}
                                                        <button
                                                            className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/20 hover:text-gold-accent hover:border-gold-accent/30 hover:bg-gold-accent/10 transition-all backdrop-blur-md"
                                                            onClick={() => setInvoiceEditingId(invoice.id)}
                                                            title="Edit"
                                                        >
                                                            <span className="material-symbols-outlined text-base">edit_note</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="glass-card backdrop-blur-xl rounded-premium border-white/10 shadow-glass-depth overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-gold-accent">archive</span>
                            <div>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Tambah Arsip Periode Lama</h3>
                                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/20">Satu rentang periode akan dipecah otomatis menjadi invoice settlement bulanan.</p>
                            </div>
                        </div>
                    </div>
                    <form className="p-8 space-y-6" onSubmit={handleCreateHistoricalArchive}>
                        <div className="rounded-2xl border border-gold-accent/10 bg-gold-accent/[0.05] px-4 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gold-accent/80">Preview Arsip Bulanan</p>
                                    <p className="mt-1 text-[10px] font-bold text-white/55">
                                        {historicalArchiveMonthlyPeriods.length > 0
                                            ? `${historicalArchiveMonthlyPeriods.length} invoice history akan dibuat dari rentang periode ini.`
                                            : "Pilih tanggal mulai dan akhir periode untuk menghitung jumlah invoice bulanan yang akan dibuat."}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white/50">
                                    {historicalArchiveMonthlyPeriods.length > 0
                                        ? `${historicalArchiveMonthlyPeriods.length} Bulan`
                                        : "0 Bulan"}
                                </div>
                            </div>
                            {historicalArchiveInvoicePreview && (
                                <p className="mt-3 text-[9px] font-bold text-white/35">
                                    Nomor invoice hasil pecah otomatis: {historicalArchiveInvoicePreview}
                                </p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <GlassInput
                                label="Mulai Periode"
                                icon="event"
                                type="date"
                                value={historicalArchiveDraft.periodStartDate}
                                onChange={(event) => updateHistoricalArchiveDraftField("periodStartDate", event.target.value)}
                            />
                            <GlassInput
                                label="Akhir Periode"
                                icon="event_available"
                                type="date"
                                value={historicalArchiveDraft.periodEndDate}
                                onChange={(event) => updateHistoricalArchiveDraftField("periodEndDate", event.target.value)}
                            />
                            <GlassInput
                                label="Nomor Kontrak / BAK"
                                icon="assignment"
                                value={historicalArchiveDraft.contractNumber}
                                onChange={(event) => updateHistoricalArchiveDraftField("contractNumber", event.target.value)}
                                placeholder="KIMA.BAK-..."
                            />
                            <GlassInput
                                label="Nomor Invoice"
                                icon="receipt_long"
                                value={historicalArchiveDraft.invoiceNumber}
                                onChange={(event) => updateHistoricalArchiveDraftField("invoiceNumber", event.target.value)}
                                placeholder="No. invoice arsip"
                            />
                            <GlassInput
                                label="Jatuh Tempo"
                                icon="event_busy"
                                type="date"
                                value={historicalArchiveDraft.dueDate}
                                onChange={(event) => updateHistoricalArchiveDraftField("dueDate", event.target.value)}
                            />
                            <GlassInput
                                label="Tanggal Bayar"
                                icon="payments"
                                type="date"
                                value={historicalArchiveDraft.paidAt}
                                onChange={(event) => updateHistoricalArchiveDraftField("paidAt", event.target.value)}
                            />
                            <GlassInput
                                label="Nominal Invoice"
                                icon="paid"
                                type="number"
                                value={historicalArchiveDraft.amount}
                                onChange={(event) => updateHistoricalArchiveDraftField("amount", event.target.value)}
                            />
                            <GlassSelect
                                label="Paket Arsip"
                                value={historicalArchiveDraft.packageType}
                                onChange={(value) => updateHistoricalArchiveDraftField("packageType", value)}
                                options={[
                                    { value: "sharing_core", label: "Sharing Core" },
                                    { value: "core", label: "Dedicated Core" },
                                ]}
                            />
                            {historicalArchiveDraft.packageType === "sharing_core" ? (
                                <GlassInput
                                    label="Rasio Sharing"
                                    icon="hub"
                                    value={historicalArchiveDraft.ratio}
                                    onChange={(event) => updateHistoricalArchiveDraftField("ratio", event.target.value)}
                                    placeholder="1:32"
                                />
                            ) : (
                                <GlassInput
                                    label="Jumlah Core"
                                    icon="settings_ethernet"
                                    type="number"
                                    value={historicalArchiveDraft.coreTotal}
                                    onChange={(event) => updateHistoricalArchiveDraftField("coreTotal", event.target.value)}
                                />
                            )}
                            <div className="md:col-span-3">
                                <GlassInput
                                    label="Catatan"
                                    icon="notes"
                                    value={historicalArchiveDraft.remarks}
                                    onChange={(event) => updateHistoricalArchiveDraftField("remarks", event.target.value)}
                                    placeholder="Opsional"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-white/5 pt-6 md:flex-row md:items-center md:justify-between">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Status invoice otomatis Lunas, lalu setiap bulan masuk ke arsip riwayat settlement.</p>
                            <button
                                type="submit"
                                disabled={isSavingInvoice}
                                className="h-12 rounded-xl bg-gold-accent px-6 text-[10px] font-black uppercase tracking-widest text-[#0f141e] shadow-gold-glow transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSavingInvoice ? "Menyimpan Arsip..." : "Tambah Arsip"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* History Invoice Table */}
                <section className="glass-card backdrop-blur-xl rounded-premium border-white/10 shadow-glass-depth overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-white/20">history</span>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Arsip & Riwayat Settlement</h3>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-white/20 uppercase tracking-widest backdrop-blur-md">
                            {historyInvoiceRows.length} Logged
                        </span>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left min-w-[1200px]">
                            <thead>
                                <tr className="bg-white/[0.01] border-b border-white/5">
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">#</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Urutan</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Identitas</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Masa Periode</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Settlement</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Status Akhir</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Waktu Bayar</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/20 text-right">Versi Log</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {displayHistoryInvoiceRows.length === 0 && (
                                    <tr>
                                        <td className="px-8 py-10 text-center text-[10px] text-white/10 italic uppercase tracking-[0.2em]" colSpan="8">Arsip riwayat settlement kosong.</td>
                                    </tr>
                                )}
                                {displayHistoryInvoiceRows.map((invoice, idx) => {
                                    const statusMeta = invoice.statusMeta ?? resolveInvoiceStatusMeta(invoice);
                                    const periodLabel = invoice.periodStartDate && invoice.periodEndDate
                                        ? `${formatDate(invoice.periodStartDate)} - ${formatDate(invoice.periodEndDate)}`
                                        : formatDate(invoice.dueDate);
                                    return (
                                        <tr key={invoice.id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="px-8 py-4 text-[10px] font-black text-white/10">{idx + 1}</td>
                                            <td className="px-8 py-4 text-xs font-black text-white/40 uppercase">Sequence #{invoice.paymentOrder}</td>
                                            <td className="px-8 py-4 text-xs font-bold text-white/60">{invoice.invoiceNumber || "-"}</td>
                                            <td className="px-8 py-4 text-[10px] font-bold text-white/30 uppercase">{periodLabel}</td>
                                            <td className="px-8 py-4 text-xs font-black text-white/60">{formatCurrency(invoice.amount ?? 0)}</td>
                                            <td className="px-8 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${statusMeta.badgeClass.includes('emerald') ? 'bg-emerald-500/5 text-emerald-500/40 border border-emerald-500/10' : 'bg-white/5 text-white/20 border border-white/5'}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-[10px] font-bold text-white/30">{formatDate(invoice.paidAt)}</td>
                                            <td className="px-8 py-4 text-right">
                                                <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/20 uppercase tracking-widest backdrop-blur-md">
                                                    v{invoice.scheduleVersion ?? 1} Archive
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        )}

        {activeTab === "documents" && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Document List */}
            <section className="lg:col-span-7 glass-card backdrop-blur-xl rounded-premium border-white/10 shadow-glass-depth overflow-hidden">
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gold-accent">folder_open</span>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Repositori Dokumen Lokasi</h3>
                    </div>
                </div>
                <div className="p-4 space-y-4">
                    {allDocuments.length === 0 && (
                        <div className="p-10 text-center border border-dashed border-white/5 rounded-2xl">
                             <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">Belum ada dokumen yang diunggah ke repositori ini.</p>
                        </div>
                    )}
                    {allDocuments.map((doc) => (
                        <div key={doc?.id} className="group/doc glass-card backdrop-blur-xl rounded-2xl p-5 border-white/5 hover:border-white/10 transition-all">
                             <div className="flex items-center justify-between gap-6">
                                 <div className="flex items-center gap-4">
                                     <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover/doc:bg-gold-accent group-hover/doc:text-[#0f141e] transition-all backdrop-blur-md">
                                         <span className="material-symbols-outlined text-2xl">description</span>
                                     </div>
                                     <div className="space-y-1">
                                         <p className="text-xs font-black text-white uppercase tracking-tight group-hover/doc:text-gold-accent transition-colors">
                                             {documentTypeLabelMap[doc?.jenisDokumen] || doc?.jenisDokumen}
                                         </p>
                                         <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                                             {doc?.nomorDokumen || "No Ref: —"} • {formatDate(doc?.tanggalDokumen)}
                                         </p>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     {isOpenableFileUrl(doc?.fileUrl) && (
                                         <button 
                                             onClick={() => window.open(doc.fileUrl, '_blank')}
                                             className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black text-white/40 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
                                         >
                                             Buka File
                                         </button>
                                     )}
                                     <button className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-amber-400 transition-all backdrop-blur-md">
                                         <span className="material-symbols-outlined text-lg">edit</span>
                                     </button>
                                 </div>
                             </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Upload Section */}
            <section className="lg:col-span-5 space-y-6">
                <div className="glass-card backdrop-blur-xl rounded-premium p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold-accent/5 blur-2xl backdrop-blur-md" />
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-10 w-10 rounded-xl bg-gold-accent/10 border border-gold-accent/20 flex items-center justify-center text-gold-accent backdrop-blur-md">
                            <span className="material-symbols-outlined text-xl">upload</span>
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Registrasi Dokumen Baru</h3>
                    </div>

                    <form className="space-y-6" onSubmit={handleUploadDocument}>
                        <GlassSelect 
                            label="Kategori Dokumen"
                            value={documentDraft.jenisDokumen}
                            onChange={(value) => setDocumentDraft(p => ({ ...p, jenisDokumen: value }))}
                            options={[
                                { value: "penawaran", label: "Surat Penawaran Harga" },
                                { value: "tanggapan", label: "Surat Tanggapan" },
                                { value: "hasil_nego", label: "Surat Negosiasi" },
                                { value: "custom", label: "Lainnya / Manual" }
                            ]}
                        />

                        {documentDraft.jenisDokumen === "custom" && (
                            <GlassInput 
                                label="Nama Dokumen Kustom"
                                icon="edit_note"
                                value={documentDraft.customJenisDokumen}
                                onChange={(e) => setDocumentDraft(p => ({ ...p, customJenisDokumen: e.target.value }))}
                                placeholder="MISAL: SURAT KUASA"
                            />
                        )}

                        <GlassInput 
                            label="Nomor Referensi (Opsional)"
                            icon="tag"
                            value={documentDraft.nomorDokumen}
                            onChange={(e) => setDocumentDraft(p => ({ ...p, nomorDokumen: e.target.value }))}
                            placeholder="MASUKKAN NOMOR SURAT"
                        />

                        <GlassInput 
                            label="Tanggal Terbit"
                            icon="calendar_today"
                            type="date"
                            value={documentDraft.tanggalDokumen}
                            onChange={(e) => setDocumentDraft(p => ({ ...p, tanggalDokumen: e.target.value }))}
                        />

                        <div className="p-6 rounded-2xl bg-white/5 border border-dashed border-white/10 relative group/file backdrop-blur-md">
                            <input 
                                type="file" 
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    setDocumentDraft((previous) => ({
                                        ...previous,
                                        fileUrl: "",
                                        uploadedFileName: file?.name ?? "",
                                        uploadedFile: file,
                                    }));
                                }}
                            />
                            <div className="flex flex-col items-center gap-3 text-center">
                                <span className="material-symbols-outlined text-3xl text-white/10 group-hover/file:text-gold-accent transition-colors">cloud_upload</span>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                                    {documentDraft.uploadedFileName ? <span className="text-gold-accent">{documentDraft.uploadedFileName}</span> : "Klik atau seret file dokumen ke sini"}
                                </p>
                            </div>
                        </div>

                        {documentError && (
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest">
                                {documentError}
                            </div>
                        )}
                        {documentFeedback && (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                                {documentFeedback}
                            </div>
                        )}

                        <button 
                            type="submit"
                            disabled={isUploadingDocument}
                            className="w-full h-14 rounded-2xl bg-gold-accent text-[#0f141e] text-[11px] font-black uppercase tracking-widest shadow-gold-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isUploadingDocument ? "Memproses Unggahan..." : "Daftarkan Dokumen"}
                        </button>
                    </form>
                </div>
            </section>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Timeline Header */}
            <section className="glass-card backdrop-blur-xl rounded-premium p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl backdrop-blur-md" />
                <div className="flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 backdrop-blur-md">
                        <span className="material-symbols-outlined text-3xl">history</span>
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Jejak Aktifitas Lokasi</h2>
                        <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Audit trail komprehensif seluruh operasional tenant</p>
                    </div>
                </div>
            </section>

            {/* Timeline Lineage */}
            <section className="relative px-4">
                <div className="absolute left-[39px] top-4 bottom-4 w-px bg-white/5 backdrop-blur-md" />
                
                <div className="space-y-6">
                    {displayTimeline.length === 0 && (
                        <div className="glass-card backdrop-blur-xl rounded-2xl p-10 border-white/5 text-center">
                            <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest">Belum ada aktifitas yang tercatat di sistem ini.</p>
                        </div>
                    )}
                    {displayTimeline.map((event, idx) => {
                        const icon = timelineIconMap[event.type] ?? "history";

                        return (
                            <div key={event.id} className="flex gap-10 group/item relative">
                                {/* Dot & Icon */}
                                <div className="relative shrink-0 pt-2">
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500 z-10 relative ${idx === 0 ? 'bg-emerald-500 border-emerald-400 text-[#0f141e] shadow-emerald-glow' : 'bg-[#0f141e] border-white/10 text-white/40 group-hover/item:border-white/30 group-hover/item:text-white'}`}>
                                        <span className="material-symbols-outlined text-2xl">{icon}</span>
                                    </div>
                                    {idx === 0 && (
                                        <div className="absolute inset-0 rounded-2xl bg-emerald-500 blur-xl opacity-20 animate-pulse" />
                                    )}
                                </div>

                                {/* Content Card */}
                                <div className="flex-1 glass-card backdrop-blur-xl rounded-2xl p-6 border-white/5 group-hover/item:border-white/10 transition-all duration-300 group-hover/item:translate-x-1">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${idx === 0 ? 'bg-emerald-500 text-[#0f141e]' : 'bg-white/5 text-white/30'}`}>
                                                    {event.type.replace(/_/g, ' ')}
                                                </span>
                                                <h4 className="text-[14px] font-black text-white uppercase tracking-tight group-hover/item:text-emerald-400 transition-colors">
                                                    {event.title}
                                                </h4>
                                            </div>
                                            <p className="text-[11px] font-medium text-white/40 leading-relaxed max-w-2xl">
                                                {event.description}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{formatDateTime(event.date)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-6 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center text-white/20 backdrop-blur-md">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                            </div>
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                                                Actor: <span className="text-white/40">{event.actor || "System Automated"}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
          </div>
        )}

        {billingEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-primary">
                    Invoice
                  </p>
                  <h3 className="text-xl font-bold text-on-surface">
                    Edit Periode Tagihan
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Ubah billing cycle kontrak langsung dari tab Invoice.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200"
                  onClick={() => setBillingEditor(null)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">
                    close
                  </span>
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleSaveBillingCycle}>
                <FieldInput
                  label="Periode Tagihan"
                  type="number"
                  value={billingEditor.billingEvery}
                  onChange={(value) =>
                    setBillingEditor((previous) =>
                      previous
                        ? { ...previous, billingEvery: value }
                        : previous,
                    )
                  }
                />
                <GlassSelect
                  label="Satuan"
                  value={billingEditor.billingUnit}
                  onChange={(value) =>
                    setBillingEditor((previous) =>
                      previous ? { ...previous, billingUnit: value } : previous,
                    )
                  }
                  options={[
                    { value: "bulan", label: "Bulan" },
                    { value: "hari", label: "Hari" },
                    { value: "tahun", label: "Tahun" },
                  ]}
                />
                {billingError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {billingError}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                    onClick={() => setBillingEditor(null)}
                    type="button"
                  >
                    Batal
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingBilling}
                    type="submit"
                  >
                    {isSavingBilling ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {versionEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-primary">
                    Ubah / Upgrade Paket
                  </p>
                  <h3 className="text-xl font-bold text-on-surface">
                    {tenantName}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Paket lama berlaku sampai akhir bulan berjalan. Paket baru aktif mulai bulan berikutnya.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200"
                  onClick={() => setVersionEditor(null)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">
                    close
                  </span>
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreateVersion}>
                <GlassSelect
                  label="Alasan Kontrak"
                  value={versionEditor.reason ?? "ubah_paket"}
                  onChange={(value) =>
                    setVersionEditor((previous) =>
                      previous ? { ...previous, reason: value } : previous,
                    )
                  }
                  options={[
                    { value: "ubah_paket", label: "Ubah Paket" },
                    { value: "lainnya", label: "Alasan Lain" },
                  ]}
                />
                {(versionEditor.reason ?? "ubah_paket") === "lainnya" && (
                  <FieldInput
                    label="Input Alasan Lain"
                    value={versionEditor.customReason ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, customReason: value } : previous,
                      )
                    }
                    placeholder="Tulis alasan perubahan kontrak"
                  />
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldInput
                    label="Tanggal Request Perubahan"
                    type="date"
                    value={versionEditor.requestedDate ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, requestedDate: value } : previous,
                      )
                    }
                  />
                  <FieldInput
                    label="Nomor Kontrak / BAK Baru"
                    value={versionEditor.contractNumber ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, contractNumber: value } : previous,
                      )
                    }
                    placeholder="Opsional"
                  />
                </div>
                <FieldSelect
                  label="Paket Baru"
                  value={versionEditor.packageType ?? "sharing_core"}
                  onChange={(value) =>
                    setVersionEditor((previous) =>
                      previous ? { ...previous, packageType: value } : previous,
                    )
                  }
                  options={[
                    { value: "sharing_core", label: "Sharing Core" },
                    { value: "core", label: "Core" },
                  ]}
                />
                {(versionEditor.packageType ?? "sharing_core") === "sharing_core" ? (
                  <FieldInput
                    label="Shared Core Ratio Baru"
                    value={versionEditor.ratio ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, ratio: value } : previous,
                      )
                    }
                    placeholder="Contoh: 1:32"
                  />
                ) : (
                  <FieldInput
                    label="Jumlah Core Baru"
                    type="number"
                    value={versionEditor.coreTotal ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, coreTotal: value } : previous,
                      )
                    }
                    placeholder="Contoh: 2"
                  />
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldInput
                    label="Nominal Bulanan Baru"
                    type="number"
                    value={versionEditor.monthlyAmount ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, monthlyAmount: value, yearlyAmount: String(Number(value || 0) * 12 || "") } : previous,
                      )
                    }
                    placeholder="Contoh: 350000"
                  />
                  <FieldInput
                    label="Nominal Tahunan Baru"
                    type="number"
                    value={versionEditor.yearlyAmount ?? ""}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, yearlyAmount: value } : previous,
                      )
                    }
                    placeholder="Contoh: 4200000"
                  />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                  Paket lama berlaku sampai {formatDate(addDaysToIsoDate(getFirstDayOfNextMonth(versionEditor.requestedDate), -1))}. Paket baru aktif mulai {formatDate(getFirstDayOfNextMonth(versionEditor.requestedDate))}. Invoice belum lunas mulai bulan tersebut akan memakai nominal baru.
                </div>
                {versionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {versionError}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                    onClick={() => setVersionEditor(null)}
                    type="button"
                  >
                    Batal
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmittingVersion}
                    type="submit"
                  >
                    {isSubmittingVersion ? "Menyimpan..." : "Simpan Perubahan Paket"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-red-600">
                  Hapus Lokasi
                </p>
                <h3 className="text-xl font-bold text-on-surface">
                  {tenantName}
                </h3>
              </div>
              <p className="text-sm text-on-surface-variant">
                Lokasi ini akan dipindahkan ke sampah dan tidak lagi tampil di daftar lokasi aktif.
              </p>
              {deleteError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {deleteError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                  onClick={() => setDeleteModalOpen(false)}
                  type="button"
                >
                  Batal
                </button>
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDeletingTenant}
                  onClick={() => void handleDeleteTenant()}
                  type="button"
                >
                  {isDeletingTenant ? "Menghapus..." : "Hapus Lokasi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default TenantDetailPage;
