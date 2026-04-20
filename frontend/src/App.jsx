import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell";
import DashboardPage from "./pages/DashboardPage";
import MonitoringSpreadsheetPage from "./pages/MonitoringSpreadsheetPage";
import CustomerWorkspacePage from "./pages/CustomerWorkspacePage";
import IspDetailPage from "./pages/IspDetailPage";
import TenantDetailPage from "./pages/TenantDetailPage";
import {
    ComplianceItem,
    FieldInput,
    FieldSelect,
    IssueCountRow,
    MetricCard,
    SummaryCard,
    TodoColumn,
} from "./components/shared/AppShared";
import {
    contractStatusBadgeClass,
    contractStatusLabelMap,
    documentTypeBadgeClass,
    documentTypeLabelMap,
    documentTypeOptions,
    invoiceStatusBadgeClass,
    invoiceStatusLabelMap,
    monthNames,
    sectionMeta,
    timelineColorMap,
    timelineIconMap,
} from "./app/constants";
import {
    API_BASE_URL,
    buildInvoiceScheduleRows,
    createDefaultDocumentForm,
    fetchJson,
    formatCoreAllocation,
    formatCurrency,
    formatDate,
    formatDateTime,
    isExternalFileUrl,
    mapCustomerToRow,
    parseDateValue,
    resolveBillingCycle,
    toTitleCase,
} from "./app/utils";
import "./App.css";

function App() {
    const [activeSection, setActiveSection] = useState("customers");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedCustomerInitialTab, setSelectedCustomerInitialTab] = useState("overview");
    const [selectedCustomerContextIsp, setSelectedCustomerContextIsp] = useState(null);
    const [selectedIsp, setSelectedIsp] = useState(null);
    const [createMode, setCreateMode] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [customersError, setCustomersError] = useState("");
    const [isps, setIsps] = useState([]);
    const [isLoadingIsps, setIsLoadingIsps] = useState(false);
    const [ispsError, setIspsError] = useState("");

    const loadCustomers = useCallback(async () => {
        setIsLoadingCustomers(true);
        setCustomersError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers`);
            const mappedCustomers = Array.isArray(result)
                ? result.map((customer, index) => mapCustomerToRow(customer, index))
                : [];

            setCustomers(mappedCustomers);
            setSelectedCustomer((previous) => {
                if (!previous) {
                    return previous;
                }

                return mappedCustomers.find((item) => item.id === previous.id) ?? previous;
            });

            return mappedCustomers;
        } catch (error) {
            setCustomersError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat daftar pelanggan.",
            );

            return [];
        } finally {
            setIsLoadingCustomers(false);
        }
    }, []);

    useEffect(() => {
        void loadCustomers();
    }, [loadCustomers]);

    const loadIsps = useCallback(async () => {
        setIsLoadingIsps(true);
        setIspsError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/isps`);
            setIsps(Array.isArray(result) ? result : []);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            setIspsError(
                error instanceof Error
                    ? error.message
                    : "Terjadi kesalahan saat memuat daftar ISP.",
            );
            return [];
        } finally {
            setIsLoadingIsps(false);
        }
    }, []);

    useEffect(() => {
        void loadIsps();
    }, [loadIsps]);

    const ispOptions = useMemo(() => {
        const uniqueIsp = new Set();
        customers.forEach((item) => {
            if (Array.isArray(item.ispList) && item.ispList.length > 0) {
                item.ispList.forEach((ispName) => uniqueIsp.add(ispName));
                return;
            }

            if (item.isp) {
                uniqueIsp.add(item.isp);
            }
        });

        return Array.from(uniqueIsp).sort((left, right) => left.localeCompare(right));
    }, [customers]);

    const resolveTenantId = (tenant) => {
        const idCandidates = [tenant?.id, tenant?.customerId, tenant?.customer?.id];

        for (const candidate of idCandidates) {
            const parsedId = Number(candidate);
            if (Number.isFinite(parsedId) && parsedId > 0) {
                return parsedId;
            }
        }

        return null;
    };

    const handleNavigate = (sectionKey) => {
        setActiveSection(sectionKey);
        setCreateMode(null);
        setSelectedIsp(null);

        if (sectionKey !== "customers") {
            setSelectedCustomer(null);
            setSelectedCustomerInitialTab("overview");
            setSelectedCustomerContextIsp(null);
        }
    };

    const handleOpenTenantDetail = (customer, initialTab = "overview", contextIsp = null) => {
        const resolvedCustomerId = resolveTenantId(customer);
        const resolvedCustomerCode = typeof customer?.customerId === "string"
            ? customer.customerId.trim()
            : "";

        const normalizedCustomerById = resolvedCustomerId
            ? customers.find((item) => Number(item.id) === resolvedCustomerId) ?? { ...customer, id: resolvedCustomerId }
            : null;
        const normalizedCustomerByCode = resolvedCustomerCode
            ? customers.find((item) => String(item.customerId ?? "").trim() === resolvedCustomerCode) ?? null
            : null;
        const normalizedCustomer = normalizedCustomerById ?? normalizedCustomerByCode;

        if (!normalizedCustomer) {
            setCustomersError("Data tenant tidak valid. ID tenant tidak ditemukan.");
            return;
        }

        setCustomersError("");
        setActiveSection("customers");
        setCreateMode(null);
        setSelectedIsp(null);
        setSelectedCustomerInitialTab(initialTab);
        setSelectedCustomerContextIsp(contextIsp);
        setSelectedCustomer(normalizedCustomer);
    };

    const handleOpenIspDetail = (isp) => {
        setActiveSection("customers");
        setSelectedCustomer(null);
        setSelectedCustomerContextIsp(null);
        setCreateMode(null);
        setSelectedIsp(isp);
    };

    const handleOpenCreateTenant = () => {
        setActiveSection("customers");
        setSelectedCustomer(null);
        setSelectedCustomerInitialTab("overview");
        setSelectedCustomerContextIsp(null);
        setSelectedIsp(null);
        setCreateMode("tenant");
    };

    const handleOpenCreateIsp = () => {
        setActiveSection("customers");
        setSelectedCustomer(null);
        setSelectedCustomerInitialTab("overview");
        setSelectedCustomerContextIsp(null);
        setSelectedIsp(null);
        setCreateMode("isp");
    };

    const handleCancelCreate = () => {
        setCreateMode(null);
    };

    const handleEntitySaved = async (savedEntity, type) => {
        setCreateMode(null);
        const [refreshedCustomers, refreshedIsps] = await Promise.all([
            loadCustomers(),
            loadIsps(),
        ]);

        if (type === "isp") {
            const savedIspId = Number(savedEntity?.id);
            if (Number.isFinite(savedIspId)) {
                const targetIsp = refreshedIsps.find((item) => Number(item.id) === savedIspId);
                if (targetIsp) {
                    setSelectedIsp(targetIsp);
                }
            }
            return;
        }

        const savedCustomerId = Number(savedEntity?.id);
        if (Number.isFinite(savedCustomerId)) {
            const targetCustomer = refreshedCustomers.find((item) => item.id === savedCustomerId);
            if (targetCustomer) {
                setSelectedCustomerContextIsp(null);
                setSelectedCustomer(targetCustomer);
                return;
            }
        }
    };

    const handleOpenCustomerById = (customerId, initialTab = "overview") => {
        const normalizedCustomerId = Number(customerId);
        const targetCustomer = customers.find((item) => Number(item.id) === normalizedCustomerId);
        if (!targetCustomer) {
            return;
        }

        handleOpenTenantDetail(targetCustomer, initialTab);
    };

    if (activeSection === "dashboard") {
        return (
            <DashboardPage
                activeSection={activeSection}
                customers={customers}
                isLoadingCustomers={isLoadingCustomers}
                onNavigate={handleNavigate}
            />
        );
    }

    if (activeSection === "monitoring") {
        return (
            <MonitoringSpreadsheetPage
                activeSection={activeSection}
                ispOptions={ispOptions}
                onNavigate={handleNavigate}
                onOpenCustomerById={handleOpenCustomerById}
            />
        );
    }

    if (activeSection !== "customers") {
        return (
            <SectionPlaceholderPage
                activeSection={activeSection}
                onNavigate={handleNavigate}
            />
        );
    }

    if (createMode === "tenant") {
        return (
            <TenantAdminFormPage
                isps={isps}
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={(entity) => handleEntitySaved(entity, "tenant")}
            />
        );
    }

    if (createMode === "isp") {
        return (
            <IspAdminFormPage
                onCancel={handleCancelCreate}
                onNavigate={handleNavigate}
                onSaved={(entity) => handleEntitySaved(entity, "isp")}
            />
        );
    }

    if (selectedIsp) {
        return (
            <IspDetailPage
                isp={selectedIsp}
                onBack={() => setSelectedIsp(null)}
                onNavigate={handleNavigate}
                onOpenTenant={(tenant, initialTab = "overview") =>
                    handleOpenTenantDetail(tenant, initialTab, selectedIsp)}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
            />
        );
    }

    if (selectedCustomer) {
        return (
            <TenantDetailPage
                customer={selectedCustomer}
                contextIsp={selectedCustomerContextIsp}
                initialTab={selectedCustomerInitialTab}
                onBack={() => {
                    setSelectedCustomer(null);
                    setSelectedCustomerInitialTab("overview");
                    setSelectedCustomerContextIsp(null);
                }}
                onCreateIsp={handleOpenCreateIsp}
                onNavigate={handleNavigate}
                onRefreshAll={async () => {
                    await Promise.all([loadCustomers(), loadIsps()]);
                }}
            />
        );
    }

    return (
        <CustomerWorkspacePage
            activeSection={activeSection}
            customers={customers}
            isps={isps}
            error={customersError}
            secondaryError={ispsError}
            isLoading={isLoadingCustomers || isLoadingIsps}
            onNavigate={handleNavigate}
            onOpenTenant={handleOpenTenantDetail}
            onOpenIsp={handleOpenIspDetail}
            onOpenCreateTenant={handleOpenCreateTenant}
            onOpenCreateIsp={handleOpenCreateIsp}
            onRefresh={async () => {
                await Promise.all([loadCustomers(), loadIsps()]);
            }}
        />
    );
}

