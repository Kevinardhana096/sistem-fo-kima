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

function IspDetailPage({
    isp,
    onBack,
    onEditIsp,
    onNavigate,
    onLogout,
    onOpenCreateTenant,
    onOpenTenant,
    onRefreshAll,
    canEditIsp = true,
    canDeleteIsp = true,
    canCreateTenant = true,
    canEditTenant = true,
    canDeleteTenant = true,
    currentRole = "admin",
}) {
    const isTeknisi = currentRole === "teknisi";
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
            await fetchJson(`${endpoint}`, { method: "POST", body: formData });
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengunggah berkas.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleRespondRenewal = async (rowId, decision, file, followUpId = null) => {
        if (!file) { setError("Harap pilih berkas tanggapan."); return; }
        setIsActionLoading(true);
        setError("");
        const formData = new FormData();
        formData.append("file", file);
        formData.append("decision", decision);
        formData.append("fileDataUrl", await readFileAsDataUrl(file));
        formData.append("fileName", file.name);
        if (followUpId) formData.append("followUpId", String(followUpId));
        try {
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/response`, { method: "POST", body: formData });
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
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}/follow-ups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">Split {followUp.splitOrder}</span>
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
                                            <label className="relative rounded border border-slate-200 bg-primary px-2 py-1 text-[10px] font-bold text-white">Lanjut<input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "lanjut", e.target.files?.[0] ?? null, followUp.id)} /></label>
                                            <label className="relative rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">Tidak<input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "tidak", e.target.files?.[0] ?? null, followUp.id)} /></label>
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
            await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/contract-rows/${rowId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
            setEditingRow(null);
            await loadDetail();
        } catch { setError("Gagal memperbarui data baris."); } finally { setIsActionLoading(false); }
    };

    const handleAddRisalah = () => { setError(""); setRisalahEditor({ id: null, tanggal: "", fileUrl: "", fileName: "", uploadedFileName: "" }); };
    const handleEditRisalah = (row) => { setError(""); setRisalahEditor({ id: row.id, tanggal: row.tanggal ?? "", fileUrl: row.fileUrl ?? "", fileName: row.fileName ?? "", uploadedFileName: row.fileName ?? "" }); };

    const handleRisalahEditorFileChange = (file) => {
        if (!file) { setRisalahEditor((p) => p ? { ...p, fileUrl: "", uploadedFileName: "" } : p); return; }
        void readFileAsDataUrl(file).then((fileUrl) => { setRisalahEditor((p) => p ? { ...p, fileUrl, uploadedFileName: file.name } : p); }).catch((re) => { setError(re instanceof Error ? re.message : "Gagal membaca berkas."); });
    };

    const handleSaveRisalah = () => {
        if (!risalahEditor) return;
        if (!String(risalahEditor.fileName ?? "").trim()) { setError("Nama berkas risalah wajib diisi."); return; }
        if (!String(risalahEditor.fileUrl ?? "").trim()) { setError("Harap unggah berkas risalah terlebih dahulu."); return; }
        const nextRow = { id: risalahEditor.id ?? `new-${Date.now()}`, tanggal: String(risalahEditor.tanggal ?? "").trim() || new Date().toISOString().slice(0, 10), fileUrl: risalahEditor.fileUrl, fileName: String(risalahEditor.fileName ?? "").trim() };
        setError("");
        setRisalahRows((pr) => risalahEditor.id ? pr.map((r) => r.id === risalahEditor.id ? nextRow : r) : [nextRow, ...pr]);
        setRisalahEditor(null);
    };

    const handleDeleteRisalah = (rowId) => { setRisalahRows((pr) => pr.filter((r) => r.id !== rowId)); };

    const handleDeleteIsp = async () => {
        if (!window.confirm(`Apakah Anda yakin ingin menghapus ISP "${ispName}"?`)) return;
        setIsLoading(true);
        try { await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}`, { method: "DELETE" }); onBack(); if (onRefreshAll) onRefreshAll(); }
        catch (err) { setError(err instanceof Error ? err.message : "Gagal menghapus ISP."); setIsLoading(false); }
    };

    const renderEmptyState = (message) => (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50"><span className="material-symbols-outlined text-3xl text-slate-300">inbox</span></div>
            <h3 className="mt-4 text-base font-bold text-slate-700">Belum Ada Data</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{message}</p>
        </div>
    );

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate} currentRole={currentRole}>
            <div className="mx-auto max-w-7xl space-y-8">
                <button className="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface-container" onClick={onBack} type="button">
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    {isTeknisi ? "Kembali ke Pelanggan" : "Kembali ke Customer Page"}
                </button>

                <section className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary-container p-6 lg:p-8">
                    <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                        <div className="space-y-4">
                            <div>
                                <div className="mb-2 inline-flex items-center gap-2">
                                    <span className="rounded-md bg-white/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">ISP</span>
                                    <span className="rounded-md bg-white/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">{['aktif', 'expired'].includes(detail?.status ?? isp.status) ? "Beroperasi" : "Berhenti"}</span>
                                    <span className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${ (detail?.status ?? isp.status) === 'expired' ? 'bg-rose-100 text-rose-700' : 'bg-white/50 text-primary'}`}>Kontrak: { (detail?.status ?? isp.status) === 'expired' ? 'Expired' : 'Aktif' }</span>
                                </div>
                                <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">{ispName}</h1>
                                <p className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-base">description</span>Kontrak Induk: {contractRef}</p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <div className="rounded-xl bg-white/60 px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Periode Berjalan</p><p className="mt-1 text-sm font-bold text-on-surface">{formatContractPeriod(detail?.contractPeriodStart ?? isp.contractPeriodStart, detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}</p></div>
                                {isTeknisi && (
                                    <div className="rounded-xl bg-white/60 px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Status Kontrak</p><p className={`mt-1 text-sm font-bold ${ (detail?.status ?? isp.status) === 'expired' ? 'text-rose-600' : 'text-emerald-600' }`}>{ (detail?.status ?? isp.status) === 'expired' ? 'Sudah Berakhir' : 'Beroperasi (Aktif)' }</p></div>
                                )}
                            </div>
                        </div>
                        {!isTeknisi && (
                            <div className="flex gap-3">
                                <button className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50" onClick={() => void loadDetail()} type="button">Refresh Data</button>
                                {canEditIsp && <button className="rounded-xl bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100" onClick={() => onEditIsp?.(detail ?? isp)} type="button">Edit Data ISP</button>}
                                {canDeleteIsp && <button className="rounded-xl bg-red-50 px-5 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100" onClick={handleDeleteIsp} type="button">Hapus ISP</button>}
                            </div>
                        )}
                        {isTeknisi && (
                             <div className="flex gap-3">
                                <button className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50" onClick={() => void loadDetail()} type="button">Refresh Data</button>
                             </div>
                        )}
                    </div>
                </section>

                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex gap-6 overflow-x-auto">
                        {[
                            { id: "overview", label: "Ringkasan", icon: "dashboard" },
                            { id: "customers", label: "Pelanggan/Tenant", icon: "groups" },
                            { id: "jalur", label: "Jalur", icon: "map" },
                            ...(currentRole !== "teknisi" ? [
                                { id: "contracts", label: "Kontrak", icon: "description" }, 
                                { id: "risalah", label: "Risalah Rapat", icon: "campaign" },
                                { id: "timeline", label: "Timeline", icon: "history" }
                            ] : []),
                        ].map((tab) => (
                            <button key={tab.id} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-semibold transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:border-slate-300 hover:text-slate-700"}`} onClick={() => setActiveTab(tab.id)} type="button">
                                <span className="material-symbols-outlined text-xl">{tab.icon}</span>{tab.label}
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
                            <SummaryCard label="Tenant Aktif" value={tenants.filter(t => t.status === "aktif" || t.status === "expired").length} icon="check_circle" />
                            <SummaryCard label="Tenant Non-aktif" value={tenants.filter(t => t.status === "berhenti" || !["aktif", "expired"].includes(t.status)).length} icon="cancel" />
                            <SummaryCard label="Total Aktif Jalur" value={tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "aktif").length} icon="lan" />
                            <SummaryCard label="Total Aktif Kontrak" value={tenants.filter(t => t.status === "aktif" || t.status === "expired").length} icon="description" />
                            <div className="flex flex-col rounded-xl bg-white p-5 shadow-sm border border-slate-100">
                                <span className="mb-2 material-symbols-outlined text-2xl text-blue-500">calendar_today</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Awal Periode Kontrak</p>
                                <p className="mt-1 text-[13px] font-semibold text-on-surface">{formatDate(detail?.contractStartDate ?? isp.contractStartDate)}</p>
                            </div>
                            <div className="flex flex-col rounded-xl bg-white p-5 shadow-sm border border-slate-100">
                                <span className="mb-2 material-symbols-outlined text-2xl text-blue-500">sync_alt</span>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Kontrak Berjalan</p>
                                <p className="mt-1 text-[11px] font-semibold text-on-surface">{formatContractPeriod(detail?.contractPeriodStart ?? isp.contractPeriodStart, detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}</p>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm border-l-4 border-amber-400">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                        <span className="material-symbols-outlined text-xl text-amber-500">{isTeknisi ? "emergency_home" : "warning"}</span>
                                        {isTeknisi ? "Status Tindak Lanjut Jalur (Urgent)" : "Status Tindak Lanjut ISP"}
                                    </h3>
                                    <div className="space-y-3">
                                        {(() => {
                                            const gangguanTenants = tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan");
                                            const noJalurTenants = tenants.filter(t => !t.route && t.status === "aktif");
                                            if (isTeknisi) {
                                                if (gangguanTenants.length === 0 && noJalurTenants.length === 0) return <p className="text-sm text-on-surface-variant italic">Semua jalur tenant terpantau normal & lengkap.</p>;
                                                return (
                                                    <>
                                                        {gangguanTenants.map(t => (
                                                            <div key={`g-${t.id}`} className="flex flex-col rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm transition-all hover:bg-rose-100 cursor-pointer" onClick={() => onOpenTenant(t, "jalur")}>
                                                                <div className="flex justify-between items-center"><p className="text-sm font-black text-rose-800">{t.name}</p><span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">URGENT</span></div>
                                                                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-rose-600"><span className="material-symbols-outlined text-xs">error</span>Jalur GANGGUAN: Butuh penanganan teknis segera!</p>
                                                            </div>
                                                        ))}
                                                        {noJalurTenants.map(t => (
                                                            <div key={`n-${t.id}`} className="flex flex-col rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm transition-all hover:bg-amber-100 cursor-pointer" onClick={() => onOpenTenant(t, "jalur")}>
                                                                <div className="flex justify-between items-center"><p className="text-sm font-black text-amber-800">{t.name}</p><span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase text-white">ACTION</span></div>
                                                                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600"><span className="material-symbols-outlined text-xs">add_location_alt</span>Data Jalur Kosong: Segera input peta jalur!</p>
                                                            </div>
                                                        ))}
                                                    </>
                                                );
                                            }
                                            return ispActionItems.map((item) => {
                                                const row = contractRows.find((r) => r.id === item.rowId); if (!row) return null;
                                                const toneClassMap = { red: { wrapper: "border-red-100 bg-red-50", title: "text-red-800", text: "text-red-600", primaryButton: "bg-red-600 hover:bg-red-700 text-white" }, blue: { wrapper: "border-blue-100 bg-blue-50", title: "text-blue-800", text: "text-blue-600", primaryButton: "bg-primary hover:bg-primary/90 text-white" }, amber: { wrapper: "border-amber-100 bg-amber-50", title: "text-amber-800", text: "text-amber-600", primaryButton: "bg-amber-600 hover:bg-amber-700 text-white" }, orange: { wrapper: "border-orange-100 bg-orange-50", title: "text-orange-800", text: "text-orange-700", primaryButton: "bg-orange-100 hover:bg-orange-200 text-orange-800" } };
                                                const toneClass = toneClassMap[item.tone] ?? toneClassMap.orange;
                                                return (<div key={item.key} className={`rounded-lg border p-4 ${toneClass.wrapper}`}><p className={`text-sm font-bold ${toneClass.title}`}>{item.title}</p><p className={`mt-1 text-xs ${toneClass.text}`}>{item.description}</p></div>);
                                            });
                                        })()}
                                    </div>
                                </div>
                                {!isTeknisi && (
                                    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface">
                                            <span className="material-symbols-outlined text-xl text-blue-500">groups</span>
                                            Status Kelengkapan Berkas Tenant
                                        </h3>
                                        <div className="space-y-3">
                                            {tenantActionRows.map((t) => (
                                                <div key={t.id} className="flex flex-col rounded-xl border border-slate-100 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer" onClick={() => onOpenTenant(t, "overview")}>
                                                    <div className="flex justify-between items-center"><p className="text-sm font-bold text-on-surface">{t.name}</p><span className="material-symbols-outlined text-slate-400 text-sm">arrow_forward_ios</span></div>
                                                    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${t.totalActions > 0 ? "text-amber-600" : "text-emerald-600"}`}><span className="material-symbols-outlined text-xs">{t.totalActions > 0 ? "error" : "check_circle"}</span>{t.name} terdapat {t.totalActions} masalah yang perlu ditindaklanjuti</p>
                                                </div>
                                            ))}
                                            {tenantActionRows.length === 0 && <p className="text-sm text-on-surface-variant">Tidak ada tindak lanjut tenant aktif saat ini.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-6">
                                <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface"><span className="material-symbols-outlined text-xl text-emerald-500">assignment</span>Ringkasan Action & Tugas</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600">{isTeknisi ? "Jalur Gangguan" : "Butuh Action ISP"}</p>
                                            <p className="mt-2 text-3xl font-black text-rose-700">{isTeknisi ? tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan").length : ispActionItems.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-orange-100 bg-orange-50 p-5">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">{isTeknisi ? "Belum Ada Jalur" : "Action Tenant"}</p>
                                            <p className="mt-2 text-3xl font-black text-orange-700">{isTeknisi ? tenants.filter(t => !t.route && t.status === "aktif").length : totalTenantActionCount}</p>
                                        </div>
                                    </div>
                                </div>
                                {!isTeknisi && (
                                    <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                                        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-on-surface"><span className="material-symbols-outlined text-xl text-blue-500">history</span>Aktivitas Terbaru</h3>
                                        {timeline.length > 0 ? (
                                            <div className="space-y-4">
                                                {timeline.slice(0, 5).map((e) => (
                                                    <div key={e.id} className="flex gap-4">
                                                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-on-surface-variant"><span className="material-symbols-outlined text-sm">radio_button_checked</span></div>
                                                        <div><p className="text-sm font-bold text-on-surface">{e.title}</p><p className="text-xs text-on-surface-variant">{e.description}</p><p className="mt-1 text-[10px] uppercase font-bold text-slate-400">{new Date(e.date).toLocaleString("id-ID")}</p></div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-on-surface-variant">Belum ada aktivitas tercatat.</div>}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {!isLoading && activeTab === "customers" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h2 className="text-lg font-bold text-on-surface">Daftar Pelanggan Tenant</h2>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Total Tenant: {tenants.length}</span>
                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Beroperasi: {tenants.filter(t => t.status === "aktif" || t.status === "expired").length}</span>
                                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">Nonaktif/Berhenti: {tenants.filter(t => t.status === "berhenti" || (!["aktif", "expired"].includes(t.status))).length}</span>
                                    <span className="h-4 w-[1px] bg-slate-300"></span>
                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Jalur Aktif: {tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "aktif").length}</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Jalur Nonaktif: {tenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "nonaktif" || (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan").length}</span>
                                </div>
                            </div>
                            {!isTeknisi && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <button className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-500" disabled><span className="material-symbols-outlined text-base">table_view</span>Konversi ke Excel</button>
                                    {canCreateTenant && <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90" onClick={() => onOpenCreateTenant?.(detail ?? isp)} type="button">Tambah Tenant</button>}
                                </div>
                            )}
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
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-wider text-on-surface-variant">{isTeknisi ? "Perlu Tindak Lanjut?" : "To Do"}</th>
                                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tenants.map((tenant, idx) => (
                                            <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-on-surface-variant">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-on-surface">{tenant.name}</td>
                                                <td className="px-4 py-3 text-sm text-on-surface-variant"><span className={`rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${['aktif', 'expired'].includes(tenant.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{['aktif', 'expired'].includes(tenant.status) ? "Beroperasi" : "Berhenti"}</span></td>
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
                                                    {isTeknisi ? (
                                                        (() => {
                                                            const needsJalur = !tenant.route && tenant.status === "aktif";
                                                            const isGangguan = (tenant.route?.activeFlowStatus ?? tenant.status_jalur) === "gangguan";
                                                            if (needsJalur || isGangguan) return <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 uppercase border border-rose-100">Ya</span>;
                                                            return <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Tidak</span>;
                                                        })()
                                                    ) : <span className="rounded bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">{tenant.todoSummary?.counts?.priority ?? 0}</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {!isTeknisi && <button className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100" onClick={() => onOpenTenant(tenant, "invoices")} type="button">Invoice</button>}
                                                        <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100" onClick={() => onOpenTenant(tenant, isTeknisi ? "jalur" : "overview")} type="button">Detail</button>
                                                        {!isTeknisi && canEditTenant && <button className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100" type="button">Edit</button>}
                                                        {!isTeknisi && canDeleteTenant && <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100" type="button">Hapus</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {!isLoading && activeTab === "jalur" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm min-h-[500px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-6xl text-slate-300">map</span>
                        <h2 className="mt-4 text-xl font-bold text-slate-600">Maps Jalur Tenant</h2>
                        <p className="mt-2 text-sm text-slate-500 max-w-md text-center">Fitur visualisasi maps untuk memantau jalur semua tenant di bawah ISP ini sedang dalam tahap perancangan layout.</p>
                    </section>
                )}

                {!isLoading && activeTab === "contracts" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4"><h2 className="text-lg font-bold text-on-surface">Daftar Kontrak / Adendum</h2></div>
                        <div className="overflow-x-auto">
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
                                                    <input type="text" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary outline-none" value={editingRow.contractReference || ""} onChange={(e) => setEditingRow({ ...editingRow, contractReference: e.target.value })} />
                                                ) : <span className="font-bold text-on-surface">{row.contractReference || "-"}</span>}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap">
                                                {isOpenableFileUrl(row.contractFileUrl) ? (
                                                    <button onClick={() => openSafeFile(row.contractFileUrl, row.contractFileName)} className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-bold text-[10px] uppercase tracking-wider bg-primary/5 px-2 py-1 rounded-md transition-colors"><span className="material-symbols-outlined text-sm">description</span>Buka</button>
                                                ) : <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors"><span className="material-symbols-outlined text-sm">upload</span>Upload<input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'contract', e.target.files[0])} /></label>}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">
                                                {editingRow?.id === row.id ? (
                                                    <input type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={editingRow.periodStart || ""} onChange={(e) => setEditingRow({ ...editingRow, periodStart: e.target.value })} />
                                                ) : <span className="font-medium">{formatDate(row.periodStart)}</span>}
                                            </td>
                                            <td className="px-4 py-4 text-sm whitespace-nowrap text-on-surface-variant">
                                                {editingRow?.id === row.id ? (
                                                    <input type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={editingRow.periodEnd || ""} onChange={(e) => setEditingRow({ ...editingRow, periodEnd: e.target.value })} />
                                                ) : <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-tight">{formatContractPeriod(row.periodStart, row.periodEnd)}</span>}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {isOpenableFileUrl(row.bakFileUrl) ? (
                                                    <button onClick={() => openSafeFile(row.bakFileUrl, row.bakFileName)} className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded-md transition-colors"><span className="material-symbols-outlined text-sm">task_alt</span>Buka</button>
                                                ) : <label className="inline-flex items-center gap-1 cursor-pointer font-bold text-[10px] text-slate-400 uppercase border border-slate-200 border-dashed px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"><span className="material-symbols-outlined text-sm">upload_file</span>BAK<input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'bak', e.target.files[0])} /></label>}
                                            </td>
                                            <td className="px-4 py-4 text-sm"><div className="space-y-2">{renderRenewalFollowUps(row, "renewal")}<button className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50" disabled={!hasInitialRenewalUpload(row)} onClick={() => handleAddRenewalSplit(row.id)} type="button"><span className="material-symbols-outlined text-xs">add_circle</span>Split</button></div></td>
                                            <td className="px-4 py-4 text-sm">{renderRenewalFollowUps(row, "response")}</td>
                                            <td className="px-4 py-4 text-right">
                                                {editingRow?.id === row.id ? (
                                                    <div className="flex justify-end gap-2"><button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700" onClick={() => handleUpdateRow(row.id, { contractReference: editingRow.contractReference, periodStart: editingRow.periodStart, periodEnd: editingRow.periodEnd })}>Simpan</button><button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200" onClick={() => setEditingRow(null)}>Batal</button></div>
                                                ) : <button className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100" onClick={() => setEditingRow({ ...row })} type="button">Edit</button>}
                                            </td>
                                        </tr>
                                    ))}
                                    {contractRows.length === 0 && (<tr><td colSpan="9" className="py-12 text-center text-on-surface-variant italic">Belum ada rincian kontrak.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {!isLoading && activeTab === "risalah" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4"><h2 className="text-lg font-bold text-on-surface">Risalah Rapat</h2><button className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary/90" type="button" onClick={handleAddRisalah}>Tambah Berkas</button></div>
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
                                            <td className="px-4 py-4 text-sm"><span className="font-medium text-slate-700">{formatDate(row.tanggal)}</span></td>
                                            <td className="px-4 py-4 text-sm">{isOpenableFileUrl(row.fileUrl) ? (<button onClick={() => openSafeFile(row.fileUrl, row.fileName)} className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:underline">Buka berkas</button>) : <span className="text-[10px] font-bold text-slate-500">Belum ada berkas</span>}</td>
                                            <td className="px-4 py-4 text-sm font-medium">{row.fileName || "Belum ada berkas"}</td>
                                            <td className="px-4 py-4 text-right"><button className="mr-3 text-primary font-bold hover:underline" onClick={() => handleEditRisalah(row)} type="button">Edit</button><button className="text-red-600 font-bold hover:underline" onClick={() => handleDeleteRisalah(row.id)} type="button">Hapus</button></td>
                                        </tr>
                                    ))}
                                    {risalahRows.length === 0 && (<tr><td colSpan="5" className="py-12 text-center italic text-on-surface-variant">Belum ada risalah rapat.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {risalahEditor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="mb-4 flex items-start justify-between"><div><h3 className="text-xl font-bold text-on-surface">{risalahEditor.id ? "Edit Risalah" : "Tambah Risalah"}</h3></div><button className="p-2" onClick={() => setRisalahEditor(null)} type="button">close</button></div>
                            <div className="space-y-4">
                                <div><label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">Nama Berkas</label><input className="w-full rounded-xl bg-slate-50 p-3 text-sm outline-none border border-slate-200" onChange={(e) => setRisalahEditor(p => p ? { ...p, fileName: e.target.value } : p)} type="text" value={risalahEditor.fileName} /></div>
                                <div><label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">Upload Berkas</label><input className="w-full text-sm" onChange={(e) => handleRisalahEditorFileChange(e.target.files?.[0] ?? null)} type="file" /></div>
                                <div><label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">Tanggal</label><input className="w-full rounded-xl bg-slate-50 p-3 text-sm outline-none border border-slate-200" onChange={(e) => setRisalahEditor(p => p ? { ...p, tanggal: e.target.value } : p)} type="date" value={risalahEditor.tanggal} /></div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2"><button className="px-4 py-2 text-sm font-semibold" onClick={() => setRisalahEditor(null)} type="button">Batal</button><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={handleSaveRisalah} type="button">Simpan</button></div>
                        </div>
                    </div>
                )}

                {!isLoading && activeTab === "timeline" && (
                    <section className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
                        <div className="mb-6 border-b border-slate-100 pb-4"><h2 className="text-lg font-bold text-on-surface">Riwayat Aktifitas & Timeline</h2></div>
                        {timeline.length === 0 ? renderEmptyState("Belum ada aktifitas baru.") : (
                            <div className="space-y-4">
                                {timeline.map((e) => (
                                    <div key={e.id} className="flex gap-4">
                                        <span className="material-symbols-outlined text-slate-400">radio_button_checked</span>
                                        <div><p className="text-sm font-bold text-on-surface">{e.title}</p><p className="text-xs text-on-surface-variant">{e.description}</p><p className="mt-1 text-[10px] text-slate-400">{new Date(e.date).toLocaleString("id-ID")}</p></div>
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
