import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import AppShell from "../../components/layout/AppShell";
import { StatCard } from "../../components/shared/AppShared";
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

const GlassCustomSelect = ({ label, value, onChange, options, icon, heightClass = "h-12" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={`space-y-3 relative ${isOpen ? "z-[60]" : "z-0"}`} ref={containerRef}>
            {label && (
                <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/40 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`rounded-xl bg-black/20 border flex items-center transition-all cursor-pointer shadow-inner-glass relative z-20 ${isOpen ? "border-gold-accent/60 bg-black/40 shadow-gold-glow" : "border-white/10 text-white/70 hover:border-white/30"} ${heightClass} w-full px-4 text-[10px] font-black`}
                >
                    {icon && (
                        <span className="material-symbols-outlined mr-3 text-lg" style={{ color: isOpen ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                            {icon}
                        </span>
                    )}
                    <span className="truncate uppercase tracking-widest">{selectedOption.label}</span>
                    <span className={`material-symbols-outlined ml-auto transition-transform duration-300 ${isOpen ? "rotate-180 text-gold-accent" : "text-white/20"}`}>
                        expand_more
                    </span>
                </div>

                {isOpen && (
                    <div className="absolute top-full mt-2 p-2 rounded-2xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-glass-depth z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden left-0 right-0 max-h-64 overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all mb-1 last:mb-0 ${value === opt.value ? "bg-gold-accent/10 text-gold-accent border border-gold-accent/20 shadow-gold-glow" : "text-white/40 hover:bg-white/5 hover:text-white"}`}
                            >
                                {opt.label}
                                {value === opt.value && <span className="material-symbols-outlined ml-auto text-sm">check_circle</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

function IspDetailPage({
    isp,
    onBack,
    onEditIsp,
    onNavigate,
    onLogout,
    onOpenCreateTenant,
    onOpenTenant,
    onRefreshAll,
    onEditTenant,
    onDeleteTenant,
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

    // Filtering & Sorting State for Lokasi Table
    const [tenantSearch, setTenantSearch] = useState("");
    const [tenantStatusFilter, setTenantStatusFilter] = useState("all");
    const [tenantPaketFilter, setTenantPaketFilter] = useState("all");
    const [tenantSortMethod, setTenantSortMethod] = useState("newest");

    // Filtering & Sorting State for Dokumen Table
    const [docSearch, setDocSearch] = useState("");
    const [docSortMethod, setDocSortMethod] = useState("newest");

    // Akun ISP popup state
    const [userPopupOpen, setUserPopupOpen] = useState(false);
    const [userPopupData, setUserPopupData] = useState(null);
    const [userPopupLoading, setUserPopupLoading] = useState(false);
    const [userPopupError, setUserPopupError] = useState("");
    const [userPopupFeedback, setUserPopupFeedback] = useState("");
    const [userPopupSaving, setUserPopupSaving] = useState(false);
    const [userPopupMode, setUserPopupMode] = useState("view"); // "view" | "edit"
    const [userForm, setUserForm] = useState({ username: "", email: "", password: "", displayName: "" });
    const [showPassword, setShowPassword] = useState(false);

    const openUserPopup = async () => {
        setUserPopupOpen(true);
        setUserPopupMode("view");
        setUserPopupError("");
        setUserPopupFeedback("");
        setShowPassword(false);
        setUserPopupLoading(true);
        try {
            const result = await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/user`);
            setUserPopupData(result);
            if (result?.user) {
                setUserForm({
                    username: result.user.username ?? "",
                    email: result.user.email ?? "",
                    password: "",
                    displayName: result.user.displayName ?? "",
                });
            } else {
                setUserForm({ username: "", email: "", password: "", displayName: "" });
            }
        } catch (err) {
            setUserPopupError(err instanceof Error ? err.message : "Gagal memuat data akun.");
        } finally {
            setUserPopupLoading(false);
        }
    };

    const handleSaveUserPopup = async () => {
        setUserPopupSaving(true);
        setUserPopupError("");
        setUserPopupFeedback("");
        try {
            const payload = {};
            if (userForm.username.trim()) payload.username = userForm.username.trim();
            if (userForm.email.trim()) payload.email = userForm.email.trim();
            if (userForm.password.trim()) payload.password = userForm.password.trim();
            if (userForm.displayName.trim()) payload.displayName = userForm.displayName.trim();
            const result = await fetchJson(`${API_BASE_URL}/api/isps/${isp.id}/user`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            setUserPopupData(result);
            setUserForm(f => ({ ...f, password: "" }));
            setUserPopupFeedback("Akun berhasil diperbarui.");
            setUserPopupMode("view");
            setShowPassword(false);
        } catch (err) {
            setUserPopupError(err instanceof Error ? err.message : "Gagal menyimpan akun.");
        } finally {
            setUserPopupSaving(false);
        }
    };

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

            // Timeline with focused metadata
            const events = [
                { id: `t1-${isp.id}`, date: ispResult?.createdAt || new Date().toISOString(), type: "system", title: "Registrasi ISP", description: "Entitas ISP berhasil didaftarkan ke dalam repositori sistem arsip KIMA.", icon: "how_to_reg", color: "text-emerald-400", bg: "bg-emerald-400/10" },
                { id: `t2-${isp.id}`, date: ispResult?.createdAt || new Date().toISOString(), type: "system", title: "Inisialisasi Kontrak", description: "Struktur data kontrak awal telah diverifikasi dan siap untuk pengelolaan adendum.", icon: "assignment_ind", color: "text-blue-400", bg: "bg-blue-400/10" },
            ];

            if (ispResult?.updatedAt && ispResult?.updatedAt !== ispResult?.createdAt) {
                events.unshift({ id: `t3-${isp.id}`, date: ispResult.updatedAt, type: "manual", title: "Pembaruan Profil", description: "Perubahan pada metadata profil ISP telah disinkronkan oleh administrator.", icon: "edit_note", color: "text-amber-400", bg: "bg-amber-400/10" });
            }

            setTimeline(events);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Terjadi kesalahan saat memuat detail ISP.");
        } finally {
            setIsLoading(false);
        }
    }, [isp.id]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    const allTenants = Array.isArray(detail?.tenants) ? detail.tenants : [];

    // Filtered & Sorted Tenants
    const filteredTenants = useMemo(() => {
        let result = [...allTenants];

        // 1. Search
        if (tenantSearch.trim()) {
            const query = tenantSearch.toLowerCase();
            result = result.filter(t =>
                t.name.toLowerCase().includes(query) ||
                (t.customerId && t.customerId.toLowerCase().includes(query))
            );
        }

        // 2. Status Filter
        if (tenantStatusFilter !== "all") {
            result = result.filter(t => t.status === tenantStatusFilter);
        }

        // 3. Paket Filter
        if (tenantPaketFilter !== "all") {
            result = result.filter(t => (t.paket || "").toLowerCase() === tenantPaketFilter.toLowerCase());
        }

        // 4. Sorting
        result.sort((a, b) => {
            if (tenantSortMethod === "name_asc") return a.name.localeCompare(b.name);
            if (tenantSortMethod === "name_desc") return b.name.localeCompare(a.name);
            if (tenantSortMethod === "oldest") return (a.id || 0) - (b.id || 0);
            return (b.id || 0) - (a.id || 0); // newest default
        });

        return result;
    }, [allTenants, tenantSearch, tenantStatusFilter, tenantPaketFilter, tenantSortMethod]);

    // Filtered & Sorted Documents
    const filteredDocs = useMemo(() => {
        let result = [...risalahRows];

        // 1. Search
        if (docSearch.trim()) {
            const query = docSearch.toLowerCase();
            result = result.filter(d =>
                d.fileName.toLowerCase().includes(query) ||
                d.tanggal.toLowerCase().includes(query)
            );
        }

        // 2. Sorting
        result.sort((a, b) => {
            const dateA = new Date(a.tanggal).getTime();
            const dateB = new Date(b.tanggal).getTime();
            if (docSortMethod === "oldest") return dateA - dateB;
            return dateB - dateA; // newest default
        });

        return result;
    }, [risalahRows, docSearch, docSortMethod]);

    const summary = detail?.summary ?? {};
    const ispActionItems = getIspContractActionItems(contractRows);
    const tenantActionRows = allTenants
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
                    <label className="cursor-pointer font-bold text-[10px] text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                        Upload
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, "renewal", e.target.files?.[0] ?? null)} />
                    </label>
                );
            }
            return <span className="text-[10px] font-bold text-white/20 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">Belum Ada</span>;
        }
        return (
            <div className="flex flex-col gap-3">
                {followUps.map((followUp) => {
                    const hasRenewalFile = isOpenableFileUrl(followUp?.renewalFileUrl);
                    const hasResponseFile = isOpenableFileUrl(followUp?.responseFileUrl);
                    const sourceLabel = followUp?.source === "auto" ? "Otomatis" : followUp?.source === "manual" ? "Manual" : "Unggah";
                    return (
                        <div key={followUp.id} className="px-4 py-3 rounded-xl border border-white/10 bg-black/40 min-w-[160px]">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[8px] font-bold text-gold-accent uppercase">Split {followUp.splitOrder}</span>
                                <span className="text-[8px] font-bold text-white/20 uppercase">{sourceLabel}</span>
                            </div>
                            <p className="text-[11px] font-bold text-white tracking-wide">{followUp.title}</p>
                            {columnType === "renewal" ? (
                                <div className="mt-3">
                                    {hasRenewalFile ? (
                                        <button onClick={() => openSafeFile(followUp.renewalFileUrl, followUp.renewalFileName)} className="text-gold-accent hover:text-white font-bold text-[10px] transition-colors">Buka Berkas</button>
                                    ) : (
                                        <label className="cursor-pointer font-bold text-[10px] text-white/40 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                                            Upload
                                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, "renewal", e.target.files?.[0] ?? null, followUp.id)} />
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-3">
                                    {hasResponseFile ? (
                                        <button onClick={() => openSafeFile(followUp.responseFileUrl, followUp.responseFileName)} className="text-emerald-400 hover:text-white font-bold text-[10px] transition-colors">Tanggapan</button>
                                    ) : hasRenewalFile ? (
                                        <div className="flex flex-col items-start gap-2">
                                            <label className="relative rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-400 cursor-pointer hover:bg-emerald-500 hover:text-white transition-all">Lanjut<input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "lanjut", e.target.files?.[0] ?? null, followUp.id)} /></label>
                                            <label className="relative rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/40 cursor-pointer hover:bg-white/10 hover:text-white transition-all">Tidak<input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleRespondRenewal(row.id, "tidak", e.target.files?.[0] ?? null, followUp.id)} /></label>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-bold text-white/10">Menunggu unggah</span>
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
        <div className="rounded-premium border border-white/10 bg-white/5 p-20 text-center backdrop-blur-xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 border border-white/10 shadow-2xl mb-6">
                <span className="material-symbols-outlined text-4xl text-white/20">inbox</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-widest">Belum Ada Data</h3>
            <p className="mt-2 text-sm font-bold text-white/30 tracking-widest">{message}</p>
        </div>
    );

    const handleExportToExcel = () => {
        alert("Fitur ekspor ke Excel sedang disiapkan.");
    };

    const pathAktifCount = allTenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "aktif").length;
    const pathGangguanCount = allTenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan").length;
    const pathPerbaikanCount = allTenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "perbaikan").length;

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole}>

            {/* ── POPUP AKUN ISP ─────────────────────────────────────────── */}
            {userPopupOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    onClick={() => { setUserPopupOpen(false); setShowPassword(false); setUserPopupMode("view"); }}
                >
                    <div className="absolute inset-0 bg-[#0a0f18]/80 backdrop-blur-md" />

                    <div
                        className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-glass-depth backdrop-blur-3xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Top accent */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-accent/40 to-transparent" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold-accent/20 bg-gold-accent/10 text-gold-accent">
                                    <span className="material-symbols-outlined text-lg">manage_accounts</span>
                                </div>
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">Akun Akses ISP</p>
                                    <p className="text-sm font-black text-white uppercase tracking-tight">{ispName}</p>
                                </div>
                            </div>
                            <button
                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white"
                                onClick={() => { setUserPopupOpen(false); setShowPassword(false); setUserPopupMode("view"); }}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <div className="h-px bg-white/[0.05]" />

                        {/* Body */}
                        <div className="p-6">
                            {userPopupLoading ? (
                                <div className="flex items-center justify-center py-12 gap-3 text-white/20">
                                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Memuat...</span>
                                </div>
                            ) : userPopupMode === "view" ? (
                                /* ── VIEW MODE ── */
                                <div className="space-y-4">
                                    {userPopupData?.hasUser ? (
                                        <>
                                            {/* Status */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-400">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    Akun Aktif
                                                </span>
                                            </div>

                                            {/* Info rows */}
                                            {[
                                                { label: "Username", value: userPopupData.user.username, icon: "person" },
                                                { label: "Email", value: userPopupData.user.email, icon: "alternate_email" },
                                            ].map(({ label, value, icon }) => (
                                                <div key={label} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                                    <span className="material-symbols-outlined text-[16px] text-white/20 shrink-0">{icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20 mb-0.5">{label}</p>
                                                        <p className="text-[11px] font-black text-white truncate">{value}</p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Password row */}
                                            <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                                <span className="material-symbols-outlined text-[16px] text-white/20 shrink-0">lock</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20 mb-0.5">Password</p>
                                                    <p className="text-[11px] font-black text-white tracking-widest">
                                                        {showPassword
                                                            ? (userPopupData.user.passwordPlain ?? <span className="text-white/20 italic font-normal normal-case tracking-normal">Tidak tersimpan</span>)
                                                            : "••••••••••"
                                                        }
                                                    </p>
                                                </div>
                                                <button
                                                    className="shrink-0 text-white/20 hover:text-white/60 transition-colors"
                                                    onClick={() => setShowPassword(s => !s)}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">{showPassword ? "visibility_off" : "visibility"}</span>
                                                </button>
                                            </div>

                                            {userPopupFeedback && (
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-2.5">{userPopupFeedback}</p>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                                                <span className="material-symbols-outlined text-3xl text-white/20">no_accounts</span>
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Belum ada akun terdaftar</p>
                                            <p className="text-[9px] text-white/10">Akun dibuat otomatis saat ISP didaftarkan dengan email & password.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ── EDIT MODE ── */
                                <div className="space-y-4">
                                    {[
                                        { label: "Username", key: "username", icon: "person", type: "text", placeholder: "username_isp" },
                                        { label: "Email", key: "email", icon: "alternate_email", type: "email", placeholder: "email@isp.com" },
                                    ].map(({ label, key, icon, type, placeholder }) => (
                                        <div key={key} className="space-y-1.5">
                                            <label className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">{label}</label>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-white/20 group-focus-within:text-gold-accent transition-colors pointer-events-none">{icon}</span>
                                                <input
                                                    className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.02] pl-10 pr-4 text-[11px] font-black text-white outline-none transition-all focus:border-gold-accent/40 focus:bg-white/[0.04] placeholder:text-white/10"
                                                    onChange={e => setUserForm(f => ({ ...f, [key]: e.target.value }))}
                                                    placeholder={placeholder}
                                                    type={type}
                                                    value={userForm[key]}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Password Baru <span className="text-white/10 normal-case font-normal">(kosongkan jika tidak diubah)</span></label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-white/20 group-focus-within:text-gold-accent transition-colors pointer-events-none">lock</span>
                                            <input
                                                className="w-full h-11 rounded-xl border border-white/[0.06] bg-white/[0.02] pl-10 pr-10 text-[11px] font-black text-white outline-none transition-all focus:border-gold-accent/40 focus:bg-white/[0.04] placeholder:text-white/10"
                                                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                                                placeholder="••••••••"
                                                type={showPassword ? "text" : "password"}
                                                value={userForm.password}
                                            />
                                            <button
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                                                onClick={() => setShowPassword(s => !s)}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">{showPassword ? "visibility_off" : "visibility"}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {userPopupError && (
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#ff2400] bg-[#ff2400]/5 border border-[#ff2400]/20 rounded-xl px-4 py-2.5">{userPopupError}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {!userPopupLoading && (
                            <>
                                <div className="h-px bg-white/[0.05]" />
                                <div className="flex items-center justify-between gap-2 px-6 py-4">
                                    {userPopupMode === "view" ? (
                                        <>
                                            <button
                                                className="h-9 px-4 rounded-xl border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                                onClick={() => { setUserPopupOpen(false); setShowPassword(false); }}
                                                type="button"
                                            >
                                                Tutup
                                            </button>
                                            {userPopupData?.hasUser && (
                                                <button
                                                    className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-gold-accent/20 bg-gold-accent/10 text-[9px] font-black uppercase tracking-widest text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition-all"
                                                    onClick={() => { setUserPopupMode("edit"); setUserPopupFeedback(""); setUserPopupError(""); setShowPassword(false); }}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-[13px]">edit_note</span>
                                                    Edit Akun
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="h-9 px-4 rounded-xl border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                                onClick={() => { setUserPopupMode("view"); setUserPopupError(""); setShowPassword(false); }}
                                                type="button"
                                            >
                                                Batal
                                            </button>
                                            <button
                                                className="h-9 px-5 rounded-xl bg-gold-accent text-[9px] font-black uppercase tracking-widest text-[#0f141e] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-gold-glow"
                                                disabled={userPopupSaving}
                                                onClick={() => void handleSaveUserPopup()}
                                                type="button"
                                            >
                                                {userPopupSaving ? "Menyimpan..." : "Simpan"}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* Background Decorative Blobs */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-gold-accent/5 blur-[120px]" />
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-[#ff2400]/5 blur-[100px]" />
            </div>

            <div className="space-y-8 pb-20 pt-2 md:pt-4">
                {/* 1. HEADER SECTION (PROFILE) */}
                <header className="px-4 lg:px-6">
                    <div className="flex flex-col gap-10">
                        {/* Top Bar: Back & Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    className="inline-flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-gold-accent transition-all group"
                                    onClick={onBack}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base transition-transform group-hover:-translate-x-1">arrow_back</span>
                                    Kembali ke Workspace
                                </button>
                                <div className="h-3 w-px bg-white/10" />
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${['aktif', 'expired'].includes(detail?.status ?? isp.status) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${['aktif', 'expired'].includes(detail?.status ?? isp.status) ? 'bg-emerald-400 shadow-emerald-glow animate-pulse' : 'bg-white/20'}`} />
                                    <span className="text-[9px] font-bold tracking-widest">{['aktif', 'expired'].includes(detail?.status ?? isp.status) ? "Beroperasi" : "Berhenti"}</span>
                                </div>
                            </div>

                            {!isTeknisi && (
                                <div className="flex items-center gap-2">
                                    <button
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-sm group"
                                        onClick={() => void loadDetail()}
                                        title="Refresh Data"
                                    >
                                        <span className="material-symbols-outlined text-lg group-hover:rotate-180 transition-transform duration-500">sync</span>
                                    </button>
                                    {/* Tombol Akun ISP */}
                                    <button
                                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm text-[9px] font-black uppercase tracking-widest"
                                        onClick={() => void openUserPopup()}
                                        title="Lihat / Edit Akun ISP"
                                    >
                                        <span className="material-symbols-outlined text-base">manage_accounts</span>
                                        Akun
                                    </button>
                                    {canEditIsp && (
                                        <button
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                            onClick={() => onEditIsp?.(detail ?? isp)}
                                            title="Edit ISP"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit_note</span>
                                        </button>
                                    )}
                                    {canDeleteIsp && (
                                        <button
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm"
                                            onClick={handleDeleteIsp}
                                            title="Hapus ISP"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete_forever</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Main Info */}
                        <div className="space-y-6">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                                {ispName}
                            </h1>

                            {/* Integrated Metadata Strip (No Cards) */}
                            <div className="flex flex-wrap items-center gap-x-12 gap-y-4">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Pendaftaran Awal</p>
                                    <p className="text-sm font-bold text-white/80">{formatDate(detail?.contractStartDate ?? isp.contractStartDate)}</p>
                                </div>
                                <div className="w-px h-6 bg-white/5 hidden md:block" />
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">No. Kontrak Berjalan</p>
                                    <p className="text-sm font-bold text-gold-accent italic tracking-tight">{contractRef}</p>
                                </div>
                                <div className="w-px h-6 bg-white/5 hidden md:block" />
                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Masa Berlaku</p>
                                    <p className="text-sm font-bold text-white/80 tracking-tight">
                                        {formatDate(detail?.contractPeriodStart ?? isp.contractPeriodStart)}
                                        <span className="mx-2 text-white/20 font-normal">sampai</span>
                                        {formatDate(detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 2. TABS NAVIGATION */}
                <section className="glass-card rounded-premium p-1.5 border-white/10 shadow-glass-depth relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
                    <nav className="relative flex flex-wrap gap-2">
                        {[
                            { id: "overview", label: "Ringkasan", icon: "dashboard" },
                            { id: "customers", label: "Daftar Lokasi", icon: "groups" },
                            { id: "jalur", label: "Peta Jalur", icon: "map" },
                            ...(currentRole !== "teknisi" ? [
                                { id: "contracts", label: "Kontrak", icon: "description" },
                                { id: "risalah", label: "Dokumen", icon: "inventory_2" },
                                { id: "timeline", label: "Timeline", icon: "history" }
                            ] : []),
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-bold tracking-[0.1em] transition-all duration-500 relative overflow-hidden ${activeTab === tab.id ? "text-white shadow-gold-glow" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
                                onClick={() => setActiveTab(tab.id)}
                                type="button"
                            >
                                {activeTab === tab.id && <div className="absolute inset-0 bg-gold-gradient animate-shimmer" />}
                                <span className={`material-symbols-outlined text-xl relative z-10 ${activeTab === tab.id ? "scale-110" : ""}`}>{tab.icon}</span>
                                <span className="relative z-10">{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </section>

                {/* 3. CONTENT AREA */}
                {isLoading ? (
                    <div className="rounded-premium bg-white/5 border border-white/10 p-32 text-center space-y-6 backdrop-blur-xl shadow-glass-depth">
                        <div className="relative w-20 h-20 mx-auto">
                            <div className="absolute inset-0 border-4 border-gold-accent/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-gold-accent rounded-full animate-spin"></div>
                        </div>
                        <p className="text-[10px] font-bold text-gold-accent animate-pulse">Menyelaraskan Detail ISP</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {error && (
                            <div className="rounded-premium bg-[#ff2400]/10 border border-[#ff2400]/20 p-6 flex items-center gap-4 mb-8">
                                <span className="material-symbols-outlined text-[#ff2400] text-3xl">report</span>
                                <p className="text-xs font-bold text-white/80">{error}</p>
                            </div>
                        )}

                        {activeTab === "overview" && (
                            <div className="space-y-10">
                                {/* Stats Cards */}
                                <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    <StatCard label="Total Lokasi" value={summary.tenantCount ?? allTenants.length} icon="groups" accent="gold" />
                                    <StatCard label="Lokasi Beroperasi" value={allTenants.filter(t => t.status === "aktif" || t.status === "expired").length} icon="check_circle" accent="gold" />

                                    {/* Custom Informai Jalur Card */}
                                    <div className="glass-card rounded-premium p-6 border-white/20 group hover:border-gold-accent/40 transition-all duration-500">
                                        <div className="flex justify-between items-start mb-4">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant group-hover:text-gold-accent transition-colors">Informasi Jalur</p>
                                            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 shadow-sm group-hover:shadow-blue-glow transition-all">
                                                <span className="material-symbols-outlined text-xl">lan</span>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-white/40">Aktif</span>
                                                <span className="text-lg font-black text-emerald-400">{pathAktifCount}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-white/40">Gangguan</span>
                                                <span className="text-lg font-black text-[#ff2400]">{pathGangguanCount}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-white/40">Perbaikan</span>
                                                <span className="text-lg font-black text-amber-400">{pathPerbaikanCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="grid grid-cols-1 gap-10 lg:grid-cols-3">
                                    {/* Action Items List - Separated ISP & Lokasi */}
                                    <div className="lg:col-span-2 space-y-10">
                                        {/* 1. Tindak Lanjut ISP */}
                                        <div className="glass-card rounded-premium p-8 border-white/10 shadow-glass-depth relative overflow-hidden group/isp-actions">
                                            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-accent/5 blur-3xl transition-all duration-700 group-hover/isp-actions:bg-gold-accent/10" />

                                            <h3 className="text-xl font-bold text-white tracking-widest mb-8 flex items-center gap-4">
                                                <span className="material-symbols-outlined text-gold-accent">admin_panel_settings</span>
                                                Tindak Lanjut ISP
                                            </h3>

                                            <div className="space-y-4 relative z-10">
                                                {ispActionItems.length === 0 ? (
                                                    <p className="text-xs font-bold text-white/20 italic p-8 text-center border border-dashed border-white/10 rounded-2xl">Tidak ada tindak lanjut administrasi ISP.</p>
                                                ) : (
                                                    ispActionItems.map((item) => {
                                                        const toneMap = {
                                                            red: "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]",
                                                            blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
                                                            amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                                            orange: "bg-orange-500/10 border-orange-500/20 text-orange-400"
                                                        };
                                                        const toneStyle = toneMap[item.tone] || toneMap.orange;

                                                        return (
                                                            <div key={item.key} className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl p-6 border transition-all hover:scale-[1.01] hover:shadow-2xl ${toneStyle}`}>
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="material-symbols-outlined text-lg">contract_edit</span>
                                                                        <h4 className="text-sm font-bold">{item.title}</h4>
                                                                    </div>
                                                                    <p className="text-[11px] font-bold opacity-70 leading-relaxed max-w-xl">{item.description}</p>
                                                                </div>
                                                                <span className="text-[9px] font-bold bg-white/10 px-4 py-1.5 rounded-full border border-white/10">Tindakan Admin</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Tindak Lanjut Lokasi */}
                                        <div className="glass-card rounded-premium p-8 border-white/10 shadow-glass-depth relative overflow-hidden group/lokasi-actions">
                                            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ff2400]/5 blur-3xl transition-all duration-700 group-hover/lokasi-actions:bg-[#ff2400]/10" />

                                            <h3 className="text-xl font-bold text-white tracking-widest mb-8 flex items-center gap-4">
                                                <span className="material-symbols-outlined text-[#ff2400]">location_away</span>
                                                Tindak Lanjut Lokasi
                                            </h3>

                                            <div className="space-y-4 relative z-10">
                                                {(() => {
                                                    const pathIssues = allTenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan");
                                                    const issues = [...pathIssues, ...tenantActionRows.filter(t => !pathIssues.find(p => p.id === t.id))];

                                                    if (issues.length === 0) {
                                                        return <p className="text-xs font-bold text-white/20 italic p-8 text-center border border-dashed border-white/10 rounded-2xl">Seluruh lokasi terpantau normal.</p>;
                                                    }

                                                    return issues.map((t) => {
                                                        const isGangguan = (t.route?.activeFlowStatus ?? t.status_jalur) === "gangguan";
                                                        return (
                                                            <div
                                                                key={`loc-${t.id}`}
                                                                className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl p-6 border transition-all hover:scale-[1.01] hover:shadow-2xl cursor-pointer ${isGangguan ? "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]" : "bg-white/5 border-white/10 text-white/80"}`}
                                                                onClick={() => onOpenTenant(t, isGangguan ? "jalur" : "overview")}
                                                            >
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="material-symbols-outlined text-lg">{isGangguan ? "router" : "warning"}</span>
                                                                        <h4 className="text-sm font-bold">{t.name}</h4>
                                                                    </div>
                                                                    <p className="text-[11px] font-bold opacity-70">
                                                                        {isGangguan ? "Terdeteksi gangguan jalur fiber optik." : `Terdapat ${t.totalActions || 1} rincian berkas yang perlu dilengkapi.`}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[9px] font-bold bg-white/10 px-4 py-1.5 rounded-full border border-white/10">Buka Lokasi</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sidebar Stats - Updated */}
                                    <div className="space-y-8">
                                        <div className="glass-card rounded-premium p-8 border-white/10 shadow-glass-depth bg-white/[0.02]">
                                            <h3 className="text-lg font-bold text-white tracking-widest mb-8">Ringkasan Tindak Lanjut</h3>
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-white/30 tracking-widest">Tindak Lanjut ISP</p>
                                                        <p className="text-2xl font-bold text-gold-accent">{ispActionItems.length}</p>
                                                    </div>
                                                    <span className="material-symbols-outlined text-gold-accent/40 text-3xl">admin_panel_settings</span>
                                                </div>

                                                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/10">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-white/30 tracking-widest">Tindak Lanjut Lokasi</p>
                                                        <p className="text-2xl font-bold text-[#ff2400]">{totalTenantActionCount}</p>
                                                    </div>
                                                    <span className="material-symbols-outlined text-[#ff2400]/40 text-3xl">location_on</span>
                                                </div>

                                            </div>
                                        </div>

                                        <div className="glass-card rounded-premium p-8 border-white/10 shadow-glass-depth">
                                            <h3 className="text-lg font-bold text-white tracking-widest mb-8 flex items-center gap-3">
                                                <span className="material-symbols-outlined text-blue-400">history</span>
                                                Aktivitas Terkini
                                            </h3>
                                            <div className="space-y-6">
                                                {timeline.slice(0, 3).map((e) => (
                                                    <div key={e.id} className="flex gap-4 relative group/history">
                                                        <div className={`w-8 h-8 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${e.color} group-hover/history:scale-110 transition-all`}>
                                                            <span className="material-symbols-outlined text-base">{e.icon}</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-white tracking-tight">{e.title}</p>
                                                            <p className="text-[9px] font-bold text-white/20 mt-1 leading-relaxed">{e.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === "customers" && (
                            <section className="glass-card rounded-premium p-10 border-white/10 shadow-glass-depth">
                                <div className="mb-6 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
                                    <div className="space-y-4 flex-1">
                                        <div className="space-y-2">
                                            <h2 className="text-2xl font-black text-white tracking-widest uppercase">Inventori Lokasi</h2>
                                            <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Manajemen titik layanan dan status operasional</p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 shadow-sm">
                                                <span className="text-[10px] font-bold text-white/40 tracking-widest">Total:</span>
                                                <span className="text-sm font-bold text-white">{allTenants.length}</span>
                                            </div>
                                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                                                <span className="text-[10px] font-bold text-emerald-400 tracking-widest">Beroperasi:</span>
                                                <span className="text-sm font-bold text-emerald-400">{allTenants.filter(t => t.status === "aktif").length}</span>
                                            </div>
                                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#ff2400]/10 border border-[#ff2400]/20 shadow-sm">
                                                <span className="text-[10px] font-bold text-[#ff2400] tracking-widest">Belum Diperpanjang:</span>
                                                <span className="text-sm font-bold text-[#ff2400]">{allTenants.filter(t => t.status === "expired").length}</span>
                                            </div>
                                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 shadow-sm">
                                                <span className="text-[10px] font-bold text-white/20 tracking-widest">Berhenti:</span>
                                                <span className="text-sm font-bold text-white/40">{allTenants.filter(t => t.status === "berhenti").length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isTeknisi && (
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                className="h-12 px-6 rounded-xl bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                                                onClick={handleExportToExcel}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-lg">description</span>
                                                Ekspor Excel
                                            </button>
                                            {canCreateTenant && (
                                                <button
                                                    className="h-12 px-8 rounded-xl bg-gold-gradient text-white text-[10px] font-bold uppercase tracking-[0.1em] shadow-gold-glow active:scale-95 transition-all flex items-center gap-2"
                                                    onClick={() => onOpenCreateTenant?.(detail ?? isp)}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined text-lg">add_location</span>
                                                    Tambah Lokasi
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ══════ REFINED FILTER PANEL ══════ */}
                                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-2xl bg-black/20 border border-white/5 shadow-inner-glass relative z-50">
                                    {/* 1. Search */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] pl-1 text-gold-accent/40">Cari Lokasi</p>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-all text-xl">search</span>
                                            <input
                                                type="text"
                                                placeholder="Nama atau ID Lokasi..."
                                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-black/20 border border-white/10 text-sm font-bold text-white outline-none focus:border-gold-accent/40 focus:bg-black/40 transition-all shadow-inner-glass"
                                                value={tenantSearch}
                                                onChange={(e) => setTenantSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* 2. Status Kontrak */}
                                    <GlassCustomSelect
                                        label="Status Kontrak"
                                        icon="verified_user"
                                        value={tenantStatusFilter}
                                        onChange={setTenantStatusFilter}
                                        options={[
                                            { value: "all", label: "SEMUA STATUS" },
                                            { value: "aktif", label: "BEROPERASI" },
                                            { value: "expired", label: "BELUM DIPERPANJANG" },
                                            { value: "berhenti", label: "BERHENTI" }
                                        ]}
                                    />

                                    {/* 3. Paket */}
                                    <GlassCustomSelect
                                        label="Jenis Paket"
                                        icon="inventory_2"
                                        value={tenantPaketFilter}
                                        onChange={setTenantPaketFilter}
                                        options={[
                                            { value: "all", label: "SEMUA PAKET" },
                                            { value: "core", label: "CORE" },
                                            { value: "shared", label: "SHARED" }
                                        ]}
                                    />

                                    {/* 4. Sorting */}
                                    <GlassCustomSelect
                                        label="Urutkan"
                                        icon="sort"
                                        value={tenantSortMethod}
                                        onChange={setTenantSortMethod}
                                        options={[
                                            { value: "newest", label: "TERBARU" },
                                            { value: "oldest", label: "TERLAMA" },
                                            { value: "name_asc", label: "NAMA A-Z" },
                                            { value: "name_desc", label: "NAMA Z-A" }
                                        ]}
                                    />
                                </div>

                                {filteredTenants.length === 0 ? renderEmptyState("Tidak ada lokasi yang cocok dengan filter.") : (
                                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 custom-scrollbar">
                                        <table className="min-w-full border-collapse whitespace-nowrap">
                                            <thead>
                                                <tr className="bg-white/5">
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">No</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-gold-accent">Lokasi</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Status Kontrak</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Status Jalur</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Periode Awal</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Kontrak Berjalan</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Paket</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Jumlah</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Tindak Lanjut</th>
                                                    <th className="px-6 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {filteredTenants.map((tenant, idx) => (
                                                    <tr key={tenant.id} className="hover:bg-white/[0.04] transition-colors group/row">
                                                        <td className="px-6 py-6 text-sm font-bold text-white/20">{String(idx + 1).padStart(2, '0')}</td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-sm font-bold text-white group-hover/row:text-gold-accent transition-colors">{tenant.name}</p>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-bold border transition-all ${['aktif'].includes(tenant.status) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : tenant.status === 'expired' ? 'bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${['aktif'].includes(tenant.status) ? 'bg-emerald-400 shadow-emerald-glow' : tenant.status === 'expired' ? 'bg-[#ff2400] shadow-red-glow' : 'bg-white/20'}`} />
                                                                {tenant.status === 'aktif' ? "Beroperasi" : tenant.status === 'expired' ? "Belum Diperpanjang" : "Berhenti"}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            {(() => {
                                                                const routeStatus = tenant.route?.activeFlowStatus ?? tenant.status_jalur;
                                                                const colors = {
                                                                    aktif: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                                                    gangguan: "bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20",
                                                                    nonaktif: "bg-white/5 text-white/30 border-white/10",
                                                                };
                                                                const color = colors[routeStatus] || colors.nonaktif;
                                                                return (
                                                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-bold border ${color}`}>
                                                                        {routeStatus === 'aktif' ? "Aktif" : routeStatus === 'gangguan' ? "Gangguan" : "Nonaktif"}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-[11px] font-bold text-white/60 uppercase">{formatDate(tenant.contractStartDate)}</p>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-[11px] font-bold text-white/60 italic tracking-tighter">
                                                                {formatDate(tenant.contractPeriodStart)} - {formatDate(tenant.contractPeriodEnd)}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-xs font-bold text-white/70 tracking-widest">{tenant.paket || '-'}</p>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-xs font-bold text-white/70 tracking-widest">{tenant.contractSharingRatio ?? tenant.jumlah ?? '-'}</p>
                                                        </td>
                                                        <td className="px-6 py-6 text-sm font-bold text-[#ff2400]">
                                                            {isTeknisi ? (
                                                                (!tenant.route && tenant.status === "aktif") || (tenant.route?.activeFlowStatus ?? tenant.status_jalur) === "gangguan" ? "YA" : "-"
                                                            ) : (tenant.todoSummary?.counts?.priority ?? 0)}
                                                        </td>
                                                        <td className="px-6 py-6 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                {!isTeknisi && (
                                                                    <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" onClick={() => onOpenTenant(tenant, "invoices")} title="Invoice">
                                                                        <span className="material-symbols-outlined text-lg">receipt_long</span>
                                                                    </button>
                                                                )}
                                                                <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all shadow-sm" onClick={() => onOpenTenant(tenant, isTeknisi ? "jalur" : "overview")} title="Detail">
                                                                    <span className="material-symbols-outlined text-lg">visibility</span>
                                                                </button>
                                                                {!isTeknisi && canEditTenant && (
                                                                    <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm" onClick={() => onEditTenant?.(tenant)} title="Edit">
                                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                                    </button>
                                                                )}
                                                                {!isTeknisi && canDeleteTenant && (
                                                                    <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#ff2400]/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm" onClick={() => onDeleteTenant?.(tenant)} title="Hapus">
                                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                                    </button>
                                                                )}
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

                        {activeTab === "jalur" && (
                            <section className="glass-card rounded-premium p-20 flex flex-col items-center justify-center border-white/10 shadow-glass-depth">
                                <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 mb-8">
                                    <span className="material-symbols-outlined text-5xl">map</span>
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-widest">Peta Jalur Lokasi</h2>
                                <p className="mt-3 text-sm font-bold text-white/30 max-w-md text-center leading-relaxed">Fitur visualisasi peta untuk memantau topologi jalur semua lokasi di bawah ISP ini sedang dalam tahap pengembangan.</p>
                            </section>
                        )}

                        {activeTab === "contracts" && (
                            <section className="glass-card rounded-premium p-10 border-white/10 shadow-glass-depth">
                                {/* Enhanced Header - Matching Dokumen Style */}
                                <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">Rincian Kontrak & Adendum</h2>
                                        <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Manajemen berkas legal dan amandemen layanan</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 custom-scrollbar">
                                    <table className="min-w-full border-collapse whitespace-nowrap">
                                        <thead>
                                            <tr className="bg-white/5 border-b border-white/5">
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-r border-white/5">No</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-gold-accent border-r border-white/5">Nomor Kontrak</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-r border-white/5">Berkas Kontrak</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-r border-white/5">Periode Awal Kontrak</th>
                                                <th colSpan="2" className="px-6 py-3 text-center text-[9px] font-black tracking-[0.4em] text-white/30 uppercase border-b border-white/5">Periode Berjalan</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-l border-white/5">BAK</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-l border-white/5">Perpanjangan</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-l border-white/5">Tanggapan</th>
                                                <th rowSpan="2" className="px-6 py-5 text-center text-[10px] font-bold tracking-[0.3em] text-white/40 border-l border-white/5">Aksi</th>
                                            </tr>
                                            <tr className="bg-white/5">
                                                <th className="px-6 py-3 text-center text-[8px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/5">Awal</th>
                                                <th className="px-6 py-3 text-center text-[8px] font-black tracking-[0.2em] text-white/20 uppercase">Akhir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {contractRows.map((row, idx) => (
                                                <tr key={row.id} className={`${editingRow?.id === row.id ? 'bg-gold-accent/5' : 'hover:bg-white/[0.02] transition-colors'}`}>
                                                    <td className="px-6 py-6 text-sm font-bold text-white/20 border-r border-white/5">{String(idx + 1).padStart(2, '0')}</td>
                                                    <td className="px-6 py-6 border-r border-white/5">
                                                        {editingRow?.id === row.id ? (
                                                            <input type="text" className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-bold text-white outline-none focus:border-gold-accent transition-all" value={editingRow.contractReference || ""} onChange={(e) => setEditingRow({ ...editingRow, contractReference: e.target.value })} />
                                                        ) : <span className="text-sm font-bold text-white">{row.contractReference || "-"}</span>}
                                                    </td>
                                                    <td className="px-6 py-6 border-r border-white/5">
                                                        {isOpenableFileUrl(row.contractFileUrl) ? (
                                                            <button onClick={() => openSafeFile(row.contractFileUrl, row.contractFileName)} className="inline-flex items-center gap-2 text-gold-accent hover:text-white font-bold text-[10px] bg-gold-accent/10 border border-gold-accent/20 px-3 py-1.5 rounded-lg transition-all"><span className="material-symbols-outlined text-sm">description</span>Buka</button>
                                                        ) : <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-[10px] text-white/30 bg-white/5 border border-white/10 border-dashed px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all"><span className="material-symbols-outlined text-sm">upload</span>Upload<input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'contract', e.target.files[0])} /></label>}
                                                    </td>
                                                    <td className="px-6 py-6 border-r border-white/5 text-center">
                                                        <span className="text-sm font-bold text-white/60">{formatDate(detail?.contractStartDate ?? isp.contractStartDate)}</span>
                                                    </td>
                                                    <td className="px-6 py-6 text-center border-r border-white/5">
                                                        {editingRow?.id === row.id ? (
                                                            <input type="date" className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs text-white outline-none w-32" value={editingRow.periodStart || ""} onChange={(e) => setEditingRow({ ...editingRow, periodStart: e.target.value })} />
                                                        ) : <span className="text-sm font-bold text-white">{formatDate(row.periodStart)}</span>}
                                                    </td>
                                                    <td className="px-6 py-6 text-center border-r border-white/5">
                                                        {editingRow?.id === row.id ? (
                                                            <input type="date" className="rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs text-white outline-none w-32" value={editingRow.periodEnd || ""} onChange={(e) => setEditingRow({ ...editingRow, periodEnd: e.target.value })} />
                                                        ) : <span className="text-sm font-bold text-gold-accent italic">{formatDate(row.periodEnd)}</span>}
                                                    </td>
                                                    <td className="px-6 py-6 border-r border-white/5">
                                                        {isOpenableFileUrl(row.bakFileUrl) ? (
                                                            <button onClick={() => openSafeFile(row.bakFileUrl, row.bakFileName)} className="inline-flex items-center gap-2 text-emerald-400 hover:text-white font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"><span className="material-symbols-outlined text-sm">task_alt</span>Buka BAK</button>
                                                        ) : <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-[10px] text-white/20 border border-white/10 border-dashed px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">Upload BAK<input type="file" className="hidden" onChange={(e) => handleFileUpload(row.id, 'bak', e.target.files[0])} /></label>}
                                                    </td>
                                                    <td className="px-6 py-6 min-w-[280px] border-r border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            {renderRenewalFollowUps(row, "renewal")}
                                                            <button className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 transition-all hover:bg-white/10 disabled:opacity-30" disabled={!hasInitialRenewalUpload(row)} onClick={() => handleAddRenewalSplit(row.id)} type="button">
                                                                <span className="material-symbols-outlined text-sm">add_circle</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 min-w-[240px] border-r border-white/5">{renderRenewalFollowUps(row, "response")}</td>
                                                    <td className="px-6 py-6 text-right">
                                                        {editingRow?.id === row.id ? (
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
                                                                    onClick={() => handleUpdateRow(row.id, { contractReference: editingRow.contractReference, periodStart: editingRow.periodStart, periodEnd: editingRow.periodEnd })}
                                                                    title="Simpan"
                                                                >
                                                                    <span className="material-symbols-outlined text-base">check</span>
                                                                </button>
                                                                <button
                                                                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all"
                                                                    onClick={() => setEditingRow(null)}
                                                                    title="Batal"
                                                                >
                                                                    <span className="material-symbols-outlined text-base">close</span>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gold-accent hover:bg-gold-accent hover:text-white transition-all shadow-sm"
                                                                onClick={() => setEditingRow({ ...row })}
                                                                type="button"
                                                                title="Edit Baris"
                                                            >
                                                                <span className="material-symbols-outlined text-base">edit_note</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {contractRows.length === 0 && (<tr><td colSpan="8" className="py-20 text-center text-white/20 font-bold italic">Belum ada rincian kontrak.</td></tr>)}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {activeTab === "risalah" && (
                            <section className="glass-card rounded-premium p-10 border-white/10 shadow-glass-depth">
                                {/* Enhanced Header with Search & Sort */}
                                <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">Dokumen Pendukung</h2>
                                        <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Arsip risalah rapat dan dokumen administratif</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4">
                                        {/* Search Bar */}
                                        <div className="relative group min-w-[280px]">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors">search</span>
                                            <input
                                                type="text"
                                                placeholder="Cari dokumen..."
                                                value={docSearch}
                                                onChange={(e) => setDocSearch(e.target.value)}
                                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-black/20 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-gold-accent/50 focus:bg-black/40 transition-all placeholder:text-white/10 shadow-inner-glass"
                                            />
                                        </div>

                                        {/* Sort Dropdown */}
                                        <div className="w-48">
                                            <GlassCustomSelect
                                                value={docSortMethod}
                                                onChange={setDocSortMethod}
                                                icon="sort"
                                                options={[
                                                    { value: "newest", label: "Terbaru" },
                                                    { value: "oldest", label: "Terlama" }
                                                ]}
                                            />
                                        </div>

                                        <div className="w-px h-10 bg-white/5 mx-2 hidden lg:block" />

                                        <button
                                            className="rounded-xl bg-gold-gradient px-8 h-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white shadow-gold-glow active:scale-95 transition-all"
                                            onClick={handleAddRisalah}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-lg">add_circle</span>
                                            Tambah Dokumen
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-3xl border border-white/5 bg-black/20 backdrop-blur-3xl shadow-2xl custom-scrollbar">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                                <th className="px-8 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">No</th>
                                                <th className="px-8 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Tanggal</th>
                                                <th className="px-8 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Nama Dokumen</th>
                                                <th className="px-8 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Berkas</th>
                                                <th className="px-8 py-6 text-center text-[10px] font-bold tracking-[0.3em] text-white/40">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredDocs.map((row, idx) => (
                                                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group/row">
                                                    <td className="px-8 py-6 text-sm font-bold text-white/20">{String(idx + 1).padStart(2, '0')}</td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-sm font-bold text-white">{formatDate(row.tanggal)}</span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <p className="text-sm font-bold text-white/70 tracking-wide">{row.fileName || "N/A"}</p>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        {isOpenableFileUrl(row.fileUrl) ? (
                                                            <button onClick={() => openSafeFile(row.fileUrl, row.fileName)} className="inline-flex items-center gap-2 text-emerald-400 hover:text-white font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"><span className="material-symbols-outlined text-sm">description</span>Buka Berkas</button>
                                                        ) : <span className="text-[10px] font-bold text-white/20">Kosong</span>}
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex justify-end gap-3 transition-opacity duration-300">
                                                            <button
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gold-accent hover:bg-gold-accent hover:text-white transition-all shadow-sm"
                                                                onClick={() => handleEditRisalah(row)}
                                                                title="Edit Dokumen"
                                                            >
                                                                <span className="material-symbols-outlined text-base">edit_note</span>
                                                            </button>
                                                            <button
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm"
                                                                onClick={() => handleDeleteRisalah(row.id)}
                                                                title="Hapus Dokumen"
                                                            >
                                                                <span className="material-symbols-outlined text-base">delete_forever</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredDocs.length === 0 && (<tr><td colSpan="5" className="py-20 text-center text-white/20 font-bold italic">Tidak ada dokumen ditemukan.</td></tr>)}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {risalahEditor && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-md bg-black/60">
                                <div className="w-full max-w-lg rounded-[2.5rem] glass-card p-10 border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 blur-3xl" />

                                    <div className="mb-10 flex items-center justify-between relative z-10">
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-white tracking-widest uppercase">
                                                {risalahEditor.id ? "Edit Dokumen" : "Tambah Dokumen"}
                                            </h3>
                                            <p className="text-[9px] font-bold text-gold-accent/40 tracking-[0.3em] uppercase">Arsip Administratif ISP</p>
                                        </div>
                                        <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:bg-[#ff2400]/10 hover:border-[#ff2400]/40 hover:text-[#ff2400] transition-all duration-300 shadow-sm" onClick={() => setRisalahEditor(null)} type="button">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    <div className="space-y-8 relative z-10">
                                        {/* Nama Dokumen */}
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Nama Dokumen</label>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors">edit_note</span>
                                                <input
                                                    className="w-full rounded-2xl bg-black/40 border border-white/10 pl-12 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-gold-accent/50 transition-all placeholder:text-white/10"
                                                    onChange={(e) => setRisalahEditor(p => p ? { ...p, fileName: e.target.value } : p)}
                                                    type="text"
                                                    value={risalahEditor.fileName}
                                                    placeholder="Contoh: Risalah Meeting 2026"
                                                />
                                            </div>
                                        </div>

                                        {/* Unggah Berkas */}
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Unggah Berkas</label>
                                            <div className="relative group">
                                                <div className="absolute inset-0 rounded-2xl bg-white/5 border border-white/10 border-dashed pointer-events-none group-hover:bg-white/10 group-hover:border-gold-accent/40 transition-all" />
                                                <input
                                                    className="w-full text-[10px] text-white/40 file:mr-4 file:py-4 file:px-6 file:rounded-l-2xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-gold-accent/10 file:text-gold-accent hover:file:bg-gold-accent/20 transition-all cursor-pointer relative z-10"
                                                    onChange={(e) => handleRisalahEditorFileChange(e.target.files?.[0] ?? null)}
                                                    type="file"
                                                />
                                            </div>
                                        </div>

                                        {/* Tanggal Rapat */}
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/40 ml-1">Tanggal Dokumen</label>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gold-accent shadow-gold-glow-sm z-10">calendar_month</span>
                                                <input
                                                    className="w-full rounded-2xl bg-black/40 border border-white/10 pl-12 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-gold-accent transition-all appearance-none"
                                                    onChange={(e) => setRisalahEditor(p => p ? { ...p, tanggal: e.target.value } : p)}
                                                    type="date"
                                                    value={risalahEditor.tanggal}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-12 flex justify-end gap-4 relative z-10">
                                        <button className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all" onClick={() => setRisalahEditor(null)} type="button">Batal</button>
                                        <button className="rounded-2xl bg-gold-gradient px-12 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-gold-glow active:scale-95 transition-all" onClick={handleSaveRisalah} type="button">Simpan Dokumen</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "timeline" && (
                            <section className="glass-card rounded-premium p-10 border-white/10 shadow-glass-depth">
                                {/* Enhanced Header - Matching Dokumen Style */}
                                <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">Timeline Aktivitas</h2>
                                        <p className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">Jejak audit dan riwayat perubahan sistem</p>
                                    </div>
                                </div>

                                {timeline.length === 0 ? renderEmptyState("Belum ada aktivitas terekam.") : (
                                    <div className="relative">
                                        {/* Vertical line - Balanced Gradient */}
                                        <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-gold-accent/40 via-white/5 to-transparent rounded-full" />

                                        <div className="space-y-8 relative z-10">
                                            {timeline.map((e, idx) => (
                                                <div key={e.id} className="flex gap-6 group/t-item">
                                                    {/* Proportional Marker */}
                                                    <div className="relative shrink-0 mt-0.5">
                                                        <div className={`w-10 h-10 rounded-xl ${e.bg} border border-white/10 flex items-center justify-center ${e.color} shadow-lg group-hover/t-item:scale-110 group-hover/t-item:shadow-gold-glow transition-all duration-500`}>
                                                            <span className="material-symbols-outlined text-lg">{e.icon}</span>
                                                        </div>
                                                        {idx !== timeline.length - 1 && (
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-8 bg-white/5" />
                                                        )}
                                                    </div>

                                                    {/* Compact Content */}
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between gap-6 mb-1 pr-1">
                                                            <div className="space-y-0.5">
                                                                <h4 className="text-sm font-black text-white group-hover/t-item:text-gold-accent transition-colors duration-500 tracking-tight uppercase">{e.title}</h4>
                                                                <span className={`inline-block text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 ${e.color}`}>{e.type}</span>
                                                            </div>

                                                            {/* Compact Right Aligned Date/Time */}
                                                            <div className="flex items-center gap-2 text-[9px] font-black tracking-widest">
                                                                <span className="text-white/30 uppercase">{new Date(e.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}</span>
                                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                                                <span className="text-gold-accent/60">{new Date(e.date).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>

                                                        {/* ULTRA DARK GLASS - Monitoring Table Style Depth */}
                                                        <div className="p-5 border border-white/5 bg-black/60 backdrop-blur-3xl rounded-2xl transition-all duration-500 shadow-glass-depth relative overflow-hidden group-hover/t-item:bg-black/70 group-hover/t-item:border-white/10">
                                                            {/* Indicator Bar */}
                                                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${e.bg.replace('bg-', 'bg-').replace('/10', '/80')}`} />

                                                            <p className="text-[12px] font-bold text-white/50 leading-relaxed tracking-wide group-hover/t-item:text-white/90 transition-colors">
                                                                {e.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

export default IspDetailPage;
