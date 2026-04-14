import { useState } from "react";

const sidebarItems = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "customers", label: "Pelanggan", icon: "groups" },
    { key: "monitoring", label: "Monitoring", icon: "monitor_heart" },
    { key: "contracts", label: "Kontrak", icon: "description" },
    { key: "invoices", label: "Invoice", icon: "receipt_long" },
    { key: "archives", label: "Arsip Dokumen", icon: "inventory_2" },
    { key: "trash", label: "Tempat Sampah", icon: "delete", separated: true },
];

function CustomerEditPage({ customer, onCancel, onNavigate }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const customerName = customer?.name ?? "PT Teknologi Nusantara Sejahtera";
    const isActive = customer?.active ?? true;

    const handleNavigate = (section) => {
        if (onNavigate) {
            onNavigate(section);
        }
    };

    const handleMobileNavigate = (section) => {
        handleNavigate(section);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="bg-surface text-on-surface">
            <EditTopNav onToggleMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
            {isMobileMenuOpen && (
                <EditMobileDropdownMenu
                    activeSection="customers"
                    onClose={() => setIsMobileMenuOpen(false)}
                    onNavigate={handleMobileNavigate}
                />
            )}
            <EditSidebar activeSection="customers" onNavigate={handleNavigate} />

            <main className="min-h-screen px-6 pb-10 pt-24 md:ml-64 md:px-12 md:pb-12">
                <section className="mx-auto w-full max-w-6xl">
                    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="mb-1 text-xs text-slate-500">Pelanggan | Edit Data</p>
                            <h2 className="font-headline text-3xl font-extrabold leading-tight text-blue-950">
                                {customerName}
                            </h2>
                            <p className="mt-2 max-w-lg text-on-surface-variant">
                                Perbarui data di bawah ini untuk memperbarui informasi pelanggan dalam sistem
                                monitoring tenant.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3 md:gap-4">
                            <button
                                className="rounded-xl px-6 py-2.5 font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high active:scale-95"
                                onClick={onCancel}
                                type="button"
                            >
                                Batalkan
                            </button>
                            <button
                                className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-8 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
                                onClick={onCancel}
                                type="button"
                            >
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-8">
                        <div className="col-span-12 space-y-8 lg:col-span-8">
                            <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">badge</span>
                                    <h3 className="text-lg font-bold text-blue-950">Identitas Pelanggan</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nama ISP
                                        </label>
                                        <select
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="IndiHome Corporate"
                                        >
                                            <option>Pilih ISP</option>
                                            <option>IndiHome Corporate</option>
                                            <option>Bina Media Utama</option>
                                            <option>Global Solusi Net</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nomor Kontrak
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="KTR/2023/X/0042"
                                            placeholder="CTR/2023/X/001"
                                            type="text"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nama Pelanggan / Institusi
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue={customerName}
                                            placeholder="Masukkan nama lengkap pelanggan"
                                            type="text"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nomor Invoice
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="INV-TNS-2023-011"
                                            placeholder="INV-XXX-XXXX"
                                            type="text"
                                        />
                                    </div>
                                    <div className="col-span-2 flex items-end pb-2 md:col-span-1">
                                        <div className="flex w-full items-center gap-4 rounded-lg bg-surface p-2.5">
                                            <span className="flex-1 text-sm font-medium text-on-surface">Status Keaktifan</span>
                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input className="peer sr-only" defaultChecked={isActive} type="checkbox" />
                                                <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border-l-4 border-blue-900 bg-surface-container-lowest p-8 shadow-sm">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">calendar_today</span>
                                    <h3 className="text-lg font-bold text-blue-950">Periode Kontrak</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Awal Kontrak
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="2023-01-01"
                                            type="date"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Berjalan - Mulai
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="2023-01-01"
                                            type="date"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Berjalan - Akhir
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="2024-01-01"
                                            type="date"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-surface-container-lowest p-8 shadow-sm">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">contact_phone</span>
                                    <h3 className="text-lg font-bold text-blue-950">Informasi Kontak</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nama PIC
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="Budi Santoso"
                                            placeholder="Nama penanggung jawab"
                                            type="text"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Email PIC
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="budi.santoso@tekno-nusantara.co.id"
                                            placeholder="email@domain.com"
                                            type="email"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nomor Telepon
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="+62 812 3456 7890"
                                            placeholder="+62 ..."
                                            type="tel"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Nomor Kontak Lain
                                        </label>
                                        <input
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="(021) 8899-7766"
                                            placeholder="Alternatif nomor"
                                            type="text"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                                            Alamat Lengkap
                                        </label>
                                        <textarea
                                            className="w-full rounded-lg border-none bg-surface p-3 text-sm focus:ring-2 focus:ring-primary/20"
                                            defaultValue="Gedung Cyber 2 Lt. 15, Jl. H. R. Rasuna Said No.13, Kuningan Timur, Setiabudi, Jakarta Selatan 12950"
                                            rows="3"
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-12 space-y-8 lg:col-span-4">
                            <div className="rounded-lg bg-surface-container-low p-6">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">settings_ethernet</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-blue-950">
                                        Detail Teknis (Eksklusif)
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    <label className="block cursor-pointer">
                                        <div className="flex items-start gap-4 rounded-xl border-2 border-transparent bg-surface-container-lowest p-4">
                                            <input className="mt-1 text-primary focus:ring-primary" defaultChecked type="radio" name="tech_type" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-blue-950">Dedicated Core</p>
                                                <p className="mb-3 text-xs text-on-surface-variant">
                                                    Core eksklusif tanpa pembagian bandwidth.
                                                </p>
                                                <div className="relative">
                                                    <input
                                                        className="w-full rounded-lg border-none bg-surface p-2.5 pr-14 text-xs focus:ring-2 focus:ring-primary/20"
                                                        defaultValue="8"
                                                        placeholder="Jumlah Core"
                                                        type="number"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                        CORE
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </label>

                                    <label className="block cursor-pointer">
                                        <div className="flex items-start gap-4 rounded-xl border-2 border-transparent bg-surface-container-lowest p-4">
                                            <input className="mt-1 text-primary focus:ring-primary" name="tech_type" type="radio" />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-blue-950">Shared Core</p>
                                                <p className="mb-3 text-xs text-on-surface-variant">
                                                    Core berbagi dengan rasio tertentu.
                                                </p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select className="rounded-lg border-none bg-surface p-2.5 text-xs focus:ring-2 focus:ring-primary/20">
                                                        <option>Rasio 1:2</option>
                                                        <option>Rasio 1:4</option>
                                                    </select>
                                                    <input
                                                        className="w-full rounded-lg border-none bg-surface p-2.5 text-xs focus:ring-2 focus:ring-primary/20"
                                                        placeholder="Cores"
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="rounded-lg bg-surface-container-low p-6">
                                <div className="mb-6 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary">payments</span>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-blue-950">
                                        Billing & Aktivasi
                                    </h3>
                                </div>

                                <div>
                                    <label className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                        Periode Tagihan
                                    </label>
                                    <div className="mb-3 grid grid-cols-2 gap-2">
                                        <button className="rounded-lg bg-primary py-2 text-xs font-bold text-white" type="button">
                                            Bulanan
                                        </button>
                                        <button
                                            className="rounded-lg bg-surface-container-lowest py-2 text-xs font-bold text-on-surface-variant transition-colors hover:bg-slate-200"
                                            type="button"
                                        >
                                            3 Bulanan
                                        </button>
                                    </div>
                                    <div className="rounded-xl bg-surface-container-lowest p-4">
                                        <p className="mb-2 text-[10px] font-bold uppercase text-on-surface-variant">Kustom Fleksibel</p>
                                        <div className="flex gap-2">
                                            <input
                                                className="w-20 rounded-lg border-none bg-surface p-2 text-xs"
                                                placeholder="0"
                                                type="number"
                                            />
                                            <select className="flex-1 rounded-lg border-none bg-surface p-2 text-xs">
                                                <option>Hari</option>
                                                <option>Bulan</option>
                                                <option>Tahun</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative overflow-hidden rounded-2xl bg-primary-container p-6 text-on-primary-container">
                                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                                <div className="relative z-10">
                                    <span className="material-symbols-outlined mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        verified_user
                                    </span>
                                    <h4 className="mb-1 font-bold text-white">Keamanan Arsip</h4>
                                    <p className="text-xs leading-relaxed opacity-80">
                                        Semua data pelanggan yang diinput akan dienkripsi secara otomatis dan tersimpan
                                        dalam brankas digital The Archive.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-20"></div>
                </section>
            </main>

        </div>
    );
}

