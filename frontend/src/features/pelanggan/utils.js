export const getPackageDisplay = (packageValue) => {
    const normalizedPackage = String(packageValue ?? "").toLowerCase();
    const isSharingPackage = normalizedPackage.includes("shar") || normalizedPackage === "shared";

    return {
        label: isSharingPackage ? "Sharing Core" : "Core",
        filterValue: isSharingPackage ? "sharing_core" : "core",
        isSharingPackage,
    };
};

export const normalizeOperationalStatus = (status) => String(status ?? "").trim().toLowerCase();

export const isPendingOperationalStatus = (status) => ["belum_beroperasi", "belum beroperasi", "belum"].includes(normalizeOperationalStatus(status));

export const isStoppedStatus = (status) => ["berhenti", "nonaktif"].includes(normalizeOperationalStatus(status));

export const getOperationalLabel = (status) => {
    const normalizedStatus = normalizeOperationalStatus(status);
    if (isPendingOperationalStatus(normalizedStatus)) return "Belum Beroperasi";
    if (isStoppedStatus(normalizedStatus)) return "Berhenti";
    if (normalizedStatus === "expired") return "Belum Diperpanjang";
    return "Beroperasi";
};

export const isOperationallyActive = (status) => normalizeOperationalStatus(status) === "aktif";
