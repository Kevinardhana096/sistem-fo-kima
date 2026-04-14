import "./App.css";

function App() {
    return (
        <div className="bg-background text-on-surface">
            <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-100 bg-white px-4 py-8">
                <div className="mb-10 px-2">
                    <h1 className="text-xl font-bold tracking-tighter text-blue-900">The Archive</h1>
                    <p className="text-xs font-manrope text-slate-500">Enterprise Curator</p>
                </div>

                <nav className="flex-1 space-y-1">
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        Dashboard
                    </a>
                    <a
                        className="flex items-center gap-3 border-r-4 border-blue-900 bg-blue-50/50 px-4 py-3 text-sm font-manrope font-bold tracking-tight text-blue-900 transition-all"
                        href="#"
                    >
                        <span className="material-symbols-outlined">groups</span>
                        Pelanggan
                    </a>
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">analytics</span>
                        Monitoring
                    </a>
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">description</span>
                        Kontrak
                    </a>
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">receipt_long</span>
                        Invoice
                    </a>
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">inventory_2</span>
                        Arsip Dokumen
                    </a>
                    <a
                        className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-manrope font-medium tracking-tight text-slate-500 transition-all hover:bg-blue-50/50"
                        href="#"
                    >
                        <span className="material-symbols-outlined">delete</span>
                        Tempat Sampah
                    </a>
                </nav>

                <div className="mt-auto px-2">
                    <button className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20">
                        Tambah Pelanggan Baru
                    </button>
                </div>
            </aside>

            <header className="fixed right-0 top-0 z-40 flex h-16 w-[calc(100%-16rem)] items-center justify-between border-b border-slate-100 bg-white/80 px-8 backdrop-blur-xl">
                <div className="flex flex-1 items-center gap-4">
                    <div className="relative w-full max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            search
                        </span>
                        <input
                            className="w-full rounded-lg border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Cari dokumen atau pelanggan..."
                            type="text"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button className="text-slate-500 transition-colors hover:text-primary">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <button className="text-slate-500 transition-colors hover:text-primary">
                        <span className="material-symbols-outlined">settings</span>
                    </button>
                    <div className="flex items-center gap-3 border-l border-slate-100 pl-6">
                        <div className="text-right">
                            <p className="text-xs font-bold text-on-surface">Admin Utama</p>
                            <p className="text-[10px] text-on-surface-variant">Administrator</p>
                        </div>
                        <img
                            alt="Administrator Profile"
                            className="h-8 w-8 rounded-full object-cover"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQd26NUIidmq1e6jjdJqfJ9hWEmHnTc0wjS5giZPTGAVSHFrs_gwhc1WREsocwwGJzV6cxUBAkeG4zgubuXOLzGLIx-SvnSSbCd7JTVTC5hkeUVRShJGTvc87leQNXh3mIHFtNmTqoRcgp3wLMqo4-9nNyBobLFqCv41pS19-6ET0nEfIYvggpahahHtSGD4FCKxcKsYGoBkQrRbF1ls4T3aTl7f-2MSrIrGXzillyIVofhSmVlQmRvzRH8l-zYneLq564C9zkms0"
                        />
                    </div>
                </div>
            </header>

            <main className="ml-64 min-h-screen bg-surface px-12 pb-12 pt-24">
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
                                <h2 className="text-3xl font-extrabold tracking-tight text-primary">
                                    PT. Nusantara Arsitektur Jaya
                                </h2>
                                <span className="rounded-full border-l-4 border-primary bg-surface-container px-3 py-1 text-xs font-bold text-primary">
                                    ACTIVE
                                </span>
                            </div>
                            <p className="flex items-center gap-2 text-on-surface-variant">
                                <span className="material-symbols-outlined text-sm">location_on</span>
                                Jl. Sudirman No. 45, Jakarta Selatan • ID: CUST-88291
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="rounded-xl bg-surface-container-high px-5 py-2.5 text-sm font-semibold text-on-surface">
                            Edit Profil
                        </button>
                        <button className="rounded-xl bg-gradient-to-br from-primary to-primary-container px-5 py-2.5 text-sm font-semibold text-white">
                            Download Laporan
                        </button>
                    </div>
                </div>

                <div className="no-scrollbar mb-8 flex gap-8 overflow-x-auto border-b border-surface-container">
                    <button className="whitespace-nowrap border-b-2 border-primary pb-4 text-sm font-bold text-primary transition-all">
                        Detail
                    </button>
                    <button className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary">
                        Kontrak
                    </button>
                    <button className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary">
                        Invoice
                    </button>
                    <button className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary">
                        Dokumen
                    </button>
                    <button className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary">
                        Catatan Aktivitas
                    </button>
                    <button className="whitespace-nowrap pb-4 text-sm font-medium text-on-surface-variant transition-all hover:text-primary">
                        Surat Peringatan
                    </button>
                </div>

                <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-8 space-y-8">
                        <section className="rounded-xl bg-surface-container-lowest p-8">
                            <div className="mb-8 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-primary">Catatan Aktivitas</h3>
                                <button className="flex items-center gap-1 text-sm font-semibold text-primary">
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
                                        <h4 className="font-bold text-on-surface">
                                            Telah disurati (Pemberitahuan Retensi)
                                        </h4>
                                        <p className="mt-1 text-sm text-on-surface-variant">
                                            Surat pemberitahuan resmi mengenai masa retensi yang akan berakhir dalam
                                            30 hari telah dikirim melalui kurir tercatat.
                                        </p>
                                    </div>
                                </div>

                                <div className="group relative flex items-start gap-6">
                                    <div className="absolute left-0 mt-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-tertiary-fixed ring-4 ring-white">
                                        <span className="material-symbols-outlined text-base text-tertiary">
                                            description
                                        </span>
                                    </div>
                                    <div className="ml-14">
                                        <span className="mb-1 block text-xs font-bold text-tertiary">15 Jan 2026</span>
                                        <h4 className="font-bold text-on-surface">Proses dokumen amandemen kontrak</h4>
                                        <p className="mt-1 text-sm text-on-surface-variant">
                                            Review legal selesai dilakukan. Dokumen siap untuk ditandatangani oleh
                                            pihak penyewa.
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
                                            Diskusi dengan tim operasional mengenai jadwal pemeliharaan lift di gedung
                                            utama.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl bg-surface-container-lowest p-8">
                            <div className="mb-8 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-primary">Arsip Dokumen</h3>
                                <button className="flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-2 text-sm font-bold text-primary">
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
                                            <p className="text-xs text-on-surface-variant">
                                                No: 442/AKTA/2022 • 12 Nov 2022
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
                                            <span className="material-symbols-outlined text-xl">visibility</span>
                                        </button>
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
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
                                            <p className="text-xs text-on-surface-variant">
                                                No: CTR-NAJ-2024-001 • 05 Jan 2024
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
                                            <span className="material-symbols-outlined text-xl">visibility</span>
                                        </button>
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
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
                                            <p className="text-xs text-on-surface-variant">
                                                No: 882/DOM/JKT/2025 • 20 Feb 2025
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
                                            <span className="material-symbols-outlined text-xl">visibility</span>
                                        </button>
                                        <button className="p-2 text-on-surface-variant transition-colors hover:text-primary">
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
                                    <span className="material-symbols-outlined text-xl text-outline-variant">
                                        schedule
                                    </span>
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
                                    <strong>Catatan Kolektor:</strong> Pelanggan telah menunggak pembayaran
                                    selama 45 hari. Komunikasi terakhir dilakukan pada 10 Jan namun belum ada
                                    kepastian bayar.
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
                                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">
                                    Informasi Kontak
                                </p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-lg text-on-surface-variant">
                                            person
                                        </span>
                                        <div>
                                            <p className="text-xs text-on-surface-variant">PIC Legal</p>
                                            <p className="text-sm font-bold">Andi Wijaya</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-lg text-on-surface-variant">
                                            mail
                                        </span>
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
            </main>
        </div>
    );
}

export default App;