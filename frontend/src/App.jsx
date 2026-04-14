import { useState } from "react";
import "./App.css";

const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "customers", label: "Pelanggan", icon: "groups" },
    { key: "monitoring", label: "Monitoring", icon: "monitor_heart" },
    { key: "contracts", label: "Kontrak", icon: "description" },
    { key: "invoices", label: "Invoice", icon: "receipt_long" },
    { key: "archives", label: "Arsip Dokumen", icon: "inventory_2" },
    { key: "trash", label: "Tempat Sampah", icon: "delete", separated: true },
];

const mobileItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "customers", label: "Pelanggan", icon: "groups", filled: true },
    { key: "contracts", label: "Kontrak", icon: "description" },
    { key: "monitoring", label: "Lainnya", icon: "more_horiz" },
];

const sectionMeta = {
    dashboard: {
        title: "Dashboard",
        description: "Ringkasan performa tenant, kontrak aktif, dan indikator operasional harian.",
    },
    monitoring: {
        title: "Monitoring",
        description: "Pantau aktivitas tenant, SLA, serta notifikasi anomali secara real-time.",
    },
    contracts: {
        title: "Kontrak",
        description: "Kelola lifecycle kontrak, masa berlaku, dan proses amandemen dokumen.",
    },
    invoices: {
        title: "Invoice",
        description: "Manajemen penagihan, status pembayaran, dan aging tagihan pelanggan.",
    },
    archives: {
        title: "Arsip Dokumen",
        description: "Pusat arsip legal dan administratif untuk seluruh tenant dan mitra.",
    },
    trash: {
        title: "Tempat Sampah",
        description: "Dokumen dan entitas yang dihapus sementara sebelum pemusnahan permanen.",
    },
};

const customers = [
    {
        no: "01",
        isp: "TELKOM INDONESIA",
        name: "PT Teknologi Nusantara Sejahtera",
        status: "Aktif",
        active: true,
        contracts: "12",
        customerId: "CUST-88291",
    },
    {
        no: "02",
        isp: "BIZNET NETWORKS",
        name: "Grand Atrium Mall Management",
        status: "Non-aktif",
        active: false,
        contracts: "05",
        customerId: "CUST-77302",
    },
    {
        no: "03",
        isp: "INDOSAT OOREDOO",
        name: "Bank Syariah Indonesia Tbk",
        status: "Aktif",
        active: true,
        contracts: "24",
        customerId: "CUST-99412",
    },
    {
        no: "04",
        isp: "BIZNET NETWORKS",
        name: "PT Global Digital Niaga",
        status: "Aktif",
        active: true,
        contracts: "08",
        customerId: "CUST-66119",
    },
];

function App() {
    const [activeSection, setActiveSection] = useState("customers");
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const handleNavigate = (sectionKey) => {
        setActiveSection(sectionKey);
        setSelectedCustomer(null);
    };

    const handleOpenDetail = (customer) => {
        setActiveSection("customers");
        setSelectedCustomer(customer);
    };

    if (activeSection === "dashboard") {
        return <DashboardPage activeSection={activeSection} onNavigate={handleNavigate} />;
    }

    if (activeSection !== "customers") {
        return (
            <SectionPlaceholderPage
                activeSection={activeSection}
                onNavigate={handleNavigate}
            />
        );
    }

    if (selectedCustomer) {
        return (
            <CustomerDetailPage
                customer={selectedCustomer}
                onBack={() => setSelectedCustomer(null)}
                onNavigate={handleNavigate}
            />
        );
    }

    return (
        <CustomerDirectoryPage
            activeSection={activeSection}
            onNavigate={handleNavigate}
            onOpenDetail={handleOpenDetail}
        />
    );
}

function AppShell({ activeSection, onNavigate, children }) {
    return (
        <div className="bg-surface text-on-surface">
            <TopNav />
            <Sidebar activeSection={activeSection} onNavigate={onNavigate} />
            <main className="min-h-screen px-6 pb-24 pt-24 md:ml-64 md:px-12">{children}</main>
            <MobileNav activeSection={activeSection} onNavigate={onNavigate} />
        </div>
    );
}

