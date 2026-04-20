import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import { FieldInput, FieldSelect, SummaryCard } from "../components/shared/AppShared";
import {
    documentTypeLabelMap,
    timelineColorMap,
    timelineIconMap,
} from "../app/constants";
import {
    API_BASE_URL,
    addDaysToIsoDate,
    fetchJson,
    formatCurrency,
    formatDate,
    toTitleCase,
} from "../app/utils";

function TenantDetailPage({ customer, contextIsp, initialTab = "overview", onBack, onNavigate, onRefreshAll }) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [detail, setDetail] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [documentDraft, setDocumentDraft] = useState({
        jenisDokumen: "penawaran",
        nomorDokumen: "",
        tanggalDokumen: new Date().toISOString().slice(0, 10),
        contractVersionId: "",
        customJenisDokumen: "",
    });
    const [documentError, setDocumentError] = useState("");
    const [documentFeedback, setDocumentFeedback] = useState("");
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const [versionEditor, setVersionEditor] = useState(null);
    const [versionError, setVersionError] = useState("");
    const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteMode, setDeleteMode] = useState(contextIsp?.id ? "this" : "selected");
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
            setError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat memuat tenant.");
        } finally {
            setIsLoading(false);
        }
    }, [customer.id]);

    useEffect(() => {
        setActiveTab(initialTab);
        void loadDetail();
    }, [initialTab, loadDetail]);

    const tenantName = detail?.name ?? customer?.name;
    const isps = Array.isArray(detail?.isps) ? detail.isps : [];
    const contract = Array.isArray(detail?.contracts) ? detail.contracts[0] ?? null : null;
    const versions = Array.isArray(detail?.contractVersions) ? detail.contractVersions : [];
    const invoices = useMemo(
        () => (Array.isArray(detail?.invoices) ? detail.invoices : []),
        [detail?.invoices],
    );
    const todoSummary = detail?.todoSummary ?? { priority: [], needAction: [], info: [], counts: {} };
    const latestDocuments = Array.isArray(detail?.latestDocuments) ? detail.latestDocuments : [];
    const requiredDocuments = latestDocuments.filter((item) => ["penawaran", "tanggapan", "hasil_nego"].includes(item.jenisDokumen));
    const allDocuments = latestDocuments; // Now includes all documents uploaded by user
    const todayIso = new Date().toISOString().slice(0, 10);
    const activationFeePaidAt = detail?.activationFeePaidAt ?? customer?.activationFeePaidAt ?? null;
    const activationFeeAmount = Number(detail?.activationFeeAmount ?? customer?.activationFeeAmount ?? 0);

    const resolveInvoiceStatusMeta = (invoice, paymentOrder) => {
        const hasInvoiceFile = typeof invoice?.invoiceFileUrl === "string" && invoice.invoiceFileUrl.trim().length > 0;
        const hasPaymentProof = typeof invoice?.paymentProofFileUrl === "string" && invoice.paymentProofFileUrl.trim().length > 0;

        if (hasPaymentProof) {
            return {
                key: "paid",
                label: "Paid",
                badgeClass: "bg-emerald-100 text-emerald-700",
            };
        }

        if (hasInvoiceFile || paymentOrder === 1) {
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

    const sortedInvoices = useMemo(() => {
        const items = [...invoices];
        items.sort((left, right) => {
            const leftKey = `${left.periodYear}-${String(left.periodMonth).padStart(2, "0")}`;
            const rightKey = `${right.periodYear}-${String(right.periodMonth).padStart(2, "0")}`;

            if (leftKey === rightKey) {
                return Number(left.id ?? 0) - Number(right.id ?? 0);
            }

            return leftKey.localeCompare(rightKey);
        });

        return items;
    }, [invoices]);

    const invoiceRows = useMemo(
        () => sortedInvoices.map((invoice, index) => ({
            ...invoice,
            paymentOrder: index + 1,
            statusMeta: resolveInvoiceStatusMeta(invoice, index + 1),
        })),
        [sortedInvoices],
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

    useEffect(() => {
        setInvoiceDrafts((previousDrafts) => {
            const nextDrafts = {};

            invoiceRows.forEach((invoice) => {
                const previousDraft = previousDrafts[invoice.id] ?? {};
                const normalizedAmount = Number.isFinite(Number(invoice.amount))
                    ? String(Math.max(0, Math.round(Number(invoice.amount))))
                    : "0";

                nextDrafts[invoice.id] = {
                    invoiceNumber: previousDraft.invoiceNumber ?? "",
                    dueDate: previousDraft.dueDate ?? "",
                    amount: previousDraft.amount ?? normalizedAmount,
                };
            });

            return nextDrafts;
        });
    }, [invoiceRows]);

    const workflowInvoiceRows = useMemo(
        () => invoiceRows.map((invoice) => {
            const draft = invoiceDrafts[invoice.id] ?? {};
            const dueDateValue = typeof draft.dueDate === "string" ? draft.dueDate.trim().slice(0, 10) : "";
            const amountSource = draft.amount !== undefined ? Number(draft.amount) : Number(invoice.amount ?? 0);
            const amountValue = Number.isFinite(amountSource) ? amountSource : 0;

            return {
                ...invoice,
                workflowDueDate: dueDateValue,
                workflowAmount: amountValue,
            };
        }),
        [invoiceRows, invoiceDrafts],
    );

    const paidInvoiceCount = invoiceRows.filter((invoice) => invoice.statusMeta.key === "paid").length;
    const unpaidInvoiceCount = invoiceRows.filter((invoice) => invoice.statusMeta.key === "unpaid").length;
    const pendingInvoiceCount = invoiceRows.filter((invoice) => invoice.statusMeta.key === "pending").length;
    const setupIncompleteCount = workflowInvoiceRows.filter((invoice) => {
        const dueDate = typeof invoice?.workflowDueDate === "string" ? invoice.workflowDueDate : "";
        const amountValue = Number(invoice?.workflowAmount ?? 0);
        return !dueDate || amountValue <= 0;
    }).length;

    const nextActionInvoice = workflowInvoiceRows.find((invoice) => {
        const hasPaymentProof = typeof invoice?.paymentProofFileUrl === "string" && invoice.paymentProofFileUrl.trim().length > 0;
        const hasInvoiceFile = typeof invoice?.invoiceFileUrl === "string" && invoice.invoiceFileUrl.trim().length > 0;
        const dueDate = typeof invoice?.workflowDueDate === "string" ? invoice.workflowDueDate : "";
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

        const dueDate = typeof nextActionInvoice?.workflowDueDate === "string" ? nextActionInvoice.workflowDueDate : "";
        return {
            type: "upload_h_minus_7",
            title: `Peringatan H-7 pembayaran ke-${nextActionInvoice.paymentOrder}`,
            message: "Mendekati masa berakhir. Isi nomor invoice lalu upload invoice untuk pembayaran ini.",
            dueDate,
        };
    })();

    const backendPriorityTodos = Array.isArray(todoSummary.priority)
        ? todoSummary.priority.filter((item) => item.code !== "required_document_missing")
        : [];
    const backendNeedActionTodos = Array.isArray(todoSummary.needAction)
        ? todoSummary.needAction.filter((item) => ![
            "required_document_missing",
            "invoice_not_uploaded",
            "payment_pending",
            "invoice_amount_missing",
        ].includes(item.code))
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

    const displayPriorityTodos = [...backendPriorityTodos, ...derivedPriorityTodos];
    const displayNeedActionTodos = [...backendNeedActionTodos, ...derivedNeedActionTodos];
    const totalActionItems = displayPriorityTodos.length + displayNeedActionTodos.length;

    const displayTimeline = useMemo(() => {
        const nonInvoiceTimeline = timeline.filter((event) => event?.type !== "invoice");
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
            const normalized = typeof value === "string" && value.trim().length > 0
                ? value.slice(0, 10)
                : todayIso;
            const timestamp = new Date(`${normalized}T00:00:00.000Z`).getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
        };

        const sortedNonInvoiceTimeline = [...nonInvoiceTimeline]
            .sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date));

        return [...synthesizedTimeline, ...sortedNonInvoiceTimeline];
    }, [customer.id, nextActionMeta, nextActionInvoice?.id, pendingInvoiceCount, timeline, todayIso]);

    const billingEvery = Number(contract?.billingEvery ?? 1);
    const billingUnitLabel = toTitleCase(contract?.billingUnit ?? "bulan");
    const packageLabel = String(detail?.paket ?? customer?.paket ?? "").toLowerCase();
    const isSharedCorePackage = packageLabel.includes("shared");
    const resolveContractActualValue = (version) => {
        if (version) {
            const versionType = String(version.coreType ?? "").toLowerCase();

            if (versionType === "core") {
                return version.coreTotal ?? detail?.jumlah ?? customer?.jumlah ?? "-";
            }

            return version.sharedCoreRatio
                ?? detail?.contractSharingRatio
                ?? detail?.jumlah
                ?? customer?.contractSharingRatio
                ?? customer?.jumlah
                ?? "-";
        }

        if (isSharedCorePackage) {
            return detail?.contractSharingRatio ?? detail?.jumlah ?? customer?.contractSharingRatio ?? customer?.jumlah ?? "-";
        }

        return detail?.jumlah ?? customer?.jumlah ?? "-";
    };
    const initialContractActualValue = resolveContractActualValue(versions[0] ?? null);

    const openVersionEditor = () => {
        const latestVersion = versions[0];
        const nextStartDate = latestVersion?.endDate ? addDaysToIsoDate(latestVersion.endDate, 1) : contract?.startDate ?? "";
        setVersionEditor({
            startDate: nextStartDate,
            endDate: contract?.endDate ?? nextStartDate,
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
        setIsSubmittingVersion(true);
        setVersionError("");
        try {
            await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/contracts/${contract.id}/versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: versionEditor.startDate,
                    endDate: versionEditor.endDate,
                    sharedCoreRatio: versionEditor.ratio.trim(),
                }),
            });
            setVersionEditor(null);
            setDocumentFeedback("Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.");
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setVersionError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat membuat versi kontrak.");
        } finally {
            setIsSubmittingVersion(false);
        }
    };

    const handleUploadDocument = async (event) => {
        event.preventDefault();
        setIsUploadingDocument(true);
        setDocumentError("");
        setDocumentFeedback("");
        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/documents`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jenisDokumen: documentDraft.jenisDokumen,
                    nomorDokumen: documentDraft.nomorDokumen.trim() || undefined,
                    tanggalDokumen: documentDraft.tanggalDokumen,
                    contractId: contract?.id ?? undefined,
                    contractVersionId: documentDraft.contractVersionId ? Number(documentDraft.contractVersionId) : undefined,
                }),
            });
            const actions = Array.isArray(result?.automation?.actions) ? result.automation.actions : [];
            setDocumentFeedback(actions.join(" ") || "Dokumen berhasil diunggah.");
            setDocumentDraft({
                jenisDokumen: "BAK",
                nomorDokumen: "",
                tanggalDokumen: new Date().toISOString().slice(0, 10),
                contractVersionId: "",
            });
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setDocumentError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat mengunggah dokumen.");
        } finally {
            setIsUploadingDocument(false);
        }
    };

    const handleRemoveTenantLinks = async () => {
        setIsDeletingLink(true);
        setDeleteError("");
        try {
            const payload = deleteMode === "this"
                ? { mode: "this", ispId: contextIsp?.id }
                : deleteMode === "all"
                    ? { mode: "all" }
                    : { mode: "selected", ispIds: selectedDeleteIspIds };

            await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/isps/remove`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            setDeleteModalOpen(false);
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setDeleteError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat menghapus relasi tenant.");
        } finally {
            setIsDeletingLink(false);
        }
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
            invoiceNumber: String(existingDraft.invoiceNumber ?? ""),
            dueDate: String(existingDraft.dueDate ?? ""),
            amount: String(existingDraft.amount ?? (Number.isFinite(Number(invoice.amount))
                ? Math.max(0, Math.round(Number(invoice.amount)))
                : 0)),
        };
    };

    const resetInvoiceDraftFromSource = (invoice) => {
        setInvoiceDrafts((previousDrafts) => ({
            ...previousDrafts,
            [invoice.id]: {
                invoiceNumber: "",
                dueDate: "",
                amount: String(Number.isFinite(Number(invoice.amount)) ? Math.max(0, Math.round(Number(invoice.amount))) : 0),
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

    const validateInvoiceDraftForUpload = (draft) => {
        if (!draft.invoiceNumber.trim()) {
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
            await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoiceNumber: draft.invoiceNumber.trim() || null,
                    dueDate: draft.dueDate || null,
                    amount,
                }),
            });
            setInvoiceEditingId((current) => (current === invoice.id ? null : current));
            setInvoiceFeedback(`Invoice #${invoice.id} berhasil diperbarui.`);
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan invoice.");
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const handleUploadInvoiceFile = async (invoice, file) => {
        if (!file) {
            return;
        }

        const draft = getInvoiceDraft(invoice);
        const validationMessage = validateInvoiceDraftForUpload(draft);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        const amount = Number(draft.amount);

        setIsSavingInvoice(true);
        setError("");
        setInvoiceFeedback("");
        try {
            await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    invoiceNumber: draft.invoiceNumber.trim(),
                    dueDate: draft.dueDate,
                    amount,
                    invoiceFileUrl: `upload://${file.name}`,
                }),
            });
            setInvoiceEditingId((current) => (current === invoice.id ? null : current));
            setInvoiceFeedback(`Invoice #${invoice.id} berhasil diunggah.`);
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal mengunggah invoice.");
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const handleUploadPaymentProof = async (invoice, file) => {
        if (!file) {
            return;
        }

        if (!invoice.invoiceFileUrl) {
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
            await fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentProofFileUrl: `upload://${file.name}`,
                }),
            });
            setInvoiceFeedback(`Bukti bayar invoice #${invoice.id} berhasil diunggah.`);
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal mengunggah bukti bayar.");
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const handleApplyGlobalSetDate = async () => {
        const requestedDay = Number(invoiceFixedDueDay);
        if (!Number.isFinite(requestedDay) || requestedDay < 1 || requestedDay > 31) {
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
                    const normalizedDay = Math.min(Math.max(Math.round(requestedDay), 1), maxDay);
                    const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(normalizedDay).padStart(2, "0")}`;

                    dueDateByInvoiceId[invoice.id] = dueDate;

                    return fetchJson(`${API_BASE_URL}/api/customers/${customer.id}/invoices/${invoice.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dueDate }),
                    });
                }),
            );

            setInvoiceDrafts((previousDrafts) => {
                const nextDrafts = { ...previousDrafts };

                invoiceRows.forEach((invoice) => {
                    const previousDraft = previousDrafts[invoice.id] ?? {};
                    const baseAmount = previousDraft.amount ?? (Number.isFinite(Number(invoice.amount))
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

            setInvoiceFeedback("Set date global berhasil diterapkan ke semua invoice.");
            await Promise.all([loadDetail(), onRefreshAll?.()]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal menerapkan set date global.");
        } finally {
            setIsSavingInvoice(false);
        }
    };

    const tabs = [
        { key: "overview", label: "Ringkasan" },
        { key: "contracts", label: "Kontrak & Riwayat" },
        { key: "invoices", label: "Tagihan / Invoice" },
        { key: "documents", label: "Arsip Dokumen" },
        { key: "timeline", label: "Timeline Aktifitas" },
    ];

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl space-y-8">
                <button className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container" onClick={onBack} type="button">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Kembali ke Customer Page
                </button>

                <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                    <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">Tenant Detail</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="text-3xl font-extrabold text-primary">{tenantName}</h1>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${detail?.status === "aktif" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{detail?.status === "aktif" ? "Aktif" : "Non-aktif"}</span>
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Paket: {(detail?.paket || customer?.paket || "CORE").toUpperCase()}</span>
                                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">Jumlah: {detail?.contractSharingRatio ?? detail?.jumlah ?? customer?.contractSharingRatio ?? customer?.jumlah ?? "-"}</span>
                            </div>
                            <p className="mt-2 text-sm text-on-surface-variant">ISP: {isps.length > 0 ? isps.map((item) => item.name).join(", ") : "-"}</p>
                            {contextIsp?.name && <p className="mt-1 text-sm text-on-surface-variant">Dibuka dari grup ISP: {contextIsp.name}</p>}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button className="rounded-xl border border-primary bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10" onClick={() => void Promise.all([loadDetail(), onRefreshAll?.()])} type="button">Refresh</button>
                            <button className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100" type="button">Edit Tenant</button>
                            <button className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100" type="button">Hapus Tenant</button>
                        </div>
                    </div>
                </section>

                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
                {isLoading && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-on-surface-variant">Memuat detail tenant...</div>}

                <div className="flex gap-6 overflow-x-auto border-b border-slate-200">
                    {tabs.map((tab) => (
                        <button key={tab.key} className={activeTab === tab.key ? "whitespace-nowrap border-b-2 border-primary pb-4 text-sm font-bold text-primary" : "whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant hover:text-primary"} onClick={() => setActiveTab(tab.key)} type="button">{tab.label}</button>
                    ))}
                </div>

                {activeTab === "overview" && (
                    <div className="space-y-8">
                        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Invoice Bulanan</p>
                                <div className="flex items-end gap-3"><span className="text-3xl font-extrabold text-on-surface">{invoiceRows.length}</span><span className="text-sm font-semibold text-on-surface-variant mb-1">Total</span></div>
                                <div className="mt-3 flex gap-4 text-xs font-semibold"><span className="text-emerald-600">{paidInvoiceCount} Selesai</span><span className="text-rose-600">{invoiceRows.length - paidInvoiceCount} Belum Selesai</span></div>
                            </div>
                            <SummaryCard label="Butuh Action" value={totalActionItems} icon="pending_actions" />
                            <SummaryCard label="Status Aktivasi" value={(detail?.activationFeePaidAt) ? "Lunas" : "Belum Lunas"} icon="payments" />
                            <div className="flex flex-col col-span-2 rounded-xl bg-white p-5 shadow-sm border border-slate-100 justify-center">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="material-symbols-outlined text-2xl text-blue-500">calendar_month</span>
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Periode Tagihan</p>
                                </div>
                                <p className="text-xl font-bold text-on-surface">Setiap {billingEvery} {billingUnitLabel}</p>
                                <p className="mt-1 text-xs text-on-surface-variant">Invoice dibuat otomatis H-7</p>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            {/* Status Kelengkapan Berkas */}
                            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                    <span className="material-symbols-outlined text-xl">task_alt</span>
                                    Status Kelengkapan Berkas
                                </h2>
                                <div className="space-y-3">
                                    {displayPriorityTodos.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-600">Prioritas Tinggi</p>
                                            {displayPriorityTodos.map((item) => (
                                                <div key={item.id} className="mb-2 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50/60 px-4 py-3">
                                                    <span className="material-symbols-outlined mt-0.5 text-base text-red-500">error</span>
                                                    <div>
                                                        <p className="text-sm font-semibold text-red-800">{item.title}</p>
                                                        <p className="text-xs text-red-600">{item.message}</p>
                                                        {item.dueDate && <p className="mt-1 text-[10px] text-red-400">Tenggat: {formatDate(item.dueDate)}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {displayNeedActionTodos.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-600">Perlu Tindakan</p>
                                            {displayNeedActionTodos.map((item) => (
                                                <div key={item.id} className="mb-2 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3">
                                                    <span className="material-symbols-outlined mt-0.5 text-base text-amber-500">warning</span>
                                                    <div>
                                                        <p className="text-sm font-semibold text-amber-800">{item.title}</p>
                                                        <p className="text-xs text-amber-600">{item.message}</p>
                                                        {item.dueDate && <p className="mt-1 text-[10px] text-amber-400">Tenggat: {formatDate(item.dueDate)}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {displayPriorityTodos.length === 0 && displayNeedActionTodos.length === 0 && (
                                        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                                            <span className="material-symbols-outlined text-base text-emerald-500">check_circle</span>
                                            <p className="text-sm font-semibold text-emerald-700">Semua berkas lengkap. Tidak ada tindakan yang perlu dilakukan.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Biaya Aktivasi */}
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl">payments</span>
                                        Biaya Aktivasi
                                    </h2>
                                    {detail?.activationFeePaidAt ? (
                                        <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                                            <span className="material-symbols-outlined text-base text-emerald-500">check_circle</span>
                                            <div>
                                                <p className="text-sm font-bold text-emerald-700">Selesai</p>
                                                <p className="text-xs text-emerald-600">Dibayar pada {formatDate(detail.activationFeePaidAt)}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3">
                                            <span className="material-symbols-outlined text-base text-amber-500">schedule</span>
                                            <div>
                                                <p className="text-sm font-bold text-amber-700">Menunggu Pembayaran</p>
                                                <p className="text-lg font-black text-amber-800">{formatCurrency(detail?.activationFeeAmount ?? customer.activationFeeAmount)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Dokumen Terbaru */}
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl">description</span>
                                        Dokumen Terbaru
                                    </h2>
                                    {requiredDocuments.length > 0 ? (
                                        <div className="space-y-2">
                                            {requiredDocuments.slice(0, 3).map((doc) => (
                                                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3">
                                                    <span className="material-symbols-outlined text-base text-blue-400">article</span>
                                                    <div>
                                                        <p className="text-sm font-semibold text-on-surface">{documentTypeLabelMap[doc.jenisDokumen] || doc.jenisDokumen}</p>
                                                        <p className="text-xs text-on-surface-variant">{doc.nomorDokumen || "-"} • {formatDate(doc.tanggalDokumen)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-on-surface-variant">Belum ada dokumen terunggah.</p>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            {/* Aktivitas Terbaru */}
                            <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border-l-4 border-emerald-400">
                                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                    <span className="material-symbols-outlined text-xl text-emerald-500">history</span>
                                    Aktivitas Terbaru
                                </h2>
                                {displayTimeline.length > 0 ? (
                                    <div className="space-y-3">
                                        {displayTimeline.slice(0, 5).map((event) => (
                                            <div key={event.id} className="flex gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3">
                                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${timelineColorMap[event.type] ?? "text-slate-700 bg-slate-100"}`}>
                                                    <span className="material-symbols-outlined text-sm">{timelineIconMap[event.type] ?? "history"}</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-on-surface">{event.title}</p>
                                                    <p className="text-xs text-on-surface-variant">{event.description}</p>
                                                    <p className="mt-1 text-[10px] text-slate-400">{formatDate(event.date)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-on-surface-variant">Belum ada aktivitas tercatat.</p>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === "contracts" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-on-surface">Daftar Kontrak Tenant</h2>
                            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90" onClick={openVersionEditor} type="button">
                                <span className="material-symbols-outlined text-base">add</span>
                                Tambah Kontrak / Perubahan
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Tgl Ditambahkan</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Alasan</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Periode Awal</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Periode Akhir</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Paket</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Jumlah Aktual</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Upload BAK</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-white border-b border-slate-50">
                                        <td className="px-4 py-4 text-sm font-medium text-on-surface">{formatDate(contract?.startDate ?? new Date().toISOString())}</td>
                                        <td className="px-4 py-4 text-sm text-on-surface-variant"><span className="rounded bg-blue-50 text-blue-700 px-2 py-1 text-[10px] font-bold">Kontrak Awal</span></td>
                                        <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">{formatDate(contract?.startDate)}</td>
                                        <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">{formatDate(contract?.endDate)}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-700 uppercase">{(detail?.paket || customer?.paket || "CORE")}</td>
                                        <td className="px-4 py-4 text-sm font-bold text-slate-700">{initialContractActualValue}</td>
                                        <td className="px-4 py-4 text-sm text-on-surface-variant">
                                            {versions[0]?.bakDocumentId ? (
                                                <span className="text-emerald-600 flex items-center gap-1 text-xs"><span className="material-symbols-outlined text-[14px]">check_circle</span> Tersedia</span>
                                            ) : (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <input type="file" className="text-[10px] w-48 text-on-surface-variant file:mr-2 file:py-1 file:px-2 file:border-0 file:text-[10px] file:bg-primary/10 file:text-primary file:rounded-md" />
                                                    <button className="text-[10px] font-semibold text-amber-600 text-left hover:underline">Tandai Memang Kosong</button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm">
                                            <button className="text-amber-600 font-bold hover:underline mr-4">Edit</button>
                                            <button className="text-red-600 font-bold hover:underline">Hapus</button>
                                        </td>
                                    </tr>
                                    {versions.slice(1).map((version) => (
                                        <tr key={version.id} className="bg-slate-50/50 opacity-70 border-b border-slate-50">
                                            <td className="px-4 py-4 text-sm text-on-surface-variant">{formatDate(version.startDate)}</td>
                                            <td className="px-4 py-4 text-sm text-on-surface-variant"><span className="rounded bg-slate-200 text-slate-700 px-2 py-1 text-[10px] font-bold">Ubah Paket</span></td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">{formatDate(version.startDate)}</td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">{formatDate(version.endDate)}</td>
                                            <td className="px-4 py-4 text-sm font-bold text-on-surface-variant uppercase">{version.coreType ? String(version.coreType).replace(/_/g, " ").toUpperCase() : (detail?.paket || customer?.paket || "CORE")}</td>
                                            <td className="px-4 py-4 text-sm text-on-surface-variant font-bold">{resolveContractActualValue(version)}</td>
                                            <td className="px-4 py-4 text-sm text-on-surface-variant">{version.bakDocumentId ? "Tersedia" : "Kosong"}</td>
                                            <td className="px-4 py-4 text-right text-sm">-</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeTab === "invoices" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-on-surface">Daftar Invoice Bulanan</h2>
                                <p className="mt-1 text-xs text-on-surface-variant">Kolom set date adalah tanggal jatuh tempo. Peringatan 1 aktif otomatis H-7.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500"
                                    disabled
                                    title="Fitur konversi Excel segera tersedia"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-sm">table_view</span>
                                    Konversi ke Excel
                                </button>

                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Urutan Pembayaran</label>
                                <select
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                    onChange={(event) => setInvoicePaymentOrderSort(event.target.value)}
                                    value={invoicePaymentOrderSort}
                                >
                                    <option value="asc">ASC (1 ke akhir)</option>
                                    <option value="desc">DESC (akhir ke 1)</option>
                                </select>

                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Set Date Global</label>
                                <select
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                    onChange={(event) => setInvoiceSetDateMode(event.target.value)}
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
                                            onChange={(event) => setInvoiceFixedDueDay(event.target.value)}
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
                            </div>
                        </div>

                        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Pending: {pendingInvoiceCount}</div>
                            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Unpaid: {unpaidInvoiceCount}</div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Paid: {paidInvoiceCount}</div>
                            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Tindak Lanjut Aktif: {nextActionMeta ? 1 : 0}</div>
                        </div>

                        {invoiceFeedback && (
                            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                                {invoiceFeedback}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1800px] border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">No</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Pembayaran Ke</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Nomor Invoice</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Set Date (Terakhir Bayar)</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Jumlah Dibayar</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Status</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Waktu Terbayar</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Upload Invoice</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Upload Bukti Bayar</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayInvoiceRows.map((invoice, idx) => {
                                        const draft = getInvoiceDraft(invoice);
                                        const isEditingRow = invoiceEditingId === invoice.id;
                                        const isSetDateLockedByGlobal = invoiceSetDateMode === "fixed_day";
                                        const statusMeta = invoice.statusMeta ?? resolveInvoiceStatusMeta(invoice, invoice.paymentOrder);
                                        const hasInvoiceFile = typeof invoice?.invoiceFileUrl === "string" && invoice.invoiceFileUrl.trim().length > 0;
                                        const isCurrentFollowUpRow = nextActionInvoice?.id === invoice.id;
                                        const canUploadInvoiceFile = isSavingInvoice ? false : (hasInvoiceFile || !nextActionInvoice || isCurrentFollowUpRow);
                                        return (
                                            <tr key={invoice.id} className={`border-b border-slate-50 bg-white transition-colors hover:bg-slate-50 ${isEditingRow ? "bg-amber-50/40" : ""}`}>
                                                <td className="px-4 py-4 text-sm font-medium text-on-surface">{idx + 1}</td>
                                                <td className="px-4 py-4 text-sm font-semibold text-on-surface">Pembayaran ke-{invoice.paymentOrder}</td>
                                                <td className="px-4 py-4 text-sm">
                                                    <input
                                                        className={`w-44 rounded-lg border px-2 py-1.5 text-xs ${isEditingRow ? "border-slate-200 bg-white text-on-surface" : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500"}`}
                                                        disabled={!isEditingRow || isSavingInvoice}
                                                        onChange={(event) => updateInvoiceDraftField(invoice.id, "invoiceNumber", event.target.value)}
                                                        placeholder="Nomor invoice"
                                                        type="text"
                                                        value={draft.invoiceNumber}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <input
                                                        className={`rounded-lg border px-2 py-1.5 text-xs ${(!isEditingRow || isSetDateLockedByGlobal) ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-on-surface"}`}
                                                        disabled={!isEditingRow || isSetDateLockedByGlobal || isSavingInvoice}
                                                        onChange={(event) => updateInvoiceDraftField(invoice.id, "dueDate", event.target.value)}
                                                        type="date"
                                                        value={draft.dueDate}
                                                    />
                                                    {isSetDateLockedByGlobal && (
                                                        <p className="mt-1 text-[10px] font-semibold text-slate-400">Dikunci karena Set Date Global aktif.</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <div className={`flex w-36 items-center gap-1 rounded border px-2 py-1 ${isEditingRow ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-100"}`}>
                                                        <span className="text-[10px] font-bold text-slate-400">Rp</span>
                                                        <input
                                                            className={`w-full text-xs outline-none ${isEditingRow ? "text-on-surface" : "cursor-not-allowed bg-transparent text-slate-500"}`}
                                                            disabled={!isEditingRow || isSavingInvoice}
                                                            min="0"
                                                            onChange={(event) => updateInvoiceDraftField(invoice.id, "amount", event.target.value)}
                                                            type="number"
                                                            value={draft.amount}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold text-on-surface-variant">{formatDate(invoice.paidAt)}</td>
                                                <td className="px-4 py-4 text-sm">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <input
                                                            className="w-44 text-[10px] text-on-surface-variant file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:text-primary disabled:opacity-60"
                                                            disabled={!canUploadInvoiceFile}
                                                            onChange={(event) => {
                                                                void handleUploadInvoiceFile(invoice, event.target.files?.[0] ?? null);
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
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <input
                                                            className="w-44 text-[10px] text-on-surface-variant file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:text-primary disabled:opacity-60"
                                                            disabled={!invoice.invoiceFileUrl || isSavingInvoice}
                                                            onChange={(event) => {
                                                                void handleUploadPaymentProof(invoice, event.target.files?.[0] ?? null);
                                                            }}
                                                            type="file"
                                                        />
                                                        <p className="text-[10px] font-semibold text-emerald-600">
                                                            {invoice.paymentProofFileUrl ? `Bukti bayar: ${formatDate(invoice.paidAt)}` : "Belum ada bukti bayar"}
                                                        </p>
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

                                    {displayInvoiceRows.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan="10">
                                                Belum ada data invoice.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeTab === "documents" && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-bold text-on-surface">Dokumen Tenant</h2>
                            <div className="space-y-3">
                                {allDocuments.map((document) => <div key={document?.id} className="flex justify-between items-center rounded-xl border border-slate-100 bg-white px-4 py-3"><div><p className="text-sm font-semibold text-on-surface">{documentTypeLabelMap[document?.jenisDokumen] || document?.jenisDokumen}</p><p className="mt-1 text-xs text-on-surface-variant">{document?.nomorDokumen || "-"} • {formatDate(document?.tanggalDokumen)}</p></div><button className="text-xs font-bold text-amber-600 hover:underline">Edit</button></div>)}
                                {allDocuments.length === 0 && <p className="text-sm text-on-surface-variant">Belum ada dokumen yang diunggah.</p>}
                            </div>
                        </section>
                        <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                            <h2 className="mb-4 text-lg font-bold text-on-surface">Upload Dokumen</h2>
                            <form className="space-y-4" onSubmit={handleUploadDocument}>
                                <FieldSelect label="Jenis Dokumen" value={documentDraft.jenisDokumen} onChange={(value) => setDocumentDraft((previous) => ({ ...previous, jenisDokumen: value }))} options={[{ value: "penawaran", label: "Surat Penawaran Harga" }, { value: "tanggapan", label: "Surat Tanggapan" }, { value: "hasil_nego", label: "Surat Negosiasi" }, { value: "custom", label: "Lainnya / Input Manual" }]} />
                                {documentDraft.jenisDokumen === "custom" && <FieldInput label="Nama Jenis Dokumen Baru" value={documentDraft.customJenisDokumen} onChange={(value) => setDocumentDraft((previous) => ({ ...previous, customJenisDokumen: value }))} placeholder="Misal: Surat Kuasa" />}
                                <FieldInput label="Nomor Dokumen (Opsional)" value={documentDraft.nomorDokumen} onChange={(value) => setDocumentDraft((previous) => ({ ...previous, nomorDokumen: value }))} placeholder="Boleh dikosongkan" />
                                <FieldInput label="Tanggal Dokumen" type="date" value={documentDraft.tanggalDokumen} onChange={(value) => setDocumentDraft((previous) => ({ ...previous, tanggalDokumen: value }))} />
                                {documentError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{documentError}</div>}
                                {documentFeedback && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{documentFeedback}</div>}
                                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={isUploadingDocument} type="submit">{isUploadingDocument ? "Mengunggah..." : "Simpan Dokumen"}</button>
                            </form>
                        </section>
                    </div>
                )}

                {activeTab === "timeline" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-bold text-on-surface">Timeline</h2>
                        <div className="space-y-4">
                            {displayTimeline.map((event) => <div key={event.id} className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4"><div className={`flex h-11 w-11 items-center justify-center rounded-full ${timelineColorMap[event.type] ?? "text-slate-700 bg-slate-100"}`}><span className="material-symbols-outlined text-base">{timelineIconMap[event.type] ?? "history"}</span></div><div><p className="text-sm font-semibold text-on-surface">{event.title}</p><p className="mt-1 text-sm text-on-surface-variant">{event.description}</p><p className="mt-2 text-xs text-slate-400">{formatDate(event.date)}</p></div></div>)}
                        </div>
                    </section>
                )}

                {versionEditor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                        <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div><p className="text-xs font-black uppercase tracking-widest text-primary">Riwayat Perubahan</p><h3 className="text-xl font-bold text-on-surface">{tenantName}</h3><p className="text-xs text-on-surface-variant">Kontrak tetap satu baris, perubahan ratio dibuat sebagai version baru.</p></div>
                                <button className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200" onClick={() => setVersionEditor(null)} type="button"><span className="material-symbols-outlined text-base">close</span></button>
                            </div>
                            <form className="space-y-4" onSubmit={handleCreateVersion}>
                                <FieldSelect label="Alasan Kontrak" value={versionEditor.reason ?? "ubah_paket"} onChange={(value) => setVersionEditor((previous) => previous ? { ...previous, reason: value } : previous)} options={[{ value: "ubah_paket", label: "Ubah Paket" }, { value: "lainnya", label: "Alasan Lain" }]} />
                                <FieldInput label="Shared Core Ratio Baru" value={versionEditor.ratio} onChange={(value) => setVersionEditor((previous) => previous ? { ...previous, ratio: value } : previous)} />
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <FieldInput label="Start Date (Periode Baru)" type="date" value={versionEditor.startDate} onChange={(value) => setVersionEditor((previous) => previous ? { ...previous, startDate: value } : previous)} />
                                    <FieldInput label="End Date" type="date" value={versionEditor.endDate} onChange={(value) => setVersionEditor((previous) => previous ? { ...previous, endDate: value } : previous)} />
                                </div>
                                {versionError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{versionError}</div>}
                                <div className="flex justify-end gap-2">
                                    <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50" onClick={() => setVersionEditor(null)} type="button">Batal</button>
                                    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmittingVersion} type="submit">{isSubmittingVersion ? "Menyimpan..." : "Simpan Perubahan"}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {deleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                        <div className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                            <div className="mb-4"><p className="text-xs font-black uppercase tracking-widest text-primary">Delete Tenant Logic</p><h3 className="text-xl font-bold text-on-surface">{tenantName}</h3></div>
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input checked={deleteMode === "this"} disabled={!contextIsp?.id} onChange={() => setDeleteMode("this")} type="radio" /><div><p className="text-sm font-semibold text-on-surface">Remove from this ISP only</p><p className="text-xs text-on-surface-variant">{contextIsp?.name ? `Lepas dari ${contextIsp.name}.` : "Hanya tersedia jika tenant dibuka dari detail ISP."}</p></div></label>
                                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input checked={deleteMode === "all"} onChange={() => setDeleteMode("all")} type="radio" /><div><p className="text-sm font-semibold text-on-surface">Remove from all ISP</p><p className="text-xs text-on-surface-variant">Lepas tenant dari seluruh grouping ISP.</p></div></label>
                                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input checked={deleteMode === "selected"} onChange={() => setDeleteMode("selected")} type="radio" /><div className="w-full"><p className="text-sm font-semibold text-on-surface">Select ISP(s)</p><div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{isps.map((ispItem) => <label key={ispItem.id} className="flex items-center gap-2 text-sm text-slate-700"><input checked={selectedDeleteIspIds.includes(ispItem.id)} disabled={deleteMode !== "selected"} onChange={() => setSelectedDeleteIspIds((previous) => previous.includes(ispItem.id) ? previous.filter((value) => value !== ispItem.id) : [...previous, ispItem.id])} type="checkbox" />{ispItem.name}</label>)}</div></div></label>
                            </div>
                            {deleteError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{deleteError}</div>}
                            <div className="mt-6 flex justify-end gap-2">
                                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50" onClick={() => setDeleteModalOpen(false)} type="button">Batal</button>
                                <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60" disabled={isDeletingLink || (deleteMode === "selected" && selectedDeleteIspIds.length === 0)} onClick={() => void handleRemoveTenantLinks()} type="button">{isDeletingLink ? "Memproses..." : "Lanjutkan"}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

export default TenantDetailPage;
