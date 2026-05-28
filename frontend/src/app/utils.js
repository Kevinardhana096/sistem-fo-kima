const normalizeApiOrigin = (value) => {
    const normalizedValue = value.replace(/\/$/, "");

    try {
        const parsedUrl = new URL(normalizedValue);
        if (parsedUrl.hostname === "0.0.0.0" || parsedUrl.hostname === "::") {
            parsedUrl.hostname = "localhost";
        }

        return parsedUrl.toString().replace(/\/$/, "");
    } catch {
        return normalizedValue;
    }
};

const resolveApiBaseUrl = () => {
    const envBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === "string"
        ? import.meta.env.VITE_API_BASE_URL.trim()
        : "";

    const fallbackHost = typeof window !== "undefined" && window.location?.hostname
        ? window.location.hostname
        : "localhost";
    const safeFallbackHost = fallbackHost === "0.0.0.0" || fallbackHost === "::"
        ? "localhost"
        : fallbackHost;
    const fallbackProtocol = typeof window !== "undefined" && window.location?.protocol === "https:"
        ? "https:"
        : "http:";

    const fallbackBaseUrl = `${fallbackProtocol}//${safeFallbackHost}:4000`;
    const normalizedBaseUrl = normalizeApiOrigin(envBaseUrl || fallbackBaseUrl);

    // Keep fetch calls consistent with `${API_BASE_URL}/api/...` even when env includes `/api`.
    return normalizedBaseUrl.endsWith("/api")
        ? normalizedBaseUrl.slice(0, -4)
        : normalizedBaseUrl;
};

export const API_BASE_URL = resolveApiBaseUrl();
const REQUEST_TIMEOUT_MS = 10_000;

export const normalizeErrorMessage = (result, fallback) => {
    if (Array.isArray(result?.message)) {
        return result.message.join(", ");
    }

    if (typeof result?.message === "string" && result.message.trim()) {
        return result.message;
    }

    return fallback;
};

export const parseDateValue = (value) => {
    if (!value) {
        return null;
    }

    const raw = typeof value === "string" ? value : String(value);
    const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed;
};

export const formatDate = (value) => {
    const parsed = parseDateValue(value);
    if (!parsed) {
        return "-";
    }

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(parsed);
};

export const formatDateTime = (value) => {
    const parsed = parseDateValue(value);
    if (!parsed) {
        return "-";
    }

    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(parsed);
};

export const formatCurrency = (value) => {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Number.isNaN(amount) ? 0 : amount);
};

export const toTitleCase = (value) => {
    if (!value) {
        return "-";
    }

    return String(value)
        .replaceAll("_", " ")
        .split(" ")
        .filter(Boolean)
        .map((segment) => segment[0].toUpperCase() + segment.slice(1))
        .join(" ");
};