function TopNav() {
    return (
        <nav className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-white/80 px-6 font-manrope antialiased shadow-sm backdrop-blur-xl">
            <div className="flex items-center gap-8">
                <span className="text-xl font-bold tracking-tight text-blue-900">The Archive</span>
                <div className="hidden items-center gap-6 md:flex">
                    <div className="group relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600">
                            search
                        </span>
                        <input
                            className="w-64 rounded-full border-none bg-slate-100 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
                            placeholder="Cari dokumen atau pelanggan..."
                            type="text"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    className="cursor-pointer rounded-full p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-50 active:scale-95"
                    type="button"
                >
                    <span className="material-symbols-outlined">notifications</span>
                </button>
                <div className="h-8 w-8 overflow-hidden rounded-full border border-outline-variant/20">
                    <img
                        alt="User Profile"
                        className="h-full w-full object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCllZftsXViF28ECBdiJms9yGqlLCaj32keChOCglGD3Cp53vCisRUwtp4h-QAnUbSzlqrG0TLbnCX01MuZ2Ve2y_RnSO-fyf-Y_6fOTBNwRPRE5vc56RliPzP7F_9dAFjC4cJOTYxe8NQ3Mt30xL_g-_aIzZ4l9DLhdBtKugVn0cQ6GWJQfLK3ktLa6DOdjLZ6yg1frdNzs1ochbBeq9zoPZ_69hlX8gIHyET35Bygw0t3sjOieY8d5RATK1XW7LWYwAZvAHozcGI"
                    />
                </div>
            </div>
        </nav>
    );
}