function CustomerAdminFormPage({ mode, customer, ispOptions = [], onCancel, onNavigate, onSaved }) {
    const isEditMode = mode === "edit";
    const isActivationFeeLocked = isEditMode && Boolean(customer?.activationFeePaidAt);
    const resolvedInitialIsp = Array.isArray(customer?.ispList) && customer.ispList.length > 0
        ? customer.ispList.join(", ")
        : customer?.isp ?? "";
    const [form, setForm] = useState({
        name: customer?.name ?? "",
        ispName: resolvedInitialIsp,
        status: customer?.rawStatus ?? "aktif",
        contractNumber: "",
        activationFeeAmount: String(Number(customer?.activationFeeAmount ?? 0)),
        activationFeePaidAt: customer?.activationFeePaidAt ? String(customer.activationFeePaidAt).slice(0, 10) : "",
        contractInitialStartDate: "",
        contractRunningStartDate: "",
        contractRunningEndDate: "",
        contractCoreType: "core",
        contractCoreTotal: "4",
        contractSharingRatioLeft: "1",
        contractSharingRatioRight: "2",
        billingPeriodMode: "bulanan",
        billingCustomEvery: "",
        billingCustomUnit: "bulan",
    });
    const [submitError, setSubmitError] = useState("");
    const [submitSuccess, setSubmitSuccess] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [invoiceRows, setInvoiceRows] = useState([]);
    const ispDatalistId = "customer-admin-isp-options";

    useEffect(() => {
        const nextIspValue = Array.isArray(customer?.ispList) && customer.ispList.length > 0
            ? customer.ispList.join(", ")
            : customer?.isp ?? "";

        setForm({
            name: customer?.name ?? "",
            ispName: nextIspValue,
            status: customer?.rawStatus ?? "aktif",
            contractNumber: "",
            activationFeeAmount: String(Number(customer?.activationFeeAmount ?? 0)),
            activationFeePaidAt: customer?.activationFeePaidAt ? String(customer.activationFeePaidAt).slice(0, 10) : "",
            contractInitialStartDate: "",
            contractRunningStartDate: "",
            contractRunningEndDate: "",
            contractCoreType: "core",
            contractCoreTotal: "4",
            contractSharingRatioLeft: "1",
            contractSharingRatioRight: "2",
            billingPeriodMode: "bulanan",
            billingCustomEvery: "",
            billingCustomUnit: "bulan",
        });
        setInvoiceRows([]);
        setSubmitError("");
        setSubmitSuccess("");
    }, [
        isEditMode,
        customer?.id,
        customer?.name,
        customer?.isp,
        customer?.ispList,
        customer?.rawStatus,
        customer?.activationFeeAmount,
        customer?.activationFeePaidAt,
    ]);

    useEffect(() => {
        if (isEditMode) {
            setInvoiceRows([]);
            return;
        }

        const hasRunningPeriod = Boolean(
            form.contractRunningStartDate
            && form.contractRunningEndDate
            && form.contractRunningStartDate <= form.contractRunningEndDate,
        );
        const billingCycle = resolveBillingCycle(
            form.billingPeriodMode,
            form.billingCustomEvery,
            form.billingCustomUnit,
        );

        if (!hasRunningPeriod || !billingCycle) {
            setInvoiceRows((previousRows) => previousRows.filter((row) => row.kind === "manual"));
            return;
        }

        const autoRows = buildInvoiceScheduleRows(
            form.contractRunningStartDate,
            form.contractRunningEndDate,
            billingCycle,
        );

        setInvoiceRows((previousRows) => {
            const previousRowMap = new Map(previousRows.map((row) => [row.key, row]));
            const manualRows = previousRows.filter((row) => row.kind === "manual");

            const mergedAutoRows = autoRows.map((row) => {
                const previousRow = previousRowMap.get(row.key);
                if (!previousRow) {
                    return row;
                }

                return {
                    ...row,
                    invoiceNumber: previousRow.invoiceNumber ?? "",
                    amount: previousRow.amount ?? "",
                    paidAt: previousRow.paidAt ?? "",
                    invoiceFileName: previousRow.invoiceFileName ?? "",
                    paymentProofFileName: previousRow.paymentProofFileName ?? "",
                };
            });

            return [...mergedAutoRows, ...manualRows];
        });
    }, [
        isEditMode,
        form.contractRunningStartDate,
        form.contractRunningEndDate,
        form.billingPeriodMode,
        form.billingCustomEvery,
        form.billingCustomUnit,
    ]);

    const handleInvoiceRowChange = (rowKey, updates) => {
        setInvoiceRows((previousRows) =>
            previousRows.map((row) =>
                row.key === rowKey
                    ? {
                        ...row,
                        ...updates,
                    }
                    : row,
            ));
    };

    const handleAddManualInvoiceRow = () => {
        const manualKey = `manual-${Date.now()}-${Math.round(Math.random() * 1000)}`;

        setInvoiceRows((previousRows) => ([
            ...previousRows,
            {
                key: manualKey,
                kind: "manual",
                periodStartDate: form.contractRunningStartDate || "",
                periodEndDate: form.contractRunningEndDate || "",
                invoiceNumber: "",
                amount: "",
                paidAt: "",
                invoiceFileName: "",
                paymentProofFileName: "",
            },
        ]));
    };

    const handleRemoveManualInvoiceRow = (rowKey) => {
        setInvoiceRows((previousRows) =>
            previousRows.filter((row) => !(row.kind === "manual" && row.key === rowKey)));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const name = form.name.trim();
        const ispName = form.ispName.trim();
        const normalizedIspNames = ispName
            .split(",")
            .map((segment) => segment.trim())
            .filter(Boolean);
        const primaryIspName = normalizedIspNames[0] ?? "";
        const contractNumber = form.contractNumber.trim();
        const activationFeeAmount = Number(form.activationFeeAmount);
        const contractInitialStartDate = form.contractInitialStartDate;
        const contractRunningStartDate = form.contractRunningStartDate;
        const contractRunningEndDate = form.contractRunningEndDate;
        const contractCoreType = form.contractCoreType;
        const contractCoreTotal = Number(form.contractCoreTotal);
        const billingPeriodMode = form.billingPeriodMode;
        const billingCustomEvery = Number(form.billingCustomEvery);
        const billingCustomUnit = form.billingCustomUnit;
        const isCustomBillingMode = billingPeriodMode === "custom";
        const billingCycle = resolveBillingCycle(
            billingPeriodMode,
            form.billingCustomEvery,
            billingCustomUnit,
        );
        const contractSharingRatioLeft = form.contractSharingRatioLeft.trim();
        const contractSharingRatioRight = form.contractSharingRatioRight.trim();
        const isSharingRatioLeftValid = /^[1-9]\d*$/.test(contractSharingRatioLeft);
        const isSharingRatioRightValid = /^[1-9]\d*$/.test(contractSharingRatioRight);
        const normalizedSharingRatio = isSharingRatioLeftValid && isSharingRatioRightValid
            ? `${String(Number(contractSharingRatioLeft))}:${String(Number(contractSharingRatioRight))}`
            : "";
        const hasContractNumber = Boolean(contractNumber);
        const hasAnyContractDate = Boolean(
            contractInitialStartDate || contractRunningStartDate || contractRunningEndDate,
        );
        const hasAllContractDates = Boolean(
            contractInitialStartDate && contractRunningStartDate && contractRunningEndDate,
        );

        if (!name || !primaryIspName) {
            setSubmitError("Nama pelanggan dan nama ISP wajib diisi.");
            return;
        }

        if (!Number.isFinite(activationFeeAmount) || activationFeeAmount < 0) {
            setSubmitError("Biaya aktivasi harus berupa angka >= 0.");
            return;
        }

        if (isCustomBillingMode) {
            if (!Number.isFinite(billingCustomEvery) || billingCustomEvery <= 0) {
                setSubmitError("Periode tagihan custom harus berupa angka lebih besar dari 0.");
                return;
            }

            if (!["hari", "bulan", "tahun"].includes(billingCustomUnit)) {
                setSubmitError("Satuan periode tagihan custom tidak valid.");
                return;
            }
        }

        if (!isEditMode && hasAnyContractDate && !hasAllContractDates) {
            setSubmitError("Periode kontrak harus diisi lengkap: awal kontrak, periode berjalan awal, dan periode berjalan akhir.");
            return;
        }

        if (!isEditMode && hasContractNumber && !hasAllContractDates) {
            setSubmitError("Nomor kontrak membutuhkan periode kontrak yang lengkap.");
            return;
        }

        if (!isEditMode && hasAllContractDates && contractRunningStartDate > contractRunningEndDate) {
            setSubmitError("Tanggal periode berjalan awal tidak boleh lebih besar dari tanggal periode berjalan akhir.");
            return;
        }

        if (!isEditMode && hasAllContractDates && contractInitialStartDate > contractRunningStartDate) {
            setSubmitError("Tanggal awal kontrak tidak boleh lebih besar dari tanggal periode berjalan awal.");
            return;
        }

        if (!isEditMode && hasAllContractDates) {
            if (contractCoreType === "core" && (!Number.isFinite(contractCoreTotal) || contractCoreTotal <= 0)) {
                setSubmitError("Total core pada detail teknis harus lebih besar dari 0.");
                return;
            }

            if (contractCoreType === "sharing_core" && (!isSharingRatioLeftValid || !isSharingRatioRightValid)) {
                setSubmitError("Rasio shared core tidak valid. Gunakan format seperti 1:2 atau 3:5.");
                return;
            }
        }

        let invoiceDraftValidationError = "";
        const normalizedInvoiceDrafts = !isEditMode && hasAllContractDates
            ? invoiceRows.map((row, index) => {
                const periodStartDate = String(row.periodStartDate ?? "").trim();
                const periodEndDate = String(row.periodEndDate ?? "").trim();
                const invoiceNumber = String(row.invoiceNumber ?? "").trim();
                const amount = Number(row.amount);
                const paidAt = String(row.paidAt ?? "").trim();
                const invoiceFileName = String(row.invoiceFileName ?? "").trim();
                const paymentProofFileName = String(row.paymentProofFileName ?? "").trim();

                if (!periodStartDate || !periodEndDate) {
                    invoiceDraftValidationError = `Periode tagihan pada baris ${index + 1} wajib diisi.`;
                }

                if (!invoiceDraftValidationError && periodStartDate > periodEndDate) {
                    invoiceDraftValidationError = `Periode tagihan pada baris ${index + 1} tidak valid.`;
                }

                if (!invoiceDraftValidationError && (!Number.isFinite(amount) || amount <= 0)) {
                    invoiceDraftValidationError = `Jumlah tagihan pada baris ${index + 1} harus berupa angka > 0.`;
                }

                return {
                    periodStartDate,
                    periodEndDate,
                    invoiceNumber: invoiceNumber || undefined,
                    amount: Number.isFinite(amount) ? Math.round(Math.max(amount, 1)) : 1,
                    paidAt: paidAt || null,
                    invoiceFileUrl: invoiceFileName ? `upload://${invoiceFileName}` : null,
                    paymentProofFileUrl: paymentProofFileName
                        ? `upload://${paymentProofFileName}`
                        : null,
                };
            })
            : [];

        if (invoiceDraftValidationError) {
            setSubmitError(invoiceDraftValidationError);
            return;
        }

        if (!isEditMode && hasAllContractDates && !billingCycle) {
            setSubmitError("Periode tagihan belum valid untuk membentuk jadwal invoice.");
            return;
        }

        if (!isEditMode && hasAllContractDates && normalizedInvoiceDrafts.length === 0) {
            setSubmitError("Jadwal invoice belum terbentuk. Lengkapi periode berjalan dan periode tagihan.");
            return;
        }

        if (isEditMode && !customer?.id) {
            setSubmitError("Data pelanggan untuk edit tidak ditemukan.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");
        setSubmitSuccess("");

        try {
            const payload = {
                name,
                ispName: primaryIspName,
                status: form.status === "nonaktif" ? "nonaktif" : "aktif",
            };

            if (normalizedIspNames.length > 1) {
                payload.newIspNames = normalizedIspNames.slice(1);
            }

            if (!isActivationFeeLocked) {
                payload.activationFeeAmount = Math.round(activationFeeAmount);
                payload.activationFeePaidAt = form.activationFeePaidAt || null;
            }

            if (!isEditMode && hasAllContractDates) {
                payload.contractStartDate = contractRunningStartDate;
                payload.contractEndDate = contractRunningEndDate;
                payload.contractCoreType = contractCoreType;
                payload.contractCoreTotal = contractCoreType === "core" ? Math.round(contractCoreTotal) : undefined;
                payload.contractSharingRatio = contractCoreType === "sharing_core" ? normalizedSharingRatio : undefined;
                payload.contractNumber = hasContractNumber ? contractNumber : undefined;
                payload.billingPeriodMode = billingPeriodMode;
                payload.billingCustomEvery = billingPeriodMode === "custom"
                    ? Math.round(Number(form.billingCustomEvery))
                    : undefined;
                payload.billingCustomUnit = billingPeriodMode === "custom" ? billingCustomUnit : undefined;
                payload.invoiceDrafts = normalizedInvoiceDrafts;
            }

            const endpoint = isEditMode
                ? `${API_BASE_URL}/api/customers/${customer.id}`
                : `${API_BASE_URL}/api/customers`;
            const method = isEditMode ? "PATCH" : "POST";

            const result = await fetchJson(endpoint, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            setSubmitSuccess(
                isEditMode
                    ? "Data pelanggan berhasil diperbarui oleh admin."
                    : "Pelanggan baru berhasil ditambahkan oleh admin.",
            );

            if (onSaved) {
                await onSaved(result);
            }
        } catch (requestError) {
            setSubmitError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat menyimpan data pelanggan.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <form className="mx-auto w-full max-w-6xl space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <h2 className="text-3xl font-extrabold leading-tight text-on-surface font-headline">
                            {isEditMode ? "Edit Data Pelanggan" : "Entri Pelanggan Baru"}
                        </h2>
                        <p className="mt-2 max-w-lg text-on-surface-variant">
                            Lengkapi data inti pelanggan untuk sinkronisasi arsip dan monitoring tenant.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            className="rounded-xl px-6 py-2.5 font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-95"
                            onClick={onCancel}
                            type="button"
                        >
                            Batalkan
                        </button>
                        <button
                            className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSubmitting}
                            type="submit"
                        >
                            {isSubmitting
                                ? "Menyimpan..."
                                : isEditMode
                                    ? "Simpan Perubahan"
                                    : "Simpan Pelanggan"}
                        </button>
                    </div>
                </div>

                {submitError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {submitError}
                    </div>
                )}

                {submitSuccess && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        {submitSuccess}
                    </div>
                )}

                <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 space-y-8 lg:col-span-8">
                        <section className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                            <div className="mb-6 flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">badge</span>
                                <h3 className="text-lg font-bold text-on-surface">Identitas Pelanggan</h3>
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Nama ISP
                                    </label>
                                    <input
                                        list={ispDatalistId}
                                        className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) => setForm((previous) => ({ ...previous, ispName: event.target.value }))}
                                        placeholder="Pilih ISP yang ada atau ketik ISP baru"
                                        type="text"
                                        value={form.ispName}
                                    />
                                    <datalist id={ispDatalistId}>
                                        {ispOptions.map((isp) => (
                                            <option key={isp} value={isp} />
                                        ))}
                                    </datalist>
                                    <p className="mt-1 text-[11px] text-on-surface-variant">
                                        Bisa pilih dari daftar ISP existing atau ketik nama ISP baru.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Status Keaktifan
                                    </label>
                                    <select
                                        className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                                        value={form.status}
                                    >
                                        <option value="aktif">Aktif</option>
                                        <option value="nonaktif">Non-aktif</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Nama Pelanggan / Institusi
                                    </label>
                                    <input
                                        className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                                        placeholder="Masukkan nama lengkap pelanggan"
                                        type="text"
                                        value={form.name}
                                    />
                                </div>
                            </div>
                        </section>

                        {!isEditMode && (
                            <section className="rounded-lg border-l-4 border-blue-900 bg-surface-container-lowest p-8 shadow-sm">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">calendar_today</span>
                                    <h3 className="text-lg font-bold text-on-surface">Periode Kontrak</h3>
                                </div>

                                <div className="mb-6">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Nomor Kontrak
                                    </label>
                                    <input
                                        className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) => setForm((previous) => ({ ...previous, contractNumber: event.target.value }))}
                                        placeholder="Contoh: CTR-KIMA-2026-001"
                                        type="text"
                                        value={form.contractNumber}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Awal Kontrak
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            onChange={(event) => setForm((previous) => ({ ...previous, contractInitialStartDate: event.target.value }))}
                                            type="date"
                                            value={form.contractInitialStartDate}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Berjalan - Mulai
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            onChange={(event) => setForm((previous) => ({ ...previous, contractRunningStartDate: event.target.value }))}
                                            type="date"
                                            value={form.contractRunningStartDate}
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Berjalan - Akhir
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            onChange={(event) => setForm((previous) => ({ ...previous, contractRunningEndDate: event.target.value }))}
                                            type="date"
                                            value={form.contractRunningEndDate}
                                        />
                                    </div>
                                </div>
                            </section>
                        )}

                        {!isEditMode && (
                            <section className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-on-surface">Rencana Invoice Awal</h3>
                                        <p className="text-xs text-on-surface-variant">
                                            Jumlah baris otomatis mengikuti periode berjalan dan periode tagihan.
                                        </p>
                                    </div>
                                    <button
                                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                                        onClick={handleAddManualInvoiceRow}
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Tambah Baris Manual
                                    </button>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                    <table className="w-full min-w-[1100px] border-collapse">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">No</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Periode Tagihan</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Nomor Invoice</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Jumlah Tiap Tagihan</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Up Invoice</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Up Bukti Bayar</th>
                                                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Tanggal Dibayar</th>
                                                <th className="px-3 py-2 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {invoiceRows.length === 0 && (
                                                <tr>
                                                    <td className="px-3 py-4 text-center text-xs text-on-surface-variant" colSpan="8">
                                                        Isi periode berjalan dan pilih periode tagihan untuk membentuk baris invoice otomatis.
                                                    </td>
                                                </tr>
                                            )}

                                            {invoiceRows.map((row, index) => (
                                                <tr key={row.key} className="align-top hover:bg-slate-50/80">
                                                    <td className="px-3 py-2 text-xs font-semibold text-on-surface-variant">
                                                        {String(index + 1).padStart(2, "0")}
                                                    </td>

                                                    <td className="px-3 py-2 text-xs text-slate-700">
                                                        {row.kind === "manual" ? (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <input
                                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                                                                    onChange={(event) =>
                                                                        handleInvoiceRowChange(row.key, {
                                                                            periodStartDate: event.target.value,
                                                                        })
                                                                    }
                                                                    type="date"
                                                                    value={row.periodStartDate}
                                                                />
                                                                <input
                                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                                                                    onChange={(event) =>
                                                                        handleInvoiceRowChange(row.key, {
                                                                            periodEndDate: event.target.value,
                                                                        })
                                                                    }
                                                                    type="date"
                                                                    value={row.periodEndDate}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <p className="font-semibold text-slate-700">
                                                                    {formatDate(row.periodStartDate)} - {formatDate(row.periodEndDate)}
                                                                </p>
                                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                                                    Otomatis
                                                                </p>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <input
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                                                            onChange={(event) =>
                                                                handleInvoiceRowChange(row.key, {
                                                                    invoiceNumber: event.target.value,
                                                                })
                                                            }
                                                            placeholder="INV-..."
                                                            type="text"
                                                            value={row.invoiceNumber}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <input
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                                                            min="1"
                                                            onChange={(event) =>
                                                                handleInvoiceRowChange(row.key, {
                                                                    amount: event.target.value,
                                                                })
                                                            }
                                                            placeholder="0"
                                                            step="1"
                                                            type="number"
                                                            value={row.amount}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <input
                                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                            className="w-full text-xs"
                                                            onChange={(event) =>
                                                                handleInvoiceRowChange(row.key, {
                                                                    invoiceFileName: event.target.files?.[0]?.name ?? "",
                                                                })
                                                            }
                                                            type="file"
                                                        />
                                                        {row.invoiceFileName && (
                                                            <p className="mt-1 truncate text-[10px] text-on-surface-variant">{row.invoiceFileName}</p>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <input
                                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                                            className="w-full text-xs"
                                                            onChange={(event) =>
                                                                handleInvoiceRowChange(row.key, {
                                                                    paymentProofFileName: event.target.files?.[0]?.name ?? "",
                                                                })
                                                            }
                                                            type="file"
                                                        />
                                                        {row.paymentProofFileName && (
                                                            <p className="mt-1 truncate text-[10px] text-on-surface-variant">{row.paymentProofFileName}</p>
                                                        )}
                                                    </td>

                                                    <td className="px-3 py-2">
                                                        <input
                                                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs"
                                                            onChange={(event) =>
                                                                handleInvoiceRowChange(row.key, {
                                                                    paidAt: event.target.value,
                                                                })
                                                            }
                                                            type="date"
                                                            value={row.paidAt}
                                                        />
                                                    </td>

                                                    <td className="px-3 py-2 text-right">
                                                        {row.kind === "manual" ? (
                                                            <button
                                                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
                                                                onClick={() => handleRemoveManualInvoiceRow(row.key)}
                                                                type="button"
                                                            >
                                                                Hapus
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-400">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                    </div>

                    <div className="col-span-12 space-y-8 lg:col-span-4">
                        {!isEditMode && (
                            <section className="rounded-lg bg-surface-container-low p-6">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">settings_ethernet</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface">Detail Teknis (Eksklusif)</h3>
                                </div>

                                <div className="space-y-4">
                                    <label className="block cursor-pointer">
                                        <div
                                            className={`flex items-start gap-4 rounded-xl border-2 bg-surface-container-lowest p-4 transition-all ${form.contractCoreType === "core" ? "border-primary" : "border-transparent"}`}
                                        >
                                            <input
                                                checked={form.contractCoreType === "core"}
                                                className="mt-1 text-primary focus:ring-primary"
                                                name="tech_type"
                                                onChange={() => setForm((previous) => ({ ...previous, contractCoreType: "core" }))}
                                                type="radio"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-on-surface">Dedicated Core</p>
                                                <p className="mb-3 text-xs text-on-surface-variant">Core eksklusif tanpa pembagian bandwidth.</p>
                                                <div className="relative">
                                                    <input
                                                        className="w-full rounded-lg border-none bg-surface p-2.5 text-xs focus:ring-2 focus:ring-primary/20"
                                                        min="1"
                                                        onChange={(event) => setForm((previous) => ({ ...previous, contractCoreTotal: event.target.value }))}
                                                        placeholder="Jumlah Core"
                                                        step="1"
                                                        type="number"
                                                        value={form.contractCoreTotal}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">CORE</span>
                                                </div>
                                            </div>
                                        </div>
                                    </label>

                                    <label className="block cursor-pointer">
                                        <div
                                            className={`flex items-start gap-4 rounded-xl border-2 bg-surface-container-lowest p-4 transition-all ${form.contractCoreType === "sharing_core" ? "border-primary" : "border-transparent"}`}
                                        >
                                            <input
                                                checked={form.contractCoreType === "sharing_core"}
                                                className="mt-1 text-primary focus:ring-primary"
                                                name="tech_type"
                                                onChange={() => setForm((previous) => ({ ...previous, contractCoreType: "sharing_core" }))}
                                                type="radio"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-on-surface">Shared Core</p>
                                                <p className="mb-3 text-xs text-on-surface-variant">Core berbagi dengan rasio tertentu.</p>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        className="w-full rounded-lg border-none bg-surface p-2.5 text-xs focus:ring-2 focus:ring-primary/20"
                                                        min="1"
                                                        onChange={(event) => setForm((previous) => ({ ...previous, contractSharingRatioLeft: event.target.value }))}
                                                        placeholder="Kiri"
                                                        step="1"
                                                        type="number"
                                                        value={form.contractSharingRatioLeft}
                                                    />
                                                    <span className="text-sm font-bold text-on-surface-variant">:</span>
                                                    <input
                                                        className="w-full rounded-lg border-none bg-surface p-2.5 text-xs focus:ring-2 focus:ring-primary/20"
                                                        min="1"
                                                        onChange={(event) => setForm((previous) => ({ ...previous, contractSharingRatioRight: event.target.value }))}
                                                        placeholder="Kanan"
                                                        step="1"
                                                        type="number"
                                                        value={form.contractSharingRatioRight}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </section>
                        )}

                        <section className="rounded-lg bg-surface-container-low p-6">
                            <div className="mb-6 flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">payments</span>
                                <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface">Billing & Aktivasi</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        Periode Tagihan
                                    </label>
                                    <div className="mb-3 grid grid-cols-3 gap-2">
                                        <button
                                            className={`rounded-lg py-2 text-xs font-bold transition-colors ${form.billingPeriodMode === "bulanan"
                                                ? "bg-primary text-white"
                                                : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-200"
                                                }`}
                                            onClick={() => setForm((previous) => ({ ...previous, billingPeriodMode: "bulanan" }))}
                                            type="button"
                                        >
                                            Bulanan
                                        </button>
                                        <button
                                            className={`rounded-lg py-2 text-xs font-bold transition-colors ${form.billingPeriodMode === "3bulanan"
                                                ? "bg-primary text-white"
                                                : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-200"
                                                }`}
                                            onClick={() => setForm((previous) => ({ ...previous, billingPeriodMode: "3bulanan" }))}
                                            type="button"
                                        >
                                            3 Bulanan
                                        </button>
                                        <button
                                            className={`rounded-lg py-2 text-xs font-bold transition-colors ${form.billingPeriodMode === "custom"
                                                ? "bg-primary text-white"
                                                : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-200"
                                                }`}
                                            onClick={() => setForm((previous) => ({ ...previous, billingPeriodMode: "custom" }))}
                                            type="button"
                                        >
                                            Custom Fleksibel
                                        </button>
                                    </div>

                                    <div
                                        className={`rounded-xl p-4 transition-colors ${form.billingPeriodMode === "custom"
                                            ? "bg-surface-container-lowest"
                                            : "bg-slate-100"
                                            }`}
                                    >
                                        <p className="mb-2 text-[10px] font-bold uppercase text-on-surface-variant">Kustom Fleksibel</p>
                                        <div className="flex gap-2">
                                            <input
                                                className="w-20 rounded-lg border-none bg-surface p-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-on-surface-variant"
                                                disabled={form.billingPeriodMode !== "custom"}
                                                min="1"
                                                onChange={(event) => setForm((previous) => ({ ...previous, billingCustomEvery: event.target.value }))}
                                                placeholder="1"
                                                step="1"
                                                type="number"
                                                value={form.billingCustomEvery}
                                            />
                                            <select
                                                className="flex-1 rounded-lg border-none bg-surface p-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-on-surface-variant"
                                                disabled={form.billingPeriodMode !== "custom"}
                                                onChange={(event) => setForm((previous) => ({ ...previous, billingCustomUnit: event.target.value }))}
                                                value={form.billingCustomUnit}
                                            >
                                                <option value="hari">Hari</option>
                                                <option value="bulan">Bulan</option>
                                                <option value="tahun">Tahun</option>
                                            </select>
                                        </div>
                                        {form.billingPeriodMode !== "custom" && (
                                            <p className="mt-2 text-[10px] text-on-surface-variant">
                                                Pilih mode Custom Fleksibel untuk mengisi periode custom.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 pt-4">
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        Biaya Aktivasi
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">Rp</span>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface-container-lowest py-3 pl-10 pr-4 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-on-surface-variant"
                                            disabled={isActivationFeeLocked}
                                            min="0"
                                            onChange={(event) => setForm((previous) => ({ ...previous, activationFeeAmount: event.target.value }))}
                                            placeholder="0"
                                            step="1"
                                            type="number"
                                            value={form.activationFeeAmount}
                                        />
                                    </div>
                                    <p className="mt-2 text-[10px] italic text-on-surface-variant">* Biaya instalasi awal core dan perangkat.</p>
                                </div>

                                {isEditMode && (
                                    <div>
                                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                            Tanggal Bayar Aktivasi
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface-container-lowest p-3 text-sm focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-on-surface-variant"
                                            disabled={isActivationFeeLocked}
                                            onChange={(event) => setForm((previous) => ({ ...previous, activationFeePaidAt: event.target.value }))}
                                            type="date"
                                            value={form.activationFeePaidAt}
                                        />
                                        {isActivationFeeLocked ? (
                                            <p className="mt-2 text-[11px] font-semibold text-amber-700">
                                                Biaya aktivasi sudah terbayar dan dikunci karena hanya sekali di awal sewa.
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-[11px] text-on-surface-variant">
                                                Kosongkan jika biaya aktivasi belum dibayar.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </form>
        </AppShell>
    );
}

function CustomerDirectoryPage({
    activeSection,
    onNavigate,
    customers,
    isLoading,
    error,
    onOpenDetail,
    onOpenCreate,
    onRefresh,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [ispFilter, setIspFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [collapsedIspMap, setCollapsedIspMap] = useState({});

    const statusMeta = useMemo(() => ({
        active: {
            label: "Aktif",
            containerClass: "border-green-600 bg-surface-container text-on-surface",
            dotClass: "bg-green-600",
        },
        "non-active": {
            label: "Non-aktif",
            containerClass: "border-error bg-error-container/30 text-on-error-container",
            dotClass: "bg-error",
        },
    }), []);

    const resolveCustomerStatusKey = useCallback((customer) => {
        if (!customer.active || customer.rawStatus === "nonaktif") {
            return "non-active";
        }

        return "active";
    }, []);

    const ispOptions = useMemo(() => {
        const values = new Set();
        customers.forEach((item) => {
            if (Array.isArray(item.ispList) && item.ispList.length > 0) {
                item.ispList.forEach((ispName) => values.add(ispName));
                return;
            }

            values.add(item.isp);
        });
        return Array.from(values).sort((left, right) => left.localeCompare(right));
    }, [customers]);

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filteredCustomers = useMemo(() => {
        return customers.filter((customer) => {
            const customerStatusKey = resolveCustomerStatusKey(customer);
            const searchableIspNames = Array.isArray(customer.ispList) && customer.ispList.length > 0
                ? customer.ispList.join(" ")
                : customer.isp;
            const isInSelectedIsp = ispFilter === "all"
                ? true
                : Array.isArray(customer.ispList) && customer.ispList.length > 0
                    ? customer.ispList.includes(ispFilter)
                    : customer.isp === ispFilter;

            const matchesSearch = normalizedSearch
                ? customer.name.toLowerCase().includes(normalizedSearch)
                || searchableIspNames.toLowerCase().includes(normalizedSearch)
                || customer.customerId.toLowerCase().includes(normalizedSearch)
                : true;

            const matchesIsp = isInSelectedIsp;
            const matchesStatus = statusFilter === "all" ? true : customerStatusKey === statusFilter;

            return matchesSearch && matchesIsp && matchesStatus;
        });
    }, [customers, normalizedSearch, ispFilter, statusFilter, resolveCustomerStatusKey]);

    const groupedCustomers = useMemo(() => {
        const groups = new Map();

        filteredCustomers.forEach((customer) => {
            if (!groups.has(customer.isp)) {
                groups.set(customer.isp, []);
            }

            groups.get(customer.isp).push(customer);
        });

        return Array.from(groups.entries())
            .sort(([leftIsp], [rightIsp]) => leftIsp.localeCompare(rightIsp))
            .map(([ispName, customersByIsp]) => {
                const sortedCustomers = customersByIsp
                    .slice()
                    .sort((left, right) => left.name.localeCompare(right.name));
                const nonActiveCount = sortedCustomers.filter(
                    (customer) => resolveCustomerStatusKey(customer) === "non-active",
                ).length;

                return {
                    ispName,
                    customers: sortedCustomers,
                    totalCustomers: sortedCustomers.length,
                    nonActiveCount,
                };
            });
    }, [filteredCustomers, resolveCustomerStatusKey]);

    const totalActive = filteredCustomers.filter(
        (customer) => resolveCustomerStatusKey(customer) === "active",
    ).length;
    const totalNonActive = filteredCustomers.filter(
        (customer) => resolveCustomerStatusKey(customer) === "non-active",
    ).length;

    const isAnyFilterActive = Boolean(normalizedSearch)
        || ispFilter !== "all"
        || statusFilter !== "all";

    const highlightedText = useCallback((value) => {
        const text = String(value ?? "");
        if (!normalizedSearch) {
            return text;
        }

        const lowerText = text.toLowerCase();
        if (!lowerText.includes(normalizedSearch)) {
            return text;
        }

        const nodes = [];
        let cursor = 0;
        let keyIndex = 0;

        while (cursor < text.length) {
            const matchIndex = lowerText.indexOf(normalizedSearch, cursor);

            if (matchIndex === -1) {
                nodes.push(
                    <span key={`text-${keyIndex}`}>
                        {text.slice(cursor)}
                    </span>,
                );
                break;
            }

            if (matchIndex > cursor) {
                nodes.push(
                    <span key={`text-${keyIndex}`}>
                        {text.slice(cursor, matchIndex)}
                    </span>,
                );
                keyIndex += 1;
            }

            nodes.push(
                <mark key={`mark-${keyIndex}`} className="rounded bg-amber-100 px-0.5 text-amber-900">
                    {text.slice(matchIndex, matchIndex + normalizedSearch.length)}
                </mark>,
            );

            keyIndex += 1;
            cursor = matchIndex + normalizedSearch.length;
        }

        return nodes;
    }, [normalizedSearch]);

    const handleToggleIspGroup = (ispName) => {
        if (normalizedSearch) {
            return;
        }

        setCollapsedIspMap((previous) => ({
            ...previous,
            [ispName]: !previous[ispName],
        }));
    };

    const handleResetSearch = () => {
        setSearchTerm("");
        setIspFilter("all");
        setStatusFilter("all");
        setCollapsedIspMap({});
    };

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl">
                <header className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div className="space-y-2">
                        <nav className="mb-1 flex items-center gap-2 text-xs font-medium text-on-surface-variant/70">
                            <span>KIMA Arsip</span>
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                            <span className="font-bold text-primary">Direktori Pelanggan</span>
                        </nav>
                        <h1 className="text-4xl font-extrabold tracking-tight text-primary">Daftar Pelanggan</h1>
                        <p className="max-w-xl leading-relaxed text-on-surface-variant">
                            Semua data pelanggan dikelola satu arah oleh admin: tambah, edit, update,
                            dan sinkronisasi data monitoring dilakukan dari panel ini.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3.5 font-bold text-white shadow-lg transition-all hover:shadow-primary/20 active:scale-95"
                            onClick={onOpenCreate}
                            type="button"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            <span>Tambah Pelanggan</span>
                        </button>
                        <button
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                            onClick={() => {
                                void onRefresh();
                            }}
                            type="button"
                        >
                            <span className="material-symbols-outlined">sync</span>
                            <span>Refresh Data</span>
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-700">info</span>
                        <p className="text-sm font-bold text-blue-800">Alur Kerja Admin</p>
                    </div>
                    <p className="text-sm leading-relaxed text-blue-700">
                        Upload dokumen, edit data pelanggan, dan pembaruan status dikelola langsung oleh admin.
                        Sistem otomatis menandai tindakan prioritas saat kontrak mendekati berakhir atau ada data yang belum lengkap.
                    </p>
                </section>

                <section className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl bg-surface-container-low p-5">
                    <div className="relative min-w-[280px] flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                            search
                        </span>
                        <input
                            className="w-full rounded-xl border-none bg-surface-container-lowest py-3 pl-12 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/10"
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search ISP or Customer Name"
                            type="text"
                            value={searchTerm}
                        />
                    </div>

                    <div className="relative min-w-[220px]">
                        <select
                            className="w-full appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pr-10 text-sm shadow-sm focus:ring-2 focus:ring-primary/10"
                            onChange={(event) => setIspFilter(event.target.value)}
                            value={ispFilter}
                        >
                            <option value="all">Semua ISP</option>
                            {ispOptions.map((isp) => (
                                <option key={isp} value={isp}>
                                    {isp}
                                </option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                            expand_more
                        </span>
                    </div>

                    <div className="relative min-w-[220px]">
                        <select
                            className="w-full appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pr-10 text-sm shadow-sm focus:ring-2 focus:ring-primary/10"
                            onChange={(event) => setStatusFilter(event.target.value)}
                            value={statusFilter}
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="non-active">Non-aktif</option>
                        </select>
                        <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                            expand_more
                        </span>
                    </div>

                    <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-on-surface-variant shadow-sm transition-colors hover:bg-slate-50"
                        onClick={handleResetSearch}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-base">restart_alt</span>
                        Reset search
                    </button>
                </section>

                <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                            Pelanggan Ditampilkan
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-on-surface">{filteredCustomers.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                            ISP Ditampilkan
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-on-surface">{groupedCustomers.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">
                            Status Pelanggan
                        </p>
                        <p className="mt-3 text-3xl font-extrabold text-on-surface">{totalActive} / {totalNonActive}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                            Aktif / Non-aktif
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    {isLoading && (
                        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-6 text-center text-sm text-on-surface-variant shadow-sm">
                            Memuat data pelanggan dari backend...
                        </div>
                    )}

                    {!isLoading && groupedCustomers.length === 0 && (
                        <div className="rounded-2xl border border-slate-100 bg-white px-6 py-10 text-center shadow-sm">
                            <p className="text-base font-bold text-on-surface">No results found</p>
                            <p className="mt-2 text-sm text-on-surface-variant">
                                Coba kata kunci lain atau gunakan tombol reset search.
                            </p>
                            {isAnyFilterActive && (
                                <button
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                                    onClick={handleResetSearch}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base">restart_alt</span>
                                    Reset search
                                </button>
                            )}
                        </div>
                    )}

                    {!isLoading && groupedCustomers.map((group) => {
                        const isExpanded = normalizedSearch ? true : !collapsedIspMap[group.ispName];

                        return (
                            <div
                                key={group.ispName}
                                className="overflow-hidden rounded-2xl border border-slate-100 bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.04)]"
                            >
                                <button
                                    className="flex w-full items-center justify-between gap-4 bg-slate-50/50 px-6 py-4 text-left"
                                    onClick={() => handleToggleIspGroup(group.ispName)}
                                    type="button"
                                >
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            ISP Group
                                        </p>
                                        <h3 className="mt-1 text-lg font-extrabold text-primary">
                                            {highlightedText(group.ispName)}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                            {group.totalCustomers} pelanggan
                                        </span>
                                        {group.nonActiveCount > 0 && (
                                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                                                {group.nonActiveCount} non-aktif
                                            </span>
                                        )}
                                        <span
                                            className={`material-symbols-outlined text-on-surface-variant transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                        >
                                            expand_more
                                        </span>
                                    </div>
                                </button>

                                <div className={`grid transition-all duration-300 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                                    <div className="overflow-hidden">
                                        <div className="overflow-x-auto border-t border-outline-variant/10">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="border-b border-outline-variant/10 bg-white">
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                                            Customer Name
                                                        </th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                                            Status
                                                        </th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                                            Aksi
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-surface">
                                                    {group.customers.map((customer) => {
                                                        const customerStatusKey = resolveCustomerStatusKey(customer);
                                                        const customerStatusMeta = statusMeta[customerStatusKey];

                                                        return (
                                                            <tr key={customer.id} className="group transition-colors hover:bg-slate-50">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-semibold text-on-surface">
                                                                            {highlightedText(customer.name)}
                                                                        </span>
                                                                        <span className="mt-1 text-[11px] text-on-surface-variant">
                                                                            ID: {highlightedText(customer.customerId)}
                                                                        </span>
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 rounded-full border-l-[4px] py-1 pl-1 pr-3 ${customerStatusMeta.containerClass}`}
                                                                    >
                                                                        <span className={`h-1.5 w-1.5 rounded-full ${customerStatusMeta.dotClass}`}></span>
                                                                        <span className="text-[11px] font-bold uppercase">
                                                                            {customerStatusMeta.label}
                                                                        </span>
                                                                    </span>
                                                                </td>

                                                                <td className="px-6 py-4 text-right">
                                                                    <button
                                                                        className="inline-flex items-center gap-1 rounded-lg bg-primary/5 px-3 py-2 text-primary transition-colors hover:bg-primary/10"
                                                                        onClick={() => onOpenDetail(customer)}
                                                                        type="button"
                                                                    >
                                                                        <span className="material-symbols-outlined text-base">visibility</span>
                                                                        Detail
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </section>
            </div>
        </AppShell>
    );
}

function SectionPlaceholderPage({ activeSection, onNavigate }) {
    const section = sectionMeta[activeSection] ?? sectionMeta.dashboard;
    const isTrashSection = activeSection === "trash";

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-5xl">
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold tracking-tight text-primary">{section.title}</h1>
                    <p className="mt-3 max-w-2xl text-on-surface-variant">{section.description}</p>
                </header>

                <section className="rounded-2xl border border-slate-100 bg-surface-container-lowest p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-primary">
                            {isTrashSection ? "delete" : "construction"}
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-on-surface">
                                {isTrashSection
                                    ? "Antrian Pemulihan"
                                    : "Modul Disiapkan"}
                            </h2>
                            <p className="text-sm text-on-surface-variant">
                                {isTrashSection
                                    ? "Tempat sampah dipakai untuk item terhapus sementara sebelum proses pembersihan permanen."
                                    : `Untuk modul ${section.title.toLowerCase()}, endpoint backend final belum tersedia.`}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Status UI</p>
                            <p className="mt-2 text-sm text-on-surface">
                                {isTrashSection
                                    ? "Mode read-only pendukung workflow"
                                    : "Sudah siap dipasang data"}
                            </p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Backend</p>
                            <p className="mt-2 text-sm text-on-surface">Menunggu endpoint write/list final</p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Temporary UX</p>
                            <p className="mt-2 text-sm text-on-surface">Arahkan workflow ke modul aktif</p>
                        </div>
                    </div>

                    <button
                        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-sm font-bold text-white"
                        onClick={() => onNavigate("customers")}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-sm">groups</span>
                        Kembali ke Direktori Pelanggan
                    </button>
                </section>
            </div>
        </AppShell>
    );
}

function CustomerDetailPage({
    customer,
    initialTab = "overview",
    onBack,
    onEdit,
    onNavigate,
    onRefreshCustomers,
}) {
    const backendCustomerId = customer.id;

    const [activeTab, setActiveTab] = useState("overview");
    const [customerDetail, setCustomerDetail] = useState(null);
    const [complianceStatus, setComplianceStatus] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState("");

    const [documents, setDocuments] = useState([]);
    const [documentFilter, setDocumentFilter] = useState("all");
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [documentsError, setDocumentsError] = useState("");
    const [uploadFeedback, setUploadFeedback] = useState("");
    const [isUploadingDocument, setIsUploadingDocument] = useState(false);
    const [newDocument, setNewDocument] = useState(() => createDefaultDocumentForm());
    const [invoiceUploadDraft, setInvoiceUploadDraft] = useState(null);
    const [invoiceUploadError, setInvoiceUploadError] = useState("");
    const [invoiceUploadFeedback, setInvoiceUploadFeedback] = useState("");
    const [isUploadingInvoiceDocument, setIsUploadingInvoiceDocument] = useState(false);
    const [contractEditor, setContractEditor] = useState(null);
    const [contractEditorError, setContractEditorError] = useState("");
    const [contractActionFeedback, setContractActionFeedback] = useState("");
    const [isSubmittingContractEditor, setIsSubmittingContractEditor] = useState(false);

    const loadCustomerDetail = useCallback(async () => {
        setIsLoadingDetail(true);
        setDetailError("");

        try {
            const [detailResult, complianceResult, timelineResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}`),
                fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}/compliance-status`),
                fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}/timeline`),
            ]);

            setCustomerDetail(detailResult ?? null);
            setComplianceStatus(complianceResult ?? null);
            setTimeline(Array.isArray(timelineResult) ? timelineResult : []);
        } catch (requestError) {
            setDetailError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat memuat detail pelanggan.",
            );
        } finally {
            setIsLoadingDetail(false);
        }
    }, [backendCustomerId]);

    const loadDocuments = useCallback(
        async (overrideFilter) => {
            const effectiveFilter = overrideFilter ?? documentFilter;
            const filterQuery =
                effectiveFilter === "all"
                    ? ""
                    : `?jenisDokumen=${encodeURIComponent(effectiveFilter)}`;

            setIsLoadingDocuments(true);
            setDocumentsError("");

            try {
                const result = await fetchJson(
                    `${API_BASE_URL}/api/customers/${backendCustomerId}/documents${filterQuery}`,
                );

                const filteredDocuments = Array.isArray(result)
                    ? result.filter((document) => document.jenisDokumen !== "invoice")
                    : [];
                setDocuments(filteredDocuments);
            } catch (requestError) {
                setDocumentsError(
                    requestError instanceof Error
                        ? requestError.message
                        : "Terjadi kesalahan saat memuat dokumen.",
                );
            } finally {
                setIsLoadingDocuments(false);
            }
        },
        [backendCustomerId, documentFilter],
    );

    useEffect(() => {
        setActiveTab(initialTab);
        setDocumentFilter("all");
        setDocuments([]);
        setDocumentsError("");
        setUploadFeedback("");
        setInvoiceUploadDraft(null);
        setInvoiceUploadError("");
        setInvoiceUploadFeedback("");
        setContractEditor(null);
        setContractEditorError("");
        setContractActionFeedback("");
        setNewDocument(createDefaultDocumentForm());
        void loadCustomerDetail();
    }, [backendCustomerId, initialTab, loadCustomerDetail]);

    useEffect(() => {
        if (activeTab !== "documents") {
            return;
        }

        void loadDocuments();
    }, [activeTab, loadDocuments]);

    const customerName = customerDetail?.name ?? customer.name;
    const detailIspNames = Array.isArray(customerDetail?.isps)
        ? customerDetail.isps
            .map((item) => item?.name)
            .filter((name) => typeof name === "string" && name.trim().length > 0)
        : [];
    const fallbackIspNames = Array.isArray(customer?.ispList) && customer.ispList.length > 0
        ? customer.ispList
        : [customer?.isp].filter(Boolean);
    const customerIspList = detailIspNames.length > 0 ? detailIspNames : fallbackIspNames;
    const customerIsp = customerIspList.length > 0 ? customerIspList.join(", ") : "-";
    const customerStatus = customerDetail?.status ?? customer.rawStatus;
    const isActive = customerStatus === "aktif";
    const activationFeeAmount = Number(
        customerDetail?.activationFeeAmount ?? customer.activationFeeAmount ?? 0,
    );
    const activationFeePaidAt =
        customerDetail?.activationFeePaidAt ?? customer.activationFeePaidAt ?? null;
    const isActivationFeePaid = Boolean(activationFeePaidAt);
    const editableCustomer = {
        ...customer,
        name: customerName,
        isp: customerIsp,
        ispList: customerIspList,
        rawStatus: customerStatus,
        activationFeeAmount,
        activationFeePaidAt,
    };

    const contracts = Array.isArray(customerDetail?.contracts)
        ? customerDetail.contracts
        : [];
    const sortedContracts = contracts
        .slice()
        .sort((left, right) => {
            const leftCreatedAt = parseDateValue(left.createdAt)?.getTime() ?? 0;
            const rightCreatedAt = parseDateValue(right.createdAt)?.getTime() ?? 0;

            if (leftCreatedAt !== rightCreatedAt) {
                return rightCreatedAt - leftCreatedAt;
            }

            return Number(right.id ?? 0) - Number(left.id ?? 0);
        });
    const activeContract = sortedContracts.find((contract) => contract.status === "aktif") ?? null;
    const latestContractNumber = sortedContracts[0]?.contractNumber ?? "-";
    const activeContractTechnical = activeContract
        ? formatCoreAllocation(
            activeContract.coreType,
            activeContract.coreTotal,
            activeContract.sharingRatio,
        )
        : "-";
    const activeContractBillingCycle = activeContract?.billingEvery && activeContract?.billingUnit
        ? `Setiap ${activeContract.billingEvery} ${toTitleCase(activeContract.billingUnit)}`
        : "-";
    const invoices = Array.isArray(customerDetail?.invoices)
        ? customerDetail.invoices
        : [];
    const latestDocuments = (Array.isArray(customerDetail?.latestDocuments)
        ? customerDetail.latestDocuments
        : []).filter((document) => document.jenisDokumen !== "invoice");

    const warnings = Array.isArray(complianceStatus?.warnings)
        ? complianceStatus.warnings
        : [];

    const outstandingAmount = invoices.reduce((sum, invoice) => {
        if (invoice.status === "lunas") {
            return sum;
        }

        return sum + Number(invoice.amount ?? 0);
    }, 0);

    const handleRefreshAll = async () => {
        await loadCustomerDetail();

        if (onRefreshCustomers) {
            await onRefreshCustomers();
        }

        if (activeTab === "documents") {
            await loadDocuments();
        }
    };

    const handleOpenCreateContractEditor = () => {
        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);

        setContractEditor({
            mode: "create",
            contractId: null,
            contractNumber: "",
            startDate: startDate.toISOString().slice(0, 10),
            endDate: endDate.toISOString().slice(0, 10),
            status: "aktif",
        });
        setContractEditorError("");
    };

    const handleOpenEditContractEditor = (contract) => {
        setContractEditor({
            mode: "edit",
            contractId: contract.id,
            contractNumber: contract.contractNumber ?? "",
            startDate: contract.startDate ? String(contract.startDate).slice(0, 10) : "",
            endDate: contract.endDate ? String(contract.endDate).slice(0, 10) : "",
            status: contract.status ?? "aktif",
        });
        setContractEditorError("");
    };

    const handleSubmitContractEditor = async (event) => {
        event.preventDefault();

        if (!contractEditor) {
            return;
        }

        const startDate = String(contractEditor.startDate ?? "").trim();
        const endDate = String(contractEditor.endDate ?? "").trim();
        const contractNumber = String(contractEditor.contractNumber ?? "").trim();
        const status = String(contractEditor.status ?? "").trim();

        if (!startDate || !endDate) {
            setContractEditorError("Periode awal dan periode akhir wajib diisi.");
            return;
        }

        if (startDate > endDate) {
            setContractEditorError("Periode awal tidak boleh lebih besar dari periode akhir.");
            return;
        }

        if (contractEditor.mode === "edit") {
            if (!contractNumber) {
                setContractEditorError("Nomor kontrak wajib diisi saat edit.");
                return;
            }

            if (!["aktif", "expired", "terminated"].includes(status)) {
                setContractEditorError("Status kontrak tidak valid.");
                return;
            }
        }

        setIsSubmittingContractEditor(true);
        setContractEditorError("");

        try {
            if (contractEditor.mode === "create") {
                await fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}/contracts`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contractNumber: contractNumber || undefined,
                        startDate,
                        endDate,
                    }),
                });

                setContractActionFeedback("Versi kontrak baru berhasil ditambahkan.");
            } else {
                await fetchJson(
                    `${API_BASE_URL}/api/customers/${backendCustomerId}/contracts/${contractEditor.contractId}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            contractNumber,
                            startDate,
                            endDate,
                            status,
                        }),
                    },
                );

                setContractActionFeedback("Data kontrak berhasil diperbarui.");
            }

            setContractEditor(null);
            await loadCustomerDetail();

            if (onRefreshCustomers) {
                await onRefreshCustomers();
            }
        } catch (requestError) {
            setContractEditorError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat menyimpan data kontrak.",
            );
        } finally {
            setIsSubmittingContractEditor(false);
        }
    };

    const handleUploadDocument = async (event) => {
        event.preventDefault();

        if (!newDocument.jenisDokumen || !newDocument.tanggalDokumen) {
            setDocumentsError("Tipe dokumen dan tanggal wajib diisi.");
            return;
        }

        setIsUploadingDocument(true);
        setDocumentsError("");
        setUploadFeedback("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}/documents`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jenisDokumen: newDocument.jenisDokumen,
                    nomorDokumen: newDocument.nomorDokumen.trim() || undefined,
                    tanggalDokumen: newDocument.tanggalDokumen,
                    contractId: newDocument.contractId ? Number(newDocument.contractId) : undefined,
                }),
            });

            const automationNotes = Array.isArray(result?.automation?.actions) && result.automation.actions.length > 0
                ? result.automation.actions.join(" ")
                : "Dokumen berhasil diunggah.";

            setUploadFeedback(automationNotes);
            setNewDocument(createDefaultDocumentForm());
            await loadDocuments();
            await loadCustomerDetail();

            if (onRefreshCustomers) {
                await onRefreshCustomers();
            }
        } catch (requestError) {
            setDocumentsError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat upload dokumen.",
            );
        } finally {
            setIsUploadingDocument(false);
        }
    };

    const handleOpenInvoiceUpload = (invoice) => {
        setInvoiceUploadError("");
        setInvoiceUploadFeedback("");
        setInvoiceUploadDraft({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber ?? "",
            tanggalDokumen: `${invoice.periodYear}-${String(invoice.periodMonth).padStart(2, "0")}-01`,
            contractId: invoice.contractId ?? null,
        });
    };

    const handleSubmitInvoiceUpload = async (event) => {
        event.preventDefault();

        if (!invoiceUploadDraft) {
            return;
        }

        if (!invoiceUploadDraft.invoiceNumber.trim()) {
            setInvoiceUploadError("Nomor invoice wajib diisi sebelum upload.");
            return;
        }

        if (!invoiceUploadDraft.tanggalDokumen) {
            setInvoiceUploadError("Tanggal invoice wajib diisi.");
            return;
        }

        setIsUploadingInvoiceDocument(true);
        setInvoiceUploadError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers/${backendCustomerId}/documents`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jenisDokumen: "invoice",
                    nomorDokumen: invoiceUploadDraft.invoiceNumber.trim(),
                    tanggalDokumen: invoiceUploadDraft.tanggalDokumen,
                    contractId: invoiceUploadDraft.contractId ?? undefined,
                }),
            });

            const automationNotes = Array.isArray(result?.automation?.actions) && result.automation.actions.length > 0
                ? result.automation.actions.join(" ")
                : "Invoice berhasil diunggah.";

            setInvoiceUploadFeedback(automationNotes);
            setInvoiceUploadDraft(null);
            await loadCustomerDetail();

            if (onRefreshCustomers) {
                await onRefreshCustomers();
            }
        } catch (requestError) {
            setInvoiceUploadError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat upload invoice.",
            );
        } finally {
            setIsUploadingInvoiceDocument(false);
        }
    };

    const handleDeleteDocument = async (documentId) => {
        const shouldDelete = window.confirm("Hapus dokumen ini?");
        if (!shouldDelete) {
            return;
        }

        setDocumentsError("");

        try {
            await fetchJson(
                `${API_BASE_URL}/api/customers/${backendCustomerId}/documents/${documentId}`,
                { method: "DELETE" },
            );

            await loadDocuments();
            await loadCustomerDetail();

            if (onRefreshCustomers) {
                await onRefreshCustomers();
            }
        } catch (requestError) {
            setDocumentsError(
                requestError instanceof Error
                    ? requestError.message
                    : "Terjadi kesalahan saat menghapus dokumen.",
            );
        }
    };

    const getTabClassName = (tabKey) =>
        activeTab === tabKey
            ? "whitespace-nowrap border-b-2 border-primary pb-4 text-sm font-bold text-primary transition-all"
            : "whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary";

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <button
                className="mb-6 inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container"
                onClick={onBack}
                type="button"
            >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Kembali ke Daftar Pelanggan
            </button>

            <section className="mb-8 rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div className="flex gap-5">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-fixed">
                            <span
                                className="material-symbols-outlined text-4xl text-primary"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                corporate_fare
                            </span>
                        </div>
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-3">
                                <h2 className="text-3xl font-extrabold tracking-tight text-primary">{customerName}</h2>
                                <span
                                    className={`rounded-full border-l-4 px-3 py-1 text-xs font-bold ${isActive
                                        ? "border-primary bg-surface-container text-primary"
                                        : "border-error bg-error-container text-on-error-container"
                                        }`}
                                >
                                    {isActive ? "AKTIF" : "NON-AKTIF"}
                                </span>
                            </div>
                            <p className="text-sm text-on-surface-variant">ISP: {customerIsp}</p>
                            <p className="text-sm text-on-surface-variant">Nomor Kontrak Terbaru: {latestContractNumber}</p>
                            <p className="text-sm text-on-surface-variant">Teknis: {activeContractTechnical}</p>
                            <p className="text-sm text-on-surface-variant">Bayar: {activeContractBillingCycle}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            className="rounded-xl bg-surface-container-high px-5 py-2.5 text-sm font-semibold text-on-surface"
                            onClick={() => {
                                void handleRefreshAll();
                            }}
                            type="button"
                        >
                            Refresh Detail
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            onClick={() => onEdit?.(editableCustomer)}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-base">edit</span>
                            Edit Profil
                        </button>
                    </div>
                </div>
            </section>

            {detailError && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {detailError}
                </div>
            )}

            <div className="no-scrollbar mb-8 flex gap-8 overflow-x-auto border-b border-surface-container">
                <button
                    className={getTabClassName("overview")}
                    onClick={() => setActiveTab("overview")}
                    type="button"
                >
                    Ringkasan
                </button>
                <button
                    className={getTabClassName("contracts")}
                    onClick={() => setActiveTab("contracts")}
                    type="button"
                >
                    Kontrak
                </button>
                <button
                    className={getTabClassName("invoices")}
                    onClick={() => setActiveTab("invoices")}
                    type="button"
                >
                    Invoice
                </button>
                <button
                    className={getTabClassName("documents")}
                    onClick={() => setActiveTab("documents")}
                    type="button"
                >
                    Dokumen
                </button>
                <button
                    className={getTabClassName("timeline")}
                    onClick={() => setActiveTab("timeline")}
                    type="button"
                >
                    Timeline
                </button>
            </div>

            {isLoadingDetail && !customerDetail && activeTab !== "documents" && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                    Memuat detail pelanggan...
                </div>
            )}

            {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <section className="space-y-6 xl:col-span-2">
                        <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-primary">Status Compliance</h3>
                            <div className="space-y-3">
                                <ComplianceItem
                                    active={Boolean(complianceStatus?.hasContract)}
                                    label="Kontrak aktif tersedia"
                                />
                                <ComplianceItem
                                    active={Boolean(complianceStatus?.hasInvoiceCurrentMonth)}
                                    label="Invoice bulan berjalan tersedia"
                                />
                                <ComplianceItem
                                    active={!complianceStatus?.contractExpiringIn30Days}
                                    label="Kontrak tidak mendekati jatuh tempo 30 hari"
                                />
                                <ComplianceItem
                                    active={!complianceStatus?.hasTerminationDocument}
                                    label="Tidak ada dokumen pemutusan"
                                />
                                <ComplianceItem
                                    active={Boolean(complianceStatus?.hasActivationFeePaid)}
                                    label="Biaya aktivasi sudah dibayar"
                                />
                            </div>

                            {warnings.length > 0 && (
                                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-700">
                                        Warning
                                    </p>
                                    <ul className="space-y-2 text-sm text-amber-800">
                                        {warnings.map((warning) => (
                                            <li key={warning} className="flex gap-2">
                                                <span className="material-symbols-outlined text-base">warning</span>
                                                <span>{warning}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-primary">Dokumen Terbaru</h3>
                            {latestDocuments.length === 0 ? (
                                <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                                    Belum ada dokumen terbaru untuk pelanggan ini.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {latestDocuments.map((document) => (
                                        <div
                                            key={document.id}
                                            className="flex flex-col gap-2 rounded-lg bg-surface-container-low px-4 py-3 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div>
                                                <span
                                                    className={`mb-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${documentTypeBadgeClass[document.jenisDokumen] ?? "bg-slate-100 text-slate-700"}`}
                                                >
                                                    {documentTypeLabelMap[document.jenisDokumen] ?? document.jenisDokumen}
                                                </span>
                                                <p className="text-sm font-semibold text-on-surface">
                                                    {document.nomorDokumen || "Tanpa nomor dokumen"}
                                                </p>
                                                <p className="text-xs text-on-surface-variant">
                                                    {formatDate(document.tanggalDokumen)}
                                                </p>
                                            </div>
                                            {isExternalFileUrl(document.fileUrl) ? (
                                                <a
                                                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                                                    href={document.fileUrl}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    <span className="material-symbols-outlined text-base">open_in_new</span>
                                                    Buka File
                                                </a>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant">
                                                    <span className="material-symbols-outlined text-base">folder</span>
                                                    Arsip Internal
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="rounded-xl bg-primary-container p-6 text-white shadow-md">
                            <p className="mb-2 text-xs font-medium uppercase tracking-widest opacity-80">
                                Kontrak Berjalan
                            </p>
                            {activeContract ? (
                                <>
                                    <h4 className="text-lg font-extrabold">
                                        {activeContract.contractNumber || `Kontrak #${activeContract.id}`}
                                    </h4>
                                    <p className="mt-1 text-xs font-semibold text-blue-100">
                                        Periode awal: {formatDate(activeContract.startDate)}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-blue-100">
                                        Periode akhir: {formatDate(activeContract.endDate)}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-blue-100">
                                        Teknis: {activeContractTechnical}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-blue-100">
                                        Bayar: {activeContractBillingCycle}
                                    </p>
                                </>
                            ) : (
                                <h4 className="text-base font-extrabold">Tidak ada kontrak aktif</h4>
                            )}
                        </div>

                        <div className="rounded-xl bg-secondary-container/40 p-6 shadow-sm">
                            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-on-secondary-container">
                                Total Invoice
                            </p>
                            <h4 className="text-3xl font-extrabold text-on-secondary-container">{invoices.length}</h4>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-6 shadow-sm">
                            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
                                Biaya Aktivasi
                            </p>
                            {isActivationFeePaid ? (
                                <>
                                    <h4 className="text-xl font-extrabold text-emerald-700">Selesai</h4>
                                    <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                                        Tgl bayar: {formatDate(activationFeePaidAt)}
                                    </p>
                                </>
                            ) : (
                                <h4 className="text-xl font-extrabold text-amber-700">
                                    {formatCurrency(activationFeeAmount)}
                                </h4>
                            )}
                        </div>

                        <div className="rounded-xl bg-error-container/50 p-6 shadow-sm">
                            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-on-error-container">
                                Potensi Outstanding
                            </p>
                            <h4 className="text-xl font-extrabold text-on-error-container">
                                {formatCurrency(outstandingAmount)}
                            </h4>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-surface-container-lowest p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="font-bold text-on-surface">Aktivitas Terbaru</h4>
                                <button
                                    className="text-xs font-semibold text-primary hover:underline"
                                    onClick={() => setActiveTab("timeline")}
                                    type="button"
                                >
                                    Lihat semua
                                </button>
                            </div>

                            {timeline.length === 0 ? (
                                <p className="text-sm text-on-surface-variant">Belum ada timeline aktivitas.</p>
                            ) : (
                                <div className="space-y-3">
                                    {timeline.slice(0, 3).map((event) => (
                                        <div key={event.id} className="rounded-lg bg-surface-container-low p-3">
                                            <p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">
                                                {formatDate(event.date)}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-on-surface">{event.title}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "contracts" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <p className="text-sm text-on-surface-variant">
                            Baris kontrak dapat ditambah manual. Kontrak terbaru otomatis tampil di baris paling atas.
                        </p>
                        <button
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                            onClick={handleOpenCreateContractEditor}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-base">add</span>
                            Tambah Baris Kontrak
                        </button>
                    </div>

                    {contractActionFeedback && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                            {contractActionFeedback}
                        </div>
                    )}

                    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            No
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Nomor Kontrak
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Periode Awal
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Periode Akhir
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Dibuat
                                        </th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {sortedContracts.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan="7">
                                                Belum ada data kontrak.
                                            </td>
                                        </tr>
                                    )}

                                    {sortedContracts.map((contract, index) => (
                                        <tr key={contract.id} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {String(index + 1).padStart(2, "0")}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                                                {contract.contractNumber || `#${contract.id}`}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${contractStatusBadgeClass[contract.status] ?? "bg-slate-100 text-slate-700"}`}>
                                                    {contractStatusLabelMap[contract.status] ?? contract.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatDate(contract.startDate)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatDate(contract.endDate)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatDateTime(contract.createdAt)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
                                                    onClick={() => handleOpenEditContractEditor(contract)}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "invoices" && (
                <section className="space-y-4">
                    <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        Upload invoice dilakukan per baris periode di tab ini. Upload invoice tidak perlu dari tab Dokumen.
                    </p>

                    {invoiceUploadError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {invoiceUploadError}
                        </div>
                    )}

                    {invoiceUploadFeedback && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                            {invoiceUploadFeedback}
                        </div>
                    )}

                    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1120px] border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            No
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
                                            Dokumen
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Diperbarui
                                        </th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {invoices.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan="8">
                                                Belum ada data invoice.
                                            </td>
                                        </tr>
                                    )}

                                    {invoices.map((invoice, index) => (
                                        <tr key={invoice.id} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {String(index + 1).padStart(2, "0")}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                                                {invoice.invoiceNumber || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {monthNames[invoice.periodMonth] ?? invoice.periodMonth} {invoice.periodYear}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                                                {formatCurrency(invoice.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${invoiceStatusBadgeClass[invoice.status] ?? "bg-slate-100 text-slate-700"}`}>
                                                    {invoiceStatusLabelMap[invoice.status] ?? invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">
                                                {invoice.documentId ? `Dokumen #${invoice.documentId}` : "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{formatDateTime(invoice.updatedAt)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
                                                    onClick={() => handleOpenInvoiceUpload(invoice)}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-sm">upload</span>
                                                    {invoice.documentId ? "Update Invoice" : "Upload Invoice"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </section>
            )}

            {activeTab === "timeline" && (
                <section className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
                    <h3 className="mb-6 text-lg font-bold text-primary">Timeline Aktivitas Pelanggan</h3>

                    {timeline.length === 0 ? (
                        <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                            Belum ada aktivitas timeline.
                        </p>
                    ) : (
                        <div className="relative space-y-6 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-0.5 before:bg-surface-container">
                            {timeline.map((event) => (
                                <div key={event.id} className="relative flex items-start gap-4">
                                    <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${timelineColorMap[event.type] ?? "bg-slate-100 text-on-surface-variant"}`}>
                                        <span className="material-symbols-outlined text-base">
                                            {timelineIconMap[event.type] ?? "history"}
                                        </span>
                                    </div>
                                    <div className="rounded-lg bg-surface-container-low p-4 flex-1">
                                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
                                            {formatDate(event.date)}
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-on-surface">{event.title}</p>
                                        <p className="mt-1 text-sm text-on-surface-variant">{event.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {activeTab === "documents" && (
                <section className="space-y-6">
                    <div className="flex flex-col gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-end md:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-primary">Dokumen Pelanggan</h3>
                            <p className="mt-1 text-sm text-on-surface-variant">
                                Upload dokumen non-invoice akan memicu automasi backend untuk kontrak dan status pelanggan.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <select
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                onChange={(event) => {
                                    const nextFilter = event.target.value;
                                    setDocumentFilter(nextFilter);
                                    if (activeTab === "documents") {
                                        void loadDocuments(nextFilter);
                                    }
                                }}
                                value={documentFilter}
                            >
                                <option value="all">Semua Jenis</option>
                                {documentTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            <button
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                                onClick={() => {
                                    void loadDocuments();
                                }}
                                type="button"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <form
                        className="grid grid-cols-1 gap-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:grid-cols-4"
                        onSubmit={handleUploadDocument}
                    >
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                Jenis Dokumen
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                                onChange={(event) =>
                                    setNewDocument((previous) => ({
                                        ...previous,
                                        jenisDokumen: event.target.value,
                                    }))
                                }
                                value={newDocument.jenisDokumen}
                            >
                                {documentTypeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                Nomor Dokumen
                            </label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                                onChange={(event) =>
                                    setNewDocument((previous) => ({
                                        ...previous,
                                        nomorDokumen: event.target.value,
                                    }))
                                }
                                placeholder="Opsional"
                                type="text"
                                value={newDocument.nomorDokumen}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                Tanggal Dokumen
                            </label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                                onChange={(event) =>
                                    setNewDocument((previous) => ({
                                        ...previous,
                                        tanggalDokumen: event.target.value,
                                    }))
                                }
                                type="date"
                                value={newDocument.tanggalDokumen}
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                Kontrak
                            </label>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                                onChange={(event) =>
                                    setNewDocument((previous) => ({
                                        ...previous,
                                        contractId: event.target.value,
                                    }))
                                }
                                value={newDocument.contractId}
                            >
                                <option value="">Tanpa Kontrak</option>
                                {contracts.map((contract) => (
                                    <option key={contract.id} value={String(contract.id)}>
                                        #{contract.id} ({formatDate(contract.startDate)} - {formatDate(contract.endDate)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="lg:col-span-4 flex justify-end">
                            <button
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isUploadingDocument}
                                type="submit"
                            >
                                <span className="material-symbols-outlined text-base">upload</span>
                                {isUploadingDocument ? "Mengunggah..." : "Upload Dokumen"}
                            </button>
                        </div>
                    </form>

                    {uploadFeedback && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                            {uploadFeedback}
                        </div>
                    )}

                    {documentsError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {documentsError}
                        </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[860px] border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Jenis
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Nomor
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Tanggal
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Kontrak
                                        </th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Arsip
                                        </th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingDocuments && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan="6">
                                                Memuat dokumen...
                                            </td>
                                        </tr>
                                    )}

                                    {!isLoadingDocuments && documents.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-6 text-center text-sm text-on-surface-variant" colSpan="6">
                                                Belum ada dokumen untuk filter ini.
                                            </td>
                                        </tr>
                                    )}

                                    {!isLoadingDocuments &&
                                        documents.map((document) => (
                                            <tr key={document.id} className="hover:bg-slate-50/80">
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${documentTypeBadgeClass[document.jenisDokumen] ?? "bg-slate-100 text-slate-700"}`}
                                                    >
                                                        {documentTypeLabelMap[document.jenisDokumen] || document.jenisDokumen}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {document.nomorDokumen || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-700">{formatDate(document.tanggalDokumen)}</td>
                                                <td className="px-4 py-3 text-sm text-slate-700">
                                                    {document.contractId ? `#${document.contractId}` : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {isExternalFileUrl(document.fileUrl) ? (
                                                        <a
                                                            className="font-semibold text-primary hover:underline"
                                                            href={document.fileUrl}
                                                            rel="noreferrer"
                                                            target="_blank"
                                                        >
                                                            Buka File
                                                        </a>
                                                    ) : (
                                                        <span className="font-semibold text-on-surface-variant">Arsip Internal</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                                                        onClick={() => {
                                                            void handleDeleteDocument(document.id);
                                                        }}
                                                        type="button"
                                                    >
                                                        Hapus
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {contractEditor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-primary">
                                    {contractEditor.mode === "create" ? "Tambah Kontrak" : "Edit Kontrak"}
                                </p>
                                <h3 className="text-xl font-bold text-on-surface">{customerName}</h3>
                                <p className="text-xs text-on-surface-variant">Isi periode kontrak sesuai data terbaru.</p>
                            </div>

                            <button
                                className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200"
                                onClick={() => {
                                    setContractEditor(null);
                                    setContractEditorError("");
                                }}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmitContractEditor}>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Nomor Kontrak
                                </label>
                                <input
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    onChange={(event) =>
                                        setContractEditor((previous) =>
                                            previous
                                                ? {
                                                    ...previous,
                                                    contractNumber: event.target.value,
                                                }
                                                : previous,
                                        )
                                    }
                                    placeholder="CTR-2026-0001"
                                    type="text"
                                    value={contractEditor.contractNumber}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Periode Awal
                                    </label>
                                    <input
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) =>
                                            setContractEditor((previous) =>
                                                previous
                                                    ? {
                                                        ...previous,
                                                        startDate: event.target.value,
                                                    }
                                                    : previous,
                                            )
                                        }
                                        type="date"
                                        value={contractEditor.startDate}
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Periode Akhir
                                    </label>
                                    <input
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) =>
                                            setContractEditor((previous) =>
                                                previous
                                                    ? {
                                                        ...previous,
                                                        endDate: event.target.value,
                                                    }
                                                    : previous,
                                            )
                                        }
                                        type="date"
                                        value={contractEditor.endDate}
                                    />
                                </div>
                            </div>

                            {contractEditor.mode === "edit" && (
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                        Status
                                    </label>
                                    <select
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        onChange={(event) =>
                                            setContractEditor((previous) =>
                                                previous
                                                    ? {
                                                        ...previous,
                                                        status: event.target.value,
                                                    }
                                                    : previous,
                                            )
                                        }
                                        value={contractEditor.status}
                                    >
                                        <option value="aktif">Aktif</option>
                                        <option value="expired">Expired</option>
                                        <option value="terminated">Terminated</option>
                                    </select>
                                </div>
                            )}

                            {contractEditorError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {contractEditorError}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                                    onClick={() => {
                                        setContractEditor(null);
                                        setContractEditorError("");
                                    }}
                                    type="button"
                                >
                                    Batal
                                </button>
                                <button
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isSubmittingContractEditor}
                                    type="submit"
                                >
                                    {isSubmittingContractEditor ? "Menyimpan..." : "Simpan Kontrak"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {invoiceUploadDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Upload Invoice</p>
                                <h3 className="text-xl font-bold text-on-surface">{customerName}</h3>
                                <p className="text-xs text-on-surface-variant">
                                    Invoice #{invoiceUploadDraft.invoiceId}
                                </p>
                            </div>

                            <button
                                className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200"
                                onClick={() => setInvoiceUploadDraft(null)}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmitInvoiceUpload}>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Nomor Invoice
                                </label>
                                <input
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    onChange={(event) =>
                                        setInvoiceUploadDraft((previous) =>
                                            previous
                                                ? {
                                                    ...previous,
                                                    invoiceNumber: event.target.value,
                                                }
                                                : previous,
                                        )
                                    }
                                    placeholder="INV-XXXX-XXX"
                                    type="text"
                                    value={invoiceUploadDraft.invoiceNumber}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                    Tanggal Invoice
                                </label>
                                <input
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    onChange={(event) =>
                                        setInvoiceUploadDraft((previous) =>
                                            previous
                                                ? {
                                                    ...previous,
                                                    tanggalDokumen: event.target.value,
                                                }
                                                : previous,
                                        )
                                    }
                                    type="date"
                                    value={invoiceUploadDraft.tanggalDokumen}
                                />
                            </div>

                            {invoiceUploadError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {invoiceUploadError}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <button
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50"
                                    onClick={() => setInvoiceUploadDraft(null)}
                                    type="button"
                                >
                                    Batal
                                </button>
                                <button
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isUploadingInvoiceDocument}
                                    type="submit"
                                >
                                    {isUploadingInvoiceDocument ? "Mengunggah..." : "Simpan Invoice"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    );
}

function TenantAdminFormPage({ isps = [], onCancel, onNavigate, onSaved }) {
    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        paket: "core",
        jumlah: "0",
        ratioLeft: "1",
        ratioRight: "8",
        contractStartDate: "",
        contractEndDate: "",
        billingPeriodMode: "bulanan",
        billingCustomEvery: "",
        billingCustomUnit: "bulan",
        activationFeeAmount: "0",
        contractNumber: "",
        newIspName: "",
    });
    const [selectedIspId, setSelectedIspId] = useState(null);
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectIsp = (ispId) => {
        setSelectedIspId(ispId);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.name.trim()) {
            setSubmitError("Nama tenant wajib diisi.");
            return;
        }
        if (!selectedIspId) {
            setSubmitError("Tenant harus terhubung ke satu ISP.");
            return;
        }
        if (form.paket === "shared" && (!form.ratioLeft || !form.ratioRight || Number(form.ratioLeft) < 1 || Number(form.ratioRight) < 1)) {
            setSubmitError("Shared Core ratio tidak valid. Masukkan angka >= 1 di kedua kolom.");
            return;
        }
        if (!form.contractStartDate || !form.contractEndDate || form.contractStartDate > form.contractEndDate) {
            setSubmitError("Periode kontrak tenant tidak valid.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");

        try {
            const result = await fetchJson(`${API_BASE_URL}/api/customers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    status: form.status,
                    ispIds: [selectedIspId],
                    contractNumber: form.contractNumber.trim() || undefined,
                    contractStartDate: form.contractStartDate,
                    contractEndDate: form.contractEndDate,
                    paket: form.paket,
                    jumlah: form.paket === "core" ? Math.round(Number(form.jumlah || 0)) : 0,
                    contractSharingRatio: form.paket === "shared" ? `${form.ratioLeft || 1}:${form.ratioRight || 8}` : undefined,
                    billingPeriodMode: form.billingPeriodMode,
                    billingCustomEvery: form.billingPeriodMode === "custom" ? Number(form.billingCustomEvery) : undefined,
                    billingCustomUnit: form.billingPeriodMode === "custom" ? form.billingCustomUnit : undefined,
                    activationFeeAmount: Math.round(Number(form.activationFeeAmount || 0)),
                }),
            });

            if (onSaved) {
                await onSaved(result);
            }
        } catch (requestError) {
            setSubmitError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat menyimpan tenant.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <form className="mx-auto max-w-6xl space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">Tambah Tenant</p>
                        <h1 className="mt-2 text-3xl font-extrabold text-primary">Tenant Baru</h1>
                        <p className="mt-2 max-w-xl text-sm text-on-surface-variant">
                            Sistem akan otomatis membuat kontrak, contract version awal, dan draft invoice.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="rounded-xl px-6 py-2.5 font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high" onClick={onCancel} type="button">Batalkan</button>
                        <button className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Menyimpan..." : "Simpan Tenant"}</button>
                    </div>
                </div>

                {submitError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{submitError}</div>}

                <div className="grid grid-cols-12 gap-8">
                    <section className="col-span-12 space-y-8 lg:col-span-8">
                        <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <FieldInput label="Nama Tenant" value={form.name} onChange={(value) => setForm((previous) => ({ ...previous, name: value }))} />
                                <FieldSelect label="Status" value={form.status} onChange={(value) => setForm((previous) => ({ ...previous, status: value }))} options={[{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Non-aktif" }]} />
                                <FieldSelect label="Paket" value={form.paket} onChange={(value) => setForm((previous) => ({ ...previous, paket: value }))} options={[{ value: "core", label: "Core" }, { value: "shared", label: "Shared Core" }]} />
                                {form.paket === "core" ? (
                                    <FieldInput label="Jumlah Core" type="number" value={form.jumlah} onChange={(value) => setForm((previous) => ({ ...previous, jumlah: value }))} placeholder="Contoh: 4" />
                                ) : (
                                    <div>
                                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Rasio Shared Core</label>
                                        <div className="flex items-center gap-2">
                                            <input className="w-24 rounded-lg border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10" type="number" min="1" value={form.ratioLeft} onChange={(e) => setForm((prev) => ({ ...prev, ratioLeft: e.target.value }))} placeholder="1" />
                                            <span className="text-lg font-bold text-slate-400">:</span>
                                            <input className="w-24 rounded-lg border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10" type="number" min="1" value={form.ratioRight} onChange={(e) => setForm((prev) => ({ ...prev, ratioRight: e.target.value }))} placeholder="8" />
                                        </div>
                                    </div>
                                )}
                                <FieldInput label="Nomor Kontrak" value={form.contractNumber} onChange={(value) => setForm((previous) => ({ ...previous, contractNumber: value }))} placeholder="Otomatis jika kosong" />
                                <FieldInput label="Contract Start" type="date" value={form.contractStartDate} onChange={(value) => setForm((previous) => ({ ...previous, contractStartDate: value }))} />
                                <FieldInput label="Contract End" type="date" value={form.contractEndDate} onChange={(value) => setForm((previous) => ({ ...previous, contractEndDate: value }))} />
                            </div>
                        </div>

                        <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                            <div className="mb-6 flex items-center justify-between gap-3">
                                <h3 className="text-lg font-bold text-on-surface">Pilih ISP</h3>
                                <p className="text-xs text-on-surface-variant">Gunakan tombol `Tambah ISP` jika ISP belum tersedia.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {isps.map((isp) => (
                                    <label key={isp.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${selectedIspId === isp.id ? "border-primary bg-blue-50/60" : "border-slate-200 bg-white"}`}>
                                        <input checked={selectedIspId === isp.id} className="mt-1 flex-shrink-0" name="selectIspRadio" onChange={() => selectIsp(isp.id)} type="radio" />
                                        <div>
                                            <p className="text-sm font-semibold text-on-surface">{isp.name}</p>
                                            <p className="mt-1 text-xs text-on-surface-variant">{isp.contractReference || "Tanpa referensi kontrak"}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="col-span-12 space-y-8 lg:col-span-4">
                        <div className="rounded-lg bg-surface-container-low p-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Billing Period</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {["bulanan", "3bulanan", "custom"].map((mode) => (
                                            <button key={mode} className={`rounded-lg py-2 text-xs font-bold transition-colors ${form.billingPeriodMode === mode ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface-variant hover:bg-slate-200"}`} onClick={() => setForm((previous) => ({ ...previous, billingPeriodMode: mode }))} type="button">{mode === "bulanan" ? "Bulanan" : mode === "3bulanan" ? "3 Bulanan" : "Custom"}</button>
                                        ))}
                                    </div>
                                    <div className="mt-3 rounded-xl bg-surface-container-lowest p-4">
                                        <div className="flex gap-2">
                                            <input className="w-20 rounded-lg border-none bg-surface p-2 text-xs disabled:bg-slate-200" disabled={form.billingPeriodMode !== "custom"} min="1" onChange={(event) => setForm((previous) => ({ ...previous, billingCustomEvery: event.target.value }))} step="1" type="number" value={form.billingCustomEvery} />
                                            <select className="flex-1 rounded-lg border-none bg-surface p-2 text-xs disabled:bg-slate-200" disabled={form.billingPeriodMode !== "custom"} onChange={(event) => setForm((previous) => ({ ...previous, billingCustomUnit: event.target.value }))} value={form.billingCustomUnit}>
                                                <option value="hari">Hari</option>
                                                <option value="bulan">Bulan</option>
                                                <option value="tahun">Tahun</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <FieldInput label="Biaya Aktivasi" type="number" value={form.activationFeeAmount} onChange={(value) => setForm((previous) => ({ ...previous, activationFeeAmount: value }))} />
                            </div>
                        </div>
                    </section>
                </div>
            </form>
        </AppShell>
    );
}

function IspAdminFormPage({ onCancel, onNavigate, onSaved }) {
    const [form, setForm] = useState({
        name: "",
        status: "aktif",
        contractReference: "",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",
        bakFileName: "",
    });
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.contractReference.trim()) {
            setSubmitError("Nama ISP dan nomor kontrak induk wajib diisi.");
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");
        try {
            const result = await fetchJson(`${API_BASE_URL}/api/isps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    status: form.status,
                    contractReference: form.contractReference.trim(),
                    contractStartDate: form.contractStartDate || null,
                    contractPeriodStart: form.contractPeriodStart || null,
                    contractPeriodEnd: form.contractPeriodEnd || null,
                    bakFileName: form.bakFileName || undefined,
                }),
            });
            if (onSaved) {
                await onSaved(result);
            }
        } catch (requestError) {
            setSubmitError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat menyimpan ISP.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <form className="mx-auto max-w-5xl space-y-8" onSubmit={handleSubmit}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60">Tambah ISP</p>
                        <h1 className="mt-2 text-3xl font-extrabold text-primary">ISP Baru</h1>
                    </div>
                    <div className="flex gap-3">
                        <button className="rounded-xl px-6 py-2.5 font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high" onClick={onCancel} type="button">Batalkan</button>
                        <button className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Menyimpan..." : "Simpan ISP"}</button>
                    </div>
                </div>

                {submitError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{submitError}</div>}

                <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FieldInput label="Nama ISP" value={form.name} onChange={(value) => setForm((previous) => ({ ...previous, name: value }))} />
                        <FieldSelect label="Status" value={form.status} onChange={(value) => setForm((previous) => ({ ...previous, status: value }))} options={[{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Non-aktif" }]} />
                        <FieldInput label="Nomor kontrak induk" value={form.contractReference} onChange={(value) => setForm((previous) => ({ ...previous, contractReference: value }))} />
                        <FieldInput label="Awal kontrak" type="date" value={form.contractStartDate} onChange={(value) => setForm((previous) => ({ ...previous, contractStartDate: value }))} />
                        <FieldInput label="Periode berjalan mulai" type="date" value={form.contractPeriodStart} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodStart: value }))} />
                        <FieldInput label="Periode berjalan akhir" type="date" value={form.contractPeriodEnd} onChange={(value) => setForm((previous) => ({ ...previous, contractPeriodEnd: value }))} />
                        <div>
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Upload BAK (Opsional)</label>
                            <input
                                accept=".pdf,.png,.jpg,.jpeg,.zip"
                                className="w-full rounded-lg border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/10"
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        bakFileName: event.target.files?.[0]?.name ?? "",
                                    }))
                                }
                                type="file"
                            />
                        </div>
                    </div>
                </div>
            </form>
        </AppShell>
    );
}

export default App;