export const formatContractPeriod = (startDate, endDate) => {
    if (!startDate && !endDate) {
        return "-";
    }

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const formatCoreAllocation = (coreType, coreTotal, sharingRatio) => {
    const normalizedTotal = Number(coreTotal ?? 0);
    if (!coreType || !Number.isFinite(normalizedTotal) || normalizedTotal <= 0) {
        return "-";
    }

    if (coreType === "sharing_core") {
        const normalizedRatio = typeof sharingRatio === "string" ? sharingRatio.trim() : "";
        return normalizedRatio
            ? `Sharing Core (Rasio ${normalizedRatio})`
            : "Sharing Core";
    }

    return `Core (${normalizedTotal})`;
};

export const addDaysToIsoDate = (isoDate, days) => {
    const parsed = parseDateValue(isoDate);
    if (!parsed || !Number.isFinite(Number(days))) {
        return "";
    }

    const next = new Date(parsed);
    next.setUTCDate(next.getUTCDate() + Math.round(Number(days)));
    return next.toISOString().slice(0, 10);
};

export const shiftIsoDateByBillingCycle = (isoDate, every, unit) => {
    const parsed = parseDateValue(isoDate);
    const normalizedEvery = Number(every);
    if (!parsed || !Number.isFinite(normalizedEvery) || normalizedEvery <= 0) {
        return "";
    }

    const next = new Date(parsed);
    if (unit === "hari") {
        next.setUTCDate(next.getUTCDate() + Math.round(normalizedEvery));
    } else if (unit === "tahun") {
        next.setUTCFullYear(next.getUTCFullYear() + Math.round(normalizedEvery));
    } else {
        next.setUTCMonth(next.getUTCMonth() + Math.round(normalizedEvery));
    }

    return next.toISOString().slice(0, 10);
};

export const resolveBillingCycle = (billingPeriodMode, billingCustomEvery, billingCustomUnit) => {
    if (billingPeriodMode === "3bulanan") {
        return { every: 3, unit: "bulan" };
    }

    if (billingPeriodMode === "custom") {
        const every = Number(billingCustomEvery);
        if (!Number.isFinite(every) || every <= 0) {
            return null;
        }

        const unit = ["hari", "bulan", "tahun"].includes(billingCustomUnit)
            ? billingCustomUnit
            : "bulan";
        return { every: Math.round(every), unit };
    }

    return { every: 1, unit: "bulan" };
};

export const buildInvoiceScheduleRows = (periodStartDate, periodEndDate, billingCycle) => {
    if (!periodStartDate || !periodEndDate || !billingCycle) {
        return [];
    }

    if (periodStartDate > periodEndDate) {
        return [];
    }

    const rows = [];
    let cursor = periodStartDate;
    let safetyCounter = 0;

    while (cursor <= periodEndDate && safetyCounter < 240) {
        safetyCounter += 1;

        const nextCursor = shiftIsoDateByBillingCycle(cursor, billingCycle.every, billingCycle.unit);
        if (!nextCursor || nextCursor <= cursor) {
            break;
        }

        const calculatedEnd = addDaysToIsoDate(nextCursor, -1);
        const periodRowEndDate = calculatedEnd && calculatedEnd < periodEndDate
            ? calculatedEnd
            : periodEndDate;

        rows.push({
            key: `auto-${cursor}-${periodRowEndDate}`,
            kind: "auto",
            periodStartDate: cursor,
            periodEndDate: periodRowEndDate,
            invoiceNumber: "",
            amount: "",
            paidAt: "",
            invoiceFileName: "",
            paymentProofFileName: "",
        });

        cursor = nextCursor;
    }

    return rows;
};

export const getRemainingRentalDays = (contractEndDate) => {
    const parsedEndDate = parseDateValue(contractEndDate);
    if (!parsedEndDate) {
        return null;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const normalizedEndDate = new Date(parsedEndDate);
    normalizedEndDate.setUTCHours(0, 0, 0, 0);

    return Math.ceil((normalizedEndDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

export const getIspContractActionItems = (contractRows) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (Array.isArray(contractRows) ? contractRows : []).flatMap((row) => {
        const items = [];
        const endDate = parseDateValue(row?.periodEnd);
        const daysLeft = endDate
            ? Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
            : null;

        const followUps = Array.isArray(row?.renewalFollowUps) ? row.renewalFollowUps : [];
        const latestOpenFollowUp = [...followUps]
            .filter((item) => item?.status !== "completed")
            .sort((left, right) => Number(right?.splitOrder ?? 0) - Number(left?.splitOrder ?? 0))[0] ?? null;

        if (latestOpenFollowUp?.renewalFileUrl) {
            items.push({
                key: `${row.id}-${latestOpenFollowUp.id}-pending`,
                rowId: row.id,
                followUpId: latestOpenFollowUp.id,
                tone: "blue",
                title: "Menunggu Tanggapan ISP",
                description: "Berkas perpanjangan sudah diunggah. Lanjutkan dengan upload tanggapan ISP: lanjut atau tidak.",
                actionType: "response",
            });
        }

        if (row?.renewalStatus === "needs_completion") {
            items.push({
                key: `${row.id}-needs-completion`,
                rowId: row.id,
                tone: "amber",
                title: "Lengkapi Data Kontrak Baru",
                description: "Baris kontrak baru sudah dibuat otomatis. Isi nomor kontrak dan periode berjalan kontrak baru.",
                actionType: "edit",
            });
        }

        if (latestOpenFollowUp && !latestOpenFollowUp.renewalFileUrl) {
            items.push({
                key: `${row.id}-${latestOpenFollowUp.id}-renewal-warning`,
                rowId: row.id,
                followUpId: latestOpenFollowUp.id,
                tone: "red",
                title: latestOpenFollowUp.title || (daysLeft >= 0
                    ? `Kontrak berakhir dalam ${daysLeft} hari`
                    : "Kontrak sudah melewati masa berlaku"),
                description: latestOpenFollowUp.description || "Segera unggah berkas perpanjangan untuk konfirmasi lanjut atau tidak ke ISP.",
                actionType: "renewal",
            });
        }

        if ((row?.renewalStatus === "active" || row?.renewalStatus === "needs_completion") && !row?.bakFileUrl) {
            items.push({
                key: `${row.id}-bak-missing`,
                rowId: row.id,
                tone: "orange",
                title: "Upload BAK",
                description: "Berkas BAK belum diunggah pada baris kontrak ini dan masih perlu ditindaklanjuti.",
                actionType: "bak",
            });
        }

        return items;
    });
};

export const isExternalFileUrl = (value) =>
    typeof value === "string" && /^https?:\/\//i.test(value.trim());

export const isOpenableFileUrl = (value) =>
    typeof value === "string" && /^(https?:\/\/|data:|blob:)/i.test(value.trim());

export const openSafeFile = (fileUrl, fileName = "dokumen.pdf") => {
    if (!fileUrl) return;

    // Jika ini adalah URL biasa (http/https), buka langsung
    if (/^https?:\/\//i.test(fileUrl)) {
        window.open(fileUrl, "_blank", "noreferrer");
        return;
    }

    // Jika ini adalah Data URL (Base64)
    if (fileUrl.startsWith("data:")) {
        try {
            const parts = fileUrl.split(",");
            const mime = parts[0].match(/:(.*?);/)[1];
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);

            const win = window.open(blobUrl, "_blank");
            if (win) {
                win.focus();
                // Opsional: bersihkan URL memori setelah beberapa saat
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
            } else {
                // Fallback jika pop-up diblokir: paksa download
                const link = document.createElement("a");
                link.href = blobUrl;
                link.download = fileName;
                link.click();
            }
        } catch (e) {
            console.error("Gagal membuka file:", e);
            alert("Gagal membuka berkas. Format data tidak valid.");
        }
        return;
    }

    // Fallback terakhir
    window.open(fileUrl, "_blank", "noreferrer");
};

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        resolve("");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
        reject(new Error(`Gagal membaca file ${file.name}.`));
    };
    reader.readAsDataURL(file);
});

