export const getPackageDisplay = (packageValue) => {
    const normalizedPackage = String(packageValue ?? "").toLowerCase();
    const isSharingPackage = normalizedPackage.includes("shar") || normalizedPackage === "shared";

    return {
        label: isSharingPackage ? "SHARING CORE" : "CORE",
        filterValue: isSharingPackage ? "sharing_core" : "core",
        isSharingPackage,
    };
};

export const normalizeOperationalStatus = (status) => String(status ?? "").trim().toLowerCase();

export const isStoppedStatus = (status) => ["berhenti", "nonaktif"].includes(normalizeOperationalStatus(status));

export const getOperationalLabel = (status) => {
    const normalizedStatus = normalizeOperationalStatus(status);
    if (isStoppedStatus(normalizedStatus)) return "Berhenti";
    if (normalizedStatus === "expired") return "Belum Diperpanjang";
    return "Beroperasi";
};

export const isOperationallyActive = (status) => normalizeOperationalStatus(status) === "aktif";