function Sidebar({ activeSection, onNavigate }) {
    return (
        <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col space-y-2 bg-slate-50 p-4 pt-20 font-manrope text-sm font-medium md:flex">
            <div className="mb-6 px-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
                    Ecosystem
                </p>
                <div className="flex items-center gap-3">
                    <div className="h-8 w-2 rounded-full bg-primary"></div>
                    <div>
                        <h3 className="text-sm font-bold text-blue-900">Enterprise Curator</h3>
                    </div>
                </div>
            </div>

            <div className="mb-4 px-2">
                <button
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-primary/90 active:scale-95"
                    type="button"
                >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    <span>Tambah Pelanggan Baru</span>
                </button>
            </div>

            <nav className="space-y-1">
                {sidebarItems.map((item) => {
                    const isActive = activeSection === item.key;
                    return (
                        <div key={item.key}>
                            {item.separated && <div className="mt-4 border-t border-slate-200/50 pt-4"></div>}
                            <button
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isActive
                                        ? "rounded-lg bg-white text-blue-900 shadow-sm"
                                        : "text-slate-600 transition-transform duration-200 hover:translate-x-1 hover:text-blue-800"
                                    }`}
                                onClick={() => onNavigate(item.key)}
                                type="button"
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}

function MobileNav({ activeSection, onNavigate }) {
    return (
        <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around bg-white px-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden">
            {mobileItems.map((item) => {
                const isActive = activeSection === item.key;
                return (
                    <button
                        key={item.key}
                        className={`flex flex-col items-center gap-1 ${isActive ? "text-primary" : "text-slate-500"
                            }`}
                        onClick={() => onNavigate(item.key)}
                        type="button"
                    >
                        <span
                            className="material-symbols-outlined"
                            style={
                                isActive && item.filled
                                    ? { fontVariationSettings: "'FILL' 1" }
                                    : undefined
                            }
                        >
                            {item.icon}
                        </span>
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

function CustomerDirectoryPage({ activeSection, onNavigate, onOpenDetail }) {
    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl">
                <header className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div className="space-y-2">
                        <nav className="mb-1 flex items-center gap-2 text-xs font-medium text-on-surface-variant/70">
                            <span>The Archive</span>
                            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                            <span className="font-bold text-primary">Direktori Pelanggan</span>
                        </nav>
                        <h1 className="text-4xl font-extrabold tracking-tight text-primary">Daftar Pelanggan</h1>
                        <p className="max-w-lg leading-relaxed text-on-surface-variant">
                            Kelola data penyewa dan mitra ISP dalam satu antarmuka kurasi yang terintegrasi.
                        </p>
                    </div>

                    <button
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-6 py-3.5 font-bold text-white shadow-lg transition-all hover:shadow-primary/20 active:scale-95"
                        type="button"
                    >
                        <span className="material-symbols-outlined">person_add</span>
                        <span>Tambah Pelanggan</span>
                    </button>
                </header>

                <section className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl bg-surface-container-low p-5">
                    <div className="relative min-w-[300px] flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                            search
                        </span>
                        <input
                            className="w-full rounded-xl border-none bg-surface-container-lowest py-3 pl-12 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/10"
                            placeholder="Cari nama pelanggan atau ISP..."
                            type="text"
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative min-w-[180px]">
                            <select className="w-full appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3 pr-10 text-sm shadow-sm focus:ring-2 focus:ring-primary/10">
                                <option>Semua ISP</option>
                                <option>Telkom Indonesia</option>
                                <option>Biznet Networks</option>
                                <option>Indosat Ooredoo</option>
                            </select>
                            <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline">
                                expand_more
                            </span>
                        </div>

                        <button
                            className="rounded-xl bg-surface-container-lowest p-3 text-on-surface shadow-sm transition-colors hover:bg-white"
                            type="button"
                        >
                            <span className="material-symbols-outlined">filter_list</span>
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6">
                    <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_20px_40px_rgba(25,28,30,0.04)]">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-outline-variant/10 bg-slate-50/50">
                                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            No
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            Nama ISP &amp; Pelanggan
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            Status
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            Jumlah Kontrak
                                        </th>
                                        <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-surface">
                                    {customers.map((customer, index) => (
                                        <tr key={customer.no} className="group transition-colors hover:bg-slate-50">
                                            <td className="px-6 py-5 text-sm font-medium text-on-surface-variant/50">
                                                {customer.no}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="mb-0.5 text-xs font-bold tracking-wide text-primary">
                                                        {customer.isp}
                                                    </span>
                                                    <span className="text-sm font-semibold text-on-surface">{customer.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div
                                                    className={`inline-flex items-center gap-2 rounded-full border-l-[4px] py-1 pl-1 pr-3 ${customer.active
                                                            ? "border-green-600 bg-surface-container"
                                                            : "border-error bg-error-container/30"
                                                        }`}
                                                >
                                                    {customer.active && (
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full bg-green-600 ${index === 0 ? "animate-pulse" : ""
                                                                }`}
                                                        ></span>
                                                    )}
                                                    <span
                                                        className={`text-[11px] font-bold uppercase ${customer.active ? "text-on-surface" : "text-on-error-container"
                                                            }`}
                                                    >
                                                        {customer.status}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-on-surface">{customer.contracts}</span>
                                                    <span className="text-[10px] font-medium text-on-surface-variant">
                                                        Kontrak Aktif
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/5 group-hover:scale-110"
                                                        onClick={() => onOpenDetail(customer)}
                                                        title="Detail"
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                                    </button>
                                                    <button
                                                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-slate-100"
                                                        title="Edit"
                                                        type="button"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">edit_note</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-slate-50/50 px-6 py-4">
                            <p className="text-xs font-medium text-on-surface-variant">
                                Menampilkan 1-10 dari 48 pelanggan
                            </p>
                            <div className="flex items-center gap-2">
                                <button className="rounded-lg p-2 transition-colors hover:bg-slate-200" type="button">
                                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                                </button>
                                <button
                                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white"
                                    type="button"
                                >
                                    1
                                </button>
                                <button
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors hover:bg-slate-200"
                                    type="button"
                                >
                                    2
                                </button>
                                <button
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors hover:bg-slate-200"
                                    type="button"
                                >
                                    3
                                </button>
                                <button className="rounded-lg p-2 transition-colors hover:bg-slate-200" type="button">
                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-primary p-6 text-white">
                            <div className="relative z-10">
                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                                    Quick Insights
                                </span>
                                <h4 className="mb-4 text-xl font-bold leading-tight">
                                    Analisis Pertumbuhan Pelanggan Kuartal Ini
                                </h4>
                                <p className="mb-6 text-xs leading-relaxed text-blue-100/80">
                                    Peningkatan sebesar 12% dalam registrasi pelanggan baru dibandingkan bulan lalu.
                                </p>
                            </div>
                            <button
                                className="relative z-10 flex w-fit items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur-md transition-colors hover:bg-white/30"
                                type="button"
                            >
                                Unduh Laporan
                                <span className="material-symbols-outlined text-sm">download</span>
                            </button>
                            <div className="absolute -bottom-4 -right-4 h-32 w-32 rounded-full bg-white/10 blur-3xl"></div>
                        </div>

                        <div className="rounded-2xl border border-secondary-container/50 bg-secondary-container/30 p-6 md:col-span-2">
                            <div className="mb-6 flex items-start justify-between">
                                <div>
                                    <h4 className="mb-1 font-bold text-on-secondary-container">Catatan Sistem</h4>
                                    <p className="text-xs text-on-secondary-container/70">
                                        Pemberitahuan administratif terbaru untuk direktori ini.
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-secondary">info</span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-4 rounded-xl bg-white/60 p-3">
                                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                                    <p className="text-xs font-medium text-on-surface">
                                        Verifikasi 5 kontrak tertunda untuk
                                        <span className="font-bold"> PT Teknologi Nusantara</span>
                                    </p>
                                    <span className="ml-auto text-[10px] text-on-surface-variant">2 jam yang lalu</span>
                                </div>

                                <div className="flex items-center gap-4 rounded-xl bg-white/60 p-3">
                                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                    <p className="text-xs font-medium text-on-surface">
                                        Pembaruan sistem database direktori berhasil dilakukan.
                                    </p>
                                    <span className="ml-auto text-[10px] text-on-surface-variant">Kemarin</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function DashboardPage({ activeSection, onNavigate }) {
    const revenueBars = [
        { label: "Mei", height: "h-32" },
        { label: "Jun", height: "h-44" },
        { label: "Jul", height: "h-56", active: true, value: "Rp 420jt" },
        { label: "Agu", height: "h-40" },
        { label: "Sep", height: "h-48" },
        { label: "Okt", height: "h-60" },
    ];

    return (
        <AppShell activeSection={activeSection} onNavigate={onNavigate}>
            <div className="mx-auto max-w-7xl space-y-8">
                <section className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
                    <div className="max-w-2xl">
                        <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-primary">
                            Dashboard Monitoring
                        </h1>
                        <p className="text-on-surface-variant">
                            Pantau status penyewa, performa kontrak, dan arus kas dalam satu tampilan
                            editorial yang terkurasi.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface-variant shadow-sm">
                        <span className="material-symbols-outlined text-lg text-primary">calendar_today</span>
                        <span>Oktober 2023 - Sekarang</span>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 md:grid-cols-5">
                    <div className="rounded-lg border-l-4 border-primary bg-surface-container-lowest p-6 shadow-sm transition-all hover:bg-white">
                        <div className="mb-4 flex items-start justify-between">
                            <span className="material-symbols-outlined rounded-lg bg-primary/10 p-2 text-primary">
                                groups
                            </span>
                            <span className="text-xs font-bold text-primary">+12%</span>
                        </div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Total Penyewa
                        </p>
                        <h3 className="text-3xl font-extrabold text-on-surface">1,284</h3>
                    </div>

                    <div className="rounded-lg border-l-4 border-secondary bg-surface-container-lowest p-6 shadow-sm transition-all hover:bg-white">
                        <div className="mb-4 flex items-start justify-between">
                            <span className="material-symbols-outlined rounded-lg bg-secondary/10 p-2 text-secondary">
                                description
                            </span>
                            <span className="text-xs font-bold text-secondary">Stabil</span>
                        </div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Kontrak Aktif
                        </p>
                        <h3 className="text-3xl font-extrabold text-on-surface">952</h3>
                    </div>

                    <div className="rounded-lg border-l-4 border-tertiary-container bg-surface-container-lowest p-6 shadow-sm transition-all hover:bg-white">
                        <div className="mb-4 flex items-start justify-between">
                            <span className="material-symbols-outlined rounded-lg bg-tertiary-fixed p-2 text-tertiary-container">
                                pending_actions
                            </span>
                            <span className="text-xs font-bold text-tertiary-container">24 New</span>
                        </div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Unpaid Invoice
                        </p>
                        <h3 className="text-3xl font-extrabold text-on-surface">118</h3>
                    </div>

                    <div className="rounded-lg border-l-4 border-error bg-surface-container-lowest p-6 shadow-sm transition-all hover:bg-white">
                        <div className="mb-4 flex items-start justify-between">
                            <span className="material-symbols-outlined rounded-lg bg-error-container p-2 text-error">
                                warning
                            </span>
                            <span className="text-xs font-bold text-error">Critical</span>
                        </div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Overdue
                        </p>
                        <h3 className="text-3xl font-extrabold text-on-surface">42</h3>
                    </div>

                    <div className="rounded-lg border-l-4 border-primary-container bg-surface-container-lowest p-6 shadow-sm transition-all hover:bg-white">
                        <div className="mb-4 flex items-start justify-between">
                            <span className="material-symbols-outlined rounded-lg bg-secondary-container p-2 text-primary-container">
                                check_circle
                            </span>
                            <span className="text-xs font-bold text-primary-container">Target Met</span>
                        </div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                            Paid Invoices
                        </p>
                        <h3 className="text-3xl font-extrabold text-on-surface">2,840</h3>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm lg:col-span-2">
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-on-surface">Monthly Revenue</h4>
                                <p className="text-sm text-on-surface-variant">
                                    Pendapatan kotor bulanan dari penyewaan properti
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button className="rounded bg-surface-container px-3 py-1 text-xs font-bold text-on-surface" type="button">
                                    6 Bulan
                                </button>
                                <button
                                    className="rounded px-3 py-1 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container"
                                    type="button"
                                >
                                    1 Tahun
                                </button>
                            </div>
                        </div>

                        <div className="flex h-64 items-end justify-between gap-4 px-4">
                            {revenueBars.map((item) => (
                                <div key={item.label} className="group flex flex-1 flex-col items-center">
                                    <div
                                        className={`relative w-full rounded-t-lg transition-all duration-300 ${item.height} ${item.active
                                                ? "bg-primary/10 group-hover:bg-primary"
                                                : "bg-surface-container group-hover:bg-primary/20"
                                            }`}
                                    >
                                        {item.active && (
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-on-surface px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                                {item.value}
                                            </div>
                                        )}
                                    </div>
                                    <span
                                        className={`mt-4 text-xs font-bold ${item.active ? "text-primary" : "text-on-surface-variant"
                                            }`}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                        <h4 className="mb-1 text-lg font-bold text-on-surface">Status Invoice</h4>
                        <p className="mb-10 text-sm text-on-surface-variant">Distribusi penagihan aktif</p>

                        <div className="relative flex flex-grow items-center justify-center">
                            <svg className="h-48 w-48 -rotate-90 transform">
                                <circle
                                    className="text-surface-container"
                                    cx="96"
                                    cy="96"
                                    fill="transparent"
                                    r="80"
                                    stroke="currentColor"
                                    strokeWidth="20"
                                ></circle>
                                <circle
                                    className="text-primary-container"
                                    cx="96"
                                    cy="96"
                                    fill="transparent"
                                    r="80"
                                    stroke="currentColor"
                                    strokeDasharray="502"
                                    strokeDashoffset="150"
                                    strokeWidth="20"
                                ></circle>
                                <circle
                                    className="text-tertiary-container"
                                    cx="96"
                                    cy="96"
                                    fill="transparent"
                                    r="80"
                                    stroke="currentColor"
                                    strokeDasharray="502"
                                    strokeDashoffset="350"
                                    strokeWidth="20"
                                ></circle>
                                <circle
                                    className="text-error"
                                    cx="96"
                                    cy="96"
                                    fill="transparent"
                                    r="80"
                                    stroke="currentColor"
                                    strokeDasharray="502"
                                    strokeDashoffset="460"
                                    strokeWidth="20"
                                ></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-on-surface">3.2k</span>
                                <span className="text-[10px] font-bold uppercase text-on-surface-variant">
                                    Total Penagihan
                                </span>
                            </div>
                        </div>

                        <div className="mt-10 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="h-3 w-3 rounded-full bg-primary-container"></span>
                                    <span className="text-sm font-medium text-on-surface">Lunas</span>
                                </div>
                                <span className="text-sm font-bold">70%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="h-3 w-3 rounded-full bg-tertiary-container"></span>
                                    <span className="text-sm font-medium text-on-surface">Belum Dibayar</span>
                                </div>
                                <span className="text-sm font-bold">22%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="h-3 w-3 rounded-full bg-error"></span>
                                    <span className="text-sm font-medium text-on-surface">Terlambat</span>
                                </div>
                                <span className="text-sm font-bold">8%</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div className="rounded-lg bg-surface-container-low p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h4 className="text-lg font-bold text-primary">Aktivitas Terkini</h4>
                            <span className="cursor-pointer text-xs font-bold text-on-surface-variant hover:underline">
                                Lihat Semua
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed">
                                    <span className="material-symbols-outlined text-xl text-primary">description</span>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-bold text-on-surface">PT. Teknologi Sejahtera</p>
                                    <p className="text-xs text-on-surface-variant">Pembaharuan Kontrak - Lantai 4 Blok B</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-on-surface-variant">2 Menit Lalu</p>
                                    <span className="mt-1 inline-block rounded-full bg-secondary-container px-2 py-0.5 text-[9px] font-bold text-on-secondary-container">
                                        DIPROSES
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container">
                                    <span className="material-symbols-outlined text-xl text-error">payment</span>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-sm font-bold text-on-surface">UD. Mekar Wangi</p>
                                    <p className="text-xs text-on-surface-variant">Invoice INV-0923 Terlambat 5 Hari</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-on-surface-variant">15 Menit Lalu</p>
                                    <span className="mt-1 inline-block rounded-full bg-error-container px-2 py-0.5 text-[9px] font-bold text-on-error-container">
                                        PERINGATAN
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary to-primary-container p-8 text-white">
                        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
                        <div className="relative z-10">
                            <h4 className="mb-2 text-xl font-bold">Statistik Hunian Unit</h4>
                            <p className="text-sm text-on-primary-container">
                                Efisiensi penggunaan ruangan per sektor gedung saat ini.
                            </p>
                        </div>

                        <div className="relative z-10 mt-8 grid grid-cols-2 gap-4">
                            <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-primary-container">
                                    Sektor Utara
                                </p>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold">98%</span>
                                    <span className="mb-1 rounded bg-white/20 px-1.5 text-[10px] text-white">Optimal</span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-primary-container">
                                    Sektor Selatan
                                </p>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold">84%</span>
                                    <span className="mb-1 rounded bg-white/20 px-1.5 text-[10px] text-white">4 Slot</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 mt-8">
                            <button
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-3 text-sm font-bold text-primary transition-all hover:bg-opacity-90"
                                type="button"
                            >
                                Buka Laporan Hunian Lengkap
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

function SectionPlaceholderPage({ activeSection, onNavigate }) {
    const section = sectionMeta[activeSection] ?? sectionMeta.dashboard;

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
                            construction
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-on-surface">Modul Sedang Disiapkan</h2>
                            <p className="text-sm text-on-surface-variant">
                                Halaman {section.title.toLowerCase()} sedang dalam tahap integrasi data.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Status</p>
                            <p className="mt-2 text-sm text-on-surface">UI sudah aktif</p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Backend</p>
                            <p className="mt-2 text-sm text-on-surface">Menunggu endpoint final</p>
                        </div>
                        <div className="rounded-xl bg-surface-container-low p-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary">Target</p>
                            <p className="mt-2 text-sm text-on-surface">Sprint berikutnya</p>
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

function CustomerDetailPage({ customer, onBack, onNavigate }) {
    const statusLabel = customer.active ? "ACTIVE" : "NON-ACTIVE";
    const statusClass = customer.active
        ? "border-primary bg-surface-container text-primary"
        : "border-error bg-error-container text-on-error-container";

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

            <div className="mb-10 flex items-start justify-between gap-4">
                <div className="flex gap-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-fixed">
                        <span
                            className="material-symbols-outlined text-4xl text-primary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            corporate_fare
                        </span>
                    </div>
                    <div>
                        <div className="mb-1 flex items-center gap-3">
                            <h2 className="text-3xl font-extrabold tracking-tight text-primary">{customer.name}</h2>
                            <span className={`rounded-full border-l-4 px-3 py-1 text-xs font-bold ${statusClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                        <p className="flex items-center gap-2 text-on-surface-variant">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                            Jl. Sudirman No. 45, Jakarta Selatan - ID: {customer.customerId}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        className="rounded-xl bg-surface-container-high px-5 py-2.5 text-sm font-semibold text-on-surface"
                        type="button"
                    >
                        Edit Profil
                    </button>
                    <button
                        className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-2.5 text-sm font-semibold text-white"
                        type="button"
                    >
                        Download Laporan
                    </button>
                </div>
            </div>

            <div className="no-scrollbar mb-8 flex gap-8 overflow-x-auto border-b border-surface-container">
                <button
                    className="whitespace-nowrap border-b-2 border-primary pb-4 text-sm font-bold text-primary transition-all"
                    type="button"
                >
                    Detail
                </button>
                <button
                    className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary"
                    type="button"
                >
                    Kontrak
                </button>
                <button
                    className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary"
                    type="button"
                >
                    Invoice
                </button>
                <button
                    className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary"
                    type="button"
                >
                    Dokumen
                </button>
                <button
                    className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary"
                    type="button"
                >
                    Catatan Aktivitas
                </button>
                <button
                    className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary"
                    type="button"
                >
                    Surat Peringatan
                </button>
            </div>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-8 space-y-8">
                    <section className="rounded-xl bg-surface-container-lowest p-8">
                        <div className="mb-8 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-primary">Catatan Aktivitas</h3>
                            <button className="flex items-center gap-1 text-sm font-semibold text-primary" type="button">
                                <span className="material-symbols-outlined text-sm">add</span>
                                Tambah Catatan
                            </button>
                        </div>

                        <div className="relative space-y-8 before:absolute before:inset-0 before:-translate-x-px before:ml-5 before:h-full before:w-0.5 before:bg-surface-container">
                            <div className="group relative flex items-start gap-6">
                                <div className="absolute left-0 mt-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed ring-4 ring-white">
                                    <span className="material-symbols-outlined text-base text-primary">mail</span>
                                </div>
                                <div className="ml-14">
                                    <span className="mb-1 block text-xs font-bold text-primary">19 Jan 2026</span>
                                    <h4 className="font-bold text-on-surface">Telah disurati (Pemberitahuan Retensi)</h4>
                                    <p className="mt-1 text-sm text-on-surface-variant">
                                        Surat pemberitahuan resmi mengenai masa retensi yang akan berakhir dalam 30 hari
                                        telah dikirim melalui kurir tercatat.
                                    </p>
                                </div>
                            </div>

                            <div className="group relative flex items-start gap-6">
                                <div className="absolute left-0 mt-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-tertiary-fixed ring-4 ring-white">
                                    <span className="material-symbols-outlined text-base text-tertiary">description</span>
                                </div>
                                <div className="ml-14">
                                    <span className="mb-1 block text-xs font-bold text-tertiary">15 Jan 2026</span>
                                    <h4 className="font-bold text-on-surface">Proses dokumen amandemen kontrak</h4>
                                    <p className="mt-1 text-sm text-on-surface-variant">
                                        Review legal selesai dilakukan. Dokumen siap untuk ditandatangani oleh pihak
                                        penyewa.
                                    </p>
                                </div>
                            </div>

                            <div className="group relative flex items-start gap-6">
                                <div className="absolute left-0 mt-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed ring-4 ring-white">
                                    <span className="material-symbols-outlined text-base text-secondary">call</span>
                                </div>
                                <div className="ml-14">
                                    <span className="mb-1 block text-xs font-bold text-secondary">10 Jan 2026</span>
                                    <h4 className="font-bold text-on-surface">Koordinasi Lapangan via Telepon</h4>
                                    <p className="mt-1 text-sm text-on-surface-variant">
                                        Diskusi dengan tim operasional mengenai jadwal pemeliharaan lift di gedung utama.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl bg-surface-container-lowest p-8">
                        <div className="mb-8 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-primary">Arsip Dokumen</h3>
                            <button
                                className="flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-2 text-sm font-bold text-primary"
                                type="button"
                            >
                                <span className="material-symbols-outlined text-sm">upload</span>
                                Upload Dokumen
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="group flex items-center justify-between rounded-xl border border-transparent bg-surface p-4 transition-all hover:border-primary-fixed-dim hover:bg-primary-fixed/30">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
                                        <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-on-surface">Akta Pendirian Perusahaan</h4>
                                        <p className="text-xs text-on-surface-variant">No: 442/AKTA/2022 - 12 Nov 2022</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                    </button>
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">download</span>
                                    </button>
                                </div>
                            </div>

                            <div className="group flex items-center justify-between rounded-xl border border-transparent bg-surface p-4 transition-all hover:border-primary-fixed-dim hover:bg-primary-fixed/30">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
                                        <span className="material-symbols-outlined text-primary">description</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-on-surface">Kontrak Sewa Lantai 4 &amp; 5</h4>
                                        <p className="text-xs text-on-surface-variant">No: CTR-NAJ-2024-001 - 05 Jan 2024</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                    </button>
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">download</span>
                                    </button>
                                </div>
                            </div>

                            <div className="group flex items-center justify-between rounded-xl border border-transparent bg-surface p-4 transition-all hover:border-primary-fixed-dim hover:bg-primary-fixed/30">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
                                        <span className="material-symbols-outlined text-primary">article</span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-on-surface">Izin Domisili</h4>
                                        <p className="text-xs text-on-surface-variant">No: 882/DOM/JKT/2025 - 20 Feb 2025</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                    </button>
                                    <button className="p-2 text-on-surface-variant transition-colors hover:text-primary" type="button">
                                        <span className="material-symbols-outlined text-xl">download</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="col-span-4 space-y-8">
                    <section className="rounded-xl border-l-4 border-error bg-surface-container-lowest p-8 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-on-surface">Status Surat Peringatan</h3>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg bg-surface p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error text-xs font-bold text-white">
                                        SP1
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface">Terkirim</p>
                                        <p className="text-[10px] text-on-surface-variant">12 Des 2025</p>
                                    </div>
                                </div>
                                <span
                                    className="material-symbols-outlined text-xl text-success"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    check_circle
                                </span>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-error-container p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error text-xs font-bold text-white">
                                        SP2
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-error-container">Terkirim</p>
                                        <p className="text-[10px] text-on-error-container/70">05 Jan 2026</p>
                                    </div>
                                </div>
                                <span
                                    className="material-symbols-outlined text-xl text-error"
                                    style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                    check_circle
                                </span>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-outline-variant text-xs font-bold text-white">
                                        SP3
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface-variant">Direncanakan</p>
                                        <p className="text-[10px] text-on-surface-variant">Est. 25 Jan 2026</p>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-xl text-outline-variant">schedule</span>
                            </div>

                            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3 opacity-50">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-outline-variant text-xs font-bold text-white">
                                        CUT
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-on-surface-variant">Pemutusan Kontrak</p>
                                        <p className="text-[10px] text-on-surface-variant">Belum Direncanakan</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-xl bg-error-container/20 p-4">
                            <p className="text-xs leading-relaxed text-on-error-container">
                                <strong>Catatan Kolektor:</strong> Pelanggan telah menunggak pembayaran selama 45 hari.
                                Komunikasi terakhir dilakukan pada 10 Jan namun belum ada kepastian bayar.
                            </p>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="rounded-xl bg-primary-container p-6 text-white shadow-md">
                            <p className="mb-2 text-xs font-medium uppercase tracking-widest opacity-80">
                                Total Tunggakan
                            </p>
                            <h4 className="mb-4 text-2xl font-extrabold">Rp 142.500.000</h4>
                            <div className="h-1 overflow-hidden rounded-full bg-white/20">
                                <div className="h-full w-3/4 bg-white"></div>
                            </div>
                            <p className="mt-2 text-[10px] opacity-70">75% dari total plafon kredit tahunan</p>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-surface-container-lowest p-6 shadow-sm">
                            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">Informasi Kontak</p>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-lg text-on-surface-variant">person</span>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">PIC Legal</p>
                                        <p className="text-sm font-bold">Andi Wijaya</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-lg text-on-surface-variant">mail</span>
                                    <div>
                                        <p className="text-xs text-on-surface-variant">Email</p>
                                        <p className="text-sm font-bold">legal@nusantara-arch.com</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

export default App;