export const formatPackageRatio = (value) => {
    if (value == null || value === "") {
        return null;
    }

    return String(value).trim().replace(":", "/");
};

const getDateValue = (value) => {
    const timestamp = parseDateValue(value)?.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const getContractVersionNumber = (version) => Number(version?.versionNumber ?? version?.version_number ?? 0);
const getTodayIso = () => new Date().toISOString().slice(0, 10);
const getStartDate = (item) => item?.startDate ?? item?.start_date ?? null;
const getEndDate = (item) => item?.endDate ?? item?.end_date ?? null;
const isDateInPeriod = (item, date) => getStartDate(item) <= date && getEndDate(item) >= date;

const sortContractVersions = (versions = []) => [...versions]
    .filter(version => !(version?.deletedAt ?? version?.deleted_at))
    .sort((left, right) => {
        const versionDiff = getContractVersionNumber(right) - getContractVersionNumber(left);
        if (versionDiff !== 0) {
            return versionDiff;
        }

        return getDateValue(right.endDate ?? right.end_date ?? right.startDate ?? right.start_date)
            - getDateValue(left.endDate ?? left.end_date ?? left.startDate ?? left.start_date);
    });

export const getLatestContractVersion = (contract) => sortContractVersions(contract?.versions)[0] ?? null;

export const getEffectiveContractVersion = (contract, date = getTodayIso()) => (
    sortContractVersions(contract?.versions).find(version => isDateInPeriod(version, date))
    ?? null
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

export const getCustomerPrimaryContract = (customer, date = getTodayIso()) => {
    if (!Array.isArray(customer.contracts)) return null;

    const contracts = [...customer.contracts].filter(contract => !(contract?.deletedAt ?? contract?.deleted_at));
    return contracts.find(contract => isDateInPeriod(contract, date))
        ?? contracts.find(contract => getStartDate(contract) > date)
        ?? contracts.sort((left, right) => getContractLatestPeriodTimestamp(right) - getContractLatestPeriodTimestamp(left))[0]
        ?? null;
};

export const getCustomerInitialContract = (customer) => (
    Array.isArray(customer.contracts)
        ? [...customer.contracts].sort((left, right) => getDateValue(left.startDate ?? left.start_date) - getDateValue(right.startDate ?? right.start_date))[0]
        : null
);

export const getCustomerSharedCoreRatio = (customer) => {
    const contract = getCustomerPrimaryContract(customer);
    const effectiveVersion = getEffectiveContractVersion(contract);

    return effectiveVersion?.sharedCoreRatio
        ?? effectiveVersion?.shared_core_ratio
        ?? contract?.sharingRatio
        ?? contract?.sharing_ratio
        ?? customer.contractSharingRatio
        ?? customer.contract_sharing_ratio
        ?? null;
};

export const resolveCustomerPackageInfo = (customer) => {
    const contract = getCustomerPrimaryContract(customer);
    const effectiveVersion = getEffectiveContractVersion(contract);
    const sharedCoreRatio = getCustomerSharedCoreRatio(customer);
    const rawPackage = String(
        effectiveVersion?.core_type
            ?? effectiveVersion?.coreType
            ?? contract?.core_type
            ?? contract?.coreType
            ?? customer.paket
            ?? "",
    ).toLowerCase();
    const isSharingPackage = rawPackage.includes("shar") || rawPackage === "shared";
    const isCorePackage = rawPackage.includes("core") || rawPackage === "";

    if (isSharingPackage) {
        return {
            paket: "sharing_core",
            jumlah: formatPackageRatio(
                sharedCoreRatio
                    ?? effectiveVersion?.shared_core_ratio
                    ?? effectiveVersion?.sharedCoreRatio
                    ?? contract?.sharing_ratio
                    ?? contract?.sharingRatio
                    ?? customer.jumlah,
            ),
        };
    }

    if (isCorePackage) {
        return {
            paket: "core",
            jumlah: effectiveVersion?.core_total
                ?? effectiveVersion?.coreTotal
                ?? contract?.core_total
                ?? contract?.coreTotal
                ?? customer.jumlah
                ?? null,
        };
    }

    return {
        paket: customer.paket ?? null,
        jumlah: customer.jumlah ?? null,
    };
};

export const resolveCustomerContractPeriodInfo = (customer) => {
    const contract = getCustomerPrimaryContract(customer);
    const initialContract = getCustomerInitialContract(customer);
    const effectiveVersion = getEffectiveContractVersion(contract);

    return {
        contractStartDate: customer.contractStartDate
            ?? customer.contract_start_date
            ?? initialContract?.contract_start_date
            ?? initialContract?.contractStartDate
            ?? initialContract?.start_date
            ?? initialContract?.startDate
            ?? contract?.contract_start_date
            ?? contract?.contractStartDate
            ?? contract?.start_date
            ?? contract?.startDate
            ?? effectiveVersion?.start_date
            ?? effectiveVersion?.startDate
            ?? null,
        contractPeriodStart: effectiveVersion?.start_date
            ?? effectiveVersion?.startDate
            ?? contract?.start_date
            ?? contract?.startDate
            ?? customer.contractPeriodStart
            ?? customer.contract_period_start
            ?? null,
        contractPeriodEnd: effectiveVersion?.end_date
            ?? effectiveVersion?.endDate
            ?? contract?.end_date
            ?? contract?.endDate
            ?? customer.contractPeriodEnd
            ?? customer.contract_period_end
            ?? null,
    };
};

const normalizeDisplayContractNumber = (value) => {
    const contractNumber = String(value ?? "").trim();
    return contractNumber && !contractNumber.startsWith("NO-BAK-") ? contractNumber : "-";
};

export const resolveCustomerContractNumber = (customer) => {
    const contract = getCustomerPrimaryContract(customer);
    const effectiveVersion = getEffectiveContractVersion(contract);

    return normalizeDisplayContractNumber(
        effectiveVersion?.contractNumber
            ?? effectiveVersion?.contract_number
            ?? contract?.contractNumber
            ?? contract?.contract_number
            ?? customer.contractNumber
            ?? customer.contract_number,
    );
};

export const mapCustomerToRow = (customer, index) => {
    const active = customer.status === "aktif";
    const activationFeeAmount = Number(customer.activationFeeAmount ?? customer.activation_fee_amount ?? 0);
    const activationFeePaidAt = customer.activationFeePaidAt ?? customer.activation_fee_paid_at ?? null;
    const routeStatus = typeof customer.routeStatus === "string"
        ? customer.routeStatus
        : "aktif";
    const packageInfo = resolveCustomerPackageInfo(customer);
    const contractPeriodInfo = resolveCustomerContractPeriodInfo(customer);

    // Handle both NestJS format (customer.isps) and Supabase format (customer.ispMemberships)
    let ispList = [];
    if (Array.isArray(customer.isps)) {
        // NestJS format
        ispList = customer.isps
            .map((isp) => isp?.name)
            .filter((name) => typeof name === "string" && name.trim().length > 0);
    } else if (Array.isArray(customer.ispMemberships)) {
        // Supabase format
        ispList = customer.ispMemberships
            .map((membership) => membership?.isp?.name)
            .filter((name) => typeof name === "string" && name.trim().length > 0);
    }

    const fallbackIspName = typeof customer.ispName === "string" && customer.ispName.trim()
        ? customer.ispName.trim()
        : typeof customer.isp_name === "string" && customer.isp_name.trim()
        ? customer.isp_name.trim()
        : "-";
    const primaryIsp = ispList[0] ?? fallbackIspName;
    const ispDisplay = ispList.length > 1
        ? `${primaryIsp} (+${ispList.length - 1})`
        : primaryIsp;

    return {
        id: customer.id,
        no: String(index + 1).padStart(2, "0"),
        isp: primaryIsp,
        ispDisplay,
        ispList: ispList.length > 0 ? ispList : [primaryIsp],
        name: customer.name ?? "-",
        status: active ? "Beroperasi" : "Berhenti",
        active,
        contracts: Number(customer.contractCount ?? customer.contract_count ?? 0),
        documents: Number(customer.documentCount ?? customer.document_count ?? 0),
        invoices: Number(customer.invoiceCount ?? customer.invoice_count ?? 0),
        customerId: customer.customerCode ?? customer.customer_code ?? `CUST-${customer.id}`,
        rawStatus: customer.status,
        routeStatus,
        contractStartDate: contractPeriodInfo.contractStartDate,
        contractPeriodStart: contractPeriodInfo.contractPeriodStart,
        contractPeriodEnd: contractPeriodInfo.contractPeriodEnd,
        contractNumber: resolveCustomerContractNumber(customer),
        activationFeeAmount,
        activationFeePaidAt,
        paket: packageInfo.paket,
        jumlah: packageInfo.jumlah,
    };
};

export const getMonthStatusClass = (status) => {
    if (status === "lunas") {
        return "bg-[#00c853] text-white shadow-[#00c853]/20";
    }

    if (status === "belum_bayar") {
        return "bg-[#ff2400] text-white shadow-[#ff2400]/20";
    }

    if (status === "terlambat") {
        return "bg-[#ffab00] text-white shadow-[#ffab00]/20";
    }

    if (status === "belum_ditagih") {
        return "bg-white/10 text-white/40 border border-white/10";
    }

    if (status === "di_luar_periode") {
        return "bg-slate-950/60 text-white/10 border border-white/5 opacity-40 cursor-not-allowed";
    }

    return "bg-slate-100/10 text-white/20 border-white/5 opacity-40";
};

export const createDefaultDocumentForm = () => ({
    jenisDokumen: "kontrak",
    nomorDokumen: "",
    tanggalDokumen: new Date().toISOString().slice(0, 10),
    contractId: "",
});

export async function fetchJson(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: options?.signal ?? controller.signal,
            ...options,
        });
        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                normalizeErrorMessage(result, `Permintaan gagal (${response.status}).`),
            );
        }

        return result;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(
                `Permintaan melebihi ${REQUEST_TIMEOUT_MS / 1000} detik. Periksa backend di ${API_BASE_URL}.`,
            );
        }

        if (error instanceof TypeError) {
            throw new Error(`Gagal terhubung ke backend (${API_BASE_URL}).`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
