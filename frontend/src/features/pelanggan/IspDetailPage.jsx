import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import AppShell from "../../components/layout/AppShell";
import { StatCard } from "../../components/shared/AppShared";
import FoRouteMultiPreview from "./components/FoRouteMultiPreview";
import DateInput from "../../components/shared/DateInput";
import IspEntryPointMap from "./components/IspEntryPointMap";
import {
    formatDate,
    getCustomerDisplayActionSummary,
    getIspContractActionItems,
    isOpenableFileUrl,
    openSafeFile,
    resolveCustomerContractPeriodInfo,
    resolveCustomerPackageInfo,
} from "../../app/utils";
import api from "../../lib/api";
import { uploadFileForRecord } from "../../lib/files";
import {
    getPackageDisplay,
    normalizeOperationalStatus,
    isPendingOperationalStatus,
    isStoppedStatus,
    getOperationalLabel,
    isOperationallyActive,
} from "./utils";

const getPrimaryIspContractRowId = (ispId) => `primary-isp-contract-${ispId}`;

const getContractRowStatus = (row, todayIso) => {
    const rawStatus = normalizeOperationalStatus(row?.status ?? row?.renewalStatus ?? row?.renewal_status);
    if (isStoppedStatus(rawStatus)) return "berhenti";
    if (rawStatus === "expired" || rawStatus === "belum_diperpanjang") return "expired";
    const periodEnd = String(row?.periodEnd ?? row?.period_end ?? "").slice(0, 10);
    return periodEnd && periodEnd < todayIso ? "expired" : "beroperasi";
};

const buildPrimaryIspContractRow = (ispDetail, fallbackIsp) => {
    const source = ispDetail ?? fallbackIsp ?? {};
    const hasPrimaryContractData = [
        source.contractReference ?? source.contract_reference,
        source.contractStartDate ?? source.contract_start_date,
        source.contractPeriodStart ?? source.contract_period_start,
        source.contractPeriodEnd ?? source.contract_period_end,
        source.bakFileUrl ?? source.bak_file_url,
        source.contractFileUrl ?? source.contract_file_url,
    ].some((value) => String(value ?? "").trim().length > 0);

    if (!hasPrimaryContractData) return null;

    return {
        id: getPrimaryIspContractRowId(source.id ?? fallbackIsp?.id),
        isPrimaryIspContract: true,
        status: source.status ?? fallbackIsp?.status ?? null,
        contractReference: source.contractReference ?? source.contract_reference ?? null,
        contractFileUrl: source.contractFileUrl ?? source.contract_file_url ?? null,
        contractFileName: source.contractFileName ?? source.contract_file_name ?? null,
        contractStartDate: source.contractStartDate ?? source.contract_start_date ?? null,
        periodStart: source.contractPeriodStart ?? source.contract_period_start ?? null,
        periodEnd: source.contractPeriodEnd ?? source.contract_period_end ?? null,
        bakFileUrl: source.bakFileUrl ?? source.bak_file_url ?? null,
        bakFileName: source.bakFileName ?? source.bak_file_name ?? null,
        renewalFollowUps: [],
    };
};

const buildPrimaryIspContractRowPayload = (source = {}) => ({
    ispId: source.ispId ?? source.id ?? null,
    contractReference: source.contractReference ?? source.contract_reference ?? "Tanpa Nomor Kontrak",
    contractStartDate: source.contractStartDate ?? source.contract_start_date ?? source.contractPeriodStart ?? source.contract_period_start ?? null,
    periodStart: source.contractPeriodStart ?? source.contract_period_start ?? source.contractStartDate ?? source.contract_start_date ?? null,
    periodEnd: source.contractPeriodEnd ?? source.contract_period_end ?? source.contractStartDate ?? source.contract_start_date ?? null,
    bakFileUrl: source.bakFileUrl ?? source.bak_file_url ?? null,
    bakFileName: source.bakFileName ?? source.bak_file_name ?? null,
    contractFileUrl: source.contractFileUrl ?? source.contract_file_url ?? null,
    contractFileName: source.contractFileName ?? source.contract_file_name ?? null,
    status: 'aktif',
    renewalStatus: 'active',
});

const isSyntheticPrimaryRowId = (rowId) => String(rowId ?? '').startsWith('primary-isp-contract-');
const isPendingPrimaryRenewalFollowUpId = (followUpId) => String(followUpId ?? '').startsWith('pending-primary-renewal-');

const getIspRowDate = (value) => String(value ?? '').slice(0, 10);

const isSamePrimaryIspContractPeriod = (row, primaryRow) => {
    if (!row || !primaryRow) return false;

    const rowStart = getIspRowDate(row.periodStart ?? row.period_start);
    const rowEnd = getIspRowDate(row.periodEnd ?? row.period_end);
    const primaryStart = getIspRowDate(primaryRow.periodStart);
    const primaryEnd = getIspRowDate(primaryRow.periodEnd);

    if (!rowStart || !rowEnd || !primaryStart || !primaryEnd) {
        return false;
    }

    const rowReference = String(row.contractReference ?? row.contract_reference ?? '').trim();
    const primaryReference = String(primaryRow.contractReference ?? '').trim();
    const isSameReference = !rowReference || !primaryReference || rowReference === primaryReference;

    return rowStart === primaryStart && rowEnd === primaryEnd && isSameReference;
};

const mergePrimaryIspContractDisplayData = (persistedRow, primaryRow) => ({
    ...primaryRow,
    ...persistedRow,
    contractStartDate: primaryRow?.contractStartDate ?? persistedRow?.contractStartDate ?? persistedRow?.contract_start_date ?? null,
    contractFileUrl: persistedRow?.contractFileUrl ?? persistedRow?.contract_file_url ?? primaryRow?.contractFileUrl ?? null,
    contractFileName: persistedRow?.contractFileName ?? persistedRow?.contract_file_name ?? primaryRow?.contractFileName ?? null,
    bakFileUrl: persistedRow?.bakFileUrl ?? persistedRow?.bak_file_url ?? primaryRow?.bakFileUrl ?? null,
    bakFileName: persistedRow?.bakFileName ?? persistedRow?.bak_file_name ?? primaryRow?.bakFileName ?? null,
    isPrimaryIspContract: false,
});

const getIspContractRowEditStatus = (row) => {
    const rawStatus = String(row?.status ?? row?.renewalStatus ?? row?.renewal_status ?? '').trim().toLowerCase();
    if (rawStatus === 'berhenti' || rawStatus === 'nonaktif') return 'berhenti';
    if (rawStatus === 'expired' || rawStatus === 'belum_diperpanjang') return 'expired';
    return 'aktif';
};
const getTenantActionCount = (tenant, todayIso) => {
    const summary = getCustomerDisplayActionSummary(tenant, { todayIso });
    return summary.total;
};
const resolveRouteStatus = (customerStatus, routeStatus) => isStoppedStatus(customerStatus)
    ? "nonaktif"
    : normalizeOperationalStatus(routeStatus || "aktif");

const getIspAccountInfo = (source = {}) => {
    const email = String(source?.userEmail ?? source?.user_id ?? "").trim();
    const passwordPlain = source?.passwordPlain ?? source?.password_plain ?? null;
    const mappings = Array.isArray(source?.accountMappings)
        ? source.accountMappings
        : Array.isArray(source?.isp_user_accounts)
            ? source.isp_user_accounts
            : [];

    return {
        email,
        passwordPlain,
        username: email.includes("@") ? email.split("@")[0] : email,
        hasCredential: Boolean(email),
        isMapped: mappings.length > 0,
        mappingCount: mappings.length,
    };
};

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
        <div className={`space-y-1.5 relative ${isOpen ? "z-[60]" : "z-0"}`} ref={containerRef}>
            {label && (
                <label className="block text-[8px] font-black uppercase tracking-[0.3em] pl-1 text-gold-accent/40">
                    {label}
                </label>
            )}
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`rounded-lg bg-black/20 border flex items-center transition-all cursor-pointer shadow-inner-glass relative z-20 ${isOpen ? "border-gold-accent/60 bg-black/40 shadow-gold-glow" : "border-white/10 text-white/70 hover:border-white/30"} ${heightClass} w-full px-4 text-[9px] font-bold`}
                >
                    {icon && (
                        <span className="material-symbols-outlined mr-2" style={{ fontSize: "16px", color: isOpen ? "#d4a937" : "rgba(255,255,255,0.2)" }}>
                            {icon}
                        </span>
                    )}
                    <span className="truncate">{selectedOption.label}</span>
                    <span className={`material-symbols-outlined ml-auto transition-transform duration-300 text-[16px] ${isOpen ? "rotate-180 text-gold-accent" : "text-white/20"}`}>
                        expand_more
                    </span>
                </div>

                {isOpen && (
                    <div className="absolute top-full mt-2 p-1 rounded-xl bg-black/80 backdrop-blur-3xl border border-white/10 shadow-glass-depth z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden left-0 right-0 max-h-64 overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center px-3 py-1.5 rounded-md text-[9px] font-bold cursor-pointer transition-all mb-0.5 last:mb-0 border ${value === opt.value ? "bg-gold-accent/10 text-gold-accent border-gold-accent/20 shadow-gold-glow" : "border-transparent text-white/40 hover:bg-white/5 hover:text-white"}`}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const FilePickerButton = ({ label, icon, onPickFile, className = "", disabled = false }) => {
    const inputRef = useRef(null);

    return (
        <>
            <button
                className={className}
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                type="button"
            >
                {icon && icon}
                {label}
            </button>
            <input
                ref={inputRef}
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    onPickFile(file);
                    event.target.value = "";
                }}
                type="file"
            />
        </>
    );
};

