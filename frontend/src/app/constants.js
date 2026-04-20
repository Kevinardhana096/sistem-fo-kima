export const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "customers", label: "Pelanggan", icon: "groups" },
    { key: "monitoring", label: "Monitoring", icon: "monitor_heart" },
    { key: "trash", label: "Tempat Sampah", icon: "delete", separated: true },
];

export const sectionMeta = {
    dashboard: {
        title: "Dashboard",
        description: "Ringkasan performa tenant, kontrak aktif, dan indikator operasional harian.",
    },
    monitoring: {
        title: "Monitoring",
        description: "Pantau aktivitas tenant, SLA, serta notifikasi anomali secara real-time.",
    },
    trash: {
        title: "Tempat Sampah",
        description: "Dokumen dan entitas yang dihapus sementara sebelum pemusnahan permanen.",
    },
};

export const monitoringMonths = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export const monthNames = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

export const documentTypeOptions = [
    { value: "permohonan", label: "Permohonan" },
    { value: "penawaran", label: "Surat Penawaran Harga" },
    { value: "tanggapan", label: "Surat Tanggapan" },
    { value: "hasil_nego", label: "Surat Hasil Negosiasi" },
    { value: "BAK", label: "BAK" },
    { value: "kontrak", label: "Kontrak" },
    { value: "perpanjangan", label: "Perpanjangan" },
    { value: "pemutusan", label: "Pemutusan" },
    { value: "lainnya", label: "Lainnya" },
];

export const documentTypeLabelMap = documentTypeOptions.reduce((accumulator, current) => {
    accumulator[current.value] = current.label;
    return accumulator;
}, {});

export const documentTypeBadgeClass = {
    kontrak: "bg-blue-100 text-blue-700",
    invoice: "bg-emerald-100 text-emerald-700",
    pemutusan: "bg-red-100 text-red-700",
    perpanjangan: "bg-indigo-100 text-indigo-700",
    BAK: "bg-amber-100 text-amber-700",
    permohonan: "bg-slate-100 text-slate-700",
    penawaran: "bg-cyan-100 text-cyan-700",
    tanggapan: "bg-teal-100 text-teal-700",
    hasil_nego: "bg-violet-100 text-violet-700",
    lainnya: "bg-zinc-100 text-zinc-700",
};

export const invoiceStatusLabelMap = {
    lunas: "Lunas",
    belum_bayar: "Belum Bayar",
    terlambat: "Terlambat",
    belum_ditagih: "Belum Ditagih",
};

export const invoiceStatusBadgeClass = {
    lunas: "bg-emerald-100 text-emerald-700",
    belum_bayar: "bg-red-100 text-red-700",
    terlambat: "bg-orange-100 text-orange-700",
    belum_ditagih: "bg-amber-100 text-amber-700",
};

export const contractStatusLabelMap = {
    aktif: "Aktif",
    expired: "Expired",
    terminated: "Terminated",
};

export const contractStatusBadgeClass = {
    aktif: "bg-blue-100 text-blue-700",
    expired: "bg-amber-100 text-amber-700",
    terminated: "bg-red-100 text-red-700",
};

export const timelineIconMap = {
    document: "article",
    contract: "description",
    contract_version: "history",
    invoice: "receipt_long",
    payment: "payments",
    todo: "task_alt",
};

export const timelineColorMap = {
    document: "text-blue-700 bg-blue-50",
    contract: "text-amber-700 bg-amber-50",
    contract_version: "text-indigo-700 bg-indigo-50",
    invoice: "text-emerald-700 bg-emerald-50",
    payment: "text-emerald-700 bg-emerald-50",
    todo: "text-slate-700 bg-slate-100",
};