function EditTopNav({ onToggleMenu }) {
    return (
        <nav className="fixed top-0 z-40 flex h-16 w-full items-center justify-between bg-white/80 px-6 font-manrope antialiased shadow-sm backdrop-blur-xl md:ml-64 md:w-[calc(100%-16rem)] md:px-8">
            <div className="flex items-center gap-3 md:gap-8">
                <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
                    onClick={onToggleMenu}
                    type="button"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                <div className="hidden items-center gap-6 md:flex">
                    <div className="flex w-96 items-center gap-4 rounded-lg bg-surface-container-low px-4 py-2">
                        <span className="material-symbols-outlined text-xl text-outline">search</span>
                        <input
                            className="w-full border-none bg-transparent text-sm font-body focus:ring-0"
                            placeholder="Cari penyewa atau invoice..."
                            type="text"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <button
                    className="relative rounded-lg p-2 text-slate-500 transition-all hover:bg-slate-50"
                    type="button"
                >
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error"></span>
                </button>
                <button className="rounded-lg p-2 text-slate-500 transition-all hover:bg-slate-50" type="button">
                    <span className="material-symbols-outlined">settings</span>
                </button>
                <div className="hidden items-center gap-3 border-l border-slate-100 pl-4 md:flex">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-on-surface">Administrator</p>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                            Super Admin
                        </p>
                    </div>
                    <img
                        alt="Administrator Profile"
                        className="h-10 w-10 rounded-full border-2 border-surface-container-high object-cover"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAFhnZ3sLh08K-pb9OHZ3RVbGsMO5bKg2zux3NkoQNNOv96Mff-nuHjRBNqlG8PKMPx0E-6VsMGTfB_Jn7lpTk0cWXlblrf-mzL1KZ3O724-QrQBwXPmLINGHLBuxACZGsByzSGBD6Yt9GVvuswzU7_IhGniplwUFCUhvp7w5cU0m_k8DzEjXtMaYsXa-5x15vort0mEzRr9ygaZgu9n6dL3xd-XNV_AxamcvQyVEuceozL2mSLxCaP6gqaGvVKvIN6DZvZzpMQh8"
                    />
                </div>
            </div>
        </nav>
    );
}