const fileActionButtonClass = "inline-flex h-6 items-center gap-1 cursor-pointer font-black text-[8px] uppercase tracking-wider px-2 rounded-md transition-all";
const fileActionPrimaryClass = "border border-gold-accent/20 bg-gold-accent/10 text-gold-accent hover:bg-gold-accent hover:text-white";
const fileActionSuccessClass = "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white";

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
    initialTab = "overview",
    notifications = [],
    onTabChange,
}) {
    const isTeknisi = currentRole === "teknisi";
    const isIsp = currentRole === "isp";
    const canManageIspContracts = currentRole === "admin";
    const canManageEntryPoints = currentRole === "admin" || currentRole === "teknisi";
    const canOpenTenantDetail = typeof onOpenTenant === "function";
    const todayIso = new Date().toISOString().slice(0, 10);
    const [detail, setDetail] = useState(null);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isMobileTabMenuOpen, setIsMobileTabMenuOpen] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [timeline, setTimeline] = useState([]);
    const [contractRows, setContractRows] = useState([]);
    const [pendingPrimaryRenewals, setPendingPrimaryRenewals] = useState({});
    const [, setIsActionLoading] = useState(false);
    const [contractRowEditor, setContractRowEditor] = useState(null);
    const [expandedContracts, setExpandedContracts] = useState({});
    const [isSavingContractRow, setIsSavingContractRow] = useState(false);
    const isSelectingFileRef = useRef(false);
    const [contractDraft, setContractDraft] = useState(null);
    const [contractDraftSaving, setContractDraftSaving] = useState(false);
    const [risalahRows, setRisalahRows] = useState([]);
    const [risalahEditor, setRisalahEditor] = useState(null);

    // Entry Point CRUD state
    const [entryPointEditor, setEntryPointEditor] = useState(null); // null | { mode: "add"|"edit", data: {...} }
    const [entryPointSaving, setEntryPointSaving] = useState(false);

    // Filtering & Sorting State for Lokasi Table
    const [tenantSearch, setTenantSearch] = useState("");
    const [tenantStatusFilter, setTenantStatusFilter] = useState("all");
    const [tenantPaketFilter, setTenantPaketFilter] = useState("all");
    const [tenantSortMethod, setTenantSortMethod] = useState("newest");
    const [showTenantFilters, setShowTenantFilters] = useState(false);

    // Filtering & Sorting State for Dokumen Table
    const [docSearch, setDocSearch] = useState("");
    const [docSortMethod, setDocSortMethod] = useState("newest");
    // Filtering & Sorting State for Kontrak Table
    const [contractSearch, setContractSearch] = useState("");
    const [contractSortMethod, setContractSortMethod] = useState("newest");

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

    const openContractRowEditor = (row, focusField = null) => {
        if (!canManageIspContracts) return;
        setError("");
        setContractRowEditor({
            rowId: row.id,
            contractReference: row.contractReference ?? "",
            status: getIspContractRowEditStatus(row),
            contractStartDate: row.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date ?? "",
            periodStart: row.periodStart ?? "",
            periodEnd: row.periodEnd ?? "",
            contractUploadedFile: null,
            contractUploadedFileName: "",
            contractFileUrl: row.contractFileUrl ?? "",
            bakUploadedFile: null,
            bakUploadedFileName: "",
            bakFileUrl: row.bakFileUrl ?? "",
            focusField,
        });
    };


    const requireIspContractManageAccess = () => {
        if (canManageIspContracts) return true;
        setError("Hanya admin yang dapat mengubah rincian kontrak dan adendum ISP.");
        return false;
    };

    const buildPersistablePrimaryContractRowPayload = () => {
        const rowPayload = buildPrimaryIspContractRowPayload(detail ?? isp);
        const periodStart = String(rowPayload.periodStart ?? "").slice(0, 10);
        const periodEnd = String(rowPayload.periodEnd ?? "").slice(0, 10);

        if (!periodStart || !periodEnd) {
            throw new Error("Lengkapi periode berjalan kontrak utama sebelum membuat perpanjangan.");
        }

        if (periodStart > periodEnd) {
            throw new Error("Periode kontrak utama tidak valid. Periode awal tidak boleh lebih besar dari periode akhir.");
        }

        return { ...rowPayload, periodStart, periodEnd };
    };

    const persistPrimaryContractRow = async () => {
        const existingPrimaryRow = contractRows.find((row) => row?.isPrimaryIspContract === false && isSamePrimaryIspContractPeriod(row, buildPrimaryIspContractRow(detail, isp)));
        if (existingPrimaryRow?.id && Number.isFinite(Number(existingPrimaryRow.id))) {
            return existingPrimaryRow;
        }

        return api.ispContractRows.create(buildPersistablePrimaryContractRowPayload());
    };

    const openUserPopup = async () => {
        setUserPopupOpen(true);
        setUserPopupMode("view");
        setUserPopupError("");
        setUserPopupFeedback("");
        setShowPassword(false);
        setUserPopupLoading(true);
        try {
            const source = detail ?? isp;
            const account = getIspAccountInfo(source);
            const result = {
                hasUser: account.hasCredential,
                user: {
                    username: account.username,
                    email: account.email,
                    displayName: source?.name ?? "",
                    passwordPlain: account.passwordPlain,
                    isMapped: account.isMapped,
                    mappingCount: account.mappingCount,
                },
            };
            setUserPopupData(result);
            setUserForm({
                username: result.user.username ?? "",
                email: result.user.email ?? "",
                password: "",
                displayName: result.user.displayName ?? "",
            });
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
            const email = String(userForm.email ?? "").trim().toLowerCase();
            const password = String(userForm.password ?? "");

            if (!email) {
                setUserPopupError("Email akun ISP wajib diisi.");
                return;
            }

            if (!userPopupData?.user?.passwordPlain && !password) {
                setUserPopupError("Password wajib diisi untuk akun ISP baru.");
                return;
            }

            const savedIsp = await api.isps.update(isp.id, {
                userEmail: email,
                ...(password ? { userPassword: password } : {}),
            });
            const nextDetail = { ...(detail ?? isp), ...(savedIsp ?? {}) };
            const account = getIspAccountInfo(nextDetail);

            setDetail(nextDetail);
            setUserPopupData({
                hasUser: account.hasCredential,
                user: {
                    username: account.username,
                    email: account.email,
                    displayName: nextDetail?.name ?? "",
                    passwordPlain: account.passwordPlain,
                    isMapped: account.isMapped,
                    mappingCount: account.mappingCount,
                },
            });
            setUserForm({
                username: account.username,
                email: account.email,
                password: "",
                displayName: nextDetail?.name ?? "",
            });
            setUserPopupMode("view");
            setShowPassword(false);
            setUserPopupFeedback("Akun berhasil dibuat/diperbarui. Pengguna kini dapat menggunakan email dan password tersebut untuk masuk.");
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
            const ispResult = await api.isps.getById(isp.id);
            const rowsResult = Array.isArray(ispResult?.contractRows) ? ispResult.contractRows : [];
            const primaryContractRow = buildPrimaryIspContractRow(ispResult, isp);
            const persistedPrimaryRow = primaryContractRow
                ? rowsResult.find((row) => isSamePrimaryIspContractPeriod(row, primaryContractRow))
                : null;
            const nextContractRows = primaryContractRow
                ? [
                    persistedPrimaryRow
                        ? mergePrimaryIspContractDisplayData(persistedPrimaryRow, primaryContractRow)
                        : primaryContractRow,
                    ...rowsResult.filter((row) => (
                        !row?.isPrimaryIspContract
                        && (!persistedPrimaryRow || Number(row?.id) !== Number(persistedPrimaryRow.id))
                    )),
                ]
                : rowsResult;

            setDetail(ispResult ?? null);
            setContractRows(nextContractRows);
            const isCendikia = String(ispResult?.name ?? "").toLowerCase().includes("cendikia") || String(ispResult?.name ?? "").toLowerCase().includes("cendekia");
            const dummyRisalah = isCendikia ? [
                {
                    id: "dummy-1",
                    tanggal: "2023-08-10",
                    fileUrl: "https://files.kima.local/contracts/dummy-cendikia-sla.pdf",
                    fileName: "Laporan SLA & Monitoring Jaringan Cendikia Q3 2023",
                    isNew: false
                },
                {
                    id: "dummy-2",
                    tanggal: "2023-11-15",
                    fileUrl: "https://files.kima.local/contracts/dummy-cendikia-topology.pdf",
                    fileName: "Diagram Topologi & Fiber Route PT Cendikia Global Solusi",
                    isNew: false
                },
                {
                    id: "dummy-3",
                    tanggal: "2024-02-20",
                    fileUrl: "https://files.kima.local/contracts/dummy-cendikia-ba.pdf",
                    fileName: "Berita Acara Rekonsiliasi Billing Cendikia - KIMA 2024",
                    isNew: false
                }
            ] : [];

            setRisalahRows(
                Array.isArray(ispResult?.risalah) && ispResult.risalah.length > 0
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
                    : dummyRisalah,
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
    }, [isp]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (risalahEditor || userPopupOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [risalahEditor, userPopupOpen]);

    const handleTabChange = useCallback((nextTab) => {
        setActiveTab(nextTab);
        onTabChange?.(nextTab);
    }, [onTabChange]);

    const resolveIspActionTargetTab = (item = {}) => {
        if (item.targetPath) {
            const queryIndex = String(item.targetPath).indexOf("?");
            if (queryIndex >= 0) {
                const params = new URLSearchParams(String(item.targetPath).slice(queryIndex + 1));
                const targetTab = params.get("tab");
                if (targetTab) return targetTab;
            }
        }

        const actionKey = String(item.code ?? item.type ?? item.id ?? item.key ?? "").toLowerCase();
        if (actionKey.includes("document") || actionKey.includes("contract") || actionKey.includes("renewal") || actionKey.includes("bak")) {
            return "contracts";
        }
        if (actionKey.includes("route") || actionKey.includes("jalur")) {
            return "jalur";
        }
        return "contracts";
    };

    const handleIspActionClick = (item) => {
        handleTabChange(resolveIspActionTargetTab(item));
    };

    const allTenants = useMemo(
        () => Array.isArray(detail?.tenants)
            ? detail.tenants.map((tenant) => ({
                ...tenant,
                contractPeriodInfo: resolveCustomerContractPeriodInfo(tenant),
                packageInfo: resolveCustomerPackageInfo(tenant),
            }))
            : [],
        [detail?.tenants],
    );

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
            result = result.filter(t => getPackageDisplay(t.packageInfo?.paket ?? t.paket).filterValue === tenantPaketFilter);
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

    // Filtered & Sorted Contracts
    const filteredContracts = useMemo(() => {
        let result = [...contractRows];

        // 1. Search
        if (contractSearch.trim()) {
            const query = contractSearch.toLowerCase();
            result = result.filter(c =>
                (c.contractReference || "").toLowerCase().includes(query)
            );
        }

        // 2. Sorting
        result.sort((a, b) => {
            const dateA = new Date(a.periodStart || a.contractStartDate || 0).getTime();
            const dateB = new Date(b.periodStart || b.contractStartDate || 0).getTime();
            if (contractSortMethod === "oldest") return dateA - dateB;
            return dateB - dateA; // newest default
        });

        return result;
    }, [contractRows, contractSearch, contractSortMethod]);

    const summary = detail?.summary ?? {};
    const centralizedIspActionItems = Array.isArray(notifications)
        ? notifications.filter((notification) => !notification.resolvedAt)
        : [];
    const fallbackIspActionItems = getIspContractActionItems(contractRows);
    const ispActionItems = centralizedIspActionItems.length > 0 ? centralizedIspActionItems : fallbackIspActionItems;
    const tenantActionRows = allTenants
        .filter((tenant) => tenant.status === "aktif")
        .map((tenant) => ({
            ...tenant,
            totalActions: getTenantActionCount(tenant),
        }))
        .filter((tenant) => tenant.totalActions > 0);
    const totalTenantActionCount = tenantActionRows.reduce((sum, tenant) => sum + tenant.totalActions, 0);

    const ispName = detail?.name ?? isp.name;
    const contractRef = detail?.contractReference ?? isp.contractReference ?? "-";

    useEffect(() => {
        if (!canManageEntryPoints) {
            setEntryPointEditor(null);
        }
    }, [canManageEntryPoints]);

    const requireEntryPointManageAccess = () => {
        if (canManageEntryPoints) return true;
        setError("Role ISP hanya dapat melihat titik masuk ISP tanpa mengubah peta.");
        return false;
    };

    const openEntryPointEditor = (editorConfig) => {
        if (!requireEntryPointManageAccess()) return;
        setError("");
        setEntryPointEditor(editorConfig);
    };

    // ── Entry Point CRUD handlers ──
    const handleSaveEntryPoint = async () => {
        if (!requireEntryPointManageAccess()) {
            setEntryPointEditor(null);
            return;
        }

        if (!entryPointEditor) return;
        const { mode, data } = entryPointEditor;
        const label = String(data.label ?? "").trim();
        const lat = Number(String(data.latitude ?? "").replace(",", "."));
        const lng = Number(String(data.longitude ?? "").replace(",", "."));
        if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setEntryPointSaving(true);
        try {
            const payload = { ...data, ispId: isp.id, latitude: lat, longitude: lng, label };
            if (mode === "edit" && data.id) {
                await api.ispEntryPoints.update(data.id, payload);
            } else {
                await api.ispEntryPoints.create(payload);
            }
            setEntryPointEditor(null);
            await loadDetail();
        } catch { /* silent */ }
        setEntryPointSaving(false);
    };

    const handleDeleteEntryPoint = async (pointId) => {
        if (!requireEntryPointManageAccess()) return;
        if (!window.confirm("Hapus titik masuk ini?")) return;
        try {
            await api.ispEntryPoints.softDelete(pointId);
            await loadDetail();
        } catch { /* silent */ }
    };

    const handleMoveEntryPoint = async (pointId, lat, lng) => {
        if (!requireEntryPointManageAccess()) return;

        try {
            const point = (detail?.entryPoints || []).find((p) => p.id === pointId);
            if (!point) return;
            await api.ispEntryPoints.update(pointId, { ...point, ispId: isp.id, latitude: Number(lat), longitude: Number(lng) });
            await loadDetail();
        } catch { /* silent */ }
    };

    const handleFileUpload = async (rowId, type, file, followUpId = null) => {
        if (!file) return;
        if (!requireIspContractManageAccess()) return;
        setIsActionLoading(true);
        setError("");
        try {
            const targetRow = contractRows.find((row) => row.id === rowId);

            if (type === "renewal") {
                let actualRowId = rowId;
                let actualFollowUpId = followUpId;

                if (targetRow?.isPrimaryIspContract || isSyntheticPrimaryRowId(rowId)) {
                    const persistedPrimaryRow = await persistPrimaryContractRow();
                    actualRowId = persistedPrimaryRow?.id;
                }

                if (!actualRowId || !Number.isFinite(Number(actualRowId))) {
                    throw new Error("Baris kontrak ISP belum siap untuk perpanjangan.");
                }

                if (!actualFollowUpId || isPendingPrimaryRenewalFollowUpId(actualFollowUpId)) {
                    const createdFollowUp = await api.ispRenewalFollowUps.createForContractRow(actualRowId);
                    actualFollowUpId = createdFollowUp?.id;
                }

                if (!actualFollowUpId || !Number.isFinite(Number(actualFollowUpId))) {
                    throw new Error("Gagal membuat baris perpanjangan.");
                }

                const fileDataUrl = await uploadFileForRecord(file, ["isps", isp.id, "renewals"]);
                await api.ispRenewalFollowUps.update(actualFollowUpId, {
                    renewal_file_url: fileDataUrl,
                    renewal_file_name: file.name,
                    status: 'pending_response',
                });

                if (targetRow?.isPrimaryIspContract || isSyntheticPrimaryRowId(rowId)) {
                    setPendingPrimaryRenewals((previous) => {
                        const next = { ...previous };
                        delete next[rowId];
                        return next;
                    });
                }

                await loadDetail();
                if (onRefreshAll) onRefreshAll();
                return;
            }

            const fileDataUrl = await uploadFileForRecord(file, ["isps", isp.id, type]);
            if (targetRow?.isPrimaryIspContract) {
                const fieldMap = {
                    bak: { bakFileUrl: fileDataUrl, bakFileName: file.name },
                    contract: { contractFileUrl: fileDataUrl, contractFileName: file.name },
                };
                await api.isps.update(isp.id, fieldMap[type]);
            } else {
                const fieldMap = {
                    bak: { bak_file_url: fileDataUrl, bak_file_name: file.name },
                    contract: { contract_file_url: fileDataUrl, contract_file_name: file.name },
                };
                await api.ispContractRows.update(rowId, fieldMap[type] ?? {});
            }
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
        if (!requireIspContractManageAccess()) return;
        if (!followUpId) {
            setError("Berkas tanggapan harus menempel pada baris perpanjangan.");
            return;
        }
        setIsActionLoading(true);
        setError("");
        try {
            const targetRow = contractRows.find((row) => row.id === rowId);
            const followUps = targetRow?.isPrimaryIspContract
                ? (pendingPrimaryRenewals[rowId] ? [pendingPrimaryRenewals[rowId]] : [])
                : (Array.isArray(targetRow?.renewalFollowUps) ? targetRow.renewalFollowUps : []);
            const targetFollowUp = followUps.find((followUp) => String(followUp?.id) === String(followUpId));

            if (!isOpenableFileUrl(targetFollowUp?.renewalFileUrl)) {
                throw new Error("Unggah berkas perpanjangan terlebih dahulu sebelum mengirim tanggapan.");
            }

            const fileDataUrl = await uploadFileForRecord(file, ["isps", isp.id, "responses"]);
            if (isPendingPrimaryRenewalFollowUpId(followUpId)) {
                if (!targetRow?.isPrimaryIspContract) {
                    throw new Error("Berkas perpanjangan belum siap untuk ditanggapi.");
                }

                const createdRow = await persistPrimaryContractRow();
                const actualRowId = createdRow?.id;
                if (!actualRowId || !Number.isFinite(Number(actualRowId))) {
                    throw new Error("Baris kontrak ISP belum siap untuk tanggapan.");
                }

                const createdFollowUp = await api.ispRenewalFollowUps.createForContractRow(actualRowId);
                await api.ispRenewalFollowUps.update(createdFollowUp.id, {
                    renewal_file_url: targetFollowUp.renewalFileUrl,
                    renewal_file_name: targetFollowUp.renewalFileName,
                    status: 'completed',
                    response_file_url: fileDataUrl,
                    response_file_name: file.name,
                    response_status: decision,
                });

                setPendingPrimaryRenewals((previous) => {
                    const next = { ...previous };
                    delete next[rowId];
                    return next;
                });
            } else {
                await api.ispRenewalFollowUps.update(followUpId, {
                    status: 'completed',
                    response_file_url: fileDataUrl,
                    response_file_name: file.name,
                    response_status: decision,
                });
            }
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengirim tanggapan.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleAddRenewalSplit = async (rowId) => {
        if (!requireIspContractManageAccess()) return;
        setIsActionLoading(true);
        setError("");
        try {
            const targetRow = contractRows.find((row) => row.id === rowId);
            let actualRowId = rowId;
            if (targetRow?.isPrimaryIspContract || isSyntheticPrimaryRowId(rowId)) {
                const createdRow = await persistPrimaryContractRow();
                actualRowId = createdRow?.id;
            }

            if (!actualRowId || !Number.isFinite(Number(actualRowId))) {
                throw new Error("Baris kontrak ISP belum siap untuk perpanjangan.");
            }

            await api.ispRenewalFollowUps.createForContractRow(actualRowId);
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal menambah split tindak lanjut.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const hasInitialRenewalUpload = (row) => {
        const followUps = row?.isPrimaryIspContract
            ? (pendingPrimaryRenewals[row.id] ? [pendingPrimaryRenewals[row.id]] : [])
            : (Array.isArray(row?.renewalFollowUps) ? row.renewalFollowUps : []);
        return followUps.length > 0 && followUps.every((followUp) => isOpenableFileUrl(followUp?.renewalFileUrl));
    };

    const renderRenewalFollowUps = (row, columnType) => {
        const followUps = row?.isPrimaryIspContract
            ? (pendingPrimaryRenewals[row.id] ? [pendingPrimaryRenewals[row.id]] : [])
            : (Array.isArray(row?.renewalFollowUps) ? row.renewalFollowUps : []);

        if (followUps.length === 0) {
            if (columnType === "renewal") {
                if (!canManageIspContracts) {
                    return <span className="text-[10px] font-bold text-white/20">Belum diunggah</span>;
                }
                return (
                    <FilePickerButton
                        label="Upload"
                        className="inline-flex h-5 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all shrink-0"
                        icon={<span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload_file</span>}
                        onPickFile={(file) => void handleFileUpload(row.id, "renewal", file)}
                    />
                );
            }
            return <span className="text-[10px] font-black text-white/20">—</span>;
        }

        const itemsToRender = columnType === "response"
            ? (followUps.length > 0 ? [[...followUps].reverse().find(f => isOpenableFileUrl(f?.renewalFileUrl)) || followUps[followUps.length - 1]] : [])
            : followUps;

        return (
            <div className="flex flex-col gap-1.5 items-center justify-center w-full">
                {itemsToRender.map((followUp, index) => {
                    const hasRenewalFile = isOpenableFileUrl(followUp?.renewalFileUrl);
                    const hasResponseFile = isOpenableFileUrl(followUp?.responseFileUrl);
                    const currentDecision = followUp?.responseStatus ?? "lanjut";
                    const isLast = index === itemsToRender.length - 1;
                    const isFirst = index === 0;

                    return (
                        <div key={followUp.id} className="flex flex-col gap-0.5 w-fit">
                            <div className={`w-[130px] ${columnType === "response" ? "hidden xl:block" : ""}`}>
                                <span className={`text-[7px] font-bold uppercase tracking-widest text-center ${columnType === "renewal" ? "block text-white/40" : "text-transparent select-none"}`}>
                                    Peringatan {index + 1}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1 backdrop-blur-md w-[130px] shrink-0">
                                    {columnType === "renewal" ? (
                                        <>
                                            {hasRenewalFile ? (
                                                <>
                                                    <button onClick={() => openSafeFile(followUp.renewalFileUrl, followUp.renewalFileName)} className="flex-1 w-full justify-center inline-flex h-5 items-center gap-1 rounded-md border border-gold-accent/20 bg-gold-accent/10 px-1 text-[8px] font-black uppercase tracking-widest text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition-all">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>visibility</span>Lihat
                                                    </button>
                                                    {canManageIspContracts && (
                                                        <FilePickerButton
                                                            label="Ganti"
                                                            className="flex-1 w-full justify-center inline-flex h-5 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                            icon={<span className="material-symbols-outlined" style={{ fontSize: '12px' }}>upload_file</span>}
                                                            onPickFile={(file) => void handleFileUpload(row.id, "renewal", file, followUp.id)}
                                                        />
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {canManageIspContracts ? (
                                                        <FilePickerButton
                                                            label="Upload"
                                                            className="w-full justify-center inline-flex h-5 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                            icon={<span className="material-symbols-outlined" style={{ fontSize: '12px' }}>upload_file</span>}
                                                            onPickFile={(file) => void handleFileUpload(row.id, "renewal", file, followUp.id)}
                                                        />
                                                    ) : (
                                                        <span className="w-full text-center text-[10px] font-bold text-white/20">Belum diunggah</span>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {hasResponseFile ? (
                                                <>
                                                    <button onClick={() => openSafeFile(followUp.responseFileUrl, followUp.responseFileName)} className="flex-1 w-full justify-center inline-flex h-5 items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1 text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-[#0f141e] transition-all">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>visibility</span>Lihat
                                                    </button>
                                                    {canManageIspContracts && (
                                                        <FilePickerButton
                                                            label="Ganti"
                                                            className="flex-1 w-full justify-center inline-flex h-5 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                            icon={<span className="material-symbols-outlined" style={{ fontSize: '12px' }}>upload_file</span>}
                                                            onPickFile={(file) => void handleRespondRenewal(row.id, currentDecision, file, followUp.id)}
                                                        />
                                                    )}
                                                </>
                                            ) : canManageIspContracts && hasRenewalFile ? (
                                                <>
                                                    <FilePickerButton
                                                        label="Lanjut"
                                                        className="flex-1 w-full justify-center inline-flex h-5 items-center gap-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1 text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500 hover:text-[#0f141e] transition-all"
                                                        icon={<span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>}
                                                        onPickFile={(file) => void handleRespondRenewal(row.id, "lanjut", file, followUp.id)}
                                                    />
                                                    <FilePickerButton
                                                        label="Tidak"
                                                        className="flex-1 w-full justify-center inline-flex h-5 items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-1 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all"
                                                        icon={<span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>}
                                                        onPickFile={(file) => void handleRespondRenewal(row.id, "tidak", file, followUp.id)}
                                                    />
                                                </>
                                            ) : (
                                                <span className="w-full text-center text-[10px] font-black text-white/20">—</span>
                                            )}
                                        </>
                                    )}
                                </div>
                                {columnType === "renewal" && canManageIspContracts && (
                                    <div className="flex items-center gap-1 w-[44px] shrink-0 justify-start">
                                        {!isFirst ? (
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Apakah Anda yakin ingin menghapus split tindak lanjut ini?")) {
                                                        try {
                                                            setIsActionLoading(true);
                                                            await api.ispRenewalFollowUps.delete(followUp.id);
                                                            await loadDetail();
                                                            if (onRefreshAll) onRefreshAll();
                                                        } catch (err) {
                                                            setError(err instanceof Error ? err.message : "Gagal menghapus split.");
                                                        } finally {
                                                            setIsActionLoading(false);
                                                        }
                                                    }
                                                }}
                                                className="h-5 w-5 shrink-0 rounded-md flex items-center justify-center border border-[#ff2400]/20 bg-[#ff2400]/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                title="Hapus split"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                            </button>
                                        ) : (
                                            <div className="w-5 h-5 shrink-0" />
                                        )}

                                        {isLast && hasInitialRenewalUpload(row) ? (
                                            <button className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 shadow-sm" disabled={!hasInitialRenewalUpload(row)} onClick={() => handleAddRenewalSplit(row.id)} type="button" title="Tambah split perpanjangan">
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
                                            </button>
                                        ) : (
                                            <div className="w-5 h-5 shrink-0" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleUpdateRow = async (rowId, updates) => {
        setIsActionLoading(true);
        try {
            const targetRow = contractRows.find((row) => row.id === rowId);
            if (targetRow?.isPrimaryIspContract) {
                const payload = {
                    contractReference: updates.contract_reference,
                    contractStartDate: updates.contract_start_date,
                    contractPeriodStart: updates.period_start,
                    contractPeriodEnd: updates.period_end,
                };
                if (Object.prototype.hasOwnProperty.call(updates, "status")) {
                    payload.status = updates.status;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "contract_file_url")) {
                    payload.contractFileUrl = updates.contract_file_url;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "contract_file_name")) {
                    payload.contractFileName = updates.contract_file_name;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "bak_file_url")) {
                    payload.bakFileUrl = updates.bak_file_url;
                }
                if (Object.prototype.hasOwnProperty.call(updates, "bak_file_name")) {
                    payload.bakFileName = updates.bak_file_name;
                }
                await api.isps.update(isp.id, payload);
            } else {
                await api.ispContractRows.update(rowId, updates);
            }
            await loadDetail();
        } catch { setError("Gagal memperbarui data baris."); } finally { setIsActionLoading(false); }
    };

    const handleSaveContractRow = async (event = null, overrides = {}) => {
        if (event) event.preventDefault();
        if (!contractRowEditor) return;

        const currentEditor = { ...contractRowEditor, ...overrides };
        const contractReference = String(currentEditor.contractReference ?? "").trim();
        const contractStartDate = String(currentEditor.contractStartDate ?? "").slice(0, 10);
        const periodStart = String(currentEditor.periodStart ?? "").slice(0, 10);
        const periodEnd = String(currentEditor.periodEnd ?? "").slice(0, 10);

        if (!contractReference) {
            setError("Nomor kontrak wajib diisi.");
            return false;
        }
        if (!periodStart) {
            setError("Periode berjalan awal wajib diisi.");
            return false;
        }
        if (!periodEnd) {
            setError("Periode berjalan akhir wajib diisi.");
            return false;
        }
        if (periodStart > periodEnd) {
            setError("Periode awal tidak boleh lebih besar dari periode akhir.");
            return false;
        }

        const updates = {
            contract_reference: contractReference,
            contract_start_date: contractStartDate || null,
            period_start: periodStart,
            period_end: periodEnd,
            status: currentEditor.status ?? "aktif",
        };
        const pendingReplacementLabels = [
            currentEditor.contractUploadedFile instanceof File && isOpenableFileUrl(currentEditor.contractFileUrl) ? "Kontrak" : null,
            currentEditor.bakUploadedFile instanceof File && isOpenableFileUrl(currentEditor.bakFileUrl) ? "BAK" : null,
        ].filter(Boolean);

        if (pendingReplacementLabels.length > 0) {
            const confirmed = window.confirm(`Ganti berkas ${pendingReplacementLabels.join(" dan ")} yang sudah tersimpan? Berkas lama akan diganti setelah perubahan disimpan.`);
            if (!confirmed) return false;
        }

        setError("");
        setIsActionLoading(true);
        setIsSavingContractRow(true);
        try {
            if (currentEditor.contractUploadedFile instanceof File) {
                updates.contract_file_url = await uploadFileForRecord(currentEditor.contractUploadedFile, ["isps", isp.id, "contract"]);
                updates.contract_file_name = currentEditor.contractUploadedFile.name;
            }
            if (currentEditor.bakUploadedFile instanceof File) {
                updates.bak_file_url = await uploadFileForRecord(currentEditor.bakUploadedFile, ["isps", isp.id, "bak"]);
                updates.bak_file_name = currentEditor.bakUploadedFile.name;
            }
            if (!(currentEditor.contractUploadedFile instanceof File) && !String(currentEditor.contractFileUrl ?? "").trim()) {
                updates.contract_file_url = null;
                updates.contract_file_name = null;
            }
            if (!(currentEditor.bakUploadedFile instanceof File) && !String(currentEditor.bakFileUrl ?? "").trim()) {
                updates.bak_file_url = null;
                updates.bak_file_name = null;
            }
            await handleUpdateRow(currentEditor.rowId, updates);
            setContractRowEditor(null);
            return true;
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Gagal mengunggah berkas pengganti.");
            return false;
        } finally {
            setIsActionLoading(false);
            setIsSavingContractRow(false);
        }
    };

    const triggerAutoSave = async () => {
        if (!contractRowEditor) return;
        if (isSelectingFileRef.current) return;

        const originalRow = contractRows.find(r => r.id === contractRowEditor.rowId);
        if (!originalRow) return;

        const originalContractStartDate = originalRow.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date ?? "";
        const originalStatus = getIspContractRowEditStatus(originalRow);

        const hasChanges =
            String(contractRowEditor.contractReference ?? "").trim() !== String(originalRow.contractReference ?? "").trim() ||
            String(contractRowEditor.status ?? "").trim() !== String(originalStatus ?? "").trim() ||
            String(contractRowEditor.contractStartDate ?? "").slice(0, 10) !== String(originalContractStartDate ?? "").slice(0, 10) ||
            String(contractRowEditor.periodStart ?? "").slice(0, 10) !== String(originalRow.periodStart ?? "").slice(0, 10) ||
            String(contractRowEditor.periodEnd ?? "").slice(0, 10) !== String(originalRow.periodEnd ?? "").slice(0, 10) ||
            String(contractRowEditor.contractFileUrl ?? "").trim() !== String(originalRow.contractFileUrl ?? "").trim() ||
            String(contractRowEditor.bakFileUrl ?? "").trim() !== String(originalRow.bakFileUrl ?? "").trim() ||
            contractRowEditor.contractUploadedFile !== null ||
            contractRowEditor.bakUploadedFile !== null;

        if (hasChanges) {
            await handleSaveContractRow();
        } else {
            setContractRowEditor(null);
        }
    };

    const createEmptyContractDraft = () => ({
        contractReference: "",
        contractStartDate: "",
        contractPeriodStart: "",
        contractPeriodEnd: "",
        contractFileUrl: "",
        contractFileName: "",
        bakFileUrl: "",
        bakFileName: "",
        contractUploadedFile: null,
        contractUploadedFileName: "",
        bakUploadedFile: null,
        bakUploadedFileName: "",
    });

    const openContractDraft = () => {
        setError("");
        setContractDraft(createEmptyContractDraft());
    };

    const handleSaveContractDraft = async () => {
        if (!contractDraft) return;
        if (!requireIspContractManageAccess()) return;

        const contractReference = String(contractDraft.contractReference ?? "").trim();
        const contractStartDate = String(contractDraft.contractStartDate ?? "").slice(0, 10);
        const contractPeriodStart = String(contractDraft.contractPeriodStart ?? "").slice(0, 10);
        const contractPeriodEnd = String(contractDraft.contractPeriodEnd ?? "").slice(0, 10);

        if (!contractReference) { setError("Nomor kontrak wajib diisi."); return; }
        if (!contractPeriodStart) { setError("Periode berjalan awal wajib diisi."); return; }
        if (!contractPeriodEnd) { setError("Periode berjalan akhir wajib diisi."); return; }
        if (contractPeriodStart > contractPeriodEnd) { setError("Periode awal tidak boleh lebih besar dari periode akhir."); return; }

        setContractDraftSaving(true);
        setIsActionLoading(true);
        setError("");
        try {
            const contractFileUrl = contractDraft.contractUploadedFile instanceof File
                ? await uploadFileForRecord(contractDraft.contractUploadedFile, ["isps", isp.id, "contracts"])
                : String(contractDraft.contractFileUrl ?? "").trim() || null;
            const bakFileUrl = contractDraft.bakUploadedFile instanceof File
                ? await uploadFileForRecord(contractDraft.bakUploadedFile, ["isps", isp.id, "bak"])
                : String(contractDraft.bakFileUrl ?? "").trim() || null;

            const payload = {
                ispId: isp.id,
                contractReference,
                contractStartDate: contractStartDate || null,
                periodStart: contractPeriodStart,
                periodEnd: contractPeriodEnd,
                contractFileUrl,
                contractFileName: contractDraft.contractUploadedFile instanceof File
                    ? contractDraft.contractUploadedFile.name
                    : String(contractDraft.contractFileName ?? "").trim() || null,
                bakFileUrl,
                bakFileName: contractDraft.bakUploadedFile instanceof File
                    ? contractDraft.bakUploadedFile.name
                    : String(contractDraft.bakFileName ?? "").trim() || null,
                status: "aktif",
                renewalStatus: "active",
            };

            await api.ispContractRows.create(payload);
            setContractDraft(null);
            await loadDetail();
            if (onRefreshAll) onRefreshAll();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Gagal menyimpan data kontrak.");
        } finally {
            setContractDraftSaving(false);
            setIsActionLoading(false);
        }
    };

    const handleAddRisalah = () => { setError(""); setRisalahEditor({ id: null, tanggal: "", fileUrl: "", fileName: "", uploadedFileName: "" }); };
    const handleEditRisalah = (row) => { setError(""); setRisalahEditor({ id: row.id, tanggal: row.tanggal ?? "", fileUrl: row.fileUrl ?? "", fileName: row.fileName ?? "", uploadedFileName: row.fileName ?? "" }); };

    const handleRisalahEditorFileChange = (file) => {
        if (!file) { setRisalahEditor((p) => p ? { ...p, fileUrl: "", uploadedFileName: "" } : p); return; }
        void uploadFileForRecord(file, ["isps", isp.id, "risalah"]).then((fileUrl) => { setRisalahEditor((p) => p ? { ...p, fileUrl, uploadedFileName: file.name } : p); }).catch((re) => { setError(re instanceof Error ? re.message : "Gagal membaca berkas."); });
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
        const confirmMessage = `PERINGATAN: Menghapus ISP "${ispName}" akan menghapus SEMUA pelanggan yang terkait dengan ISP ini!\n\nApakah Anda yakin ingin melanjutkan?`;
        if (!window.confirm(confirmMessage)) return;
        setIsLoading(true);
        try {
            const result = await api.isps.delete(isp.id);
            const deletedCount = result?.deletedCustomersCount || 0;
            if (deletedCount > 0) {
                alert(`ISP berhasil dihapus bersama ${deletedCount} pelanggan terkait.`);
            }
            onBack();
            if (onRefreshAll) onRefreshAll();
        }
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
    const pathNonaktifCount = allTenants.filter(t => (t.route?.activeFlowStatus ?? t.status_jalur) === "nonaktif" || (t.route?.activeFlowStatus ?? t.status_jalur) === "non-aktif").length;

    const statusBeroperasiCount = allTenants.filter(t => normalizeOperationalStatus(t.status) === "aktif").length;
    const statusBelumBeroperasiCount = allTenants.filter(t => isPendingOperationalStatus(t.status)).length;
    const statusBelumDiperpanjangCount = allTenants.filter(t => ["expired", "expired_contract"].includes(normalizeOperationalStatus(t.status))).length;
    const statusBerhentiCount = allTenants.filter(t => normalizeOperationalStatus(t.status) === "berhenti").length;

    return (
        <AppShell activeSection="customers" onNavigate={onNavigate} onLogout={onLogout} currentRole={currentRole} hideSidebar={isIsp}>

            {/* ── POPUP AKUN ISP ─────────────────────────────────────────── */}
            {userPopupOpen && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-md bg-black/60 animate-fade-in duration-300">
                    <div className="w-full max-w-sm rounded-2xl glass-card backdrop-blur-xl p-5 border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 blur-3xl pointer-events-none" />

                        {/* Header */}
                        <div className="mb-5 flex items-center justify-between relative z-10">
                            <div className="space-y-0.5">
                                <h3 className="text-base font-black text-white tracking-widest uppercase">
                                    Akun Akses ISP
                                </h3>
                                <p className="text-[9px] font-bold text-gold-accent/40 tracking-[0.3em] uppercase">{ispName}</p>
                            </div>
                            <button
                                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:bg-[#ff2400]/10 hover:border-[#ff2400]/40 hover:text-[#ff2400] transition-all duration-300 shadow-sm"
                                onClick={() => { setUserPopupOpen(false); setShowPassword(false); setUserPopupMode("view"); }}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="relative z-10">
                            {userPopupLoading ? (
                                <div className="flex items-center justify-center py-16 gap-3 text-white/20">
                                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Memuat Data...</span>
                                </div>
                            ) : userPopupMode === "view" ? (
                                /* ── VIEW MODE ── */
                                <div className="space-y-4">
                                    {userPopupData?.hasUser ? (
                                        <>
                                            {/* Status */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${userPopupData.user.isMapped ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${userPopupData.user.isMapped ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                                                    {userPopupData.user.isMapped ? "Auth Terhubung" : "Credential Tersimpan"}
                                                </span>
                                            </div>

                                            {/* Info rows */}
                                            {[
                                                { label: "Username", value: userPopupData.user.username, icon: "person" },
                                                { label: "Email", value: userPopupData.user.email, icon: "alternate_email" },
                                            ].map(({ label, value, icon }) => (
                                                <div key={label} className="space-y-1">
                                                    <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">{label}</label>
                                                    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                                                        <span className="material-symbols-outlined text-[10px] text-white/20 shrink-0">{icon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-bold text-white truncate">{value}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Password row */}
                                            <div className="space-y-1">
                                                <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Password</label>
                                                <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                                                    <span className="material-symbols-outlined text-[10px] text-white/20 shrink-0">lock</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold text-white tracking-widest">
                                                            {showPassword
                                                                ? (userPopupData.user.passwordPlain ?? <span className="text-white/20 italic font-normal normal-case tracking-normal">Tidak tersimpan</span>)
                                                                : "••••••••••"
                                                            }
                                                        </p>
                                                    </div>
                                                    <button
                                                        className="shrink-0 text-white/25 hover:text-white/70 transition-colors"
                                                        onClick={() => setShowPassword(s => !s)}
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">{showPassword ? "visibility_off" : "visibility"}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {userPopupFeedback && (
                                                <p className="text-[10px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl px-5 py-3.5 leading-relaxed">{userPopupFeedback}</p>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 py-12 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner-glass animate-pulse">
                                                <span className="material-symbols-outlined text-3xl text-white/20">no_accounts</span>
                                            </div>
                                            <div>
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">BELUM ADA AKUN TERDAFTAR</h4>
                                                <p className="text-[9px] text-white/20 max-w-xs leading-relaxed mt-2">Silakan siapkan kredensial akses untuk memberikan izin login pada portal ISP ini.</p>
                                            </div>
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
                                            <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">{label}</label>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 group-focus-within:text-gold-accent transition-colors pointer-events-none">{icon}</span>
                                                <input
                                                    className="w-full rounded-xl bg-black/40 border border-white/10 pl-8 pr-3 py-2 text-[11px] font-bold text-white outline-none focus:border-gold-accent/50 transition-all placeholder:text-white/10"
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
                                        <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Password Baru <span className="text-white/20 normal-case font-normal">(kosong)</span></label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-white/20 group-focus-within:text-gold-accent transition-colors pointer-events-none">lock</span>
                                            <input
                                                className="w-full rounded-xl bg-black/40 border border-white/10 pl-8 pr-8 py-2 text-[11px] font-bold text-white outline-none transition-all focus:border-gold-accent/50 placeholder:text-white/10"
                                                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                                                placeholder="••••••••"
                                                type={showPassword ? "text" : "password"}
                                                value={userForm.password}
                                            />
                                            <button
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                                                onClick={() => setShowPassword(s => !s)}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[12px]">{showPassword ? "visibility_off" : "visibility"}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {userPopupError && (
                                        <p className="text-[10px] font-bold text-[#ff2400] bg-[#ff2400]/5 border border-[#ff2400]/20 rounded-2xl px-5 py-3.5 leading-relaxed">{userPopupError}</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        {!userPopupLoading && (
                            <div className="mt-6 flex justify-end gap-3 relative z-10">
                                {userPopupMode === "view" ? (
                                    <>
                                        <button
                                            className="px-4 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                                            onClick={() => { setUserPopupOpen(false); setShowPassword(false); }}
                                            type="button"
                                        >
                                            Tutup
                                        </button>
                                        <button
                                            className="px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-gold-accent/40 text-[8px] font-black uppercase tracking-widest text-white hover:text-gold-accent transition-all duration-300 flex items-center gap-1.5"
                                            onClick={() => { setUserPopupMode("edit"); setUserPopupFeedback(""); setUserPopupError(""); setShowPassword(false); }}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                                            {userPopupData?.hasUser ? "Edit Akun" : "Buat Akun"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="px-4 py-1.5 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
                                            onClick={() => { setUserPopupMode("view"); setUserPopupError(""); setShowPassword(false); }}
                                            type="button"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            className="px-4 py-1.5 rounded-lg bg-gold-accent text-[8px] font-black uppercase tracking-widest text-slate-900 hover:opacity-90 active:scale-95 transition-all shadow-gold-glow flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={userPopupSaving}
                                            onClick={() => void handleSaveUserPopup()}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">save</span>
                                            {userPopupSaving ? "Menyimpan..." : "Simpan"}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Entry Point Editor Modal */}
            {entryPointEditor && createPortal(
                <div className="fixed inset-0 z-[1500] flex items-center justify-center px-4 backdrop-blur-md bg-black/60">
                    <div className="w-full max-w-sm rounded-2xl glass-card backdrop-blur-xl p-5 border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-black text-white tracking-widest uppercase">
                                {entryPointEditor.mode === "add" ? "Tambah Titik Masuk" : "Edit Titik Masuk"}
                            </h3>
                            <button className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-[#ff2400] transition-all" onClick={() => setEntryPointEditor(null)} type="button">
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Label / Nama Titik *</label>
                                <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="Gerbang Utara KIMA" value={entryPointEditor.data.label} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, label: e.target.value } }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Latitude *</label>
                                    <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="-5.0929" value={entryPointEditor.data.latitude} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, latitude: e.target.value } }))} />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Longitude *</label>
                                    <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="119.5018" value={entryPointEditor.data.longitude} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, longitude: e.target.value } }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Jenis Fiber</label>
                                    <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="SM" value={entryPointEditor.data.fiberType} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, fiberType: e.target.value } }))} />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Core Capacity</label>
                                    <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="12" value={entryPointEditor.data.coreCapacity} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, coreCapacity: e.target.value } }))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Status</label>
                                <select className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" value={entryPointEditor.data.status} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, status: e.target.value } }))}>
                                    <option value="aktif">Aktif</option>
                                    <option value="draft">Draft</option>
                                    <option value="nonaktif">Nonaktif</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Keterangan</label>
                                <input type="text" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-gold-accent/50 transition-all" placeholder="Opsional" value={entryPointEditor.data.description} onChange={(e) => setEntryPointEditor((prev) => ({ ...prev, data: { ...prev.data, description: e.target.value } }))} />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button type="button" className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/50 hover:bg-white/10 transition-all" onClick={() => setEntryPointEditor(null)}>Batal</button>
                            <button type="button" className="px-4 py-2 rounded-lg bg-gold-accent text-[10px] font-black text-[#0f141e] hover:bg-gold-accent/80 transition-all disabled:opacity-40" disabled={entryPointSaving || !entryPointEditor.data.label.trim() || !entryPointEditor.data.latitude || !entryPointEditor.data.longitude} onClick={handleSaveEntryPoint}>
                                {entryPointSaving ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-[#ff2400]/5 blur-[100px]" />
            </div>

            <div className="space-y-4 pb-20 pt-2 md:pt-4">
                {/* 1. TOP BAR & PROFILE CARD SECTION */}
                <div className="flex flex-col gap-2">
                    {/* Top Bar: Back & Actions */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {!isIsp && (
                                <button
                                    className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-gold-accent transition-all group"
                                    onClick={onBack}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-[10px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                                    KEMBALI KE WORKSPACE
                                </button>
                            )}
                        </div>

                        {!isTeknisi && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    className="hidden md:flex h-7 px-3 items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-sm group text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                    onClick={() => void loadDetail()}
                                    title="Refresh Data"
                                >
                                    <span className="material-symbols-outlined text-[10px] group-hover:rotate-180 transition-transform duration-500">sync</span>
                                    Refresh
                                </button>
                                {/* Tombol Akun ISP */}
                                {!isIsp && (
                                    <button
                                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                        onClick={() => void openUserPopup()}
                                        title="Lihat / Edit Akun ISP"
                                    >
                                        <span className="material-symbols-outlined text-[10px]">manage_accounts</span>
                                        Akun Akses
                                    </button>
                                )}
                                {canEditIsp && (
                                    <button
                                        className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                        onClick={() => onEditIsp?.(detail ?? isp)}
                                        title="Edit ISP"
                                    >
                                        <span className="material-symbols-outlined text-[10px]">edit_note</span>
                                        Edit ISP
                                    </button>
                                )}
                                {canDeleteIsp && (
                                    <button
                                        className="h-7 px-3 flex items-center gap-1.5 rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm text-[8px] font-black uppercase tracking-widest backdrop-blur-md"
                                        onClick={handleDeleteIsp}
                                        title="Hapus ISP"
                                    >
                                        <span className="material-symbols-outlined text-[10px]">delete_forever</span>
                                        Hapus ISP
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Profile Card */}
                    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shadow-glass-depth">
                        {/* Ambient glow */}
                        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gold-accent/[0.04] blur-[100px]" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-blue-500/[0.03] blur-[80px]" />

                        {/* Top accent line */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-accent/30 to-transparent" />

                        <div className="relative p-4 md:p-5">
                            {/* Row 1: Identity */}
                            <div className="flex items-start justify-between">
                                {/* Left: label + name */}
                                <div className="min-w-0 flex-1 space-y-1.5 md:space-y-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="hidden md:flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gold-accent/20 bg-gold-accent/10 text-gold-accent backdrop-blur-md">
                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>corporate_fare</span>
                                        </div>
                                        <p className="text-[8px] md:text-[7px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-gold-accent/60 md:text-white/20 leading-none">Internet Service Provider</p>
                                    </div>
                                    <h1 className="text-xl md:text-xl font-black tracking-tight text-white uppercase leading-tight">
                                        {ispName}
                                    </h1>
                                </div>

                                {/* Right: status pill (Desktop Only) */}
                                <div className="hidden md:flex shrink-0 items-start">
                                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 ${isOperationallyActive(detail?.status ?? isp.status) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                        <span className={`material-symbols-outlined text-[12px] ${isOperationallyActive(detail?.status ?? isp.status) ? 'text-emerald-400' : 'text-white/30'}`}>{isOperationallyActive(detail?.status ?? isp.status) ? 'check_circle' : 'cancel'}</span>
                                        <div>
                                            <p className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20">Status</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${isOperationallyActive(detail?.status ?? isp.status) ? 'text-emerald-400' : 'text-white/30'}`}>{getOperationalLabel(detail?.status ?? isp.status)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`mt-3 md:mt-4 md:block space-y-3 md:space-y-4 ${isProfileExpanded ? 'block' : 'hidden'}`}>
                                {/* Divider */}
                                <div className="h-px bg-white/[0.05]" />

                                {/* Row 2: Metadata grid */}
                                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:gap-y-5 sm:grid-cols-4 lg:grid-cols-4">
                                    {/* Nomor Kontrak */}
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Nomor Kontrak</p>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="material-symbols-outlined text-[10px] sm:text-[12px] scale-[0.75] sm:scale-100 origin-center text-gold-accent/60">description</span>
                                            <p className="text-[11px] font-black text-gold-accent uppercase tracking-wide italic">{contractRef}</p>
                                        </div>
                                    </div>

                                    {/* Periode Awal Kontrak */}
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Periode Awal Kontrak</p>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="material-symbols-outlined text-[10px] sm:text-[12px] scale-[0.75] sm:scale-100 origin-center text-emerald-400/60">event_available</span>
                                            <p className="text-[11px] font-black text-white tracking-wide font-mono">
                                                {detail?.contractStartDate ?? isp.contractStartDate ? formatDate(detail?.contractStartDate ?? isp.contractStartDate) : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Periode Berjalan */}
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Periode Berjalan</p>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="material-symbols-outlined text-[10px] sm:text-[12px] scale-[0.75] sm:scale-100 origin-center text-sky-400/60">date_range</span>
                                            <p className="text-[11px] font-black text-white tracking-wide font-mono">
                                                {detail?.contractPeriodStart ?? isp.contractPeriodStart ?? detail?.contractPeriodEnd ?? isp.contractPeriodEnd
                                                    ? <>{formatDate(detail?.contractPeriodStart ?? isp.contractPeriodStart)}<span className="mx-1.5 text-white/20 font-normal">—</span>{formatDate(detail?.contractPeriodEnd ?? isp.contractPeriodEnd)}</>
                                                    : "—"
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Paket */}
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <p className="text-[8px] font-black uppercase tracking-[0.35em] text-white/20">Paket</p>
                                        <div className="flex items-center gap-1 sm:gap-2">
                                            <span className="material-symbols-outlined text-[10px] sm:text-[12px] scale-[0.75] sm:scale-100 origin-center text-amber-400/60">hub</span>
                                            <p className="text-[11px] font-black text-white tracking-wide uppercase">
                                                {(() => {
                                                    const packageQty = detail?.packageQuantity ?? isp.packageQuantity ?? detail?.jumlah ?? isp.jumlah;
                                                    return packageQty ? `${packageQty} Core` : "- Core";
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer: Status + Toggle (Mobile Only) */}
                            <div className="md:hidden mt-3 pt-2 -mb-2 border-t border-white/[0.05] flex items-center justify-between">
                                {/* Left: Status Badge */}
                                <div className={`flex items-center px-2 py-0.5 rounded-full border shadow-sm backdrop-blur-sm ${isOperationallyActive(detail?.status ?? isp.status) ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' : 'bg-white/5 border-white/10 text-white/40 shadow-white/5'}`}>
                                    <span className="text-[7px] font-black uppercase tracking-[0.2em]">{getOperationalLabel(detail?.status ?? isp.status)}</span>
                                </div>

                                {/* Right: Toggle Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                                    className="flex items-center gap-1 text-[8.5px] font-black tracking-[0.2em] text-white/40 hover:text-gold-accent transition-colors"
                                >
                                    {isProfileExpanded ? "Lebih Sedikit" : "Lebih Lengkap"}
                                    <span className="material-symbols-outlined text-[10px]">{isProfileExpanded ? "expand_less" : "expand_more"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Bottom accent line */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
                    </div>
                </div>

                {/* ══════ MOBILE STICKY HEADER (TABS) ══════ */}
                <div className="md:hidden fixed top-4 left-4 z-[45]">
                    {/* Left: Tab Menu Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsMobileTabMenuOpen(!isMobileTabMenuOpen)}
                            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm p-1.5 pl-3 pr-4 anim-surface hover:bg-white/20"
                            type="button"
                        >
                            <span className="material-symbols-outlined text-base text-gold-accent">menu</span>
                            <span className="text-[10px] font-black tracking-widest uppercase text-white">
                                {[
                                    { id: "overview", label: "Ringkasan" },
                                    { id: "customers", label: "Daftar Lokasi" },
                                    { id: "jalur", label: "Peta Jalur" },
                                    { id: "contracts", label: "Kontrak" },
                                    { id: "risalah", label: "Dokumen" },
                                    { id: "timeline", label: "Timeline" }
                                ].find(t => t.id === activeTab)?.label || "Menu"}
                            </span>
                        </button>

                        {isMobileTabMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMobileTabMenuOpen(false)}></div>
                                <div className="absolute top-full left-0 mt-3 w-52 origin-top-left p-2 rounded-2xl glass-premium border border-white/10 shadow-glass-depth z-50 flex flex-col gap-1 animate-in fade-in zoom-in duration-300">
                                    {[
                                        { id: "overview", label: "Ringkasan", icon: "dashboard" },
                                        { id: "customers", label: "Daftar Lokasi", icon: "groups" },
                                        { id: "jalur", label: "Peta Jalur", icon: "map" },
                                        ...(currentRole !== "teknisi" ? [
                                            { id: "contracts", label: "Kontrak", icon: "description" },
                                            { id: "risalah", label: "Dokumen", icon: "inventory_2" },
                                            { id: "timeline", label: "Timeline", icon: "history" }
                                        ] : []),
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                handleTabChange(tab.id);
                                                setIsMobileTabMenuOpen(false);
                                            }}
                                            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${activeTab === tab.id
                                                ? 'bg-gold-accent/10 text-gold-accent border border-gold-accent/20'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                }`}
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 2. TABS NAVIGATION (DESKTOP) */}
                <section className="hidden md:block glass-card backdrop-blur-xl rounded-2xl p-1 border-white/10 shadow-glass-depth relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
                    <nav className="relative flex flex-wrap gap-1">
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
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black tracking-[0.1em] transition-all duration-500 relative overflow-hidden ${activeTab === tab.id ? "text-white bg-gold-accent shadow-gold-glow" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                                onClick={() => handleTabChange(tab.id)}
                                type="button"
                            >
                                <span className={`material-symbols-outlined relative z-10 ${activeTab === tab.id ? "scale-110 text-white" : ""}`} style={{ fontSize: "14px" }}>{tab.icon}</span>
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
                            <div className="rounded-xl bg-[#ff2400]/10 border border-[#ff2400]/20 p-3 flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[#ff2400] text-[14px]">report</span>
                                <p className="text-[10px] font-bold text-white/80">{error}</p>
                            </div>
                        )}

                        {activeTab === "overview" && (
                            <div className="space-y-2">

                                {/* Stats Cards */}
                                <section className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12">
                                    {/* Card 1: Total Lokasi */}
                                    <div className="md:col-span-2 lg:col-span-2 glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth relative overflow-hidden group hover:border-gold-accent/30 transition-all duration-500 border-l-2 border-l-gold-accent">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-gold-accent/10 transition-colors duration-500" />
                                        <div className="flex flex-col h-full justify-center text-center relative z-10">
                                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-1">Total Lokasi</p>
                                            <span className="text-4xl font-black text-white tracking-tighter drop-shadow-md">{summary.tenantCount ?? allTenants.length}</span>
                                        </div>
                                    </div>

                                    {/* Card 2: Status Lokasi */}
                                    <div className="md:col-span-1 lg:col-span-5 glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500 border-l-2 border-l-emerald-500">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors duration-500" />
                                        <div className="relative z-10 flex flex-col h-full justify-center">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-3.5 w-1 bg-gold-accent rounded-full"></span>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Status Kontrak</p>
                                                </div>
                                            </div>

                                            {/* Badges Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-400/5 border border-emerald-400/10 hover:bg-emerald-400/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Beroperasi</span>
                                                    </div>
                                                    <span className="text-base font-black text-emerald-400">{statusBeroperasiCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-sky-400/5 border border-sky-400/10 hover:bg-sky-400/10 transition-colors">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest truncate">Belum Beroperasi</span>
                                                    </div>
                                                    <span className="text-base font-black text-sky-400 shrink-0 ml-1">{statusBelumBeroperasiCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#ff2400]/5 border border-[#ff2400]/10 hover:bg-[#ff2400]/10 transition-colors">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest truncate">Belum Diperpanjang</span>
                                                    </div>
                                                    <span className="text-base font-black text-[#ff2400] shrink-0 ml-1">{statusBelumDiperpanjangCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Berhenti</span>
                                                    </div>
                                                    <span className="text-base font-black text-white/60">{statusBerhentiCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: Informasi Jalur */}
                                    <div className="md:col-span-1 lg:col-span-5 glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 border-l-2 border-l-blue-500">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors duration-500" />
                                        <div className="relative z-10 flex flex-col h-full justify-center">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-3.5 w-1 bg-gold-accent rounded-full"></span>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Status Jalur FO</p>
                                                </div>
                                            </div>

                                            {/* Badges Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-400/5 border border-emerald-400/10 hover:bg-emerald-400/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Aktif</span>
                                                    </div>
                                                    <span className="text-base font-black text-emerald-400">{pathAktifCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#ff2400]/5 border border-[#ff2400]/10 hover:bg-[#ff2400]/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Gangguan</span>
                                                    </div>
                                                    <span className="text-base font-black text-[#ff2400]">{pathGangguanCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-400/5 border border-amber-400/10 hover:bg-amber-400/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Perbaikan</span>
                                                    </div>
                                                    <span className="text-base font-black text-amber-400">{pathPerbaikanCount}</span>
                                                </div>
                                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Nonaktif</span>
                                                    </div>
                                                    <span className="text-base font-black text-white/60">{pathNonaktifCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                                    {/* Action Items List - Separated ISP & Lokasi */}
                                    <div className="lg:col-span-2 space-y-2">
                                        {/* 1. Tindak Lanjut ISP */}
                                        <div className="glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth relative overflow-hidden group/isp-actions">
                                            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-accent/5 blur-3xl transition-all duration-700 group-hover/isp-actions:bg-gold-accent/10" />

                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xs md:text-sm font-bold text-white tracking-widest flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-gold-accent" style={{ fontSize: "19px" }}>admin_panel_settings</span>
                                                    Tindak Lanjut ISP
                                                </h3>
                                                {!isIsp && !isTeknisi && (
                                                    <div className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-gold-accent/10 border border-gold-accent/20 text-gold-accent text-[10px] font-black shadow-sm">
                                                        {ispActionItems.length}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-3 relative z-10">
                                                {ispActionItems.length === 0 ? (
                                                    <p className="text-xs font-bold text-white/20 italic p-8 text-center border border-dashed border-white/10 rounded-2xl">Tidak ada tindak lanjut administrasi ISP.</p>
                                                ) : (
                                                    ispActionItems.map((item) => {
                                                        const severityToneMap = {
                                                            critical: "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]",
                                                            warning: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                                            info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
                                                        };
                                                        const fallbackToneMap = {
                                                            red: "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]",
                                                            blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
                                                            amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                                            orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
                                                        };
                                                        const toneStyle = severityToneMap[item.severity] || fallbackToneMap[item.tone] || fallbackToneMap.orange;
                                                        const itemTitle = item.title || "Tindak lanjut ISP";
                                                        const itemDescription = item.message || item.description || "Ada administrasi ISP yang perlu dilengkapi.";
                                                        const itemKey = item.id || item.key || itemTitle;
                                                        const actionLabel = item.actionLabel || "Tindakan Admin";
                                                        const statusLabel = item.readAt ? "Dibaca" : "Belum Dibaca";

                                                        return (
                                                            <div
                                                                key={itemKey}
                                                                className={`flex flex-col lg:flex-row lg:items-center justify-between gap-2 rounded-sm p-2 border transition-all hover:scale-[1.01] hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold-accent/40 ${toneStyle}`}
                                                                onClick={() => handleIspActionClick(item)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter" || event.key === " ") {
                                                                        event.preventDefault();
                                                                        handleIspActionClick(item);
                                                                    }
                                                                }}
                                                                role="button"
                                                                tabIndex={0}
                                                                title="Buka area penyelesaian"
                                                            >
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>contract_edit</span>
                                                                        <h4 className="text-xs font-bold">{itemTitle}</h4>
                                                                        {item.id && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" title={statusLabel} />}
                                                                    </div>
                                                                    <p className="text-[9px] font-bold opacity-70 leading-relaxed max-w-xl">{itemDescription}</p>
                                                                </div>
                                                                <span className="text-[8px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10">{actionLabel}</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Tindak Lanjut Lokasi */}
                                        <div className="glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth relative overflow-hidden group/lokasi-actions">
                                            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#ff2400]/5 blur-3xl transition-all duration-700 group-hover/lokasi-actions:bg-[#ff2400]/10" />

                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xs md:text-sm font-bold text-white tracking-widest flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[#ff2400]" style={{ fontSize: "19px" }}>location_away</span>
                                                    Tindak Lanjut Lokasi
                                                </h3>
                                                <div className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[#ff2400]/10 border border-[#ff2400]/20 text-[#ff2400] text-[10px] font-black shadow-sm">
                                                    {totalTenantActionCount}
                                                </div>
                                            </div>

                                            <div className="space-y-3 relative z-10">
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
                                                                className={`flex flex-col lg:flex-row lg:items-center justify-between gap-2 rounded-sm p-2 border transition-all ${canOpenTenantDetail ? "hover:scale-[1.01] hover:shadow-lg cursor-pointer" : ""} ${isGangguan ? "bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]" : "bg-white/5 border-white/10 text-white/80"}`}
                                                                onClick={() => {
                                                                    if (canOpenTenantDetail) onOpenTenant(t, isGangguan ? "jalur" : "overview");
                                                                }}
                                                            >
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>{isGangguan ? "router" : "warning"}</span>
                                                                        <h4 className="text-xs font-bold">{t.name}</h4>
                                                                    </div>
                                                                    <p className="text-[9px] font-bold opacity-70">
                                                                        {isGangguan ? "Terdeteksi gangguan jalur fiber optik." : `Terdapat ${t.totalActions || 1} rincian berkas yang perlu dilengkapi.`}
                                                                    </p>
                                                                </div>
                                                                {canOpenTenantDetail && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[8px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10">Buka Lokasi</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sidebar Stats - Updated */}
                                    <div className="space-y-2">

                                        <div className="glass-card backdrop-blur-xl rounded-lg p-3 border-white/10 shadow-glass-depth">
                                            <h3 className="text-xs md:text-sm font-bold text-white tracking-widest mb-5 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-400" style={{ fontSize: "19px" }}>history</span>
                                                Aktivitas Terkini
                                            </h3>
                                            <div className="space-y-1.5">
                                                {timeline.slice(0, 3).map((e) => (
                                                    <div key={e.id} className="group/history py-2 border-b border-white/5 last:border-0 relative">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center shrink-0 ${e.bg || 'bg-white/5'} ${e.color || 'text-white/60'} group-hover/history:scale-105 transition-transform duration-300`}>
                                                                <span className="material-symbols-outlined text-[10px]">{e.icon}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                    <p className="text-[12px] font-bold text-white/90 truncate group-hover/history:text-gold-accent transition-colors">{e.title}</p>
                                                                    <span className="text-[10px] font-black text-white/30 uppercase shrink-0">
                                                                        {new Date(e.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', ' •')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-white/40 leading-relaxed group-hover/history:text-white/60 transition-colors">{e.description}</p>
                                                            </div>
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
                            <div className="space-y-2.5">
                                {/* ══════ CARD 1: HEADER & STATS ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-4 md:p-5 border-white/10 shadow-glass-depth">
                                    <div className="flex flex-col justify-between gap-2.5 lg:gap-4 lg:flex-row lg:items-end">
                                        <div className="space-y-2.5 md:space-y-3 flex-1">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                                    <h2 className="text-base font-black text-white tracking-widest uppercase">Inventori Lokasi</h2>
                                                </div>
                                                <p className="text-[9px] font-bold text-white/20 tracking-wider">Manajemen titik layanan dan status operasional.</p>
                                            </div>

                                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                                                <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 shadow-sm">
                                                    <span className="text-[8px] font-bold text-white/40 tracking-widest">Total:</span>
                                                    <span className="text-[10px] font-bold text-white">{allTenants.length}</span>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
                                                    <span className="text-[8px] font-bold text-emerald-400 tracking-widest">Beroperasi:</span>
                                                    <span className="text-[10px] font-bold text-emerald-400">{allTenants.filter(t => t.status === "aktif").length}</span>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-lg bg-[#ff2400]/10 border border-[#ff2400]/20 shadow-sm">
                                                    <span className="text-[8px] font-bold text-[#ff2400] tracking-widest">Belum Diperpanjang:</span>
                                                    <span className="text-[10px] font-bold text-[#ff2400]">{allTenants.filter(t => t.status === "expired").length}</span>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 shadow-sm">
                                                    <span className="text-[8px] font-bold text-white/20 tracking-widest">Berhenti:</span>
                                                    <span className="text-[10px] font-bold text-white/40">{allTenants.filter(t => t.status === "berhenti").length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {!isTeknisi && (
                                            <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-2 lg:mt-0">
                                                <button
                                                    className="h-8 lg:h-7 px-3 justify-center rounded bg-white/5 border border-white/10 text-white text-[8px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5"
                                                    onClick={handleExportToExcel}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>description</span>
                                                    Ekspor Excel
                                                </button>
                                                {canCreateTenant && !isIsp && (
                                                    <button
                                                        className="h-8 lg:h-7 px-4 justify-center rounded bg-gold-accent text-slate-900 text-[8px] font-black uppercase tracking-[0.1em] shadow-gold-glow active:scale-95 transition-all flex items-center gap-1.5"
                                                        onClick={() => onOpenCreateTenant?.(detail ?? isp)}
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined text-slate-900" style={{ fontSize: "16px" }}>add_location</span>
                                                        Tambah Lokasi
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* ══════ CARD 2: FILTER & TABLE ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-3 md:p-4 border-white/10 shadow-glass-depth">
                                    {/* ══════ REFINED FILTER PANEL ══════ */}

                                    {/* 1. DESKTOP VIEW FILTER PANEL (hidden on mobile, visible on desktop/laptop) */}
                                    <div className="hidden lg:flex flex-wrap items-end gap-1.5 w-full relative z-50 mb-1.5">
                                        {/* 1. Search */}
                                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                                            <p className="text-[8px] font-black uppercase tracking-[0.3em] pl-1 text-gold-accent/40">Cari Lokasi</p>
                                            <div className="relative group">
                                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-all" style={{ fontSize: "16px" }}>search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Nama atau ID Lokasi..."
                                                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-black/20 border border-white/10 text-[9px] font-bold text-white outline-none focus:border-gold-accent/40 focus:bg-black/40 transition-all shadow-inner-glass"
                                                    value={tenantSearch}
                                                    onChange={(e) => setTenantSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* 2. Status Kontrak */}
                                        <div className="w-full md:w-[160px]">
                                            <GlassCustomSelect
                                                label="Status Kontrak"
                                                heightClass="h-8"
                                                icon="verified_user"
                                                value={tenantStatusFilter}
                                                onChange={setTenantStatusFilter}
                                                options={[
                                                    { value: "all", label: "Semua Status" },
                                                    { value: "aktif", label: "Beroperasi" },
                                                    { value: "expired", label: "Belum Diperpanjang" },
                                                    { value: "berhenti", label: "Berhenti" }
                                                ]}
                                            />
                                        </div>

                                        {/* 3. Paket */}
                                        <div className="w-full md:w-[160px]">
                                            <GlassCustomSelect
                                                label="Jenis Paket"
                                                heightClass="h-8"
                                                icon="inventory_2"
                                                value={tenantPaketFilter}
                                                onChange={setTenantPaketFilter}
                                                options={[
                                                    { value: "all", label: "Semua Paket" },
                                                    { value: "core", label: "Core" },
                                                    { value: "sharing_core", label: "Sharing Core" }
                                                ]}
                                            />
                                        </div>

                                        {/* 4. Sorting */}
                                        <div className="w-full md:w-[150px]">
                                            <GlassCustomSelect
                                                label="Urutkan"
                                                heightClass="h-8"
                                                icon="sort"
                                                value={tenantSortMethod}
                                                onChange={setTenantSortMethod}
                                                options={[
                                                    { value: "newest", label: "Terbaru" },
                                                    { value: "oldest", label: "Terlama" },
                                                    { value: "name_asc", label: "Nama A-Z" },
                                                    { value: "name_desc", label: "Nama Z-A" }
                                                ]}
                                            />
                                        </div>

                                        {/* 5. Reset Filter */}
                                        {(() => {
                                            const isFilterActive = tenantSearch || tenantStatusFilter !== "all" || tenantPaketFilter !== "all" || tenantSortMethod !== "newest";
                                            return (
                                                <button
                                                    onClick={() => {
                                                        setTenantSearch("");
                                                        setTenantStatusFilter("all");
                                                        setTenantPaketFilter("all");
                                                        setTenantSortMethod("newest");
                                                    }}
                                                    title="Hapus Filter"
                                                    disabled={!isFilterActive}
                                                    className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all shrink-0 backdrop-blur-md ${isFilterActive ? "border-[#ff2400]/40 bg-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white cursor-pointer shadow-[0_0_15px_rgba(255,36,0,0.4)]" : "bg-white/5 border-white/10 text-white/40 opacity-40 cursor-not-allowed"}`}
                                                    type="button"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>filter_alt_off</span>
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* 2. MOBILE VIEW FILTER PANEL (hidden on desktop/laptop, visible on mobile) */}
                                    <div className="lg:hidden flex flex-col gap-3 relative z-50 mb-3">
                                        {/* ── Search & Filter Toggle Row ── */}
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" style={{ fontSize: "17px" }}>search</span>
                                                <input
                                                    type="text"
                                                    placeholder="Cari nama lokasi..."
                                                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] font-semibold text-white placeholder-white/20 outline-none focus:border-gold-accent/40 focus:bg-white/[0.07] transition-all"
                                                    value={tenantSearch}
                                                    onChange={(e) => setTenantSearch(e.target.value)}
                                                />
                                                {tenantSearch && (
                                                    <button onClick={() => setTenantSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                                                        <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>close</span>
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowTenantFilters(!showTenantFilters)}
                                                className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border transition-all ${showTenantFilters
                                                        ? "bg-gold-accent/20 border-gold-accent/40 text-gold-accent shadow-[0_0_15px_rgba(212,175,55,0.25)]"
                                                        : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:border-white/20"
                                                    }`}
                                                title="Filter Rincian"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>filter_list</span>
                                            </button>
                                        </div>

                                        {/* ── Collapsible Filter Panel ── */}
                                        {showTenantFilters && (
                                            <div className="flex flex-col gap-3 pt-2 border-t border-white/[0.05] animate-in fade-in slide-in-from-top-2 duration-200">
                                                {/* Status */}
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/25">Status</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[
                                                            { value: "aktif", label: "Beroperasi" },
                                                            { value: "expired", label: "Belum Perpanjang" },
                                                            { value: "berhenti", label: "Berhenti" },
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => setTenantStatusFilter(tenantStatusFilter === opt.value ? "all" : opt.value)}
                                                                className={`h-7 px-3 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all ${tenantStatusFilter === opt.value
                                                                        ? "bg-gold-accent/20 border-gold-accent/40 text-gold-accent shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                                                                        : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/20"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Paket */}
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/25">Paket</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[
                                                            { value: "core", label: "Core" },
                                                            { value: "sharing_core", label: "Sharing Core" },
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => setTenantPaketFilter(tenantPaketFilter === opt.value ? "all" : opt.value)}
                                                                className={`h-7 px-3 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all ${tenantPaketFilter === opt.value
                                                                        ? "bg-sky-500/15 border-sky-500/30 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
                                                                        : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/20"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Urutkan */}
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/25">Urutkan</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[
                                                            { value: "newest", label: "Terbaru" },
                                                            { value: "oldest", label: "Terlama" },
                                                            { value: "name_asc", label: "A – Z" },
                                                            { value: "name_desc", label: "Z – A" },
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => setTenantSortMethod(opt.value)}
                                                                className={`h-7 px-3 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all ${tenantSortMethod === opt.value
                                                                        ? "bg-violet-500/15 border-violet-500/30 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.15)]"
                                                                        : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/20"
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Footer: hasil + reset ── */}
                                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                                                {filteredTenants.length} lokasi
                                            </span>
                                            {(tenantSearch || tenantStatusFilter !== "all" || tenantPaketFilter !== "all" || tenantSortMethod !== "newest") && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTenantSearch("");
                                                        setTenantStatusFilter("all");
                                                        setTenantPaketFilter("all");
                                                        setTenantSortMethod("newest");
                                                    }}
                                                    className="flex items-center gap-1 h-6 px-2.5 rounded-full text-[8px] font-black uppercase tracking-wide border border-[#ff2400]/30 bg-[#ff2400]/10 text-[#ff2400] hover:bg-[#ff2400]/20 transition-all"
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>close</span>
                                                    Reset Filter
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>

                                        {/* ══════ DESKTOP VIEW (TABLE) ══════ */}
                                        <div className="hidden xl:block overflow-x-auto custom-scrollbar rounded-lg border border-white/10 bg-black/55 backdrop-blur-3xl shadow-2xl">
                                            <table className="min-w-full border-collapse whitespace-nowrap">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10">
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">No</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-gold-accent border-r border-white/10">Lokasi</th>
                                                        <th colSpan="2" className="px-3 py-1.5 text-center text-[8px] font-black tracking-[0.4em] text-white/30 uppercase border-b border-white/10 border-r border-white/10">Status</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Sisa Sewa</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Periode Awal</th>
                                                        <th colSpan="2" className="px-3 py-1.5 text-center text-[8px] font-black tracking-[0.4em] text-white/30 uppercase border-b border-white/10 border-r border-white/10">Kontrak Berjalan</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Paket</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Jumlah</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Tindak Lanjut</th>
                                                        <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40">Aksi</th>
                                                    </tr>
                                                    <tr className="bg-white/5">
                                                        <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/10">Kontrak</th>
                                                        <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/10">Jalur</th>
                                                        <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/10">Awal</th>
                                                        <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/10">Akhir</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/10">
                                                    {filteredTenants.map((tenant, idx) => (
                                                        <tr key={tenant.id} className="hover:bg-white/[0.04] transition-colors group/row">
                                                            <td className="px-3 py-2.5 text-center text-[11px] font-bold text-white/20 border-r border-white/10">{String(idx + 1).padStart(2, '0')}</td>
                                                            <td className="px-3 py-2.5 border-r border-white/10">
                                                                <p className="text-[11px] font-bold text-white group-hover/row:text-gold-accent transition-colors">{tenant.name}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[8px] font-bold border transition-all ${normalizeOperationalStatus(tenant.status) === 'aktif' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : normalizeOperationalStatus(tenant.status) === 'expired' ? 'bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20' : isPendingOperationalStatus(tenant.status) ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-white/5 text-white/30 border-white/10'}`}>
                                                                    {getOperationalLabel(tenant.status)}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                {(() => {
                                                                    const routeStatus = resolveRouteStatus(tenant.status, tenant.route?.activeFlowStatus ?? tenant.status_jalur);
                                                                    const colors = {
                                                                        aktif: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                                                                        gangguan: "bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20",
                                                                        nonaktif: "bg-white/5 text-white/30 border-white/10",
                                                                    };
                                                                    const color = colors[routeStatus] || colors.nonaktif;
                                                                    return (
                                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-bold border ${color}`}>
                                                                            {routeStatus === 'aktif' ? "Aktif" : routeStatus === 'gangguan' ? "Gangguan" : "Nonaktif"}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                {(() => {
                                                                    const endDateStr = tenant.contractPeriodInfo?.contractPeriodEnd ?? tenant.contractPeriodEnd;
                                                                    if (!endDateStr) return <span className="text-[10px] font-bold text-white/20">-</span>;
                                                                    const endDate = new Date(endDateStr);
                                                                    const today = new Date(todayIso);
                                                                    const diffTime = endDate.getTime() - today.getTime();
                                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                                    if (diffDays < 0) return <span className="text-[10px] font-bold text-[#ff2400]">Lewat {Math.abs(diffDays)} Hari</span>;
                                                                    if (diffDays === 0) return <span className="text-[10px] font-bold text-amber-400">Hari Ini</span>;
                                                                    if (diffDays < 30) return <span className="text-[10px] font-bold text-amber-400">{diffDays} Hari</span>;
                                                                    const diffMonths = Math.floor(diffDays / 30);
                                                                    return <span className="text-[10px] font-bold text-emerald-400">{diffMonths} Bulan</span>;
                                                                })()}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <p className="text-[10px] font-bold text-white/60 uppercase">{formatDate(tenant.contractPeriodInfo?.contractStartDate ?? tenant.contractStartDate)}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <p className="text-[10px] font-bold text-white/60 uppercase">{formatDate(tenant.contractPeriodInfo?.contractPeriodStart ?? tenant.contractPeriodStart)}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <p className="text-[10px] font-bold text-white/60 uppercase">{formatDate(tenant.contractPeriodInfo?.contractPeriodEnd ?? tenant.contractPeriodEnd)}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <p className="text-[11px] font-bold text-white/70 tracking-widest">{getPackageDisplay(tenant.packageInfo?.paket ?? tenant.paket).label}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <p className="text-[11px] font-bold text-white/70 tracking-widest">{tenant.packageInfo?.jumlah ?? tenant.contractSharingRatio ?? tenant.jumlah ?? '-'}</p>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center text-[11px] font-bold text-[#ff2400] border-r border-white/10">
                                                                {isTeknisi ? (
                                                                    (!tenant.route && tenant.status === "aktif") || (tenant.route?.activeFlowStatus ?? tenant.status_jalur) === "gangguan" ? "YA" : "-"
                                                                ) : getTenantActionCount(tenant, todayIso)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right">
                                                                <div className="flex justify-end gap-1.5">
                                                                    {!isTeknisi && canOpenTenantDetail && (
                                                                        <button className="w-6 h-6 flex items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all shadow-sm" onClick={() => onOpenTenant(tenant, "invoices")} title="Invoice">
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>receipt_long</span>
                                                                        </button>
                                                                    )}
                                                                    {canOpenTenantDetail && (
                                                                        <button className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 text-white hover:bg-white/10 transition-all shadow-sm" onClick={() => onOpenTenant(tenant, isTeknisi ? "jalur" : "overview")} title="Detail">
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>visibility</span>
                                                                        </button>
                                                                    )}
                                                                    {!isTeknisi && canEditTenant && (
                                                                        <button className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition-all shadow-sm" onClick={() => onEditTenant?.(tenant)} title="Edit">
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
                                                                        </button>
                                                                    )}
                                                                    {!isTeknisi && canDeleteTenant && (
                                                                        <button className="w-6 h-6 flex items-center justify-center rounded-md bg-[#ff2400]/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm" onClick={() => onDeleteTenant?.(tenant)} title="Hapus">
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredTenants.length === 0 && (
                                                        <tr>
                                                            <td colSpan="12" className="py-10 text-center">
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
                                                                        <span className="material-symbols-outlined text-2xl text-gold-accent/40">location_off</span>
                                                                    </div>
                                                                    <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">BELUM ADA RINCIAN LOKASI</h4>
                                                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">
                                                                        {tenantSearch || tenantStatusFilter !== "all" || tenantPaketFilter !== "all"
                                                                            ? "Tidak ada lokasi yang cocok dengan filter pencarian"
                                                                            : "Belum ada titik lokasi yang terdaftar untuk ISP ini"}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* ══════ MOBILE VIEW (CARD LAYOUT) ══════ */}
                                        <div className="xl:hidden flex flex-col gap-4 mt-3">
                                            {filteredTenants.map((tenant, idx) => {
                                                const endDateStr = tenant.contractPeriodInfo?.contractPeriodEnd ?? tenant.contractPeriodEnd;
                                                const diffDays = endDateStr ? Math.ceil((new Date(endDateStr) - new Date(todayIso)) / 86400000) : null;
                                                const routeStatus = resolveRouteStatus(tenant.status, tenant.route?.activeFlowStatus ?? tenant.status_jalur);
                                                const locStatus = normalizeOperationalStatus(tenant.status);
                                                const actionCount = isTeknisi
                                                    ? ((!tenant.route && tenant.status === "aktif") || routeStatus === "gangguan" ? "YA" : null)
                                                    : getTenantActionCount(tenant, todayIso);
                                                const hasAction = actionCount !== null && actionCount !== "-" && actionCount !== 0;
                                                return (
                                                    <div key={tenant.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">

                                                        {/* ── HEADER: nomor + nama ── */}
                                                        <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2.5 border-b border-white/[0.06]">
                                                            <span className="shrink-0 text-[10px] font-black text-gold-accent/60 tabular-nums">#{String(idx + 1).padStart(2, '0')}</span>
                                                            <p className="flex-1 text-[13px] font-black text-white uppercase tracking-wide leading-tight">{tenant.name}</p>
                                                            {diffDays !== null && (
                                                                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${diffDays < 0 ? 'bg-[#ff2400]/15 border-[#ff2400]/30 text-[#ff2400]' : diffDays < 30 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'}`}>
                                                                    {diffDays < 0 ? `Lewat ${Math.abs(diffDays)} hr` : diffDays === 0 ? 'Hari ini' : diffDays < 30 ? `${diffDays} hari` : `${Math.floor(diffDays / 30)} bln`}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* ── BODY: detail informasi ── */}
                                                        <div className="px-3.5 py-2.5 flex flex-col gap-2">

                                                            {/* Status */}
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${locStatus === 'aktif' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : locStatus === 'expired' ? 'bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]' : isPendingOperationalStatus(tenant.status) ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                                                    {getOperationalLabel(tenant.status)}
                                                                </span>
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${routeStatus === 'aktif' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : routeStatus === 'gangguan' ? 'bg-[#ff2400]/10 border-[#ff2400]/20 text-[#ff2400]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                                                    Jalur {routeStatus === 'aktif' ? 'Aktif' : routeStatus === 'gangguan' ? 'Gangguan' : 'Nonaktif'}
                                                                </span>
                                                            </div>

                                                            {/* Grid info: 2 kolom */}
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                {/* Paket & Jumlah */}
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Paket</p>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[11px] font-black text-white uppercase">{getPackageDisplay(tenant.packageInfo?.paket ?? tenant.paket).label}</span>
                                                                        <span className="w-px h-3 bg-white/15 shrink-0"></span>
                                                                        <span className="text-[11px] font-black text-gold-accent">{tenant.packageInfo?.jumlah ?? tenant.contractSharingRatio ?? tenant.jumlah ?? '–'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Periode Awal */}
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Periode Awal</p>
                                                                    <p className="text-[11px] font-bold text-white/60 font-mono">
                                                                        {formatDate(tenant.contractPeriodInfo?.contractStartDate ?? tenant.contractStartDate) || '–'}
                                                                    </p>
                                                                </div>

                                                                {/* Periode Berjalan — full width */}
                                                                <div className="col-span-2">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-0.5">Periode Berjalan</p>
                                                                    <p className="text-[11px] font-bold text-white/60 font-mono">
                                                                        {formatDate(tenant.contractPeriodInfo?.contractPeriodStart ?? tenant.contractPeriodStart)}
                                                                        <span className="mx-1.5 text-white/20">–</span>
                                                                        {formatDate(tenant.contractPeriodInfo?.contractPeriodEnd ?? tenant.contractPeriodEnd)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Tindak Lanjut */}
                                                            {!isIsp && (
                                                                <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Tindak Lanjut</span>
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${hasAction ? 'bg-[#ff2400]/15 border-[#ff2400]/30 text-[#ff2400]' : 'bg-white/5 border-white/10 text-white/25'}`}>
                                                                        {hasAction ? actionCount : '–'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* ── FOOTER: tombol aksi ── */}
                                                        <div className="border-t border-white/[0.06] flex">
                                                            {!isTeknisi && canOpenTenantDetail && (
                                                                <button
                                                                    className="flex-1 h-9 flex items-center justify-center gap-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors border-r border-white/[0.06]"
                                                                    onClick={() => onOpenTenant(tenant, "invoices")}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>receipt_long</span>
                                                                    <span className="text-[9.5px] font-black uppercase tracking-widest">Invoice</span>
                                                                </button>
                                                            )}
                                                            {canOpenTenantDetail && (
                                                                <button
                                                                    className="flex-1 h-9 flex items-center justify-center gap-1.5 text-white/70 hover:bg-white/5 transition-colors"
                                                                    onClick={() => onOpenTenant(tenant, isTeknisi ? "jalur" : "overview")}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>open_in_new</span>
                                                                    <span className="text-[9.5px] font-black uppercase tracking-widest">Detail</span>
                                                                </button>
                                                            )}
                                                            {!isTeknisi && canEditTenant && (
                                                                <button
                                                                    className="w-11 h-9 flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors border-l border-white/[0.06]"
                                                                    onClick={() => onEditTenant?.(tenant)}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
                                                                </button>
                                                            )}
                                                            {!isTeknisi && canDeleteTenant && (
                                                                <button
                                                                    className="w-11 h-9 flex items-center justify-center text-[#ff2400]/70 hover:bg-[#ff2400]/10 transition-colors border-l border-white/[0.06]"
                                                                    onClick={() => onDeleteTenant?.(tenant)}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {filteredTenants.length === 0 && (
                                                <div className="py-12 flex flex-col items-center justify-center gap-3">
                                                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10">
                                                        <span className="material-symbols-outlined text-2xl text-gold-accent/40">location_off</span>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Belum Ada Lokasi</p>
                                                        <p className="text-[8px] text-white/20 mt-1">
                                                            {tenantSearch || tenantStatusFilter !== "all" || tenantPaketFilter !== "all"
                                                                ? "Tidak cocok dengan filter"
                                                                : "Belum ada lokasi terdaftar"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === "jalur" && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Header Section */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-4 border-white/10 shadow-glass-depth relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="h-4 w-1 bg-gold-accent rounded-full" />
                                                <h2 className="text-[12px] font-black text-white tracking-widest uppercase">Pemetaan Jalur FO</h2>
                                            </div>
                                            <p className="text-[9px] font-bold text-white/30 tracking-wider">Visualisasi rute layanan ke lokasi dan manajemen titik masuk ISP.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Main Map & Entry Points Grid */}
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                                    {/* Main Route Map */}
                                    <div className="xl:col-span-8 flex flex-col">
                                        <FoRouteMultiPreview
                                            tenants={allTenants}
                                            entryPoints={detail?.entryPoints || []}
                                            ispLogoUrl={detail?.logoUrl ?? detail?.logo_url ?? isp.logoUrl ?? isp.logo_url ?? ""}
                                            ispName={ispName}
                                            onTenantClick={(tenantId) => {
                                                if (!canOpenTenantDetail) return;
                                                const tenant = allTenants.find((t) => t.id === tenantId);
                                                if (tenant) onOpenTenant(tenant, "jalur");
                                            }}
                                        />
                                    </div>

                                    {/* Entry Points Panel */}
                                    <div className="xl:col-span-4 flex flex-col">
                                        <section className="glass-card backdrop-blur-xl rounded-xl border border-white/10 shadow-glass-depth flex flex-col flex-1 max-h-[720px] overflow-hidden bg-white/[0.02]">
                                            <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px] text-gold-accent drop-shadow-md">pin_drop</span>
                                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white drop-shadow-md">Titik Masuk ISP</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[8px] font-black text-white/50 uppercase tracking-widest shadow-inner-glass">
                                                            {(detail?.entryPoints || []).length} Titik
                                                        </span>
                                                        {canManageEntryPoints && (
                                                            <button
                                                                type="button"
                                                                className="flex items-center justify-center w-6 h-6 rounded-md bg-gold-accent/10 border border-gold-accent/20 text-gold-accent hover:bg-gold-accent hover:text-[#0f141e] transition-all shadow-sm"
                                                                onClick={() => openEntryPointEditor({ mode: "add", data: { label: "", latitude: "", longitude: "", status: "aktif", fiberType: "", coreCapacity: "", description: "", isDefault: false } })}
                                                                title="Tambah Titik"
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Map Container */}
                                            <div className="p-2 border-b border-white/5 bg-black/20">
                                                <IspEntryPointMap
                                                    entryPoints={detail?.entryPoints || []}
                                                    readOnly={!canManageEntryPoints}
                                                    onAddPoint={(lat, lng) => openEntryPointEditor({ mode: "add", data: { label: "", latitude: lat, longitude: lng, status: "aktif", fiberType: "", coreCapacity: "", description: "", isDefault: false } })}
                                                    onMovePoint={handleMoveEntryPoint}
                                                    onEditPoint={(point) => openEntryPointEditor({ mode: "edit", data: { id: point.id, label: point.label, latitude: String(point.latitude), longitude: String(point.longitude), status: point.status, fiberType: point.fiberType || "", coreCapacity: point.coreCapacity != null ? String(point.coreCapacity) : "", description: point.description || "", isDefault: point.isDefault } })}
                                                    onDeletePoint={handleDeleteEntryPoint}
                                                    ispLogoUrl={detail?.logoUrl ?? detail?.logo_url ?? isp.logoUrl ?? isp.logo_url ?? ""}
                                                />
                                            </div>

                                            {/* List of Entry Points */}
                                            <div className="p-2 flex-1 overflow-y-auto space-y-1.5 relative z-10 custom-scrollbar bg-transparent">
                                                {(detail?.entryPoints || []).length === 0 ? (
                                                    <div className="flex flex-col items-center justify-center h-full py-12 opacity-30">
                                                        <span className="material-symbols-outlined text-3xl mb-3">location_off</span>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-center">Belum Ada Titik</p>
                                                    </div>
                                                ) : (
                                                    detail.entryPoints.map((point) => (
                                                        <div key={point.id} className="group flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 p-3 transition-all">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    {point.isDefault && (
                                                                        <span className="w-2 h-2 rounded-full bg-gold-accent shadow-[0_0_8px_rgba(255,215,0,0.5)]"></span>
                                                                    )}
                                                                    <p className="text-[11px] font-black text-white uppercase tracking-widest truncate">{point.label}</p>
                                                                </div>
                                                                <p className="text-[9px] font-bold text-white/40 font-mono truncate tracking-wider">{point.latitude}, {point.longitude}</p>
                                                            </div>
                                                            {canManageEntryPoints && (
                                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 border border-white/5 hover:bg-gold-accent/10 hover:border-gold-accent/20 text-white/40 hover:text-gold-accent transition-all shadow-sm" onClick={() => openEntryPointEditor({ mode: "edit", data: { id: point.id, label: point.label, latitude: String(point.latitude), longitude: String(point.longitude), status: point.status, fiberType: point.fiberType || "", coreCapacity: point.coreCapacity != null ? String(point.coreCapacity) : "", description: point.description || "", isDefault: point.isDefault } })}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit</span>
                                                                    </button>
                                                                    <button type="button" className="w-7 h-7 flex items-center justify-center rounded-md bg-white/5 border border-white/5 hover:bg-red-400/10 hover:border-red-400/20 text-white/40 hover:text-red-400 transition-all shadow-sm" onClick={() => handleDeleteEntryPoint(point.id)}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "contracts" && (
                            <div className="space-y-2.5">
                                {/* ══════ CARD 1: HEADER ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-5 border-white/10 shadow-glass-depth">
                                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                                <h2 className="text-base font-black text-white tracking-widest uppercase">Rincian Kontrak & Adendum</h2>
                                            </div>
                                            <p className="text-[9px] font-bold text-white/20 tracking-wider">Manajemen berkas legal dan amandemen layanan.</p>
                                        </div>
                                        {canManageIspContracts && (
                                            <button
                                                className="rounded-lg bg-gold-accent px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow transition-all active:scale-95 hover:opacity-90 inline-flex items-center gap-1.5"
                                                onClick={openContractDraft}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                                                Tambah Kontrak
                                            </button>
                                        )}
                                    </div>
                                </section>

                                {/* ══════ CARD 2: FILTER & TABLE ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-3 md:p-5 border-white/10 shadow-glass-depth">
                                    <div className="mb-1.5 flex items-center gap-1.5 w-full relative z-50">
                                        {/* Search Bar */}
                                        <div className="relative group flex-1 min-w-0">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors" style={{ fontSize: "16px" }}>search</span>
                                            <input
                                                type="text"
                                                placeholder="Cari nomor kontrak..."
                                                value={contractSearch}
                                                onChange={(e) => setContractSearch(e.target.value)}
                                                className="w-full h-8 pl-8 pr-3 rounded-lg bg-black/20 border border-white/10 text-[9px] font-bold text-white outline-none focus:border-gold-accent/40 focus:bg-black/40 transition-all shadow-inner-glass"
                                            />
                                        </div>

                                        {/* Sort Toggle */}
                                        <button
                                            className="group relative flex h-8 w-8 xl:w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 text-white/60 transition-all hover:border-white/20 hover:bg-black/40 hover:text-white"
                                            onClick={() => setContractSortMethod((prev) => (prev === "newest" ? "oldest" : "newest"))}
                                            title={contractSortMethod === "newest" ? "Urutkan Terlama" : "Urutkan Terbaru"}
                                            type="button"
                                        >
                                            <div className="relative flex h-full items-center justify-center">
                                                <span
                                                    className={`material-symbols-outlined transition-all duration-300 ${contractSortMethod === "newest" ? "rotate-0 opacity-100 scale-100" : "-rotate-180 opacity-0 scale-75 absolute"}`}
                                                    style={{ fontSize: "15px" }}
                                                >
                                                    arrow_downward
                                                </span>
                                                <span
                                                    className={`material-symbols-outlined transition-all duration-300 ${contractSortMethod === "oldest" ? "rotate-0 opacity-100 scale-100" : "rotate-180 opacity-0 scale-75 absolute"}`}
                                                    style={{ fontSize: "15px" }}
                                                >
                                                    arrow_upward
                                                </span>
                                            </div>
                                            <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest text-white/70 transition-colors group-hover:text-white">
                                                {contractSortMethod === "newest" ? "Terbaru" : "Terlama"}
                                            </span>
                                        </button>
                                    </div>

                                    <div className="hidden xl:block overflow-x-auto rounded-lg border border-white/10 bg-black/55 backdrop-blur-3xl shadow-2xl custom-scrollbar">
                                        <table className="min-w-full border-collapse whitespace-nowrap">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10">
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">No</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-gold-accent border-r border-white/10">Nomor Kontrak</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Keterangan</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Berkas Kontrak</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Periode Awal Kontrak</th>
                                                    <th colSpan="2" className="px-3 py-1.5 text-center text-[8px] font-black tracking-[0.4em] text-white/30 uppercase border-b border-white/10">Periode Berjalan</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-l border-white/10">BAK</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-l border-white/10">Perpanjangan</th>
                                                    <th rowSpan="2" className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-l border-white/10">Tanggapan</th>
                                                </tr>
                                                <tr className="bg-white/5">
                                                    <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase border-r border-white/10">Awal</th>
                                                    <th className="px-3 py-1.5 text-center text-[7px] font-black tracking-[0.2em] text-white/20 uppercase">Akhir</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {filteredContracts.map((row, idx) => {
                                                    const isEditingContractRow = contractRowEditor?.rowId === row.id;
                                                    const statusForBadge = isEditingContractRow ? contractRowEditor.status : getContractRowStatus(row, todayIso);
                                                    const statusLabel = statusForBadge === 'expired'
                                                        ? 'Belum Diperpanjang'
                                                        : statusForBadge === 'berhenti'
                                                            ? 'Berhenti'
                                                            : 'Beroperasi';
                                                    const statusClasses = statusForBadge === 'berhenti'
                                                        ? 'bg-white/5 text-white/30 border-white/10'
                                                        : statusForBadge === 'expired'
                                                            ? 'bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                                    const contractStartValue = row.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date;

                                                    return (
                                                        <tr
                                                            key={row.id}
                                                            className={`${isEditingContractRow ? 'bg-gold-accent/[0.03]' : 'hover:bg-white/[0.02]'} transition-colors`}
                                                            onBlur={(event) => {
                                                                if (!isEditingContractRow) return;
                                                                const currentTarget = event.currentTarget;
                                                                setTimeout(() => {
                                                                    if (!currentTarget.contains(document.activeElement)) {
                                                                        void triggerAutoSave();
                                                                    }
                                                                }, 100);
                                                            }}
                                                        >
                                                            <td className="px-3 py-2.5 text-center text-[11px] font-bold text-white/20 border-r border-white/10">{String(idx + 1).padStart(2, '0')}</td>
                                                            <td className="border-r border-white/10 p-0 min-w-[230px]">
                                                                {isEditingContractRow ? (
                                                                    <div className="flex items-center gap-1.5 px-2 bg-black/40 min-h-9 w-full border border-gold-accent/40">
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 w-full bg-transparent px-2 py-1 text-[11px] font-black uppercase tracking-tight text-white outline-none"
                                                                            value={contractRowEditor.contractReference || ""}
                                                                            onChange={(e) => setContractRowEditor((prev) => prev ? { ...prev, contractReference: e.target.value } : prev)}
                                                                            placeholder="Nomor kontrak / BAK"
                                                                            autoFocus
                                                                            onKeyDown={(event) => {
                                                                                if (event.key === "Enter") {
                                                                                    event.preventDefault();
                                                                                    void triggerAutoSave();
                                                                                }
                                                                                if (event.key === "Escape") {
                                                                                    setContractRowEditor(null);
                                                                                }
                                                                            }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => void triggerAutoSave()}
                                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                                                            title="Simpan"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>check</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setContractRowEditor(null)}
                                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                            title="Batal"
                                                                            onMouseDown={(e) => e.preventDefault()}
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        className="min-h-9 w-full px-4 py-2 text-left text-[11px] font-black uppercase tracking-tight leading-snug text-white whitespace-normal break-words hover:bg-white/[0.02] focus:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-gold-accent/40 transition-all"
                                                                        disabled={!canManageIspContracts}
                                                                        onClick={() => openContractRowEditor(row)}
                                                                        type="button"
                                                                        title={canManageIspContracts ? "Edit baris kontrak" : undefined}
                                                                    >
                                                                        {row.contractReference || <span className="text-white/20">Nomor kontrak / BAK</span>}
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[8px] font-black uppercase tracking-widest ${statusClasses}`}>{statusLabel}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10 p-0">
                                                                <div className="flex items-center justify-center gap-1.5 p-2">
                                                                    {isEditingContractRow && contractRowEditor.contractUploadedFile ? (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 max-w-[150px]">
                                                                            <span className="text-[8px] font-bold text-blue-400 truncate" title={contractRowEditor.contractUploadedFileName}>
                                                                                {contractRowEditor.contractUploadedFileName}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setContractRowEditor(prev => prev ? { ...prev, contractUploadedFile: null, contractUploadedFileName: "" } : null);
                                                                                }}
                                                                                className="text-white/40 hover:text-white flex items-center justify-center"
                                                                                title="Batal berkas baru"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                                                                            </button>
                                                                        </div>
                                                                    ) : (isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl) ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button type="button" onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl, row.contractFileName)} className={`${fileActionButtonClass} ${fileActionPrimaryClass}`}>
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>description</span>Buka Kontrak
                                                                            </button>
                                                                            {canManageIspContracts && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (!isEditingContractRow) {
                                                                                            openContractRowEditor(row, null);
                                                                                            setTimeout(() => {
                                                                                                setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                                            }, 50);
                                                                                        } else {
                                                                                            setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                                        }
                                                                                    }}
                                                                                    className="h-6 w-6 rounded-md border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shrink-0"
                                                                                    title="Hapus berkas"
                                                                                >
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : !canManageIspContracts ? (
                                                                        <span className="text-[10px] font-bold text-white/20">Belum diunggah</span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openContractRowEditor(row, "contractFile")}
                                                                            className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all shrink-0"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                            Upload
                                                                        </button>
                                                                    )}
                                                                    {isEditingContractRow ? (
                                                                        <label
                                                                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all shrink-0"
                                                                            onClick={() => { isSelectingFileRef.current = true; }}
                                                                            title="Ganti berkas"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                disabled={isSavingContractRow}
                                                                                onChange={async (event) => {
                                                                                    isSelectingFileRef.current = false;
                                                                                    const file = event.target.files?.[0] ?? null;
                                                                                    if (file) {
                                                                                        setContractRowEditor((previous) => (
                                                                                            previous ? { ...previous, contractUploadedFile: file, contractUploadedFileName: file.name } : previous
                                                                                        ));
                                                                                        await handleSaveContractRow(null, { contractUploadedFile: file });
                                                                                    }
                                                                                }}
                                                                                ref={(el) => {
                                                                                    if (el && contractRowEditor?.focusField === "contractFile") {
                                                                                        isSelectingFileRef.current = true;
                                                                                        el.click();
                                                                                        setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    ) : canManageIspContracts && row.contractFileUrl && (
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all shrink-0"
                                                                            onClick={() => openContractRowEditor(row, "contractFile")}
                                                                            title="Ganti berkas"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="border-r border-white/10 text-center p-0">
                                                                <DateInput
                                                                    value={isEditingContractRow ? (contractRowEditor.contractStartDate || contractStartValue || "") : (contractStartValue || "")}
                                                                    onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, contractStartDate: val } : prev)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            event.currentTarget.blur();
                                                                        }
                                                                        if (event.key === "Escape") {
                                                                            setContractRowEditor(null);
                                                                            event.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    onFocus={() => {
                                                                        if (!isEditingContractRow && canManageIspContracts) {
                                                                            openContractRowEditor(row);
                                                                        }
                                                                    }}
                                                                    className="h-9 w-full"
                                                                    hideIcon={true}
                                                                    inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                                    disabled={!canManageIspContracts}
                                                                />
                                                            </td>
                                                            <td className="border-r border-white/10 text-center p-0">
                                                                <DateInput
                                                                    value={isEditingContractRow ? (contractRowEditor.periodStart || "") : (row.periodStart || "")}
                                                                    onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodStart: val } : prev)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            event.currentTarget.blur();
                                                                        }
                                                                        if (event.key === "Escape") {
                                                                            setContractRowEditor(null);
                                                                            event.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    onFocus={() => {
                                                                        if (!isEditingContractRow && canManageIspContracts) {
                                                                            openContractRowEditor(row);
                                                                        }
                                                                    }}
                                                                    className="h-9 w-full"
                                                                    hideIcon={true}
                                                                    inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                                    disabled={!canManageIspContracts}
                                                                />
                                                            </td>
                                                            <td className="border-r border-white/10 text-center p-0">
                                                                <DateInput
                                                                    value={isEditingContractRow ? (contractRowEditor.periodEnd || "") : (row.periodEnd || "")}
                                                                    onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodEnd: val } : prev)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter") {
                                                                            event.preventDefault();
                                                                            event.currentTarget.blur();
                                                                        }
                                                                        if (event.key === "Escape") {
                                                                            setContractRowEditor(null);
                                                                            event.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    onFocus={() => {
                                                                        if (!isEditingContractRow && canManageIspContracts) {
                                                                            openContractRowEditor(row);
                                                                        }
                                                                    }}
                                                                    className="h-9 w-full"
                                                                    hideIcon={true}
                                                                    inputClass="w-full h-full bg-transparent px-2 text-[10px] font-black text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] hover:bg-white/[0.02] outline-none transition-all text-center uppercase"
                                                                    disabled={!canManageIspContracts}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center border-r border-white/10 p-0">
                                                                <div className="flex items-center justify-center gap-1.5 p-2">
                                                                    {isEditingContractRow && contractRowEditor.bakUploadedFile ? (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 max-w-[150px]">
                                                                            <span className="text-[8px] font-bold text-blue-400 truncate" title={contractRowEditor.bakUploadedFileName}>
                                                                                {contractRowEditor.bakUploadedFileName}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setContractRowEditor(prev => prev ? { ...prev, bakUploadedFile: null, bakUploadedFileName: "" } : null);
                                                                                }}
                                                                                className="text-white/40 hover:text-white flex items-center justify-center"
                                                                                title="Batal berkas baru"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                                                                            </button>
                                                                        </div>
                                                                    ) : (isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl) ? (
                                                                        <div className="flex items-center gap-1.5">
                                                                            <button type="button" onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl, row.bakFileName)} className={`${fileActionButtonClass} ${fileActionSuccessClass}`}>
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>task_alt</span>Buka BAK
                                                                            </button>
                                                                            {canManageIspContracts && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (!isEditingContractRow) {
                                                                                            openContractRowEditor(row, null);
                                                                                            setTimeout(() => {
                                                                                                setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                                            }, 50);
                                                                                        } else {
                                                                                            setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                                        }
                                                                                    }}
                                                                                    className="h-6 w-6 rounded-md border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shrink-0"
                                                                                    title="Hapus berkas"
                                                                                >
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ) : !canManageIspContracts ? (
                                                                        <span className="text-[10px] font-bold text-white/20">Belum diunggah</span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openContractRowEditor(row, "bakFile")}
                                                                            className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[8px] font-black uppercase tracking-widest text-white/40 hover:border-white/20 hover:text-white transition-all shrink-0"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                            Upload
                                                                        </button>
                                                                    )}
                                                                    {isEditingContractRow ? (
                                                                        <label
                                                                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all shrink-0"
                                                                            onClick={() => { isSelectingFileRef.current = true; }}
                                                                            title="Ganti berkas"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                disabled={isSavingContractRow}
                                                                                onChange={async (event) => {
                                                                                    isSelectingFileRef.current = false;
                                                                                    const file = event.target.files?.[0] ?? null;
                                                                                    if (file) {
                                                                                        setContractRowEditor((previous) => (
                                                                                            previous ? { ...previous, bakUploadedFile: file, bakUploadedFileName: file.name } : previous
                                                                                        ));
                                                                                        await handleSaveContractRow(null, { bakUploadedFile: file });
                                                                                    }
                                                                                }}
                                                                                ref={(el) => {
                                                                                    if (el && contractRowEditor?.focusField === "bakFile") {
                                                                                        isSelectingFileRef.current = true;
                                                                                        el.click();
                                                                                        setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                                    }
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    ) : canManageIspContracts && row.bakFileUrl && (
                                                                        <button
                                                                            type="button"
                                                                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/40 hover:text-white hover:border-white/20 transition-all shrink-0"
                                                                            onClick={() => openContractRowEditor(row, "bakFile")}
                                                                            title="Ganti berkas"
                                                                        >
                                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>upload_file</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 w-[200px] border-r border-white/10 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {renderRenewalFollowUps(row, "renewal")}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 w-[150px] border-r border-white/10 text-center">{renderRenewalFollowUps(row, "response")}</td>
                                                        </tr>
                                                    );
                                                })}
                                                {filteredContracts.length === 0 && (
                                                    <tr>
                                                        <td colSpan="10" className="py-10 text-center">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
                                                                    <span className="material-symbols-outlined text-2xl text-gold-accent/40">history_edu</span>
                                                                </div>
                                                                <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">BELUM ADA RINCIAN KONTRAK</h4>
                                                                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">Rincian kontrak atau adendum belum tersedia</p>
                                                                {canManageIspContracts && (
                                                                    <button
                                                                        className="mt-4 rounded-lg bg-gold-accent px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow active:scale-95 transition-all inline-flex items-center gap-1.5"
                                                                        onClick={openContractDraft}
                                                                        type="button"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                                                                        Tambah Kontrak
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* ══════ MOBILE VIEW (CARDS) ══════ */}
                                    <div className="xl:hidden flex flex-col gap-2 mt-2">
                                        {filteredContracts.map((row, idx) => {
                                            const isEditingContractRow = contractRowEditor?.rowId === row.id;
                                            const isExpanded = isEditingContractRow || !!expandedContracts[row.id];
                                            const statusForBadge = isEditingContractRow ? contractRowEditor.status : getContractRowStatus(row, todayIso);
                                            const statusLabel = statusForBadge === 'expired'
                                                ? 'Belum Diperpanjang'
                                                : statusForBadge === 'berhenti'
                                                    ? 'Berhenti'
                                                    : 'Beroperasi';
                                            const statusClasses = statusForBadge === 'berhenti'
                                                ? 'bg-white/5 text-white/30 border-white/10'
                                                : statusForBadge === 'expired'
                                                    ? 'bg-[#ff2400]/10 text-[#ff2400] border-[#ff2400]/20'
                                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                            const contractStartValue = row.contractStartDate ?? detail?.contractStartDate ?? detail?.contract_start_date ?? isp.contractStartDate ?? isp.contract_start_date;

                                            return (
                                                <div
                                                    key={row.id}
                                                    className={`glass-card rounded-xl border ${isEditingContractRow ? 'border-gold-accent/40 bg-gold-accent/[0.02]' : 'border-white/10'} px-2.5 pt-2.5 pb-1 md:p-4 shadow-glass-depth flex flex-col gap-2 md:gap-3.5 transition-all`}
                                                >
                                                    {/* Row 1: Header (No, Ref, Status Badge) */}
                                                    <div className={`flex items-center justify-between gap-3 pb-1.5 ${isExpanded ? 'border-b border-white/[0.06]' : ''}`}>
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="text-[10px] font-black text-gold-accent/60 tabular-nums shrink-0">#{String(idx + 1).padStart(2, '0')}</span>
                                                            {isEditingContractRow ? (
                                                                <div className="flex items-center gap-1.5 px-2 bg-black/45 h-7 rounded-lg border border-gold-accent/40 flex-1 min-w-0">
                                                                    <input
                                                                        type="text"
                                                                        className="flex-1 w-full bg-transparent text-[10px] font-bold uppercase tracking-tight text-white outline-none"
                                                                        value={contractRowEditor.contractReference || ""}
                                                                        onChange={(e) => setContractRowEditor((prev) => prev ? { ...prev, contractReference: e.target.value } : prev)}
                                                                        placeholder="Nomor kontrak..."
                                                                        autoFocus
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === "Enter") {
                                                                                event.preventDefault();
                                                                                void triggerAutoSave();
                                                                            }
                                                                            if (event.key === "Escape") {
                                                                                setContractRowEditor(null);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void triggerAutoSave()}
                                                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
                                                                        title="Simpan"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>check</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setContractRowEditor(null)}
                                                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#ff2400]/20 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                        title="Batal"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>close</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    className="text-[11px] font-black uppercase tracking-tight text-white hover:text-gold-accent transition-all text-left truncate"
                                                                    disabled={!canManageIspContracts}
                                                                    onClick={() => openContractRowEditor(row)}
                                                                    type="button"
                                                                >
                                                                    {row.contractReference || <span className="text-white/20">Isi Nomor Kontrak / BAK</span>}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider shrink-0 ${statusClasses}`}>{statusLabel}</span>
                                                    </div>

                                                    {isExpanded && (
                                                        <>
                                                            {/* Row 3: Dates Info (Vertical Stack with Fixed-Width Inputs to Prevent Overlapping) */}
                                                            <div className="flex flex-col gap-1.5 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2.5">
                                                                {/* Awal Kontrak */}
                                                                <div className="flex items-center justify-between gap-3 border-b border-white/[0.03] pb-1.5">
                                                                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>calendar_today</span>
                                                                        Awal Kontrak
                                                                    </span>
                                                                    <div className="w-[110px] h-7 rounded-lg bg-black/20 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                                        <DateInput
                                                                            value={isEditingContractRow ? (contractRowEditor.contractStartDate || contractStartValue || "") : (contractStartValue || "")}
                                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, contractStartDate: val } : prev)}
                                                                            onFocus={() => {
                                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                                    openContractRowEditor(row);
                                                                                }
                                                                            }}
                                                                            className="h-full w-full"
                                                                            hideIcon={true}
                                                                            inputClass="w-full h-full bg-transparent px-1 text-[10px] font-bold text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] outline-none transition-all text-center uppercase"
                                                                            disabled={!canManageIspContracts}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Berjalan (Awal) */}
                                                                <div className="flex items-center justify-between gap-3 border-b border-white/[0.03] pb-1.5">
                                                                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>event_repeat</span>
                                                                        Berjalan (Awal)
                                                                    </span>
                                                                    <div className="w-[110px] h-7 rounded-lg bg-black/20 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                                        <DateInput
                                                                            value={isEditingContractRow ? (contractRowEditor.periodStart || "") : (row.periodStart || "")}
                                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodStart: val } : prev)}
                                                                            onFocus={() => {
                                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                                    openContractRowEditor(row);
                                                                                }
                                                                            }}
                                                                            className="h-full w-full"
                                                                            hideIcon={true}
                                                                            inputClass="w-full h-full bg-transparent px-1 text-[10px] font-bold text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] outline-none transition-all text-center uppercase"
                                                                            disabled={!canManageIspContracts}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Berjalan (Akhir) */}
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>event_busy</span>
                                                                        Berjalan (Akhir)
                                                                    </span>
                                                                    <div className="w-[110px] h-7 rounded-lg bg-black/20 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                                                                        <DateInput
                                                                            value={isEditingContractRow ? (contractRowEditor.periodEnd || "") : (row.periodEnd || "")}
                                                                            onChange={(val) => setContractRowEditor((prev) => prev ? { ...prev, periodEnd: val } : prev)}
                                                                            onFocus={() => {
                                                                                if (!isEditingContractRow && canManageIspContracts) {
                                                                                    openContractRowEditor(row);
                                                                                }
                                                                            }}
                                                                            className="h-full w-full"
                                                                            hideIcon={true}
                                                                            inputClass="w-full h-full bg-transparent px-1 text-[10px] font-bold text-white border-transparent focus:border-gold-accent/40 focus:bg-white/[0.04] outline-none transition-all text-center uppercase"
                                                                            disabled={!canManageIspContracts}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Row 4: Files Upload List (Vertical Rows) */}
                                                            <div className="flex flex-col gap-1.5 bg-black/35 border border-white/[0.04] rounded-xl p-2.5">
                                                                <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1.5">
                                                                    <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>folder_open</span>
                                                                    Lampiran Berkas
                                                                </p>

                                                                {/* File 1: Berkas Kontrak */}
                                                                <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
                                                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                        <span className="material-symbols-outlined text-gold-accent/50 text-[18px] shrink-0">history_edu</span>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Berkas Kontrak</span>
                                                                            {isEditingContractRow && contractRowEditor.contractUploadedFile ? (
                                                                                <span className="text-[9px] font-bold text-blue-400 truncate max-w-[120px] sm:max-w-none" title={contractRowEditor.contractUploadedFileName}>
                                                                                    {contractRowEditor.contractUploadedFileName}
                                                                                </span>
                                                                            ) : (isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl) ? (
                                                                                <span className="text-[9px] font-bold text-white/60 truncate max-w-[120px] sm:max-w-none" title={row.contractFileName || "Kontrak"}>
                                                                                    {row.contractFileName || "Tersedia"}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-white/20">Kosong</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {isEditingContractRow && contractRowEditor.contractUploadedFile ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setContractRowEditor(prev => prev ? { ...prev, contractUploadedFile: null, contractUploadedFileName: "" } : null)}
                                                                                className="h-6 w-6 rounded-lg bg-[#ff2400]/15 text-[#ff2400] border border-[#ff2400]/25 flex items-center justify-center hover:bg-[#ff2400] hover:text-white transition-all"
                                                                                title="Batal"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>close</span>
                                                                            </button>
                                                                        ) : (isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl) ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.contractFileUrl : row.contractFileUrl, row.contractFileName)}
                                                                                    className="h-6 px-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center hover:bg-sky-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider"
                                                                                >
                                                                                    Buka
                                                                                </button>
                                                                                {canManageIspContracts && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (!isEditingContractRow) {
                                                                                                openContractRowEditor(row, null);
                                                                                                setTimeout(() => {
                                                                                                    setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                                                }, 50);
                                                                                            } else {
                                                                                                setContractRowEditor(prev => prev ? { ...prev, contractFileUrl: "" } : null);
                                                                                            }
                                                                                        }}
                                                                                        className="h-6 w-6 rounded-lg border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                                        title="Hapus"
                                                                                    >
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>delete</span>
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        ) : canManageIspContracts ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openContractRowEditor(row, "contractFile")}
                                                                                className="h-6 px-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center hover:border-white/20 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider"
                                                                            >
                                                                                Upload
                                                                            </button>
                                                                        ) : null}
                                                                        {isEditingContractRow ? (
                                                                            <label
                                                                                className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center justify-center cursor-pointer hover:text-white hover:border-white/20 transition-all"
                                                                                onClick={() => { isSelectingFileRef.current = true; }}
                                                                                title="Ganti berkas"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>sync</span>
                                                                                <input
                                                                                    type="file"
                                                                                    className="hidden"
                                                                                    disabled={isSavingContractRow}
                                                                                    onChange={async (event) => {
                                                                                        isSelectingFileRef.current = false;
                                                                                        const file = event.target.files?.[0] ?? null;
                                                                                        if (file) {
                                                                                            setContractRowEditor((previous) => (
                                                                                                previous ? { ...previous, contractUploadedFile: file, contractUploadedFileName: file.name } : previous
                                                                                            ));
                                                                                            await handleSaveContractRow(null, { contractUploadedFile: file });
                                                                                        }
                                                                                    }}
                                                                                    ref={(el) => {
                                                                                        if (el && contractRowEditor?.focusField === "contractFile") {
                                                                                            isSelectingFileRef.current = true;
                                                                                            el.click();
                                                                                            setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        ) : canManageIspContracts && row.contractFileUrl && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openContractRowEditor(row, "contractFile")}
                                                                                className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center justify-center hover:text-white hover:border-white/20 transition-all"
                                                                                title="Ganti berkas"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>sync</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* File 2: Berkas BAK */}
                                                                <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
                                                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                        <span className="material-symbols-outlined text-gold-accent/50 text-[18px] shrink-0">assignment</span>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Berkas BAK</span>
                                                                            {isEditingContractRow && contractRowEditor.bakUploadedFile ? (
                                                                                <span className="text-[9px] font-bold text-blue-400 truncate max-w-[120px] sm:max-w-none" title={contractRowEditor.bakUploadedFileName}>
                                                                                    {contractRowEditor.bakUploadedFileName}
                                                                                </span>
                                                                            ) : (isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl) ? (
                                                                                <span className="text-[9px] font-bold text-white/60 truncate max-w-[120px] sm:max-w-none" title={row.bakFileName || "BAK"}>
                                                                                    {row.bakFileName || "Tersedia"}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] font-bold text-white/20">Kosong</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {isEditingContractRow && contractRowEditor.bakUploadedFile ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setContractRowEditor(prev => prev ? { ...prev, bakUploadedFile: null, bakUploadedFileName: "" } : null)}
                                                                                className="h-6 w-6 rounded-lg bg-[#ff2400]/15 text-[#ff2400] border border-[#ff2400]/25 flex items-center justify-center hover:bg-[#ff2400] hover:text-white transition-all"
                                                                                title="Batal"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>close</span>
                                                                            </button>
                                                                        ) : (isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl) ? (
                                                                            <>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openSafeFile(isEditingContractRow ? contractRowEditor.bakFileUrl : row.bakFileUrl, row.bakFileName)}
                                                                                    className="h-6 px-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center hover:bg-sky-500 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider"
                                                                                >
                                                                                    Buka
                                                                                </button>
                                                                                {canManageIspContracts && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (!isEditingContractRow) {
                                                                                                openContractRowEditor(row, null);
                                                                                                setTimeout(() => {
                                                                                                    setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                                                }, 50);
                                                                                            } else {
                                                                                                setContractRowEditor(prev => prev ? { ...prev, bakFileUrl: "" } : null);
                                                                                            }
                                                                                        }}
                                                                                        className="h-6 w-6 rounded-lg border border-[#ff2400]/20 bg-[#ff2400]/10 flex items-center justify-center text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all"
                                                                                        title="Hapus"
                                                                                    >
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>delete</span>
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        ) : canManageIspContracts ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openContractRowEditor(row, "bakFile")}
                                                                                className="h-6 px-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center hover:border-white/20 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider"
                                                                            >
                                                                                Upload
                                                                            </button>
                                                                        ) : null}
                                                                        {isEditingContractRow ? (
                                                                            <label
                                                                                className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center justify-center cursor-pointer hover:text-white hover:border-white/20 transition-all"
                                                                                onClick={() => { isSelectingFileRef.current = true; }}
                                                                                title="Ganti berkas"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>sync</span>
                                                                                <input
                                                                                    type="file"
                                                                                    className="hidden"
                                                                                    disabled={isSavingContractRow}
                                                                                    onChange={async (event) => {
                                                                                        isSelectingFileRef.current = false;
                                                                                        const file = event.target.files?.[0] ?? null;
                                                                                        if (file) {
                                                                                            setContractRowEditor((previous) => (
                                                                                                previous ? { ...previous, bakUploadedFile: file, bakUploadedFileName: file.name } : previous
                                                                                            ));
                                                                                            await handleSaveContractRow(null, { bakUploadedFile: file });
                                                                                        }
                                                                                    }}
                                                                                    ref={(el) => {
                                                                                        if (el && contractRowEditor?.focusField === "bakFile") {
                                                                                            isSelectingFileRef.current = true;
                                                                                            el.click();
                                                                                            setContractRowEditor((prev) => prev ? { ...prev, focusField: null } : null);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                        ) : canManageIspContracts && row.bakFileUrl && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openContractRowEditor(row, "bakFile")}
                                                                                className="h-6 w-6 rounded-lg bg-white/5 border border-white/10 text-white/40 flex items-center justify-center hover:text-white hover:border-white/20 transition-all"
                                                                                title="Ganti berkas"
                                                                            >
                                                                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>sync</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Row 5: Renewal & Response Action Panel (Vertical Split List) */}
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
                                                                {/* Split Perpanjangan */}
                                                                <div className="flex items-center justify-between gap-3 bg-white/[0.01] border border-white/[0.03] rounded-xl p-2">
                                                                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1.5 shrink-0">
                                                                        <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>history</span>
                                                                        Perpanjangan
                                                                    </span>
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        {renderRenewalFollowUps(row, "renewal")}
                                                                    </div>
                                                                </div>

                                                                {/* Split Tanggapan */}
                                                                <div className="flex items-center justify-between gap-3 bg-white/[0.01] border border-white/[0.03] rounded-xl p-2">
                                                                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1.5 shrink-0">
                                                                        <span className="material-symbols-outlined text-[13px] text-white/30" style={{ fontSize: '13px' }}>chat_bubble</span>
                                                                        Tanggapan
                                                                    </span>
                                                                    <div className="flex items-center justify-end">
                                                                        {renderRenewalFollowUps(row, "response")}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Bottom Divider & Expand Toggle Button */}
                                                    <div className="flex justify-end pt-1 md:pt-1.5 border-t border-white/[0.06]">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setExpandedContracts((prev) => ({
                                                                    ...prev,
                                                                    [row.id]: !prev[row.id],
                                                                }));
                                                            }}
                                                            className="flex items-center gap-1 text-[8.5px] font-black tracking-[0.1em] leading-none text-white/40 hover:text-gold-accent transition-colors"
                                                        >
                                                            {isExpanded ? "Lebih Sedikit" : "Lebih Lengkap"}
                                                            <span className="material-symbols-outlined text-[10px]">{isExpanded ? "expand_less" : "expand_more"}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {filteredContracts.length === 0 && (
                                            <div className="py-10 text-center glass-card rounded-2xl border border-white/10">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
                                                        <span className="material-symbols-outlined text-2xl text-gold-accent/40">history_edu</span>
                                                    </div>
                                                    <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">BELUM ADA RINCIAN KONTRAK</h4>
                                                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">Rincian kontrak atau adendum belum tersedia</p>
                                                    {canManageIspContracts && (
                                                        <button
                                                            className="mt-4 rounded-lg bg-gold-accent px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow active:scale-95 transition-all inline-flex items-center gap-1.5"
                                                            onClick={openContractDraft}
                                                            type="button"
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                                                            Tambah Kontrak
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === "risalah" && (
                            <div className="space-y-2.5">
                                {/* ══════ CARD 1: HEADER ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-5 border-white/10 shadow-glass-depth">
                                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                                <h2 className="text-base font-black text-white tracking-widest uppercase">Dokumen Pendukung</h2>
                                            </div>
                                            <p className="text-[9px] font-bold text-white/20 tracking-wider">Arsip risalah rapat dan dokumen administratif.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* ══════ CARD 2: FILTER & TABLE ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-3 md:p-5 border-white/10 shadow-glass-depth">
                                    <div className="mb-1.5 flex items-center gap-1.5 w-full relative z-50">
                                        {/* Search Bar */}
                                        <div className="relative group flex-1 min-w-0">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold-accent transition-colors" style={{ fontSize: "16px" }}>search</span>
                                            <input
                                                type="text"
                                                placeholder="Cari dokumen..."
                                                value={docSearch}
                                                onChange={(e) => setDocSearch(e.target.value)}
                                                className="w-full h-8 pl-8 pr-3 rounded-lg bg-black/20 border border-white/10 text-[9px] font-bold text-white outline-none focus:border-gold-accent/40 focus:bg-black/40 transition-all shadow-inner-glass"
                                            />
                                        </div>

                                        {/* Sort Toggle */}
                                        <button
                                            className="group relative flex h-8 w-8 xl:w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 text-white/60 transition-all hover:border-white/20 hover:bg-black/40 hover:text-white"
                                            onClick={() => setDocSortMethod((prev) => (prev === "newest" ? "oldest" : "newest"))}
                                            title={docSortMethod === "newest" ? "Urutkan Terlama" : "Urutkan Terbaru"}
                                            type="button"
                                        >
                                            <div className="relative flex h-full items-center justify-center">
                                                <span
                                                    className={`material-symbols-outlined transition-all duration-300 ${docSortMethod === "newest" ? "rotate-0 opacity-100 scale-100" : "-rotate-180 opacity-0 scale-75 absolute"}`}
                                                    style={{ fontSize: "15px" }}
                                                >
                                                    arrow_downward
                                                </span>
                                                <span
                                                    className={`material-symbols-outlined transition-all duration-300 ${docSortMethod === "oldest" ? "rotate-0 opacity-100 scale-100" : "rotate-180 opacity-0 scale-75 absolute"}`}
                                                    style={{ fontSize: "15px" }}
                                                >
                                                    arrow_upward
                                                </span>
                                            </div>
                                            <span className="hidden xl:inline text-[9px] font-black uppercase tracking-widest text-white/70 transition-colors group-hover:text-white">
                                                {docSortMethod === "newest" ? "Terbaru" : "Terlama"}
                                            </span>
                                        </button>

                                        {!isIsp && (
                                            <button
                                                className="rounded-lg bg-gold-accent px-4 h-8 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow active:scale-95 transition-all shrink-0"
                                                onClick={handleAddRisalah}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-slate-900" style={{ fontSize: "14px" }}>add_circle</span>
                                                Tambah
                                            </button>
                                        )}
                                    </div>

                                    <div className="hidden xl:block overflow-x-auto rounded-lg border border-white/10 bg-black/55 backdrop-blur-3xl shadow-2xl custom-scrollbar">
                                        <table className="min-w-full border-collapse whitespace-nowrap">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10">
                                                    <th className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">No</th>
                                                    <th className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Tanggal</th>
                                                    <th className="px-3 py-2 text-left text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Nama Dokumen</th>
                                                    <th className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40 border-r border-white/10">Berkas</th>
                                                    {!isIsp && <th className="px-3 py-2 text-center text-[9px] font-bold tracking-[0.3em] text-white/40">Aksi</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/10">
                                                {filteredDocs.map((row, idx) => (
                                                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group/row">
                                                        <td className="px-3 py-2.5 text-center text-[11px] font-bold text-white/20 border-r border-white/10">{String(idx + 1).padStart(2, '0')}</td>
                                                        <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                            <span className="text-[11px] font-bold text-white">{formatDate(row.tanggal)}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 border-r border-white/10 text-left">
                                                            <p className="text-[11px] font-bold text-white/70 tracking-wide">{row.fileName || "N/A"}</p>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center border-r border-white/10">
                                                            {isOpenableFileUrl(row.fileUrl) ? (
                                                                <button onClick={() => openSafeFile(row.fileUrl, row.fileName)} className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-white font-bold text-[9px] uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md transition-all mx-auto"><span className="material-symbols-outlined" style={{ fontSize: "14px" }}>description</span>Buka Berkas</button>
                                                            ) : <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Kosong</span>}
                                                        </td>
                                                        {!isIsp && (
                                                            <td className="px-3 py-2.5 text-center">
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-gold-accent hover:bg-gold-accent hover:text-white transition-all shadow-sm"
                                                                        onClick={() => handleEditRisalah(row)}
                                                                        title="Edit Dokumen"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>edit_note</span>
                                                                    </button>
                                                                    <button
                                                                        className="w-6 h-6 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm"
                                                                        onClick={() => handleDeleteRisalah(row.id)}
                                                                        title="Hapus Dokumen"
                                                                    >
                                                                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>delete_forever</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                                {filteredDocs.length === 0 && (
                                                    <tr>
                                                        <td colSpan={isIsp ? "4" : "5"} className="py-10 text-center">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
                                                                    <span className="material-symbols-outlined text-2xl text-gold-accent/40">folder_off</span>
                                                                </div>
                                                                <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">BELUM ADA DOKUMEN</h4>
                                                                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">Silakan tambahkan dokumen administratif baru</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View List */}
                                    <div className="xl:hidden flex flex-col gap-2 mt-2">
                                        {filteredDocs.map((row) => (
                                            <div
                                                key={row.id}
                                                className="glass-card rounded-xl border border-white/10 px-3 py-2 flex items-center justify-between gap-3 shadow-glass-depth transition-all"
                                            >
                                                {/* Left: Icon & Info */}
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="h-[25px] w-[25px] flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gold-accent shrink-0">
                                                        <span className="material-symbols-outlined text-[13px]" style={{ fontSize: '13px' }}>description</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10.5px] font-bold text-white/95 truncate" title={row.fileName}>
                                                            {row.fileName || "N/A"}
                                                        </p>
                                                        <p className="text-[8.5px] font-medium text-white/45 mt-0.5">
                                                            {formatDate(row.tanggal)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isOpenableFileUrl(row.fileUrl) ? (
                                                        <button
                                                            onClick={() => openSafeFile(row.fileUrl, row.fileName)}
                                                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-white font-bold text-[8.5px] leading-none uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 rounded-md transition-all active:scale-95"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]" style={{ fontSize: "11px" }}>description</span>
                                                            Buka
                                                        </button>
                                                    ) : (
                                                        <span className="text-[8.5px] font-black uppercase tracking-widest text-white/20">Kosong</span>
                                                    )}

                                                    {!isIsp && (
                                                        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                                                            <button
                                                                className="w-6.5 h-6.5 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-gold-accent hover:bg-gold-accent hover:text-white transition-all shadow-sm"
                                                                onClick={() => handleEditRisalah(row)}
                                                                title="Edit"
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>edit_note</span>
                                                            </button>
                                                            <button
                                                                className="w-6.5 h-6.5 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-[#ff2400] hover:bg-[#ff2400] hover:text-white transition-all shadow-sm"
                                                                onClick={() => handleDeleteRisalah(row.id)}
                                                                title="Hapus"
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>delete_forever</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {filteredDocs.length === 0 && (
                                            <div className="py-10 text-center glass-card rounded-xl border border-white/10">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 shadow-inner-glass mb-3 animate-pulse">
                                                        <span className="material-symbols-outlined text-2xl text-gold-accent/40">folder_off</span>
                                                    </div>
                                                    <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">BELUM ADA DOKUMEN</h4>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {risalahEditor && createPortal(
                            <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-md bg-black/60 animate-fade-in duration-300">
                                <div className="w-full max-w-sm rounded-2xl glass-card backdrop-blur-xl p-5 border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold-accent/5 blur-3xl pointer-events-none" />

                                    <div className="mb-5 flex items-center justify-between relative z-10">
                                        <div className="space-y-0.5">
                                            <h3 className="text-base font-black text-white tracking-widest uppercase">
                                                {risalahEditor.id ? "Edit Dokumen" : "Tambah Dokumen"}
                                            </h3>
                                            <p className="text-[9px] font-bold text-gold-accent/40 tracking-[0.3em] uppercase">Arsip Administratif ISP</p>
                                        </div>
                                        <button className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:bg-[#ff2400]/10 hover:border-[#ff2400]/40 hover:text-[#ff2400] transition-all duration-300 shadow-sm" onClick={() => setRisalahEditor(null)} type="button">
                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </div>

                                    <div className="space-y-4 relative z-10">
                                        {/* Nama Dokumen */}
                                        <div className="space-y-1">
                                            <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Nama Dokumen</label>
                                            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 focus-within:border-gold-accent/50 transition-all">
                                                <span className="material-symbols-outlined text-[12px] text-white/20 shrink-0">edit_note</span>
                                                <input
                                                    className="flex-1 min-w-0 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-white/10"
                                                    onChange={(e) => setRisalahEditor(p => p ? { ...p, fileName: e.target.value } : p)}
                                                    type="text"
                                                    value={risalahEditor.fileName}
                                                    placeholder="Contoh: Risalah Meeting 2026"
                                                />
                                            </div>
                                        </div>

                                        {/* Unggah Berkas */}
                                        <div className="space-y-1">
                                            <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-white/40 ml-1">Unggah Berkas</label>
                                            <div className="relative">
                                                <input
                                                    id="risalah-file-upload"
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => handleRisalahEditorFileChange(e.target.files?.[0] ?? null)}
                                                />
                                                <label
                                                    htmlFor="risalah-file-upload"
                                                    className="flex items-center justify-between w-full rounded-xl bg-black/40 border border-white/10 hover:border-gold-accent/40 px-3 py-2 cursor-pointer group transition-all"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="material-symbols-outlined text-[12px] text-white/30 group-hover:text-gold-accent shrink-0">cloud_upload</span>
                                                        <span className="text-[11px] font-bold text-white/60 group-hover:text-white truncate">
                                                            {risalahEditor.file ? risalahEditor.file.name : (risalahEditor.fileName || "Pilih berkas...")}
                                                        </span>
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-widest bg-gold-accent/10 text-gold-accent group-hover:bg-gold-accent group-hover:text-slate-900 px-2 py-1 rounded-md transition-all border border-gold-accent/20 shrink-0 ml-2">
                                                        Cari
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Tanggal Dokumen */}
                                        <div className="space-y-1">
                                            <label className="block text-[8px] font-black uppercase tracking-[0.3em] text-gold-accent/40 ml-1">Tanggal Dokumen</label>
                                            <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 focus-within:border-gold-accent/50 transition-all">
                                                <span className="material-symbols-outlined text-[12px] text-gold-accent shrink-0">calendar_month</span>
                                                <DateInput
                                                    value={risalahEditor.tanggal}
                                                    onChange={(val) => setRisalahEditor(p => p ? { ...p, tanggal: val } : p)}
                                                    className="flex-1 min-w-0"
                                                    inputClass="w-full bg-transparent text-[11px] font-bold text-white outline-none pr-7"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3 relative z-10">
                                        <button className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all" onClick={() => setRisalahEditor(null)} type="button">Batal</button>
                                        <button className="rounded-xl bg-gold-accent px-6 py-2 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow active:scale-95 transition-all" onClick={handleSaveRisalah} type="button">Simpan</button>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}

                        {activeTab === "timeline" && (
                            <div className="space-y-2.5">
                                {/* ══════ CARD 1: HEADER ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-3 sm:p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="h-4 w-1 bg-gold-accent rounded-full"></span>
                                                <h2 className="text-base font-black text-white tracking-widest uppercase">Timeline Aktivitas</h2>
                                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold-accent/10 border border-gold-accent/20 ml-2">
                                                    <span className="w-1 h-1 rounded-full bg-gold-accent animate-pulse shadow-gold-glow" />
                                                    <span className="text-[7px] font-black uppercase tracking-widest text-gold-accent">Sistem Log</span>
                                                </div>
                                            </div>
                                            <p className="text-[9px] font-bold text-white/20 tracking-wider">Jejak audit digital dan riwayat perubahan repositori ISP.</p>
                                        </div>
                                    </div>
                                </section>

                                {/* ══════ CARD 2: TIMELINE ══════ */}
                                <section className="glass-card backdrop-blur-xl rounded-xl p-3 sm:p-5 border-white/10 shadow-glass-depth relative overflow-hidden">
                                    {timeline.length === 0 ? renderEmptyState("Belum ada aktivitas terekam.") : (
                                        <div className="relative sm:pt-2 pt-0">
                                            {/* DESKTOP VIEW */}
                                            <div className="hidden sm:block">
                                                {/* Vertical line - High Glow Gradient */}
                                                <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-gold-accent/40 via-white/10 to-transparent rounded-full shadow-gold-glow" />

                                                <div className="space-y-6 relative z-10">
                                                    {timeline.map((e) => (
                                                        <div key={e.id} className="flex gap-4 group/t-item">
                                                            {/* Glowing Marker */}
                                                            <div className="relative shrink-0 mt-1">
                                                                <div className={`w-10 h-10 rounded-xl ${e.bg} border border-white/10 flex items-center justify-center ${e.color} shadow-sm group-hover/t-item:scale-110 group-hover/t-item:shadow-gold-glow transition-all duration-300`}>
                                                                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>{e.icon}</span>
                                                                </div>
                                                            </div>

                                                            {/* Compact Content */}
                                                            <div className="flex-1 space-y-2">
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-1">
                                                                    <div className="space-y-0.5">
                                                                        <h4 className="text-[11px] font-black text-white group-hover/t-item:text-gold-accent transition-colors duration-300 tracking-wider uppercase">{e.title}</h4>
                                                                        <span className={`inline-block text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${e.color}`}>{e.type}</span>
                                                                    </div>

                                                                    {/* Compact Right Aligned Date/Time */}
                                                                    <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                                                                        <span className="text-white/40 uppercase">{new Date(e.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                        <div className="w-1 h-1 rounded-full bg-white/10 animate-pulse" />
                                                                        <span className="text-gold-accent">{new Date(e.date).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WITA</span>
                                                                    </div>
                                                                </div>

                                                                {/* ULTRA DARK GLASS - Monitoring Table Style Depth */}
                                                                <div className="p-4 border border-white/5 bg-black/40 backdrop-blur-3xl rounded-xl transition-all duration-300 shadow-sm relative overflow-hidden group-hover/t-item:bg-black/60 group-hover/t-item:border-white/10">
                                                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${e.bg.replace('bg-', 'bg-').replace('/10', '/80')}`} />
                                                                    <p className="text-[10px] font-bold text-white/50 leading-relaxed tracking-wide group-hover/t-item:text-white/90 transition-colors">
                                                                        {e.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* MOBILE VIEW */}
                                            <div className="sm:hidden">
                                                {/* Vertical line - High Glow Gradient */}
                                                <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-gold-accent/40 via-white/10 to-transparent rounded-full shadow-gold-glow" />

                                                <div className="space-y-3 relative z-10">
                                                    {timeline.map((e) => (
                                                        <div key={e.id} className="flex items-center gap-3 group/t-item">
                                                            {/* Glowing Marker */}
                                                            <div className="relative shrink-0">
                                                                <div className={`w-8 h-8 rounded-lg ${e.bg} border border-white/10 flex items-center justify-center ${e.color} shadow-sm group-hover/t-item:scale-110 group-hover/t-item:shadow-gold-glow transition-all duration-300`}>
                                                                    <span className="material-symbols-outlined text-[14px]" style={{ fontSize: "inherit" }}>{e.icon}</span>
                                                                </div>
                                                            </div>

                                                            {/* Compact Content */}
                                                            <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                                                                {/* Row 1: Title & Actor Badge */}
                                                                <div className="flex items-center justify-between gap-2 leading-tight">
                                                                    <h4 className="text-[10.5px] font-black text-white group-hover/t-item:text-gold-accent transition-colors duration-300 tracking-wider uppercase truncate leading-tight">
                                                                        {e.title}
                                                                    </h4>
                                                                    <span className={`inline-flex items-center justify-center text-[6.5px] font-black uppercase tracking-widest px-1.5 h-[14px] rounded bg-white/5 border border-white/10 ${e.color} shrink-0`}>
                                                                        {e.type}
                                                                    </span>
                                                                </div>

                                                                {/* Row 2: Date & Time */}
                                                                <div className="flex items-center gap-1.5 text-[8px] font-black tracking-widest text-white/40 uppercase leading-tight">
                                                                    <span>{new Date(e.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                                    <span className="text-white/20">•</span>
                                                                    <span className="text-gold-accent/80">{new Date(e.date).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WITA</span>
                                                                </div>

                                                                {/* Row 3: Description Text (No nested card to prevent spacing misalignment) */}
                                                                <p className="text-[9.5px] font-bold text-white/50 leading-snug tracking-wide group-hover/t-item:text-white/90 transition-colors">
                                                                    {e.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {contractDraft && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-md bg-black/60 animate-fade-in duration-300">
                    <div className="w-full max-w-2xl rounded-2xl glass-card backdrop-blur-xl p-5 md:p-6 border border-white/20 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gold-accent">Tambah Data</p>
                                <h3 className="text-lg font-black uppercase text-white tracking-tight">Tambah Kontrak ISP</h3>
                            </div>
                            <button
                                className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                                onClick={() => setContractDraft(null)}
                                type="button"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-white/20">Nomor Kontrak</label>
                                <input
                                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-gold-accent/40"
                                    value={contractDraft.contractReference}
                                    onChange={(e) => setContractDraft((prev) => prev ? { ...prev, contractReference: e.target.value } : prev)}
                                    placeholder="Nomor kontrak"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-white/20">Tanggal Kontrak</label>
                                <DateInput
                                    value={contractDraft.contractStartDate}
                                    onChange={(val) => setContractDraft((prev) => prev ? { ...prev, contractStartDate: val } : prev)}
                                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02]"
                                    inputClass="w-full h-full bg-transparent px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-white/20">Periode Awal</label>
                                <DateInput
                                    value={contractDraft.contractPeriodStart}
                                    onChange={(val) => setContractDraft((prev) => prev ? { ...prev, contractPeriodStart: val } : prev)}
                                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02]"
                                    inputClass="w-full h-full bg-transparent px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-white/20">Periode Akhir</label>
                                <DateInput
                                    value={contractDraft.contractPeriodEnd}
                                    onChange={(val) => setContractDraft((prev) => prev ? { ...prev, contractPeriodEnd: val } : prev)}
                                    className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.02]"
                                    inputClass="w-full h-full bg-transparent px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none"
                                />
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:bg-white/[0.04] transition-all">
                                <span className="flex items-center gap-2 text-white/70 mb-2">
                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                    Berkas Kontrak
                                </span>
                                <span className="block text-white/30 normal-case font-bold text-[10px]">
                                    {contractDraft.contractUploadedFileName || contractDraft.contractFileName || "Upload berkas kontrak"}
                                </span>
                                <input
                                    className="hidden"
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        setContractDraft((prev) => prev ? {
                                            ...prev,
                                            contractUploadedFile: file,
                                            contractUploadedFileName: file?.name ?? "",
                                        } : prev);
                                    }}
                                />
                            </label>
                            <label className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 text-[9px] font-black uppercase tracking-widest text-white/40 cursor-pointer hover:bg-white/[0.04] transition-all">
                                <span className="flex items-center gap-2 text-white/70 mb-2">
                                    <span className="material-symbols-outlined text-[10px]">folder</span>
                                    BAK
                                </span>
                                <span className="block text-white/30 normal-case font-bold text-[10px]">
                                    {contractDraft.bakUploadedFileName || contractDraft.bakFileName || "Upload berkas BAK"}
                                </span>
                                <input
                                    className="hidden"
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        setContractDraft((prev) => prev ? {
                                            ...prev,
                                            bakUploadedFile: file,
                                            bakUploadedFileName: file?.name ?? "",
                                        } : prev);
                                    }}
                                />
                            </label>
                        </div>

                        <div className="mt-3 flex justify-end gap-3 border-t border-white/10 pt-4">
                            <button
                                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-all"
                                onClick={() => setContractDraft(null)}
                                type="button"
                            >
                                Batal
                            </button>
                            <button
                                className="rounded-lg bg-gold-accent px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-900 shadow-gold-glow transition-all active:scale-95 disabled:opacity-50"
                                disabled={contractDraftSaving}
                                onClick={() => void handleSaveContractDraft()}
                                type="button"
                            >
                                {contractDraftSaving ? "Menyimpan..." : "Simpan"}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

        </AppShell>
    );
}

export default IspDetailPage;
