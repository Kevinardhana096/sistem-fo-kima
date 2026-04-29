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
  timelineColorMap,
  timelineIconMap,
} from "../../app/constants";
import {
  API_BASE_URL,
  addDaysToIsoDate,
  fetchJson,
  formatCurrency,
  formatDate,
  formatDateTime,
  isOpenableFileUrl,
  readFileAsDataUrl,
  toTitleCase,
} from "../../app/utils";

const ROUTE_OPERATION_LABEL_MAP = {
  add: "Tambah Titik",
  update: "Edit Titik",
  delete: "Hapus Titik",
  reorder: "Atur Ulang Urutan",
  status: "Ubah Status Jalur",
  replace: "Setel Ulang Jalur",
  commit: "Simpan Jalur",
};

function TenantDetailPage({
  customer,
  contextIsp,
  initialTab = "overview",
  onBack,
  onEditTenant,
  onNavigate,
  onOpenRoutePlanner,
  onTabChange,
  onRefreshAll,
  routeViewMode = "embedded",
  backLabel = "Kembali ke Customer Page",
  hideSidebar = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
  const [versionEditor, setVersionEditor] = useState(null);
  const [versionError, setVersionError] = useState("");
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState(
    contextIsp?.id ? "this" : "selected",
  );
  const [selectedDeleteIspIds, setSelectedDeleteIspIds] = useState([]);
  const [deleteError, setDeleteError] = useState("");
  const [isDeletingLink, setIsDeletingLink] = useState(false);
  const [invoiceSetDateMode, setInvoiceSetDateMode] = useState("manual");
  const [invoiceFixedDueDay, setInvoiceFixedDueDay] = useState("1");
  const [invoicePaymentOrderSort, setInvoicePaymentOrderSort] = useState("asc");
  const [invoiceDrafts, setInvoiceDrafts] = useState({});
  const [invoiceFeedback, setInvoiceFeedback] = useState("");
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [invoiceEditingId, setInvoiceEditingId] = useState(null);
  const [billingEditor, setBillingEditor] = useState(null);
  const [billingError, setBillingError] = useState("");
  const [isSavingBilling, setIsSavingBilling] = useState(false);
  const [contractNumberInput, setContractNumberInput] = useState("");
  const [isSavingContractNumber, setIsSavingContractNumber] = useState(false);
  const [emptyContractNumberRows, setEmptyContractNumberRows] = useState({});
  const [emptyBakRows, setEmptyBakRows] = useState({});
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeFeedback, setRouteFeedback] = useState("");
  const [routeError, setRouteError] = useState("");
  const [routeChangeNote, setRouteChangeNote] = useState("");
  const [routeEditMode, setRouteEditMode] = useState("edit");
  const [isRouteDrafting, setIsRouteDrafting] = useState(false);
  const [draftRoutePoints, setDraftRoutePoints] = useState([]);
  const [draftRouteStatus, setDraftRouteStatus] = useState("aktif");

  const [routePointForm, setRoutePointForm] = useState({
    pathName: "",
    pointType: "transit",
    note: "",
  });
  const [editingRoutePointId, setEditingRoutePointId] = useState(null);
  const emptyStateStorageKey = `tenant-contract-empty-state-${customer.id}`;
  const handleSelectTab = useCallback(
    (tabKey) => {
      setActiveTab(tabKey);
      onTabChange?.(tabKey);
    },
    [onTabChange],
  );
  const isStandaloneJalurView = routeViewMode !== "embedded";
  const isPlannerJalurView = routeViewMode === "planner";

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [detailResult, timelineResult] = await Promise.all([
        fetchJson(`${API_BASE_URL}/api/customers/${customer.id}`),
        fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/timeline`),
      ]);
      setDetail(detailResult ?? null);
      setTimeline(Array.isArray(timelineResult) ? timelineResult : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat memuat tenant.",
      );
    } finally {
      setIsLoading(false);
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

  const tenantName = detail?.name ?? customer?.name;
  const isps = Array.isArray(detail?.isps) ? detail.isps : [];
  const contract = Array.isArray(detail?.contracts)
    ? (detail.contracts[0] ?? null)
    : null;
  const versions = Array.isArray(detail?.contractVersions)
    ? detail.contractVersions
    : [];
  const invoices = useMemo(
    () => (Array.isArray(detail?.invoices) ? detail.invoices : []),
    [detail?.invoices],
  );
  const activeInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.scheduleStatus !== "history"),
    [invoices],
  );
  const historyInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.scheduleStatus === "history"),
    [invoices],
  );
  const todoSummary = detail?.todoSummary ?? {
    priority: [],
    needAction: [],
    info: [],
    counts: {},
  };
  const latestDocuments = Array.isArray(detail?.latestDocuments)
    ? detail.latestDocuments
    : [];
  const requiredDocuments = latestDocuments.filter((item) =>
    ["penawaran", "tanggapan", "hasil_nego"].includes(item.jenisDokumen),
  );
  const allDocuments = latestDocuments; // Now includes all documents uploaded by user
  const todayIso = new Date().toISOString().slice(0, 10);
  const activationFeePaidAt =
    detail?.activationFeePaidAt ?? customer?.activationFeePaidAt ?? null;
  const activationFeeAmount = Number(
    detail?.activationFeeAmount ?? customer?.activationFeeAmount ?? 0,
  );
  const activeRouteId = detail?.route?.activeRouteId ?? null;
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

  const activeAwalPoint =
    routePoints.find((point) => point.pointType === "awal") ?? null;
  const activeTujuanPoint =
    routePoints.find((point) => point.pointType === "tujuan") ?? null;
  const transitPointIds = routePoints
    .filter((point) => point.pointType === "transit")
    .map((point) => point.id);
  const previewRoutePoints = useMemo(
    () =>
      routePoints
        .map((point, index, list) => {
          const noteText = String(point?.note ?? "");
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
    [routePoints],
  );
  useEffect(() => {
    setContractNumberInput(String(contract?.contractNumber ?? ""));
  }, [contract?.contractNumber, contract?.id]);

  const resolveInvoiceStatusMeta = (invoice) => {
    const hasInvoiceFile =
      typeof invoice?.invoiceFileUrl === "string" &&
      invoice.invoiceFileUrl.trim().length > 0;
    const hasPaymentProof =
      typeof invoice?.paymentProofFileUrl === "string" &&
      invoice.paymentProofFileUrl.trim().length > 0;

    if (hasPaymentProof) {
      return {
        key: "paid",
        label: "Paid",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    }

    if (invoice?.status === "terlambat") {
      return {
        key: "overdue",
        label: "Overdue",
        badgeClass: "bg-amber-100 text-amber-700",
      };
    }

    if (hasInvoiceFile) {
      return {
        key: "unpaid",
        label: "Unpaid",
        badgeClass: "bg-rose-100 text-rose-700",
      };
    }

    return {
      key: "pending",
      label: "Pending",
      badgeClass: "bg-slate-100 text-slate-700",
    };
  };

  const getInvoiceFollowUps = (invoice) => {
    const followUps = Array.isArray(invoice?.invoiceFollowUps)
      ? invoice.invoiceFollowUps
      : [];
    return [...followUps].sort(
      (left, right) =>
        Number(left?.splitOrder ?? 0) - Number(right?.splitOrder ?? 0),
    );
  };

  const hasUploadedInvoiceSplit = (invoice) =>
    getInvoiceFollowUps(invoice).some((followUp) =>
      isOpenableFileUrl(followUp?.invoiceFileUrl),
    );

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

  const invoiceRows = useMemo(
    () =>
      sortedInvoices.map((invoice, index) => ({
        ...invoice,
        paymentOrder: index + 1,
        statusMeta: resolveInvoiceStatusMeta(invoice),
      })),
    [sortedInvoices],
  );

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
            previousFollowUpDrafts.initial?.invoiceNumber ?? "",
          ),
        };

        nextDrafts[invoice.id] = {
          dueDate: previousDraft.dueDate ?? String(invoice.dueDate ?? ""),
          amount: previousDraft.amount ?? normalizedAmount,
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

        return {
          ...invoice,
          workflowDueDate: dueDateValue,
          workflowAmount: amountValue,
          activeReminderSplits,
        };
      }),
    [invoiceRows, invoiceDrafts],
  );

  const paidInvoiceCount = invoiceRows.filter(
    (invoice) => invoice.statusMeta.key === "paid",
  ).length;
  const unpaidInvoiceCount = invoiceRows.filter((invoice) =>
    ["unpaid", "overdue"].includes(invoice.statusMeta.key),
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
    workflowInvoiceRows.find((invoice) => {
      const hasPaymentProof =
        typeof invoice?.paymentProofFileUrl === "string" &&
        invoice.paymentProofFileUrl.trim().length > 0;
      const hasInvoiceFile = hasUploadedInvoiceSplit(invoice);
      const dueDate =
        typeof invoice?.workflowDueDate === "string"
          ? invoice.workflowDueDate
          : "";
      const amountValue = Number(invoice?.workflowAmount ?? 0);

      if (hasPaymentProof || hasInvoiceFile) {
        return false;
      }

      if (!dueDate || amountValue <= 0) {
        return false;
      }

      const reminderDate = addDaysToIsoDate(dueDate, -7);
      return reminderDate <= todayIso;
    }) ?? null;

  const nextActionMeta = (() => {
    if (!nextActionInvoice) {
      return null;
    }

    const dueDate =
      typeof nextActionInvoice?.workflowDueDate === "string"
        ? nextActionInvoice.workflowDueDate
        : "";
    return {
      type: "upload_h_minus_7",
      title: `Peringatan H-7 pembayaran ke-${nextActionInvoice.paymentOrder}`,
      message:
        "Mendekati jatuh tempo. Isi nomor invoice awal lalu upload invoice untuk pembayaran ini.",
      dueDate,
    };
  })();

  const primaryContractRowMarkerId =
    versions.length > 0
      ? `version-${versions[0]?.id ?? 0}`
      : contract
        ? `contract-${contract.id}`
        : null;
  const hasContractNumberValue = Boolean(
    String(contract?.contractNumber ?? "").trim(),
  );
  const isContractNumberExplicitlyEmpty = Object.values(
    emptyContractNumberRows,
  ).some(Boolean);

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
  const packageLabel = String(
    detail?.paket ?? customer?.paket ?? "",
  ).toLowerCase();
  const isSharedCorePackage = packageLabel.includes("shared");
  const resolveContractActualValue = (version) => {
    if (version) {
      const versionType = String(version.coreType ?? "").toLowerCase();

      if (versionType === "core") {
        return version.coreTotal ?? detail?.jumlah ?? customer?.jumlah ?? "-";
      }

      return (
        version.sharedCoreRatio ??
        detail?.contractSharingRatio ??
        detail?.jumlah ??
        customer?.contractSharingRatio ??
        customer?.jumlah ??
        "-"
      );
    }

    if (isSharedCorePackage) {
      return (
        detail?.contractSharingRatio ??
        detail?.jumlah ??
        customer?.contractSharingRatio ??
        customer?.jumlah ??
        "-"
      );
    }

    return detail?.jumlah ?? customer?.jumlah ?? "-";
  };
  const contractRowsForTable =
    versions.length > 0
      ? versions.map((version, index) => {
          const normalizedCoreType = String(
            version?.coreType ?? "",
          ).toLowerCase();
          const paketLabel = normalizedCoreType
            ? normalizedCoreType.replace(/_/g, " ").toUpperCase()
            : String(detail?.paket || customer?.paket || "CORE").toUpperCase();

          return {
            id: `version-${version.id ?? index}`,
            contractId: contract?.id ?? null,
            versionId: version?.id ?? null,
            number: index + 1,
            contractNumber: contract?.contractNumber ?? "",
            note: index === 0 ? "Kontrak Beroperasi" : "Riwayat Perubahan",
            periodStart: version?.startDate ?? contract?.startDate ?? "",
            periodEnd: version?.endDate ?? contract?.endDate ?? "",
            paket: paketLabel,
            jumlahPaket: resolveContractActualValue(version),
            hasBak: Boolean(version?.bakDocumentId),
            renewalFollowUps: Array.isArray(version?.renewalFollowUps)
              ? version.renewalFollowUps
              : [],
          };
        })
      : contract
        ? [
            {
              id: `contract-${contract.id}`,
              contractId: contract.id,
              versionId: null,
              number: 1,
              contractNumber: contract.contractNumber ?? "",
              note: "Kontrak Awal",
              periodStart: contract.startDate ?? "",
              periodEnd: contract.endDate ?? "",
              paket: String(
                detail?.paket || customer?.paket || "CORE",
              ).toUpperCase(),
              jumlahPaket: resolveContractActualValue(null),
              hasBak: false,
              renewalFollowUps: [],
            },
          ]
        : [];

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
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${contract.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billingEvery,
            billingUnit: billingEditor.billingUnit,
          }),
        },
      );

      setBillingEditor(null);
      setInvoiceFeedback(
        "Periode tagihan berhasil diperbarui. Jadwal invoice aktif direstrukturisasi, sementara invoice lunas tetap tersimpan sebagai riwayat.",
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

  const handleSaveContractNumber = async () => {
    if (!contract?.id) {
      setError(
        "Kontrak beroperasi tidak ditemukan untuk update nomor kontrak.",
      );
      return;
    }

    const normalizedContractNumber = contractNumberInput.trim();
    if (!normalizedContractNumber) {
      setError("Nomor kontrak wajib diisi sebelum disimpan.");
      return;
    }

    setIsSavingContractNumber(true);
    setError("");

    try {
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${contract.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractNumber: normalizedContractNumber,
          }),
        },
      );

      setEmptyContractNumberRows({});
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
    setVersionEditor({
      reason: "ubah_paket",
      customReason: "",
      startDate: todayIso,
      endDate: latestVersion?.endDate ?? contract?.endDate ?? todayIso,
      ratio: latestVersion?.sharedCoreRatio ?? contract?.sharingRatio ?? "1:8",
    });
    setVersionError("");
  };

  const handleCreateVersion = async (event) => {
    event.preventDefault();
    if (!contract || !versionEditor) {
      return;
    }
    if (!/^[1-9]\d*:[1-9]\d*$/.test(versionEditor.ratio.trim())) {
      setVersionError("Rasio shared core tidak valid.");
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
    try {
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${contract.id}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: versionEditor.startDate,
            endDate: versionEditor.endDate,
            sharedCoreRatio: versionEditor.ratio.trim(),
          }),
        },
      );
      setVersionEditor(null);
      setDocumentFeedback(
        "Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.",
      );
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setVersionError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat membuat versi kontrak.",
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
      const formData = new FormData();
      formData.append("jenisDokumen", documentDraft.jenisDokumen);
      if (documentDraft.nomorDokumen.trim())
        formData.append("nomorDokumen", documentDraft.nomorDokumen.trim());
      if (documentDraft.tanggalDokumen)
        formData.append("tanggalDokumen", documentDraft.tanggalDokumen);
      if (contract?.id) formData.append("contractId", String(contract.id));
      if (documentDraft.contractVersionId)
        formData.append(
          "contractVersionId",
          String(Number(documentDraft.contractVersionId)),
        );
      formData.append("file", documentDraft.uploadedFile);

      const result = await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      const actions = Array.isArray(result?.automation?.actions)
        ? result.automation.actions
        : [];
      setDocumentFeedback(actions.join(" ") || "Dokumen berhasil diunggah.");
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

  const handleRemoveTenantLinks = async () => {
    setIsDeletingLink(true);
    setDeleteError("");
    try {
      const payload =
        deleteMode === "this"
          ? { mode: "this", ispId: contextIsp?.id }
          : deleteMode === "all"
            ? { mode: "all" }
            : { mode: "selected", ispIds: selectedDeleteIspIds };

      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/isps/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setDeleteModalOpen(false);
      await Promise.all([loadDetail(), onRefreshAll?.()]);
    } catch (requestError) {
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Terjadi kesalahan saat menghapus relasi tenant.",
      );
    } finally {
      setIsDeletingLink(false);
    }
  };

  const handleOpenDeleteModal = () => {
    setDeleteError("");
    setSelectedDeleteIspIds([]);
    setDeleteMode(contextIsp?.id ? "this" : "selected");
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
      const endpoint =
        routeEditMode === "ubah_jalur"
          ? `${API_BASE_URL}/api/customers/${customer.id}/routes/change`
          : `${API_BASE_URL}/api/customers/${customer.id}/routes/edit`;

      const payload = {
        ...body,
        ...(routeEditMode === "ubah_jalur"
          ? {
              changeNote:
                routeChangeNote.trim() ||
                "Perubahan struktur jalur dari halaman tenant.",
            }
          : {}),
      };

      await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setRouteFeedback(
        routeEditMode === "ubah_jalur"
          ? `${successMessage} Riwayat perubahan jalur berhasil dicatat.`
          : successMessage,
      );

      setEditingRoutePointId(null);
      setRoutePointForm({ pathName: "", pointType: "transit", note: "" });
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

  const handleSubmitRoutePoint = async (event) => {
    event.preventDefault();
    if (!activeRouteId) return;

    const normalizedPathName = routePointForm.pathName.trim();
    if (!normalizedPathName) {
      setRouteError("Nama jalan/lintasan wajib diisi.");
      return;
    }

    if (isRouteDrafting) {
      setRouteError(null);
      if (editingRoutePointId) {
        setDraftRoutePoints((prev) =>
          prev.map((p) =>
            p.id === editingRoutePointId
              ? {
                  ...p,
                  pathName: normalizedPathName,
                  pointType: routePointForm.pointType,
                  note: routePointForm.note,
                }
              : p,
          ),
        );
        setEditingRoutePointId(null);
        setRouteFeedback("Titik draft diperbarui.");
      } else {
        const newPoint = {
          id: Date.now(), // Temp ID
          pathName: normalizedPathName,
          pointType: routePointForm.pointType,
          note: routePointForm.note,
          orderNumber: draftRoutePoints.length + 1,
        };
        setDraftRoutePoints((prev) => [...prev, newPoint]);
        setRouteFeedback("Titik ditambahkan ke draft.");
      }
      setRoutePointForm({ pathName: "", pointType: "transit", note: "" });
      setTimeout(() => setRouteFeedback(""), 3000);
      return;
    }

    // Quick Edit Mode
    if (editingRoutePointId) {
      await runRouteMutation(
        {
          operation: "update",
          pointId: editingRoutePointId,
          pathName: normalizedPathName,
          pointType: routePointForm.pointType,
          note: routePointForm.note,
        },
        "Titik jalur berhasil diperbarui.",
      );
      return;
    }

    await runRouteMutation(
      {
        operation: "add",
        pathName: normalizedPathName,
        pointType: routePointForm.pointType,
        note: routePointForm.note,
      },
      "Titik jalur berhasil ditambahkan.",
    );
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
      const payload = {
        operation: "replace",
        changeNote: routeChangeNote,
        flowStatus: draftRouteStatus,
        points: (Array.isArray(draftRoutePoints) ? draftRoutePoints : []).map(
          (p, idx) => ({
            pathName: p.pathName,
            pointType: p.pointType,
            note: p.note,
            orderNumber: idx + 1,
          }),
        ),
      };

      const response = await fetch(
        `${API_BASE_URL}/api/customers/${customer.id}/routes/change`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Gagal menyimpan struktur jalur.");
      }

      setRouteChangeNote("");
      setIsRouteDrafting(false);
      setDraftRoutePoints([]);
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
    setEditingRoutePointId(null);
    setRoutePointForm({ pathName: "", pointType: "transit", note: "" });
    setRouteError("");
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

  const handleDeleteHistory = async (historyId) => {
    if (
      !confirm(
        "Hapus catatan riwayat ini? Tindakan ini tidak dapat dibatalkan.",
      )
    )
      return;

    setRouteBusy(true);
    setRouteError("");
    setRouteFeedback("");
    try {
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/routes/history/${historyId}`,
        {
          method: "DELETE",
        },
      );
      setRouteFeedback("Riwayat berhasil dihapus.");
      await loadDetail();
    } catch (requestError) {
      setRouteError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menghapus riwayat.",
      );
    } finally {
      setRouteBusy(false);
    }
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
      const result = await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/routes/history`,
        {
          method: "DELETE",
        },
      );
      const deletedCount = Number(result?.deletedCount ?? 0);
      setRouteFeedback(
        deletedCount > 0
          ? `${deletedCount} riwayat jalur berhasil dihapus.`
          : "Tidak ada riwayat jalur yang perlu dihapus.",
      );
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

  const handleEditRoutePoint = (point) => {
    setEditingRoutePointId(point.id);
    setRouteError("");
    setRouteFeedback("");
    setRoutePointForm({
      pathName: point.pathName ?? "",
      pointType: point.pointType ?? "transit",
      note: point.note ?? "",
    });

    // Scroll to form
    const formEl = document.getElementById("route-point-form");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const handleFlowStatusChange = async (nextStatus) => {
    if (isRouteDrafting) {
      setDraftRouteStatus(nextStatus);
      return;
    }
    await runRouteMutation(
      {
        operation: "status",
        flowStatus: nextStatus,
      },
      "Status jalur berhasil diperbarui.",
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
    setRouteEditMode("ubah_jalur");
    setEditingRoutePointId(null);
    setDraftRoutePoints(
      plannedPoints.map((point, index) => ({
        ...point,
        id: point?.id ?? `draft-planner-${Date.now()}-${index}`,
        orderNumber: index + 1,
      })),
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

  const getInvoiceDraft = (invoice) => {
    const existingDraft = invoiceDrafts[invoice.id] ?? {};

    return {
      dueDate: String(existingDraft.dueDate ?? invoice?.dueDate ?? ""),
      amount: String(
        existingDraft.amount ??
          (Number.isFinite(Number(invoice.amount))
            ? Math.max(0, Math.round(Number(invoice.amount)))
            : 0),
      ),
      followUps: existingDraft.followUps ?? {},
    };
  };

  const getInvoiceFollowUpDraft = (invoice, followUp = null) => {
    const draft = getInvoiceDraft(invoice);
    const followUpKey = followUp?.id ? String(followUp.id) : "initial";
    return {
      invoiceNumber: String(
        draft.followUps?.[followUpKey]?.invoiceNumber ??
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
    nextFollowUpDrafts.initial = { invoiceNumber: "" };

    setInvoiceDrafts((previousDrafts) => ({
      ...previousDrafts,
      [invoice.id]: {
        dueDate: String(invoice?.dueDate ?? ""),
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
      const followUpPayload = getInvoiceFollowUps(invoice).map((followUp) => ({
        id: followUp.id,
        invoiceNumber:
          getInvoiceFollowUpDraft(invoice, followUp).invoiceNumber.trim() ||
          null,
      }));

      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dueDate: draft.dueDate || null,
            amount,
            invoiceFollowUps: followUpPayload,
          }),
        },
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

  const handleUploadInvoiceFile = async (invoice, file, followUpId = null) => {
    if (!file) {
      return;
    }

    const draft = getInvoiceDraft(invoice);
    const targetFollowUp =
      getInvoiceFollowUps(invoice).find(
        (followUp) => followUp.id === followUpId,
      ) ?? null;
    const followUpDraft = getInvoiceFollowUpDraft(invoice, targetFollowUp);
    const validationMessage = validateInvoiceDraftForUpload(
      draft,
      followUpDraft,
    );
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const amount = Number(draft.amount);

    setIsSavingInvoice(true);
    setError("");
    setInvoiceFeedback("");
    try {
      const invoiceFileUrl = await readFileAsDataUrl(file);
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followUpId,
            invoiceNumber: followUpDraft.invoiceNumber.trim(),
            dueDate: draft.dueDate,
            amount,
            invoiceFileUrl,
          }),
        },
      );
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

    if (!hasUploadedInvoiceSplit(invoice)) {
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
      const paymentProofFileUrl = await readFileAsDataUrl(file);
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentProofFileUrl,
          }),
        },
      );
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

          return fetchJson(
            `${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dueDate }),
            },
          );
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
      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${row.contractId}/versions/${row.versionId}/follow-ups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
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
      const formData = new FormData();
      formData.append("file", file);
      if (followUpId) formData.append("followUpId", String(followUpId));

      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${row.contractId}/versions/${row.versionId}/renewal`,
        {
          method: "POST",
          body: formData,
        },
      );
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("decision", decision);
      if (followUpId) formData.append("followUpId", String(followUpId));

      await fetchJson(
        `${API_BASE_URL}/api/customers/${customer.id}/contracts/${row.contractId}/versions/${row.versionId}/response`,
        {
          method: "POST",
          body: formData,
        },
      );
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
          <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200">
            Upload
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                void handleUploadTenantRenewal(
                  row,
                  event.target.files?.[0] ?? null,
                );
              }}
            />
          </label>
        );
      }

      return (
        <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
          Belum Ada
        </span>
      );
    }

    return (
      <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
        {followUps.map((followUp) => {
          const hasRenewalFile = isOpenableFileUrl(followUp?.renewalFileUrl);
          const hasResponseFile = isOpenableFileUrl(followUp?.responseFileUrl);
          const sourceLabel =
            followUp?.source === "auto"
              ? "Auto"
              : followUp?.source === "manual"
                ? "Manual"
                : "Upload";

          return (
            <div key={followUp.id} className="bg-white px-3 py-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Split {followUp.splitOrder}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {sourceLabel}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-on-surface">
                {followUp.title}
              </p>
              {columnType === "renewal" ? (
                <div className="mt-2">
                  {hasRenewalFile ? (
                    <a
                      href={followUp.renewalFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-bold text-[11px] uppercase tracking-wider"
                    >
                      Buka Berkas
                    </a>
                  ) : (
                    <label className="cursor-pointer rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200">
                      Upload
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          void handleUploadTenantRenewal(
                            row,
                            event.target.files?.[0] ?? null,
                            followUp.id,
                          );
                        }}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  {hasResponseFile ? (
                    <a
                      href={followUp.responseFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-bold text-[11px] uppercase tracking-wider"
                    >
                      Tanggapan
                    </a>
                  ) : hasRenewalFile ? (
                    <div className="flex flex-col items-start gap-2">
                      <label className="relative rounded bg-primary px-2 py-1 text-[10px] font-bold text-white">
                        Lanjut
                        <input
                          type="file"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          onChange={(event) => {
                            void handleRespondTenantRenewal(
                              row,
                              "lanjut",
                              event.target.files?.[0] ?? null,
                              followUp.id,
                            );
                          }}
                        />
                      </label>
                      <label className="relative rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">
                        Tidak
                        <input
                          type="file"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          onChange={(event) => {
                            void handleRespondTenantRenewal(
                              row,
                              "tidak",
                              event.target.files?.[0] ?? null,
                              followUp.id,
                            );
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-400">
                      Menunggu upload perpanjangan
                    </span>
                  )}
                </div>
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
        hideSidebar={true}
        full={true}
      >
        <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-manrope antialiased">
          {/* Combined Top Overlay UI - Optimized for Mobile */}
          <div className="absolute inset-x-0 top-0 z-[1000] flex items-start justify-center p-4 pointer-events-none md:p-6">
            {/* Back Button - Positioned to the right */}
            <div className="absolute right-4 top-4 md:right-6 md:top-6">
              <button
                className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 font-black text-primary shadow-2xl transition-all hover:scale-105 active:scale-95 border border-slate-200 md:h-12 md:px-5"
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
            <header className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-2xl bg-slate-900/80 px-4 py-2 shadow-2xl backdrop-blur-md border border-white/10 md:p-4 md:min-w-[300px]">
              <h1 className="text-[10px] md:text-sm font-black text-white uppercase tracking-[0.1em] md:tracking-[0.2em] truncate max-w-[150px] md:max-w-none text-center">
                {tenantName}
              </h1>
              <div className="flex items-center gap-1.5 md:gap-3 text-[8px] md:text-[10px] font-bold text-white/60">
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-primary border border-primary/30 uppercase tracking-tighter">
                  {(detail?.paket || customer?.paket || "CORE")}
                </span>
                <span className="hidden md:block w-1 h-1 rounded-full bg-white/20"></span>
                <span className="uppercase tracking-widest hidden md:block">
                  ISP: {isps.length > 0 ? isps.map((item) => item.name).join(", ") : "-"}
                </span>
              </div>
            </header>
          </div>

          {/* Map Container */}
          <div className="h-full w-full">
            <FoRoutePlanner
              disabled={routeBusy}
              onApplyPlannedRoute={(plannedPoints, plannerMeta) => {
                handleApplyPlannedRoute(plannedPoints, plannerMeta);
                window.setTimeout(() => onBack?.(), 800);
              }}
              mode="full"
              providerIconUrl={isps[0]?.logoUrl || ""}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { key: "overview", label: "Ringkasan" },
    { key: "jalur", label: "Jalur" },
    { key: "contracts", label: "Kontrak & Riwayat" },
    { key: "invoices", label: "Tagihan / Invoice" },
    { key: "documents", label: "Arsip Dokumen" },
    { key: "timeline", label: "Timeline Aktifitas" },
  ];

  return (
    <AppShell
      activeSection="customers"
      onNavigate={onNavigate}
      hideSidebar={hideSidebar}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container"
          onClick={onBack}
          type="button"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          {backLabel}
        </button>

        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                Tenant Detail
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold text-primary">
                  {tenantName}
                </h1>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${detail?.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                >
                  {detail?.status === "aktif" ? "Beroperasi" : "Berhenti"}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  Paket:{" "}
                  {(detail?.paket || customer?.paket || "CORE").toUpperCase()}
                </span>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                  Jumlah:{" "}
                  {detail?.contractSharingRatio ??
                    detail?.jumlah ??
                    customer?.contractSharingRatio ??
                    customer?.jumlah ??
                    "-"}
                </span>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                ISP:{" "}
                {isps.length > 0
                  ? isps.map((item) => item.name).join(", ")
                  : "-"}
              </p>
              {contextIsp?.name && (
                <p className="mt-1 text-sm text-on-surface-variant">
                  Dibuka dari grup ISP: {contextIsp.name}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl border border-primary bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                onClick={() =>
                  void Promise.all([loadDetail(), onRefreshAll?.()])
                }
                type="button"
              >
                Refresh
              </button>
              <button
                className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                onClick={() => onEditTenant?.(detail ?? customer)}
                type="button"
              >
                Edit Tenant
              </button>
              <button
                className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100"
                onClick={handleOpenDeleteModal}
                type="button"
              >
                Hapus Tenant
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {isLoading && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-on-surface-variant">
            Memuat detail tenant...
          </div>
        )}

        {!hideSidebar && (
          <div className="flex gap-6 overflow-x-auto border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={
                  activeTab === tab.key
                    ? "whitespace-nowrap border-b-2 border-primary pb-4 text-sm font-bold text-primary"
                    : "whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant hover:text-primary"
                }
                onClick={() => handleSelectTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-8">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Invoice Bulanan
                </p>
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-extrabold text-on-surface">
                    {invoiceRows.length}
                  </span>
                  <span className="text-sm font-semibold text-on-surface-variant mb-1">
                    Total
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-xs font-semibold">
                  <span className="text-emerald-600">
                    {paidInvoiceCount} Selesai
                  </span>
                  <span className="text-rose-600">
                    {invoiceRows.length - paidInvoiceCount} Belum Selesai
                  </span>
                </div>
              </div>
              <SummaryCard
                label="Butuh Action"
                value={totalActionItems}
                icon="pending_actions"
              />
              <SummaryCard
                label="Status Aktivasi"
                value={detail?.activationFeePaidAt ? "Lunas" : "Belum Lunas"}
                icon="payments"
              />
              <div className="flex flex-col col-span-2 rounded-xl bg-white p-5 shadow-sm border border-slate-100 justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-2xl text-blue-500">
                    calendar_month
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Periode Tagihan
                  </p>
                </div>
                <p className="text-xl font-bold text-on-surface">
                  Setiap {billingEvery} {billingUnitLabel}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Invoice dibuat otomatis H-7
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* Status Kelengkapan Berkas */}
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                  <span className="material-symbols-outlined text-xl">
                    task_alt
                  </span>
                  Status Kelengkapan Berkas
                </h2>
                <div className="space-y-3">
                  {displayPriorityTodos.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-600">
                        Prioritas Tinggi
                      </p>
                      {displayPriorityTodos.map((item) => (
                        <div
                          key={item.id}
                          className="mb-2 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3"
                        >
                          <span className="material-symbols-outlined mt-0.5 text-base text-red-500">
                            error
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-red-800">
                              {item.title}
                            </p>
                            <p className="text-xs text-red-600">
                              {item.message}
                            </p>
                            {item.dueDate && (
                              <p className="mt-1 text-[10px] text-red-400">
                                Tenggat: {formatDate(item.dueDate)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {displayNeedActionTodos.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-600">
                        Perlu Tindakan
                      </p>
                      {displayNeedActionTodos.map((item) => (
                        <div
                          key={item.id}
                          className="mb-2 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3"
                        >
                          <span className="material-symbols-outlined mt-0.5 text-base text-amber-500">
                            warning
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-amber-800">
                              {item.title}
                            </p>
                            <p className="text-xs text-amber-600">
                              {item.message}
                            </p>
                            {item.dueDate && (
                              <p className="mt-1 text-[10px] text-amber-400">
                                Tenggat: {formatDate(item.dueDate)}
                              </p>
                            )}
                            {item.code === "contract_number_missing_local" && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                  className="w-52 rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-amber-400 focus:outline-none"
                                  onChange={(event) =>
                                    setContractNumberInput(event.target.value)
                                  }
                                  placeholder="Masukkan nomor kontrak"
                                  type="text"
                                  value={contractNumberInput}
                                />
                                <button
                                  className="rounded bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isSavingContractNumber}
                                  onClick={() => {
                                    void handleSaveContractNumber();
                                  }}
                                  type="button"
                                >
                                  {isSavingContractNumber
                                    ? "Menyimpan..."
                                    : "Simpan Nomor"}
                                </button>
                                <button
                                  className="rounded border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={
                                    !primaryContractRowMarkerId ||
                                    isSavingContractNumber
                                  }
                                  onClick={() => {
                                    if (primaryContractRowMarkerId) {
                                      toggleContractNumberEmptyMark(
                                        primaryContractRowMarkerId,
                                      );
                                    }
                                  }}
                                  type="button"
                                >
                                  Tandai Memang Kosong
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {displayPriorityTodos.length === 0 &&
                    displayNeedActionTodos.length === 0 && (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                        <span className="material-symbols-outlined text-base text-emerald-500">
                          check_circle
                        </span>
                        <p className="text-sm font-semibold text-emerald-700">
                          Semua berkas lengkap. Tidak ada tindakan yang perlu
                          dilakukan.
                        </p>
                      </div>
                    )}
                </div>
              </div>

              {/* Biaya Aktivasi */}
              <div className="space-y-6">
                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                    <span className="material-symbols-outlined text-xl">
                      payments
                    </span>
                    Biaya Aktivasi
                  </h2>
                  {detail?.activationFeePaidAt ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                      <span className="material-symbols-outlined text-base text-emerald-500">
                        check_circle
                      </span>
                      <div>
                        <p className="text-sm font-bold text-emerald-700">
                          Selesai
                        </p>
                        <p className="text-xs text-emerald-600">
                          Dibayar pada {formatDate(detail.activationFeePaidAt)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3">
                      <span className="material-symbols-outlined text-base text-amber-500">
                        schedule
                      </span>
                      <div>
                        <p className="text-sm font-bold text-amber-700">
                          Menunggu Pembayaran
                        </p>
                        <p className="text-lg font-black text-amber-800">
                          {formatCurrency(
                            detail?.activationFeeAmount ??
                              customer.activationFeeAmount,
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dokumen Terbaru */}
                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                    <span className="material-symbols-outlined text-xl">
                      description
                    </span>
                    Dokumen Terbaru
                  </h2>
                  {requiredDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {requiredDocuments.slice(0, 3).map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3"
                        >
                          <span className="material-symbols-outlined text-base text-blue-400">
                            article
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-on-surface">
                              {documentTypeLabelMap[doc.jenisDokumen] ||
                                doc.jenisDokumen}
                            </p>
                            <p className="text-xs text-on-surface-variant">
                              {doc.nomorDokumen || "-"} •{" "}
                              {formatDate(doc.tanggalDokumen)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      Belum ada dokumen terunggah.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {/* Aktivitas Terbaru */}
              <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border-l-4 border-emerald-400">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                  <span className="material-symbols-outlined text-xl text-emerald-500">
                    history
                  </span>
                  Aktivitas Terbaru
                </h2>
                {displayTimeline.length > 0 ? (
                  <div className="space-y-3">
                    {displayTimeline.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="flex gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${timelineColorMap[event.type] ?? "text-slate-700 bg-slate-100"}`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {timelineIconMap[event.type] ?? "history"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">
                            {event.title}
                          </p>
                          <p className="text-xs text-on-surface-variant">
                            {event.description}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatDate(event.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Belum ada aktivitas tercatat.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === "jalur" && (
          <div className="space-y-6">
            {/* Header & Mode Selector */}
            <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border-l-4 border-amber-400">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="text-xl font-bold text-on-surface">
                    Manajemen Jalur Lintasan
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Kelola lintasan menuju lokasi tenant. Pisahkan antara
                    penambahan titik cepat atau perubahan struktur jalur yang
                    dicatat ke riwayat.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!isRouteDrafting ? (
                    <>
                      <button
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all shadow-sm ${routeEditMode === "edit" ? "bg-primary text-white scale-105" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                        onClick={() => setRouteEditMode("edit")}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">
                          edit_note
                        </span>
                        Edit Cepat
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-amber-600 shadow-sm hover:scale-105"
                        onClick={startDraftingSession}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">
                          Alt_Route
                        </span>
                        Ubah Struktur Jalur
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 animate-pulse">
                          Sedang Menyunting Draft
                        </span>
                        <span className="text-[9px] text-slate-500 italic">
                          Jalur lama tetap aktif sampai disimpan
                        </span>
                      </div>
                      <button
                        className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                        onClick={cancelDraftingSession}
                        type="button"
                      >
                        Batalkan Perubahan
                      </button>
                      <button
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-700 shadow-md transform hover:scale-105 ring-2 ring-emerald-500/20"
                        onClick={() => void handleCommitDraft()}
                        disabled={routeBusy}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">
                          check_circle
                        </span>
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

            <FoRoutePlanner
              mode="preview"
              onPreviewClick={() => onOpenRoutePlanner?.(detail ?? customer)}
              previewPoints={previewRoutePoints}
              providerIconUrl={isps[0]?.logoUrl || ""}
            />

            <div className="flex flex-col gap-8">
              <div className="space-y-8">
                {/* Form Tambah/Edit Titik */}
                <section
                  id="route-point-form"
                  className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm"
                >
                  <h3 className="mb-4 text-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">
                      add_location_alt
                    </span>
                    {editingRoutePointId
                      ? "Update Titik Jalur"
                      : "Tambah Titik Baru"}
                  </h3>
                  <form
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
                    onSubmit={(event) => {
                      void handleSubmitRoutePoint(event);
                    }}
                  >
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Nama Jalan / Lintasan
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary outline-none"
                        disabled={!activeRouteId}
                        onChange={(event) =>
                          setRoutePointForm((previous) => ({
                            ...previous,
                            pathName: event.target.value,
                          }))
                        }
                        placeholder="Contoh: Jl. Ahmad Yani - Manhole 04"
                        type="text"
                        value={routePointForm.pathName}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Jenis Titik
                      </label>
                      <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        {Object.entries(routePointTypeMeta).map(
                          ([typeKey, meta]) => {
                            const isDisabled =
                              !activeRouteId ||
                              (typeKey === "awal" &&
                                Boolean(
                                  activeAwalPoint &&
                                  activeAwalPoint.id !== editingRoutePointId,
                                )) ||
                              (typeKey === "tujuan" &&
                                Boolean(
                                  activeTujuanPoint &&
                                  activeTujuanPoint.id !== editingRoutePointId,
                                ));

                            const isActive =
                              routePointForm.pointType === typeKey;

                            return (
                              <button
                                key={typeKey}
                                className={`rounded-md px-2 py-1.5 text-left transition-all ${isActive ? "bg-white shadow-sm ring-1 ring-primary/20" : "bg-transparent"} ${isDisabled ? "cursor-not-allowed opacity-40 grayscale" : "hover:bg-white/60"}`}
                                disabled={isDisabled}
                                onClick={() =>
                                  setRoutePointForm((previous) => ({
                                    ...previous,
                                    pointType: typeKey,
                                  }))
                                }
                                type="button"
                              >
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                                  <span className="material-symbols-outlined text-[14px]">
                                    {meta.icon}
                                  </span>
                                  {meta.label}
                                </div>
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Keterangan Teknis
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary outline-none"
                        disabled={!activeRouteId}
                        onChange={(event) =>
                          setRoutePointForm((previous) => ({
                            ...previous,
                            note: event.target.value,
                          }))
                        }
                        placeholder="Catatan tambahan (opsional)"
                        type="text"
                        value={routePointForm.note}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        className={`w-full rounded-lg px-4 py-2 text-sm font-bold text-white transition-all shadow-sm ${editingRoutePointId ? "bg-amber-600 hover:bg-amber-700" : "bg-primary hover:bg-primary/90"} disabled:opacity-50`}
                        disabled={routeBusy || !activeRouteId}
                        type="submit"
                      >
                        {editingRoutePointId ? "Update" : "Tambah"}
                      </button>
                    </div>
                  </form>
                  {(routeError || routeFeedback) && (
                    <div
                      className={`mt-3 rounded-lg border px-3 py-2 text-xs font-semibold animate-in slide-in-from-top-2 duration-300 ${routeError ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                    >
                      {routeError || routeFeedback}
                    </div>
                  )}
                </section>

                {/* Tabel Titik Jalur */}
                <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm overflow-hidden">
                  <h3 className="mb-4 text-sm font-bold text-on-surface flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">
                        reorder
                      </span>
                      Daftar Titik {isRouteDrafting ? "(DRAFT)" : "Aktif"}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] uppercase font-black text-on-surface-variant">
                        Status:{" "}
                      </label>
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                        disabled={routeBusy || !activeRouteId}
                        onChange={(event) =>
                          handleFlowStatusChange(event.target.value)
                        }
                        value={
                          isRouteDrafting ? draftRouteStatus : activeRouteStatus
                        }
                      >
                        <option value="aktif">AKTIF</option>
                        <option value="nonaktif">NONAKTIF</option>
                        <option value="gangguan">GANGGUAN</option>
                      </select>
                    </div>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                            Lintasan
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                            Tipe
                          </th>
                          <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                            Note
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(isRouteDrafting ? draftRoutePoints : routePoints).map(
                          (point) => (
                            <tr
                              key={point.id}
                              className="bg-white hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-4 py-4 text-sm font-bold text-slate-400">
                                {point.orderNumber}
                              </td>
                              <td className="px-4 py-4 text-sm font-semibold text-on-surface">
                                {point.pathName}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                                    point.pointType === "awal"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                      : point.pointType === "tujuan"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        : "bg-slate-50 text-slate-600 border-slate-100"
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    {routePointTypeMeta[point.pointType]?.icon}
                                  </span>
                                  {routePointTypeLabelMap[point.pointType]}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-[11px] text-on-surface-variant italic">
                                {point.note || "-"}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20"
                                    disabled={
                                      routeBusy || point.pointType !== "transit"
                                    }
                                    onClick={() =>
                                      handleMoveRoutePoint(point.id, "up")
                                    }
                                    title="Naik"
                                  >
                                    <span className="material-symbols-outlined text-base">
                                      expand_less
                                    </span>
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-20"
                                    disabled={
                                      routeBusy || point.pointType !== "transit"
                                    }
                                    onClick={() =>
                                      handleMoveRoutePoint(point.id, "down")
                                    }
                                    title="Turun"
                                  >
                                    <span className="material-symbols-outlined text-base">
                                      expand_more
                                    </span>
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-amber-100 text-amber-600 disabled:opacity-20 ml-2"
                                    onClick={() => handleEditRoutePoint(point)}
                                    title="Edit"
                                  >
                                    <span className="material-symbols-outlined text-base">
                                      edit
                                    </span>
                                  </button>
                                  <button
                                    className="p-1 rounded hover:bg-rose-100 text-rose-600 disabled:opacity-20"
                                    disabled={
                                      routeBusy || point.pointType !== "transit"
                                    }
                                    onClick={() => {
                                      void handleDeleteRoutePoint(point.id);
                                    }}
                                    title="Hapus"
                                  >
                                    <span className="material-symbols-outlined text-base">
                                      delete
                                    </span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                        {(isRouteDrafting ? draftRoutePoints : routePoints)
                          .length === 0 && (
                          <tr>
                            <td
                              className="px-4 py-10 text-center text-sm text-on-surface-variant italic"
                              colSpan="5"
                            >
                              Belum ada titik jalur atau sedang kosong.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {/* Separator Section */}
              <div className="relative py-4">
                <div
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-50 px-4 text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                    Arsip & Riwayat Perubahan
                  </span>
                </div>
              </div>

              {/* History Section - Moved Below */}
              <section className="rounded-2xl bg-surface-container-lowest p-8 shadow-sm border-t-4 border-amber-400 space-y-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500">
                        history
                      </span>
                      Ledger Perubahan Jalur
                    </h3>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Setiap sesi{" "}
                      <span className="font-bold text-on-surface">
                        Ubah Jalur
                      </span>{" "}
                      disimpan sebagai jejak perubahan, jadi bukan hanya kondisi
                      terbaru yang tampil.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-700">
                        {routeHistoryRows.length} riwayat tersimpan
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
                        {routeVersions.length} versi jalur
                      </span>
                    </div>
                  </div>
                  <button
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={routeBusy || routeHistoryRows.length === 0}
                    onClick={() => {
                      void handleDeleteAllHistory();
                    }}
                    type="button"
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="space-y-8 overflow-auto max-h-[900px] pr-2 custom-scrollbar">
                  {routeHistory.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50 px-4 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                        <span className="material-symbols-outlined text-slate-300">
                          history_toggle_off
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400">
                        Belum ada catatan riwayat jalur.
                      </p>
                    </div>
                  ) : (
                    routeHistoryRows.map((item) => {
                      const isExpanded = expandedHistoryIds.includes(item.id);
                      return (
                        <div key={item.id} className="group relative">
                          {/* Version Header & Change Reason - Clickable for toggle */}
                          <div
                            className="mb-4 flex flex-wrap items-end justify-between gap-4 px-2 cursor-pointer"
                            onClick={() => toggleHistoryExpand(item.id)}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="material-symbols-outlined text-slate-400 text-sm transition-transform duration-300"
                                  style={{
                                    transform: isExpanded
                                      ? "rotate(180deg)"
                                      : "rotate(0deg)",
                                  }}
                                >
                                  expand_more
                                </span>
                                <span className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-black text-white shadow-sm shadow-amber-200">
                                  VERSI #{item.changeNumber}
                                </span>
                                <span className="text-xs font-black text-on-surface">
                                  {formatDateTime(item.createdAt)}
                                </span>
                              </div>
                              {/* Alasan Perubahan - Styled nicely outside the table */}
                              <div className="relative mt-2 max-w-2xl overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/50 to-transparent p-3 pl-4 hover:border-amber-300 transition-colors">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
                                <div className="flex items-start gap-2">
                                  <span className="material-symbols-outlined text-sm text-amber-500 mt-0.5">
                                    format_quote
                                  </span>
                                  <p className="text-xs font-bold italic leading-relaxed text-amber-900">
                                    {item.note ||
                                      "Perubahan struktur jalur tanpa catatan tambahan."}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 opacity-0 transition-all hover:bg-rose-100 group-hover:opacity-100"
                                disabled={routeBusy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteHistory(item.id);
                                }}
                                type="button"
                              >
                                Hapus Log
                              </button>
                            </div>
                          </div>

                          {/* Point Table - Styled like active table - Collapsible */}
                          {isExpanded && (
                            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm animate-in slide-in-from-top-2 duration-300">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-50 bg-slate-50/30">
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      #
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      Lintasan
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      Tipe
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      Note
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {item.afterPoints.map((point) => (
                                    <tr
                                      key={point.id}
                                      className="bg-white hover:bg-slate-50/30 transition-colors"
                                    >
                                      <td className="px-4 py-3 text-[11px] font-bold text-slate-400">
                                        {point.orderNumber}
                                      </td>
                                      <td className="px-4 py-3 text-[11px] font-bold text-on-surface">
                                        {point.pathName}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                                            point.pointType === "awal"
                                              ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                              : point.pointType === "tujuan"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : "bg-slate-50 text-slate-600 border-slate-100"
                                          }`}
                                        >
                                          <span className="material-symbols-outlined text-[12px]">
                                            {
                                              routePointTypeMeta[
                                                point.pointType
                                              ]?.icon
                                            }
                                          </span>
                                          {
                                            routePointTypeLabelMap[
                                              point.pointType
                                            ]
                                          }
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-[10px] text-on-surface-variant italic font-medium">
                                        {point.note || "-"}
                                      </td>
                                    </tr>
                                  ))}
                                  {item.afterPoints.length === 0 && (
                                    <tr>
                                      <td
                                        className="px-4 py-6 text-center text-[10px] text-slate-400 italic"
                                        colSpan="4"
                                      >
                                        Jalur dikosongkan pada versi ini.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
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
          <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-on-surface">
                Daftar Kontrak Tenant
              </h2>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
                onClick={openVersionEditor}
                type="button"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Tambah Kontrak / Perubahan
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">No</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Nomor Kontrak</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Keterangan</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Awal</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Akhir</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Paket</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Jumlah</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">BAK</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Perpanjangan</th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Tanggapan</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contractRowsForTable.map((row) => {
                    const isContractNumberMarkedEmpty = Boolean(emptyContractNumberRows[row.id]);
                    const isBakMarkedEmpty = Boolean(emptyBakRows[row.id]);

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-4 py-4 text-sm font-semibold text-slate-400">{row.number}</td>
                        <td className="px-4 py-4 text-sm">
                          {row.contractNumber ? (
                            <span className="font-bold text-on-surface">{row.contractNumber}</span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              {!isContractNumberMarkedEmpty && (
                                <div className="flex items-center gap-2 mb-1">
                                  <input
                                    className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                    onChange={(event) => setContractNumberInput(event.target.value)}
                                    placeholder="Input nomor kontrak"
                                    type="text"
                                    value={contractNumberInput}
                                  />
                                  <button
                                    className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
                                    disabled={isSavingContractNumber}
                                    onClick={() => void handleSaveContractNumber()}
                                    type="button"
                                  >
                                    {isSavingContractNumber ? "..." : "Simpan"}
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${isContractNumberMarkedEmpty ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  {isContractNumberMarkedEmpty ? "Memang Kosong" : "Belum Diisi"}
                                </span>
                                <button
                                  className="text-[10px] font-bold text-amber-600 hover:underline"
                                  onClick={() => toggleContractNumberEmptyMark(row.id)}
                                  type="button"
                                >
                                  {isContractNumberMarkedEmpty ? "Batal" : "Tandai Kosong"}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 uppercase tracking-tight">
                            {row.note}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant font-medium">
                          {formatDate(row.periodStart)}
                        </td>
                        <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant font-medium">
                          {formatDate(row.periodEnd)}
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-700 uppercase">{row.paket}</td>
                        <td className="px-4 py-4 text-sm font-bold text-slate-700">{row.jumlahPaket}</td>
                        <td className="px-4 py-4 text-sm">
                          {row.hasBak ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 uppercase">
                              <span className="material-symbols-outlined text-[14px]">task_alt</span> Tersedia
                            </span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              {!isBakMarkedEmpty && (
                                <input
                                  className="text-[10px] w-48 text-on-surface-variant file:mr-2 file:rounded-md file:border-0 file:bg-primary/5 file:px-2 file:py-1 file:text-[10px] file:text-primary file:font-bold"
                                  type="file"
                                  onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                          setEmptyBakRows(prev => ({ ...prev, [row.id]: false }));
                                      }
                                  }}
                                />
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${isBakMarkedEmpty ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  {isBakMarkedEmpty ? "Memang Kosong" : "Belum Diupload"}
                                </span>
                                <button
                                  className="text-[10px] font-bold text-amber-600 hover:underline"
                                  onClick={() => toggleBakEmptyMark(row.id)}
                                  type="button"
                                >
                                  {isBakMarkedEmpty ? "Batal" : "Tandai Kosong"}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="space-y-2">
                            {renderTenantRenewalFollowUps(row, "renewal")}
                            <button
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!hasInitialTenantRenewalUpload(row)}
                              onClick={() => void handleAddTenantRenewalSplit(row)}
                              type="button"
                            >
                              <span className="material-symbols-outlined text-xs">add_circle</span> Split
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {renderTenantRenewalFollowUps(row, "response")}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors" type="button">
                            <span className="material-symbols-outlined text-sm">edit</span> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {contractRowsForTable.length === 0 && (
                    <tr>
                      <td className="px-4 py-12 text-center text-sm text-on-surface-variant italic" colSpan="11">Belum ada data kontrak.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {contractRowsForTable.map((row) => {
                const isContractNumberMarkedEmpty = Boolean(emptyContractNumberRows[row.id]);
                const isBakMarkedEmpty = Boolean(emptyBakRows[row.id]);

                return (
                  <div key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/30 p-4 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kontrak #{row.number}</span>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-[9px] font-black text-blue-700 uppercase tracking-tighter">
                          {row.note}
                        </span>
                      </div>
                      <button className="text-amber-600">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nomor Kontrak</label>
                        {row.contractNumber ? (
                          <div className="font-bold text-on-surface break-words">{row.contractNumber}</div>
                        ) : (
                          <div className="space-y-2">
                            {!isContractNumberMarkedEmpty && (
                              <div className="flex gap-2">
                                <input
                                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                  onChange={(event) => setContractNumberInput(event.target.value)}
                                  placeholder="Input nomor kontrak"
                                  type="text"
                                  value={contractNumberInput}
                                />
                                <button
                                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                                  disabled={isSavingContractNumber}
                                  onClick={() => void handleSaveContractNumber()}
                                >
                                  {isSavingContractNumber ? "..." : "OK"}
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-tight ${isContractNumberMarkedEmpty ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                {isContractNumberMarkedEmpty ? "Memang Kosong" : "Belum Diisi"}
                              </span>
                              <button
                                className="text-[9px] font-black text-amber-600 uppercase tracking-widest hover:underline"
                                onClick={() => toggleContractNumberEmptyMark(row.id)}
                              >
                                {isContractNumberMarkedEmpty ? "Batal Tandai" : "Tandai Kosong"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Awal Periode</label>
                          <div className="text-sm font-bold text-on-surface">{formatDate(row.periodStart)}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Akhir Periode</label>
                          <div className="text-sm font-bold text-on-surface">{formatDate(row.periodEnd)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Paket</label>
                          <div className="text-sm font-black text-slate-700 uppercase">{row.paket}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Jumlah</label>
                          <div className="text-sm font-black text-slate-700">{row.jumlahPaket}</div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Status BAK</label>
                        {row.hasBak ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 uppercase">
                            <span className="material-symbols-outlined text-sm">task_alt</span> Tersedia
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {!isBakMarkedEmpty && (
                              <input
                                className="text-[10px] w-full text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-primary/5 file:px-3 file:py-1.5 file:text-[10px] file:text-primary file:font-black"
                                type="file"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setEmptyBakRows(prev => ({ ...prev, [row.id]: false }));
                                    }
                                }}
                              />
                            )}
                            <div className="flex items-center gap-3">
                              <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-tight ${isBakMarkedEmpty ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                {isBakMarkedEmpty ? "Memang Kosong" : "Belum Diupload"}
                              </span>
                              <button
                                className="text-[9px] font-black text-amber-600 uppercase tracking-widest hover:underline"
                                onClick={() => toggleBakEmptyMark(row.id)}
                              >
                                {isBakMarkedEmpty ? "Batal Tandai" : "Tandai Kosong"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold uppercase text-slate-400">Perpanjangan</label>
                            <button
                              className="text-[9px] font-black uppercase text-primary bg-primary/5 px-1.5 py-0.5 rounded"
                              disabled={!hasInitialTenantRenewalUpload(row)}
                              onClick={() => void handleAddTenantRenewalSplit(row)}
                            >
                              + Split
                            </button>
                          </div>
                          <div className="bg-white/50 rounded-lg p-2 min-h-[40px]">
                            {renderTenantRenewalFollowUps(row, "renewal")}
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tanggapan</label>
                          <div className="bg-white/50 rounded-lg p-2 min-h-[40px]">
                            {renderTenantRenewalFollowUps(row, "response")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {contractRowsForTable.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-sm">Belum ada data kontrak.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === "invoices" && (
          <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-on-surface">
                  Daftar Invoice Bulanan
                </h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Kolom set date adalah tanggal jatuh tempo. Peringatan 1 aktif
                  otomatis H-7.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500"
                  disabled
                  title="Fitur konversi Excel segera tersedia"
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">
                    table_view
                  </span>
                  Konversi ke Excel
                </button>

                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Urutan Pembayaran
                </label>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  onChange={(event) =>
                    setInvoicePaymentOrderSort(event.target.value)
                  }
                  value={invoicePaymentOrderSort}
                >
                  <option value="asc">ASC (1 ke akhir)</option>
                  <option value="desc">DESC (akhir ke 1)</option>
                </select>

                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Set Date Global
                </label>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  onChange={(event) =>
                    setInvoiceSetDateMode(event.target.value)
                  }
                  value={invoiceSetDateMode}
                >
                  <option value="manual">Manual per baris</option>
                  <option value="fixed_day">Rutin tanggal tetap</option>
                </select>

                {invoiceSetDateMode === "fixed_day" && (
                  <>
                    <input
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                      max="31"
                      min="1"
                      onChange={(event) =>
                        setInvoiceFixedDueDay(event.target.value)
                      }
                      type="number"
                      value={invoiceFixedDueDay}
                    />
                    <button
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      disabled={isSavingInvoice}
                      onClick={() => {
                        void handleApplyGlobalSetDate();
                      }}
                      type="button"
                    >
                      Terapkan Semua
                    </button>
                  </>
                )}

                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
                  onClick={openBillingEditor}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">
                    edit_calendar
                  </span>
                  Edit Periode Tagihan
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                Pending: {pendingInvoiceCount}
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Unpaid: {unpaidInvoiceCount}
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                Paid: {paidInvoiceCount}
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Tindak Lanjut Aktif: {nextActionMeta ? 1 : 0}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Jadwal invoice aktif di bawah ini selalu mengikuti periode
                tagihan terbaru.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Riwayat invoice dipisahkan agar perubahan restrukturisasi mudah
                dipantau.
              </div>
            </div>

            {invoiceFeedback && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {invoiceFeedback}
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    Jadwal Invoice Aktif
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Hanya sisa tagihan aktif yang ditampilkan dan bisa diedit di
                    sini.
                  </p>
                </div>
                <div className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
                  {invoiceRows.length} invoice aktif
                </div>
              </div>
              <table className="w-full min-w-[1800px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Pembayaran Ke
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Nomor Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Set Date (Terakhir Bayar)
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Jumlah Dibayar
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Waktu Terbayar
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Upload Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Upload Bukti Bayar
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayInvoiceRows.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-sm text-on-surface-variant"
                        colSpan="10"
                      >
                        Belum ada invoice aktif.
                      </td>
                    </tr>
                  )}
                  {displayInvoiceRows.map((invoice, idx) => {
                    const draft = getInvoiceDraft(invoice);
                    const isEditingRow = invoiceEditingId === invoice.id;
                    const isSetDateLockedByGlobal =
                      invoiceSetDateMode === "fixed_day";
                    const statusMeta =
                      invoice.statusMeta ?? resolveInvoiceStatusMeta(invoice);
                    const hasInvoiceFile =
                      typeof invoice?.invoiceFileUrl === "string" &&
                      invoice.invoiceFileUrl.trim().length > 0;
                    const isCurrentFollowUpRow =
                      nextActionInvoice?.id === invoice.id;
                    const canUploadInvoiceFile = isSavingInvoice
                      ? false
                      : hasInvoiceFile ||
                        !nextActionInvoice ||
                        isCurrentFollowUpRow;
                    return (
                      <tr
                        key={invoice.id}
                        className={`border-b border-slate-50 bg-white transition-colors hover:bg-slate-50 ${isEditingRow ? "bg-amber-50/40" : ""}`}
                      >
                        <td className="px-4 py-4 text-sm font-medium text-on-surface">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-on-surface">
                          <div className="flex flex-col gap-1">
                            <span>Pembayaran ke-{invoice.paymentOrder}</span>
                            <span className="inline-flex w-fit rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                              {`Aktif v${invoice.scheduleVersion ?? 1}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <input
                            className={`w-44 rounded-lg border px-2 py-1.5 text-xs ${isEditingRow ? "border-slate-200 bg-white text-on-surface" : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500"}`}
                            disabled={!isEditingRow || isSavingInvoice}
                            onChange={(event) =>
                              updateInvoiceDraftField(
                                invoice.id,
                                "invoiceNumber",
                                event.target.value,
                              )
                            }
                            placeholder="Nomor invoice"
                            type="text"
                            value={draft.invoiceNumber}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <input
                            className={`rounded-lg border px-2 py-1.5 text-xs ${!isEditingRow || isSetDateLockedByGlobal ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-on-surface"}`}
                            disabled={
                              !isEditingRow ||
                              isSetDateLockedByGlobal ||
                              isSavingInvoice
                            }
                            onChange={(event) =>
                              updateInvoiceDraftField(
                                invoice.id,
                                "dueDate",
                                event.target.value,
                              )
                            }
                            type="date"
                            value={draft.dueDate}
                          />
                          {isSetDateLockedByGlobal && (
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">
                              Dikunci karena Set Date Global aktif.
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div
                            className={`flex w-36 items-center gap-1 rounded border px-2 py-1 ${isEditingRow ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-100"}`}
                          >
                            <span className="text-[10px] font-bold text-slate-400">
                              Rp
                            </span>
                            <input
                              className={`w-full text-xs outline-none ${isEditingRow ? "text-on-surface" : "cursor-not-allowed bg-transparent text-slate-500"}`}
                              disabled={!isEditingRow || isSavingInvoice}
                              min="0"
                              onChange={(event) =>
                                updateInvoiceDraftField(
                                  invoice.id,
                                  "amount",
                                  event.target.value,
                                )
                              }
                              type="number"
                              value={draft.amount}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-on-surface-variant">
                          {formatDate(invoice.paidAt)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-col items-start gap-1">
                            <input
                              className="w-44 text-[10px] text-on-surface-variant file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:text-primary disabled:opacity-60"
                              disabled={!canUploadInvoiceFile}
                              onChange={(event) => {
                                void handleUploadInvoiceFile(
                                  invoice,
                                  event.target.files?.[0] ?? null,
                                );
                              }}
                              type="file"
                            />
                            <p className="text-[10px] font-semibold text-amber-600">
                              {invoice.invoiceFileUrl
                                ? "Invoice terupload"
                                : isCurrentFollowUpRow
                                  ? "Belum ada file invoice"
                                  : "Menunggu giliran pembayaran ini"}
                            </p>
                            {isOpenableFileUrl(invoice.invoiceFileUrl) && (
                              <a
                                className="text-[10px] font-bold text-primary hover:underline"
                                href={invoice.invoiceFileUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Buka invoice
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <div className="flex flex-col items-start gap-1">
                            <input
                              className="w-44 text-[10px] text-on-surface-variant file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:text-primary disabled:opacity-60"
                              disabled={
                                !invoice.invoiceFileUrl || isSavingInvoice
                              }
                              onChange={(event) => {
                                void handleUploadPaymentProof(
                                  invoice,
                                  event.target.files?.[0] ?? null,
                                );
                              }}
                              type="file"
                            />
                            <p className="text-[10px] font-semibold text-emerald-600">
                              {invoice.paymentProofFileUrl
                                ? `Bukti bayar: ${formatDate(invoice.paidAt)}`
                                : "Belum ada bukti bayar"}
                            </p>
                            {isOpenableFileUrl(invoice.paymentProofFileUrl) && (
                              <a
                                className="text-[10px] font-bold text-primary hover:underline"
                                href={invoice.paymentProofFileUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Buka bukti bayar
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm">
                          {isEditingRow ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                                disabled={isSavingInvoice}
                                onClick={() => {
                                  resetInvoiceDraftFromSource(invoice);
                                  setInvoiceEditingId(null);
                                }}
                                type="button"
                              >
                                Batal
                              </button>
                              <button
                                className="rounded bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                                disabled={isSavingInvoice}
                                onClick={() => {
                                  void handleSaveInvoiceRow(invoice);
                                }}
                                type="button"
                              >
                                Simpan
                              </button>
                            </div>
                          ) : (
                            <button
                              className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100"
                              onClick={() => {
                                setInvoiceEditingId(invoice.id);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-8 overflow-x-auto">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    Riwayat Invoice
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Invoice lunas dan invoice dari jadwal lama tersimpan di
                    bagian ini.
                  </p>
                </div>
                <div className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700">
                  {historyInvoiceRows.length} invoice riwayat
                </div>
              </div>
              <table className="w-full min-w-[1200px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Pembayaran Ke
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Nomor Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Periode
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Terbayar
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                      Versi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayHistoryInvoiceRows.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-6 text-center text-sm text-on-surface-variant"
                        colSpan="8"
                      >
                        Belum ada riwayat invoice.
                      </td>
                    </tr>
                  )}
                  {displayHistoryInvoiceRows.map((invoice, idx) => {
                    const statusMeta =
                      invoice.statusMeta ?? resolveInvoiceStatusMeta(invoice);
                    const periodLabel =
                      invoice.periodStartDate && invoice.periodEndDate
                        ? `${formatDate(invoice.periodStartDate)} - ${formatDate(invoice.periodEndDate)}`
                        : formatDate(invoice.dueDate);
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-50 bg-white"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-on-surface">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-on-surface">
                          Pembayaran ke-{invoice.paymentOrder}
                        </td>
                        <td className="px-4 py-4 text-sm text-on-surface">
                          {invoice.invoiceNumber || "-"}
                        </td>
                        <td className="px-4 py-4 text-sm text-on-surface-variant">
                          {periodLabel}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-on-surface">
                          {formatCurrency(invoice.amount ?? 0)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-on-surface-variant">
                          {formatDate(invoice.paidAt)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className="inline-flex w-fit rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                            {`Riwayat v${invoice.scheduleVersion ?? 1}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "documents" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-on-surface">
                Dokumen Tenant
              </h2>
              <div className="space-y-3">
                {allDocuments.map((document) => (
                  <div
                    key={document?.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {documentTypeLabelMap[document?.jenisDokumen] ||
                          document?.jenisDokumen}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {document?.nomorDokumen || "-"} •{" "}
                        {formatDate(document?.tanggalDokumen)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOpenableFileUrl(document?.fileUrl) && (
                        <a
                          className="text-xs font-bold text-primary hover:underline"
                          href={document.fileUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Buka berkas
                        </a>
                      )}
                      <button className="text-xs font-bold text-amber-600 hover:underline">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                {allDocuments.length === 0 && (
                  <p className="text-sm text-on-surface-variant">
                    Belum ada dokumen yang diunggah.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-on-surface">
                Upload Dokumen
              </h2>
              <form className="space-y-4" onSubmit={handleUploadDocument}>
                <FieldSelect
                  label="Jenis Dokumen"
                  value={documentDraft.jenisDokumen}
                  onChange={(value) =>
                    setDocumentDraft((previous) => ({
                      ...previous,
                      jenisDokumen: value,
                    }))
                  }
                  options={[
                    { value: "penawaran", label: "Surat Penawaran Harga" },
                    { value: "tanggapan", label: "Surat Tanggapan" },
                    { value: "hasil_nego", label: "Surat Negosiasi" },
                    { value: "custom", label: "Lainnya / Input Manual" },
                  ]}
                />
                {documentDraft.jenisDokumen === "custom" && (
                  <FieldInput
                    label="Nama Jenis Dokumen Baru"
                    value={documentDraft.customJenisDokumen}
                    onChange={(value) =>
                      setDocumentDraft((previous) => ({
                        ...previous,
                        customJenisDokumen: value,
                      }))
                    }
                    placeholder="Misal: Surat Kuasa"
                  />
                )}
                <FieldInput
                  label="Nomor Dokumen (Opsional)"
                  value={documentDraft.nomorDokumen}
                  onChange={(value) =>
                    setDocumentDraft((previous) => ({
                      ...previous,
                      nomorDokumen: value,
                    }))
                  }
                  placeholder="Boleh dikosongkan"
                />
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Upload Dokumen
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setDocumentDraft((previous) => ({
                        ...previous,
                        fileUrl: "",
                        uploadedFileName: file?.name ?? "",
                        uploadedFile: file,
                      }));
                    }}
                    type="file"
                  />
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {documentDraft.uploadedFileName
                      ? `File dipilih: ${documentDraft.uploadedFileName}`
                      : "Belum ada file dipilih."}
                  </p>
                </div>
                <FieldInput
                  label="Tanggal Dokumen"
                  type="date"
                  value={documentDraft.tanggalDokumen}
                  onChange={(value) =>
                    setDocumentDraft((previous) => ({
                      ...previous,
                      tanggalDokumen: value,
                    }))
                  }
                />
                <p className="text-xs text-on-surface-variant">
                  Jika tanggal dokumen dikosongkan, sistem akan otomatis
                  menyimpan tanggal hari ini.
                </p>
                {documentError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {documentError}
                  </div>
                )}
                {documentFeedback && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {documentFeedback}
                  </div>
                )}
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUploadingDocument}
                  type="submit"
                >
                  {isUploadingDocument ? "Mengunggah..." : "Simpan Dokumen"}
                </button>
              </form>
            </section>
          </div>
        )}

        {activeTab === "timeline" && (
          <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-on-surface">Timeline</h2>
            <div className="space-y-4">
              {displayTimeline.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${timelineColorMap[event.type] ?? "text-slate-700 bg-slate-100"}`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {timelineIconMap[event.type] ?? "history"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {event.title}
                    </p>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {event.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(event.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
                <FieldSelect
                  label="Satuan"
                  value={billingEditor.billingUnit}
                  onChange={(value) =>
                    setBillingEditor((previous) =>
                      previous ? { ...previous, billingUnit: value } : previous,
                    )
                  }
                  options={[
                    { value: "hari", label: "Hari" },
                    { value: "bulan", label: "Bulan" },
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
            <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-primary">
                    Riwayat Perubahan
                  </p>
                  <h3 className="text-xl font-bold text-on-surface">
                    {tenantName}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Kontrak tetap satu baris, perubahan ratio dibuat sebagai
                    version baru.
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
                <FieldSelect
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
                        previous
                          ? { ...previous, customReason: value }
                          : previous,
                      )
                    }
                    placeholder="Tulis alasan perubahan kontrak"
                  />
                )}
                <FieldInput
                  label="Shared Core Ratio Baru"
                  value={versionEditor.ratio}
                  onChange={(value) =>
                    setVersionEditor((previous) =>
                      previous ? { ...previous, ratio: value } : previous,
                    )
                  }
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FieldInput
                    label="Start Date (Periode Baru)"
                    type="date"
                    value={versionEditor.startDate}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, startDate: value } : previous,
                      )
                    }
                  />
                  <FieldInput
                    label="End Date"
                    type="date"
                    value={versionEditor.endDate}
                    onChange={(value) =>
                      setVersionEditor((previous) =>
                        previous ? { ...previous, endDate: value } : previous,
                      )
                    }
                  />
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
                    {isSubmittingVersion ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-primary">
                  Delete Tenant Logic
                </p>
                <h3 className="text-xl font-bold text-on-surface">
                  {tenantName}
                </h3>
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    checked={deleteMode === "this"}
                    disabled={!contextIsp?.id}
                    onChange={() => setDeleteMode("this")}
                    type="radio"
                  />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      Remove from this ISP only
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {contextIsp?.name
                        ? `Lepas dari ${contextIsp.name}.`
                        : "Hanya tersedia jika tenant dibuka dari detail ISP."}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    checked={deleteMode === "all"}
                    onChange={() => setDeleteMode("all")}
                    type="radio"
                  />
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      Remove from all ISP
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Lepas tenant dari seluruh grouping ISP.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    checked={deleteMode === "selected"}
                    onChange={() => setDeleteMode("selected")}
                    type="radio"
                  />
                  <div className="w-full">
                    <p className="text-sm font-semibold text-on-surface">
                      Select ISP(s)
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {isps.map((ispItem) => (
                        <label
                          key={ispItem.id}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          <input
                            checked={selectedDeleteIspIds.includes(ispItem.id)}
                            disabled={deleteMode !== "selected"}
                            onChange={() =>
                              setSelectedDeleteIspIds((previous) =>
                                previous.includes(ispItem.id)
                                  ? previous.filter(
                                      (value) => value !== ispItem.id,
                                    )
                                  : [...previous, ispItem.id],
                              )
                            }
                            type="checkbox"
                          />
                          {ispItem.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </label>
              </div>
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
                  disabled={
                    isDeletingLink ||
                    (deleteMode === "selected" &&
                      selectedDeleteIspIds.length === 0)
                  }
                  onClick={() => void handleRemoveTenantLinks()}
                  type="button"
                >
                  {isDeletingLink ? "Memproses..." : "Lanjutkan"}
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