function EditMobileDropdownMenu({ activeSection, onNavigate, onClose }) {
    return (
        <div className="fixed inset-x-0 top-16 z-40 px-4 md:hidden">
            <div className="rounded-2xl border border-slate-100 bg-white/95 p-2 shadow-xl backdrop-blur">
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Menu Navigasi
                    </p>
                    <button
                        className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100"
                        onClick={onClose}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div className="space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive = activeSection === item.key;
                        return (
                            <div key={item.key} className={item.separated ? "mt-2 border-t border-slate-100 pt-2" : ""}>
                                <button
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${isActive
                                        ? "bg-blue-50/70 font-bold text-blue-900"
                                        : "text-slate-600 transition-colors hover:bg-slate-100"
                                        }`}
                                    onClick={() => onNavigate(item.key)}
                                    type="button"
                                >
                                    <span
                                        className="material-symbols-outlined"
                                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                    >
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function EditSidebar({ activeSection, onNavigate }) {
    return (
        <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col bg-slate-50/80 px-4 py-8 font-manrope text-sm font-medium backdrop-blur-xl md:flex">
            <div className="mb-10 px-2">
                <div className="flex items-center gap-3">
                    <img
                        alt=""
                        aria-hidden="true"
                        className="h-10 w-10 object-contain"
                        src="/favicon.svg"
                    />
                    <div>
                        <p className="text-lg font-extrabold tracking-tight text-blue-900">KIMA</p>
                        <p className="text-xs font-medium text-on-surface-variant">Dokumen Arsip</p>
                    </div>
                </div>
            </div>

            <nav className="flex-grow space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = activeSection === item.key;
                    return (
                        <div key={item.key}>
                            <button
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left font-manrope text-sm tracking-tight ${isActive
                                    ? "rounded-l-lg border-r-4 border-blue-900 bg-blue-50/50 font-bold text-blue-900"
                                    : "rounded-lg text-slate-500 transition-all hover:bg-blue-50/30 hover:text-blue-800"
                                    }`}
                                onClick={() => onNavigate(item.key)}
                                type="button"
                            >
                                <span
                                    className="material-symbols-outlined"
                                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                >
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                            </button>
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}

export default CustomerEditPage;
