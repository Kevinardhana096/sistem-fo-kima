import { useState } from "react";
import { sidebarItems } from "../../app/constants";
import { getSectionPath } from "../../app/routes";

export default function AppShell({ activeSection, onNavigate, children, hideSidebar = false, full = false }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleMobileNavigate = (sectionKey) => {
        onNavigate(sectionKey);
        setIsMobileMenuOpen(false);
    };

    if (full) {
        return (
            <div className="h-screen w-screen overflow-hidden text-on-surface">
                <main className="h-full w-full">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="text-on-surface">
            {!hideSidebar && <TopNav onToggleMenu={() => setIsMobileMenuOpen((prev) => !prev)} />}
            {isMobileMenuOpen && !hideSidebar && (
                <MobileDropdownMenu
                    activeSection={activeSection}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onNavigate={handleMobileNavigate}
                />
            )}
            {!hideSidebar && <Sidebar activeSection={activeSection} onNavigate={onNavigate} />}
            <main className={`min-h-screen pb-10 overflow-x-hidden ${hideSidebar ? "pt-6 px-6" : "pt-24 px-6 md:ml-64 md:px-12 md:pb-12"}`}>
                {children}
            </main>
        </div>
    );
}

function TopNav({ onToggleMenu }) {
    return (
        <nav className="fixed top-0 z-40 flex h-16 w-full items-center justify-between px-6 font-manrope antialiased glass-navbar md:ml-64 md:w-[calc(100%-16rem)] md:px-8">
            <div className="flex items-center gap-3">
                <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low md:hidden"
                    onClick={onToggleMenu}
                    type="button"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            </div>

            <div className="flex items-center gap-6">
                <button
                    className="relative rounded-xl p-2 text-on-surface-variant transition-all hover:bg-surface-container-low"
                    type="button"
                >
                    <span className="material-symbols-outlined">notifications</span>
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-container"></span>
                </button>
                <div className="hidden items-center gap-3 pl-4 md:flex">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-on-surface">Administrator</p>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                            Super Admin
                        </p>
                    </div>
                    <img
                        alt="Administrator Profile"
                        className="h-10 w-10 rounded-full object-cover shadow-soft"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAFhnZ3sLh08K-pb9OHZ3RVbGsMO5bKg2zux3NkoQNNOv96Mff-nuHjRBNqlG8PKMPx0E-6VsMGTfB_Jn7lpTk0cWXlblrf-mzL1KZ3O724-QrQBwXPmLINGHLBuxACZGsByzSGBD6Yt9GVvuswzU7_IhGniplwUFCUhvp7w5cU0m_k8DzEjXtMaYsXa-5x15vort0mEzRr9ygaZgu9n6dL3xd-XNV_AxamcvQyVEuceozL2mSLxCaP6gqaGvVKvIN6DZvZzpMQh8"
                    />
                </div>
            </div>
        </nav>
    );
}

function MobileDropdownMenu({ activeSection, onNavigate, onClose }) {
    const handleSectionClick = (event, sectionKey) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }

        event.preventDefault();
        onNavigate(sectionKey);
        onClose();
    };

    return (
        <div className="fixed inset-x-0 top-16 z-40 px-4 md:hidden">
            <div className="rounded-2xl glass-panel p-2">
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        Menu Navigasi
                    </p>
                    <button
                        className="rounded-md p-1 text-on-surface-variant transition-colors hover:bg-slate-100"
                        onClick={onClose}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div className="space-y-1">
                    {sidebarItems.map((item) => {
                        const isActive = activeSection === item.key;
                        const href = getSectionPath(item.key);
                        return (
                            <div key={item.key} className={item.separated ? "mt-2 pt-2" : ""}>
                                <a
                                    href={href}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${isActive
                                        ? "bg-primary-container/60 font-bold text-on-surface"
                                        : "text-on-surface-variant hover:bg-surface-container-low"
                                        }`}
                                    onClick={(event) => handleSectionClick(event, item.key)}
                                >
                                    <span
                                        className={`material-symbols-outlined ${isActive ? "text-primary" : ""}`}
                                        style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                    >
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                </a>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Sidebar({ activeSection, onNavigate }) {
    const handleSectionClick = (event, sectionKey) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }

        event.preventDefault();
        onNavigate(sectionKey);
    };

    return (
        <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col glass-sidebar px-4 py-8 font-manrope text-sm font-medium md:flex">
            <div className="mb-10 px-2">
                <div className="flex items-center gap-3">
                    <img
                        alt=""
                        aria-hidden="true"
                        className="h-10 w-10 object-contain"
                        src="/logo-kima.png"
                    />
                    <div>
                        <p className="text-lg font-extrabold tracking-tight text-primary">KIMA</p>
                        <p className="text-xs font-medium text-on-surface-variant">Dokumen Arsip</p>
                    </div>
                </div>
            </div>

            <nav className="flex-grow space-y-1">
                {sidebarItems.map((item) => {
                    const isActive = activeSection === item.key;
                    const href = getSectionPath(item.key);
                    return (
                        <a
                            key={item.key}
                            href={href}
                            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-all ${isActive ? "bg-primary-container/50 text-on-surface font-bold shadow-soft" : "text-on-surface-variant hover:bg-white/60 hover:text-on-surface"}`}
                            onClick={(event) => handleSectionClick(event, item.key)}
                        >
                            <span
                                className={`material-symbols-outlined ${isActive ? "text-primary" : ""}`}
                                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                {item.icon}
                            </span>
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
}
