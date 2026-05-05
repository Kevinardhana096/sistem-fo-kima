import { useCallback, useEffect, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import { SummaryCard } from "../../components/shared/AppShared";
import {
    API_BASE_URL,
    fetchJson,
    formatContractPeriod,
    formatDate,
    getIspContractActionItems,
    isOpenableFileUrl,
    openSafeFile,
    readFileAsDataUrl,
} from "../../app/utils";

function IspDetailPage({ isp, onBack, onEditIsp, onNavigate, onOpenCreateTenant, onOpenTenant, onRefreshAll }) {
    const [detail, setDetail] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [timeline, setTimeline] = useState([]);
    const [contractRows, setContractRows] = useState([]);
    const [, setIsActionLoading] = useState(false);
    const [editingRow, setEditingRow] = useState(null);
    const [risalahRows, setRisalahRows] = useState([]);
    const [risalahEditor, setRisalahEditor] = useState(null);

    const loadDetail = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const [ispResult, rowsResult] = await Promise.all([
                fetchJson(`${API_BASE_URL}/api/isps/${isp.id}`),
                fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows`),
            ]);

            setDetail(ispResult ?? null);
            setContractRows(Array.isArray(rowsResult) ? rowsResult : []);
            setRisalahRows(
                Array.isArray(ispResult?.risalah)
                    ? ispResult.risalah.map((row, index) => ({
                        id: row?.id ?? `existing-${isp.id}-${index}`,
                        tanggal:
                            row?.tanggal ??
                            row?.meetingDate ??
                            (typeof row?.createdAt === "string"
                                ? row.createdAt.slice(0, 10)
                                : new Date().toISOString().slice(0, 10)),
                        fileUrl: row?.fileUrl ?? "",
                        fileName: row?.fileName ?? "",
                        isNew: false,
                    }))
                    : [],
            );

            // In a real app, timeline would be fetched
            setTimeline([
                { id: `t1-${isp.id}`, date: ispResult?.createdAt || new Date().toISOString(), type: "system", title: "ISP Terdaftar", description: "Data ISP berhasil dibuat dalam sistem." }
            ]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat memuat detail ISP.");
        } finally {
            setIsLoading(false);
        }
    }, [isp.id]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    const tenants = Array.isArray(detail?.tenants) ? detail.tenants : [];
    const summary = detail?.summary ?? {};
    const ispActionItems = getIspContractActionItems(contractRows);
    const tenantActionRows = tenants
        .filter((tenant) => tenant.status === "aktif")
        .map((tenant) => {
            const priorityCount = Number(tenant.todoSummary?.counts?.priority ?? 0);
            const needActionCount = Number(tenant.todoSummary?.counts?.needAction ?? 0);
            const total = priorityCount + needActionCount;

            return {
                ...tenant,
                totalActions: total,
            };
        })
        .filter((tenant) => tenant.totalActions > 0);
    const totalTenantActionCount = tenantActionRows.reduce((sum, tenant) => sum + tenant.totalActions, 0);

    // Derived header properties
    const ispName = detail?.name ?? isp.name;
    const contractRef = detail?.contractReference ?? isp.contractReference ?? "-";
    const handleFileUpload = async (rowId, type, file, followUpId = null) => {
        if (!file) return;

        setIsActionLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileDataUrl", await readFileAsDataUrl(file));
        formData.append("fileName", file.name);
        if (followUpId) formData.append("followUpId", String(followUpId));

        let endpoint = "";
        if (type === "bak") endpoint = `${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/bak`;
        else if (type === "renewal") endpoint = `${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/renewal`;
        else if (type === "contract") endpoint = `${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/contract-file`;

        try {
            await fetchJson(`${endpoint}`, {
                method: "POST",
                body: formData,
            });
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengunggah berkas.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRespondRenewal = async (rowId, decision, file, followUpId = null) => {
        if (!file) {
            setError("Harap pilih berkas tanggapan.");
            return;
        }

        setIsActionLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("decision", decision);
        formData.append("fileDataUrl", await readFileAsDataUrl(file));
        formData.append("fileName", file.name);
        if (followUpId) formData.append("followUpId", String(followUpId));

        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/response`, {
                method: "POST",
                body: formData,
            });
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengirim tanggapan.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAddRenewalSplit = async (rowId) => {
        setIsActionLoading(true);
        setError("");
        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/follow-ups`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal menambah split tindak lanjut.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const hasInitialRenewalUpload = (row) => {
        const followUps = Array.isArray(row?.renewalFollowUps) ? row.renewalFollowUps : [];
        return followUps.some((followUp) => isOpenableFileUrl(followUp?.renewalFileUrl));
    };

    const renderRenewalFollowUps = (row, columnType) => {
        const followUps = Array.isArray(row?.renewalFollowUps) ? row.renewalFollowUps : [];
        if (followUps.length === 0) {
            if (columnType === "renewal") {
                return (
                    <label className="cursor-pointer font-bold text-[10px] text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">
                        Upload
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, "renewal", e.target.files?.[0] ?? null)} />
                    </label>
                );
            }

            return <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Belum Ada</span>;
        }

        return (
            <div className="flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
                {followUps.map((followUp) => {
                    const hasRenewalFile = isOpenableFileUrl(followUp?.renewalFileUrl);
                    const hasResponseFile = isOpenableFileUrl(followUp?.responseFileUrl);
                    const sourceLabel = followUp?.source === "auto" ? "Auto" : followUp?.source === "manual" ? "Manual" : "Upload";

                    return (
                        <div key={followUp.id} className="bg-white px-3 py-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                    Split {followUp.splitOrder}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">{sourceLabel}</span>
                            </div>
                            <p className="text-[11px] font-semibold text-on-surface">{followUp.title}</p>
                            {columnType === "renewal" ? (
                                <div className="mt-2">
                                    {hasRenewalFile ? (
                                        <button onClick={() => openSafeFile(followUp.renewalFileUrl, followUp.renewalFileName)} className="text-primary hover:underline font-bold text-[11px] uppercase tracking-wider">Buka Berkas</button>
                                    ) : (
                                        <label className="cursor-pointer font-bold text-[10px] text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">
                                            Upload
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, "renewal", e.target.files?.[0] ?? null, followUp.id)} />
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-2">
                                    {hasResponseFile ? (
                                        <button onClick={() => openSafeFile(followUp.responseFileUrl, followUp.responseFileName)} className="text-primary hover:underline font-bold text-[11px] uppercase tracking-wider">Tanggapan</button>
                                    ) : hasRenewalFile ? (
                                        <div className="flex flex-col items-start gap-2">
                                            <label className="relative rounded border border-slate-200 bg-primary px-2 py-1 text-[10px] font-bold text-white">
                                                Lanjut
                                                <input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "lanjut", e.target.files?.[0] ?? null, followUp.id)} />
                                            </label>
                                            <label className="relative rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">
                                                Tidak
                                                <input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "tidak", e.target.files?.[0] ?? null, followUp.id)} />
                                            </label>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-medium text-slate-400">Menunggu upload perpanjangan</span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleUpdateRow = async (rowId, updates) => {
        setIsActionLoading(true);
        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            setEditingRow(null);
            await loadDetail();
        } catch {
            setError("Gagal memperbarui data baris.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAddRisalah = () => {
        setError("");
        setRisalahEditor({
            id: null,
            tanggal: "",
            fileUrl: "",
            fileName: "",
            uploadedFileName: "",
        });
    };

    const handleEditRisalah = (row) => {
        setError("");
        setRisalahEditor({
            id: row.id,
            tanggal: row.tanggal ?? "",
            fileUrl: row.fileUrl ?? "",
            fileName: row.fileName ?? "",
            uploadedFileName: row.fileName ?? "",
        });
    };

    const handleRisalahEditorFileChange = (file) => {
        if (!file) {
            setRisalahEditor((previous) => (previous
                ? {
                    ...previous,
                    fileUrl: "",
                    uploadedFileName: "",
                }
                : previous));
            return;
        }

        void readFileAsDataUrl(file).then((fileUrl) => {
            setRisalahEditor((previous) => (previous
                ? {
                    ...previous,
                    fileUrl,
                    uploadedFileName: file.name,
                }
                : previous));
        }).catch((requestError) => {
            setError(requestError instanceof Error ? requestError.message : "Gagal membaca berkas.");
        });
    };

    const handleSaveRisalah = () => {
        if (!risalahEditor) {
            return;
        }

        if (!String(risalahEditor.fileName ?? "").trim()) {
            setError("Nama berkas risalah wajib diisi.");
            return;
        }

        if (!String(risalahEditor.fileUrl ?? "").trim()) {
            setError("Harap unggah berkas risalah terlebih dahulu.");
            return;
        }

        const normalizedDate = String(risalahEditor.tanggal ?? "").trim() || new Date().toISOString().slice(0, 10);
        const nextRow = {
            id: risalahEditor.id ?? `new-${Date.now()}`,
            tanggal: normalizedDate,
            fileUrl: risalahEditor.fileUrl,
            fileName: String(risalahEditor.fileName ?? "").trim(),
        };

        setError("");
        setRisalahRows((previousRows) => {
            if (risalahEditor.id) {
                return previousRows.map((row) => (row.id === risalahEditor.id ? nextRow : row));
            }

            return [nextRow, ...previousRows];
        });
        setRisalahEditor(null);
        // Real app would fetch/save to backend
    };

    const handleDeleteRisalah = (rowId) => {
        setRisalahRows((previousRows) => previousRows.filter((row) => row.id !== rowId));
    };

    const handleDeleteIsp = async () => {
        const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus ISP "${ispName}"? Semua data tenant di bawahnya juga akan terhapus.`);
        if (!confirmDelete) return;

        setIsLoading(true);
        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}`, {
                method: "DELETE",
            });
            onBack(); 
            if (onRefreshAll) onRefreshAll();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menghapus ISP.");
            setIsLoading(false);
        }
    };

    const renderEmptyState = (message) => (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                <span className="material-symbols-outlined text-3xl text-slate-300">inbox</span>
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-700">Belum Ada Data</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{message}</p>
        </div>
    );

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl space-y-8">
                <button className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container" onClick={onBack} type="button">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Kembali ke Customer Page
                </button>

                <section className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary-container p-6 lg:p-8">
                    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 inline-flex items-center gap-2">
                                    <span className="rounded-md bg-white/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                                        ISP
                                    </span>
                                    <span className="rounded-md bg-white/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                                        {((detail?.status ?? isp.status) === "aktif") ? "Aktif" : "Non-aktif"}
                                    </span>
                                </div>
                                <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">{ispName}</h1>
                                <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
                                    <span className="material-symbols-outlined text-base">description</span>
                                    Kontrak Induk: {contractRef}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <div className="rounded-xl bg-white/60 px-4 py-3 shadow-sm">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Periode Berjalan</p>
                                    <p className="mt-1 text-sm font-bold text-on-surface">{formatContractPeriod(detail?.contractPeriodStart ?? isp.contractPeriodStart, detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50" onClick={() => void loadDetail()} type="button">
                                Refresh Data
                            </button>
                            <button className="rounded-xl bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100" onClick={() => onEditIsp?.(detail ?? isp)} type="button">
                                Edit Data ISP
                            </button>
                            <button className="rounded-xl bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100" onClick={handleDeleteIsp} type="button">
                                Hapus ISP
                            </button>
                        </div>
                    </div>
                </section>

                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex gap-6 overflow-x-auto">
                        {[
                            { id: "overview", label: "Ringkasan", icon: "dashboard" },
                            { id: "customers", label: "Pelanggan/Tenant", icon: "groups" },
                            { id: "contracts", label: "Kontrak", icon: "description" },
                            { id: "risalah", label: "Risalah Rapat", icon: "campaign" },
                            { id: "timeline", label: "Timeline", icon: "history" },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-semibold transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:border-slate-300 hover:text-slate-700"}`}
                                onClick={() => setActiveTab(tab.id)}
                                type="button">
                                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {isLoading && <div className="p-8 text-center text-on-surface-variant">Memuat...</div>}
                {!isLoading && error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

                {!isLoading && activeTab === "overview" && (
                    <div className="space-y-6">
                        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard label="Total Tenant" value={summary.tenantCount ?? tenants.length} icon="groups" />
                            <SummaryCard label="Tenant Aktif" value={tenants.filter(t => t.status === "aktif").length} icon="check_circle" />
                            <SummaryCard label="Tenant Non-aktif" value={tenants.filter(t => t.status !== "aktif").length} icon="cancel" />
                            <div className="flex flex-col rounded-xl bg-white p-5 shadow-sm border border-slate-100">
                                <span className="mb-2 material-symbols-outlined text-2xl text-blue-500">calendar_month</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Kontrak ISP</p>
                                <p className="mt-1 text-[13px] font-semibold text-on-surface">Awal: {formatDate(detail?.contractStartDate ?? isp.contractStartDate)}</p>
                                <p className="mt-1 text-[11px] text-on-surface-variant">Berjalan: {formatContractPeriod(detail?.contractPeriodStart ?? isp.contractPeriodStart, detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}</p>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border-l-4 border-amber-400">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl text-amber-500">warning</span>
                                        Status Tindak Lanjut ISP
                                    </h3>
                                    <div className="space-y-3">
                                        {ispActionItems.map((item) => {
                                            const row = contractRows.find((contractRow) => contractRow.id === item.rowId);
                                            if (!row) {
                                                return null;
                                            }

                                            const toneClassMap = {
                                                red: {
                                                    wrapper: "border-red-100 bg-red-50",
                                                    title: "text-red-800",
                                                    text: "text-red-600",
                                                    primaryButton: "bg-red-600 hover:bg-red-700 text-white",
                                                    secondaryButton: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
                                                },
                                                blue: {
                                                    wrapper: "border-blue-100 bg-blue-50",
                                                    title: "text-blue-800",
                                                    text: "text-blue-600",
                                                    primaryButton: "bg-primary hover:bg-primary/90 text-white",
                                                    secondaryButton: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
                                                },
                                                amber: {
                                                    wrapper: "border-amber-100 bg-amber-50",
                                                    title: "text-amber-800",
                                                    text: "text-amber-600",
                                                    primaryButton: "bg-amber-600 hover:bg-amber-700 text-white",
                                                    secondaryButton: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
                                                },
                                                orange: {
                                                    wrapper: "border-orange-100 bg-orange-50",
                                                    title: "text-orange-800",
                                                    text: "text-orange-700",
                                                    primaryButton: "bg-orange-100 hover:bg-orange-200 text-orange-800",
                                                    secondaryButton: "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
                                                },
                                            };
                                            const toneClass = toneClassMap[item.tone] ?? toneClassMap.orange;

                                            return (
                                                <div key={item.key} className={`rounded-lg border p-4 ${toneClass.wrapper}`}>
                                                    <p className={`text-sm font-bold ${toneClass.title}`}>{item.title}</p>
                                                    <p className={`mt-1 text-xs ${toneClass.text}`}>{item.description}</p>
                                                    <div className="mt-3 flex flex-wrap items-center gap-3">
                                                        {item.actionType === "renewal" && (
                                                            <label className={`inline-flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 text-xs font-bold shadow-sm transition-colors ${toneClass.primaryButton}`}>
                                                                <span className="material-symbols-outlined text-sm">upload</span>
                                                                Unggah Berkas Perpanjangan
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) => handleFileUpload(row.id, "renewal", e.target.files[0], item.followUpId ?? null)}
                                                                />
                                                            </label>
                                                        )}
                                                        {item.actionType === "response" && (
                                                            <>
                                                                <div className="relative">
                                                                    <button className={`rounded border px-3 py-1.5 text-xs font-bold shadow-sm transition-colors ${toneClass.primaryButton}`}>
                                                                        Lanjut (Upload Tanggapan)
                                                                        <input
                                                                            type="file"
                                                                            className="absolute inset-0 cursor-pointer opacity-0"
                                                                            onChange={(e) => handleRespondRenewal(row.id, "lanjut", e.target.files[0], item.followUpId ?? null)}
                                                                        />
                                                                    </button>
                                                                </div>
                                                                <div className="relative">
                                                                    <button className={`rounded border px-3 py-1.5 text-xs font-bold shadow-sm transition-colors ${toneClass.secondaryButton}`}>
                                                                        Tidak (Upload Tanggapan)
                                                                        <input
                                                                            type="file"
                                                                            className="absolute inset-0 cursor-pointer opacity-0"
                                                                            onChange={(e) => handleRespondRenewal(row.id, "tidak", e.target.files[0], item.followUpId ?? null)}
                                                                        />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                        {item.actionType === "edit" && (
                                                            <button
                                                                className={`rounded px-3 py-1.5 text-xs font-bold shadow-sm transition-colors ${toneClass.primaryButton}`}
                                                                onClick={() => {
                                                                    setEditingRow({ ...row });
                                                                    setActiveTab("contracts");
                                                                }}
                                                                type="button"
                                                            >
                                                                Isi Data Sekarang
                                                            </button>
                                                        )}
                                                        {item.actionType === "bak" && (
                                                            <label className={`cursor-pointer rounded px-3 py-1.5 text-xs font-bold transition-colors ${toneClass.primaryButton}`}>
                                                                Upload BAK
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) => handleFileUpload(row.id, "bak", e.target.files[0])}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {ispActionItems.length === 0 && (
                                            <p className="text-sm text-on-surface-variant italic">Tidak ada tindak lanjut kontrak saat ini.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl text-blue-500">groups</span>
                                        Status Kelengkapan Berkas Tenant
                                    </h3>
                                    <div className="space-y-3">
                                        {tenantActionRows.map((tenant) => (
                                            <div key={tenant.id} className="flex flex-col rounded-xl border border-slate-100 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer" onClick={() => onOpenTenant(tenant, "overview")}>
                                                <div className="flex justify-between items-center">
                                                    <p className="text-sm font-bold text-on-surface">{tenant.name}</p>
                                                    <span className="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span>
                                                </div>
                                                <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${tenant.totalActions > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                    <span className="material-symbols-outlined text-xs">{tenant.totalActions > 0 ? "error" : "check_circle"}</span>
                                                    {tenant.name} terdapat {tenant.totalActions} masalah/yang perlu ditindaklanjuti
                                                </p>
                                            </div>
                                        ))}
                                        {tenantActionRows.length === 0 && <p className="text-sm text-on-surface-variant">Tidak ada tindak lanjut tenant aktif saat ini.</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl text-emerald-500">assignment</span>
                                        Ringkasan Action & Tugas
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Butuh Action ISP</p>
                                            <p className="mt-2 text-3xl font-black text-rose-700">{ispActionItems.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Action Tenant</p>
                                            <p className="mt-2 text-3xl font-black text-orange-700">{totalTenantActionCount}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl text-blue-500">history</span>
                                        Aktivitas Terbaru
                                    </h3>
                                    {timeline.length > 0 ? (
                                        <div className="space-y-4">
                                            {timeline.slice(0, 5).map((event) => (
                                                <div key={event.id} className="flex gap-4">
                                                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-on-surface-variant">
                                                        <span className="material-symbols-outlined text-sm">radio_button_checked</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-on-surface">{event.title}</p>
                                                        <p className="text-xs text-on-surface-variant">{event.description}</p>
                                                        <p className="mt-1 text-[10px] uppercase font-bold text-slate-400">{new Date(event.date).toLocaleString("id-ID")}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-on-surface-variant">Belum ada aktivitas tercatat.</div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {!isLoading && activeTab === "customers" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-on-surface">Tenant di Bawah ISP Ini</h2>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Total: {tenants.length}</span>
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Beroperasi: {tenants.filter(t => t.status === "aktif" || t.status === "expired").length}</span>
                                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">Berhenti: {tenants.filter(t => t.status === "berhenti" || (!["aktif", "expired"].includes(t.status))).length}</span>
                                    <span className="h-4 w-[1px] bg-slate-300"></span>
                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Jalur Aktif: {tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "aktif").length}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Jalur Nonaktif: {tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "nonaktif").length}</span>
                                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">Jalur Gangguan: {tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan").length}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-500"
                                    disabled
                                    title="Fitur konversi Excel segera tersedia"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base">table_view</span>
                                    Konversi ke Excel
                                </button>
                                <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90" onClick={() => onOpenCreateTenant?.(detail ?? isp)} type="button">Tambah Tenant</button>
                            </div>
                        </div>
                        {tenants.length === 0 ? renderEmptyState("Belum ada tenant pada ISP ini.") : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50">
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">No</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Tenant</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Status Kontrak</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Status Jalur</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Paket</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Jumlah</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">To Do</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tenants.map((tenant, idx) => (
                                            <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-on-surface-variant">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-on-surface">{tenant.name}</td>
                                                <td className="px-4 py-3 text-sm text-on-surface-variant">
                                                    <span className={`rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${['aktif', 'expired'].includes(tenant.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{['aktif', 'expired'].includes(tenant.status) ? "Beroperasi" : "Berhenti"}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-on-surface-variant">
                                                    {(() => {
                                                        const routeStatus = tenant.route?.activeFlowStatus ?? tenant.status_jalur;
                                                        if (routeStatus === 'aktif') return <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">Aktif</span>;
                                                        if (routeStatus === 'gangguan') return <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-rose-100 text-rose-800">Gangguan</span>;
                                                        if (routeStatus === 'nonaktif') return <span className="rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-800">Non-aktif</span>;
                                                        return <span className="text-xs text-slate-400 font-bold">-</span>;
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-on-surface-variant">{(tenant.paket || "-").toUpperCase()}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-700">{tenant.contractSharingRatio ?? tenant.jumlah ?? "-"}</td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span className="rounded bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">{tenant.todoSummary?.counts?.priority ?? 0}</span>
                                                </td>
                                                <td className="px-4 py-3 flex justify-end gap-2">
                                                    <button className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100" onClick={() => onOpenTenant(tenant, "invoices")} type="button">Invoice</button>
                                                    <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100" onClick={() => onOpenTenant(tenant, "overview")} type="button">Detail</button>
                                                    <button className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100" type="button">Edit</button>
                                                    <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100" type="button">Hapus</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {!isLoading && activeTab === "contracts" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-on-surface">Daftar Kontrak / Adendum</h2>
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/50">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">No</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Nomor Kontrak</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Berkas</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Awal Kontrak</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Periode Berjalan</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">BAK</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Perpanjangan</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">Tanggapan</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-slate-500">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {contractRows.map((row, idx) => (
                                        <tr key={row.id} className={`${editingRow?.id === row.id ? 'bg-amber-50/50' : 'hover:bg-slate-50/30 transition-colors'}`}>
                                            <td className="px-4 py-4 text-sm font-semibold text-slate-400">{idx + 1}</td>
                                            <td className="px-4 py-4 text-sm">
                                                {editingRow?.id === row.id ? (
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                        value={editingRow.contractReference || ""}
                                                        onChange={(e) => setEditingRow({ ...editingRow, contractReference: e.target.value })}
                                                    />
                                                ) : (
                                                    <span className="font-bold text-on-surface">{row.contractReference || "-"}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap">
                                                {isOpenableFileUrl(row.contractFileUrl) ? (
                                                    <button onClick={() => openSafeFile(row.contractFileUrl, row.contractFileName)} className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-bold text-[10px] uppercase tracking-wider bg-primary/5 px-2 py-1 rounded-md transition-colors">
                                                        <span className="material-symbols-outlined text-sm">description</span>
                                                        Buka
                                                    </button>
                                                ) : (
                                                    <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">upload</span>
                                                        Upload
                                                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'contract', e.target.files[0])} />
                                                    </label>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">
                                                {editingRow?.id === row.id ? (
                                                    <input
                                                        type="date"
                                                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                        value={editingRow.periodStart || ""}
                                                        onChange={(e) => setEditingRow({ ...editingRow, periodStart: e.target.value })}
                                                    />
                                                ) : (
                                                    <span className="font-medium">{formatDate(row.periodStart)}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">
                                                {editingRow?.id === row.id ? (
                                                    <input
                                                        type="date"
                                                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                        value={editingRow.periodEnd || ""}
                                                        onChange={(e) => setEditingRow({ ...editingRow, periodEnd: e.target.value })}
                                                    />
                                                ) : (
                                                    <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                                        {formatContractPeriod(row.periodStart, row.periodEnd)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {isOpenableFileUrl(row.bakFileUrl) ? (
                                                    <button onClick={() => openSafeFile(row.bakFileUrl, row.bakFileName)} className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md transition-colors">
                                                        <span className="material-symbols-outlined text-sm">task_alt</span>
                                                        Buka
                                                    </button>
                                                ) : (
                                                    <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-400 uppercase tracking-widest border border-slate-200 border-dashed px-2 py-1 rounded-md hover:bg-slate-50 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">upload_file</span>
                                                        BAK
                                                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'bak', e.target.files[0])} />
                                                    </label>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                <div className="space-y-2">
                                                    {renderRenewalFollowUps(row, "renewal")}
                                                    <button
                                                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                                                        disabled={!hasInitialRenewalUpload(row)}
                                                        onClick={() => {
                                                            void handleAddRenewalSplit(row.id);
                                                        }}
                                                        title={!hasInitialRenewalUpload(row) ? "Upload berkas perpanjangan pertama terlebih dahulu." : "Tambah split tindak lanjut"}
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">add_circle</span>
                                                        Split
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {renderRenewalFollowUps(row, "response")}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {editingRow?.id === row.id ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors" onClick={() => handleUpdateRow(row.id, { contractReference: editingRow.contractReference, periodStart: editingRow.periodStart, periodEnd: editingRow.periodEnd })}>
                                                            <span className="material-symbols-outlined text-sm">save</span>
                                                            Simpan
                                                        </button>
                                                        <button className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors" onClick={() => setEditingRow(null)}>
                                                            Batal
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end">
                                                        <button className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors" onClick={() => setEditingRow({ ...row })}>
                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                            Edit
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {contractRows.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="py-12 text-center text-on-surface-variant italic">Belum ada rincian kontrak.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="grid grid-cols-1 gap-4 md:hidden">
                            {contractRows.map((row, idx) => (
                                <div key={row.id} className={`rounded-xl border ${editingRow?.id === row.id ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-slate-50/30'} p-4 space-y-4 shadow-sm`}>
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kontrak #{idx + 1}</span>
                                        {editingRow?.id !== row.id && (
                                            <button className="text-amber-600" onClick={() => setEditingRow({ ...row })}>
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nomor Kontrak</label>
                                            {editingRow?.id === row.id ? (
                                                <input
                                                    type="text"
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                                    value={editingRow.contractReference || ""}
                                                    onChange={(e) => setEditingRow({ ...editingRow, contractReference: e.target.value })}
                                                />
                                            ) : (
                                                <div className="font-bold text-on-surface break-words">{row.contractReference || "-"}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Awal Kontrak</label>
                                            {editingRow?.id === row.id ? (
                                                <input
                                                    type="date"
                                                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                    value={editingRow.periodStart || ""}
                                                    onChange={(e) => setEditingRow({ ...editingRow, periodStart: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-sm font-medium text-on-surface-variant">{formatDate(row.periodStart)}</div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Periode</label>
                                            {editingRow?.id === row.id ? (
                                                <input
                                                    type="date"
                                                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                                    value={editingRow.periodEnd || ""}
                                                    onChange={(e) => setEditingRow({ ...editingRow, periodEnd: e.target.value })}
                                                />
                                            ) : (
                                                <div className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                                    {formatContractPeriod(row.periodStart, row.periodEnd)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">Berkas</label>
                                            {isOpenableFileUrl(row.contractFileUrl) ? (
                                                <button onClick={() => openSafeFile(row.contractFileUrl, row.contractFileName)} className="inline-flex items-center gap-1 text-primary font-bold text-[10px] uppercase bg-primary/5 px-2 py-1.5 rounded-md">
                                                    <span className="material-symbols-outlined text-sm">description</span>
                                                    Kontrak
                                                </button>
                                            ) : (
                                                <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-500 uppercase bg-slate-100 px-2 py-1.5 rounded-md">
                                                    <span className="material-symbols-outlined text-sm">upload</span>
                                                    Upload
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'contract', e.target.files[0])} />
                                                </label>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400">BAK</label>
                                            {isOpenableFileUrl(row.bakFileUrl) ? (
                                                <button onClick={() => openSafeFile(row.bakFileUrl, row.bakFileName)} className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-1.5 rounded-md">
                                                    <span className="material-symbols-outlined text-sm">task_alt</span>
                                                    BAK
                                                </button>
                                            ) : (
                                                <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-400 uppercase border border-slate-200 border-dashed px-2 py-1.5 rounded-md">
                                                    <span className="material-symbols-outlined text-sm">upload_file</span>
                                                    Upload
                                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'bak', e.target.files[0])} />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2 border-t border-slate-100">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Perpanjangan</label>
                                                <button
                                                    className="text-[9px] font-black uppercase text-primary bg-primary/5 px-1.5 py-0.5 rounded"
                                                    disabled={!hasInitialRenewalUpload(row)}
                                                    onClick={() => handleAddRenewalSplit(row.id)}
                                                >
                                                    + Split
                                                </button>
                                            </div>
                                            <div className="bg-white/50 rounded-lg p-2 min-h-[40px]">
                                                {renderRenewalFollowUps(row, "renewal")}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tanggapan</label>
                                            <div className="bg-white/50 rounded-lg p-2 min-h-[40px]">
                                                {renderRenewalFollowUps(row, "response")}
                                            </div>
                                        </div>
                                    </div>

                                    {editingRow?.id === row.id && (
                                        <div className="flex gap-2 pt-2 border-t border-amber-100">
                                            <button className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm" onClick={() => handleUpdateRow(row.id, { contractReference: editingRow.contractReference, periodStart: editingRow.periodStart, periodEnd: editingRow.periodEnd })}>
                                                Simpan Perubahan
                                            </button>
                                            <button className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-bold text-slate-600" onClick={() => setEditingRow(null)}>
                                                Batal
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {contractRows.length === 0 && (
                                <div className="py-8 text-center text-slate-400 italic text-sm">Belum ada rincian kontrak.</div>
                            )}
                        </div>
                    </section>
                )}

                {!isLoading && activeTab === "risalah" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-on-surface">Risalah Rapat</h2>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
                                type="button"
                                onClick={handleAddRisalah}
                            >
                                <span className="material-symbols-outlined text-base">add</span>
                                Tambah Berkas
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">No</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Tanggal Rapat</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Upload Berkas</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Nama Berkas</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {risalahRows.map((row, idx) => (
                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4 text-sm font-semibold">{idx + 1}</td>
                                            <td className="px-4 py-4 text-sm">
                                                <span className="font-medium text-slate-700">{formatDate(row.tanggal)}</span>
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {isOpenableFileUrl(row.fileUrl) ? (
                                                    <button onClick={() => openSafeFile(row.fileUrl, row.fileName)} className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:underline">
                                                        <span className="material-symbols-outlined text-[14px]">attach_file</span>
                                                        Buka berkas
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                                                        <span className="material-symbols-outlined text-[14px]">attach_file</span>
                                                        Belum ada berkas
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-on-surface-variant font-medium">
                                                {row.fileName ? (
                                                    <span className="font-semibold text-on-surface">{row.fileName}</span>
                                                ) : "Belum ada berkas"}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button className="mr-3 text-primary font-bold hover:underline" onClick={() => handleEditRisalah(row)} type="button">Edit</button>
                                                <button className="text-red-600 font-bold hover:underline" onClick={() => handleDeleteRisalah(row.id)} type="button">Hapus</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {risalahRows.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-on-surface-variant italic">Belum ada risalah rapat. Klik "Tambah Berkas" untuk membuat baru.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {risalahEditor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                        <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Risalah Rapat</p>
                                    <h3 className="text-xl font-bold text-on-surface">{risalahEditor.id ? "Edit Berkas Risalah" : "Tambah Berkas Risalah"}</h3>
                                    <p className="text-xs text-on-surface-variant">Isi nama berkas manual, unggah file, lalu atur tanggal jika diperlukan.</p>
                                </div>
                                <button className="rounded-lg bg-slate-100 p-2 text-on-surface-variant transition-colors hover:bg-slate-200" onClick={() => setRisalahEditor(null)} type="button">
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Nama Berkas</label>
                                    <input
                                        className="w-full rounded-xl bg-surface-container-low p-3 text-sm outline-none transition-all glass-input"
                                        onChange={(event) => setRisalahEditor((previous) => previous ? { ...previous, fileName: event.target.value } : previous)}
                                        placeholder="Contoh: Risalah Meeting April 2026"
                                        type="text"
                                        value={risalahEditor.fileName}
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Upload Berkas</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 bg-surface-container-lowest px-3 py-2.5 text-sm outline-none transition-colors file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                                        onChange={(event) => handleRisalahEditorFileChange(event.target.files?.[0] ?? null)}
                                        type="file"
                                    />
                                    <p className="mt-2 text-xs text-on-surface-variant">
                                        {risalahEditor.uploadedFileName ? `File dipilih: ${risalahEditor.uploadedFileName}` : "Belum ada file dipilih."}
                                    </p>
                                </div>
                                <div>
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">Tanggal Rapat</label>
                                    <input
                                        className="w-full rounded-xl bg-surface-container-low p-3 text-sm outline-none transition-all glass-input"
                                        onChange={(event) => setRisalahEditor((previous) => previous ? { ...previous, tanggal: event.target.value } : previous)}
                                        type="date"
                                        value={risalahEditor.tanggal}
                                    />
                                    <p className="mt-2 text-xs text-on-surface-variant">Kosongkan jika ingin otomatis memakai tanggal hari ini.</p>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-slate-50" onClick={() => setRisalahEditor(null)} type="button">Batal</button>
                                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90" onClick={handleSaveRisalah} type="button">Simpan</button>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === "timeline" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-bold text-on-surface">Riwayat Aktifitas & Timeline</h2>
                        </div>
                        {timeline.length === 0 ? renderEmptyState("Belum ada aktifitas baru.") : (
                            <div className="space-y-4">
                                {timeline.map((event) => (
                                    <div key={event.id} className="flex gap-4">
                                        <span className="material-symbols-outlined text-slate-400">radio_button_checked</span>
                                        <div>
                                            <p className="text-sm font-bold text-on-surface">{event.title}</p>
                                            <p className="text-xs text-on-surface-variant">{event.description}</p>
                                            <p className="mt-1 text-[10px] text-slate-400">{new Date(event.date).toLocaleString("id-ID")}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </AppShell>
    );
}

export default IspDetailPage;
