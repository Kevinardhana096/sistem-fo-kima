import { useState, useEffect } from "react";
import { getSectionPath } from "../../app/routes";
import { getRoleConfig } from "../../roles";
import api from "../../lib/api";

export default function AppShell({
    activeSection,
    onNavigate,
    onLogout,
    children,
    hideSidebar = false,
    full = false,
    currentRole = "admin",
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Initialize state from localStorage to ensure persistence
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem("sidebar_collapsed");
        return saved === "true";
    });

    const roleConfig = getRoleConfig(currentRole);

    const handleMobileNavigate = (sectionKey) => {
        onNavigate(sectionKey);
        setIsMobileMenuOpen(false);
    };

    // Effect to save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("sidebar_collapsed", String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    if (full) {
        return (
            <div className="relative min-h-screen w-screen overflow-hidden">
                <div id="bg-image-layer"></div>
                <div id="bg-glass-overlay"></div>
                <div className="mesh-glow"></div>
                <main className="relative h-full w-full z-10">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen font-inter antialiased selection:bg-gold-accent/20 selection:text-gold-accent">
            {/* Background Layers */}
            <div id="bg-image-layer"></div>
            <div id="bg-glass-overlay"></div>
            <div className="mesh-glow"></div>

            {!hideSidebar && (
                <TopNav
                    isSidebarCollapsed={isSidebarCollapsed}
                    onToggleMenu={() => setIsMobileMenuOpen((prev) => !prev)}
                    onLogout={onLogout}
                    roleConfig={roleConfig}
                    onEditProfile={() => setIsEditModalOpen(true)}
                />
            )}

            {isMobileMenuOpen && !hideSidebar && (
                <MobileDropdownMenu
                    activeSection={activeSection}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onNavigate={handleMobileNavigate}
                    onLogout={onLogout}
                    roleConfig={roleConfig}
                />
            )}

            {!hideSidebar && (
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    activeSection={activeSection}
                    onNavigate={onNavigate}
                    roleConfig={roleConfig}
                />
            )}

            <main
                className={`relative z-10 min-h-screen transition-all duration-700 ease-in-out px-4 sm:px-6 md:px-8 lg:px-12 pb-12 pt-20 lg:pt-24 ${hideSidebar ? "" : (isSidebarCollapsed ? "lg:ml-32" : "lg:ml-80")
                    }`}
            >
                <div className="mx-auto max-w-[1600px]">
                    {children}
                </div>
            </main>

            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="relative w-full max-w-md rounded-3xl glass-premium p-8 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/20">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-on-surface">Edit Profile</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 transition-all backdrop-blur-md">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-8">
                            <div className="relative group cursor-pointer">
                                <img
                                    alt="Profile"
                                    className="h-24 w-24 rounded-3xl object-cover ring-4 ring-black/5 shadow-xl bg-white transition-all group-hover:opacity-70"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(roleConfig.profileTitle)}&background=f1f5f9&color=94a3b8&bold=true&size=128`}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="h-10 w-10 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined">photo_camera</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[10px] font-bold text-gold-accent uppercase tracking-widest mt-4 cursor-pointer hover:underline">Ubah Foto Profil</p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Username</label>
                                <input type="text" defaultValue={roleConfig.profileTitle} className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-gold-accent/50 transition-all backdrop-blur-md" />
                            </div>
                            
                            <div className="pt-2 border-t border-black/5">
                                <p className="text-[10px] font-black text-on-surface uppercase tracking-widest mb-3">Ubah Password</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Password Lama</label>
                                        <input type="password" placeholder="Masukkan password saat ini" className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-gold-accent/50 transition-all placeholder:text-black/30 backdrop-blur-md" />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Password Baru</label>
                                        <input type="password" placeholder="Masukkan password baru" className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-gold-accent/50 transition-all placeholder:text-black/30 backdrop-blur-md" />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Konfirmasi Password Baru</label>
                                        <input type="password" placeholder="Ulangi password baru" className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-2.5 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-gold-accent/50 transition-all placeholder:text-black/30 backdrop-blur-md" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-2xl font-bold text-xs bg-black/5 text-on-surface hover:bg-black/10 transition-all backdrop-blur-md">
                                Batal
                            </button>
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 rounded-2xl font-bold text-xs bg-gold-gradient text-white shadow-gold-glow hover:opacity-90 transition-all">
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TopNav({ isSidebarCollapsed, onToggleMenu, onLogout, roleConfig, onEditProfile }) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    const loadNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const data = await api.notifications.list({ limit: 20 });
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load notifications:", error);
            setNotifications([]);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, []);

    const handleOpenNotification = async (notification) => {
        if (!notification.readAt) {
            try {
                await api.notifications.markRead(notification.id);
            } catch (error) {
                console.error("Failed to mark notification as read:", error);
            }
        }
        setIsNotificationsOpen(false);
        if (notification.targetPath) {
            window.history.pushState({}, "", notification.targetPath);
            window.dispatchEvent(new PopStateEvent("popstate"));
        }
    };

    const handleMarkRead = async (event, notification) => {
        event.stopPropagation();
        try {
            await api.notifications.markRead(notification.id);
            await loadNotifications();
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    };

    const handleMarkResolved = async (event, notification) => {
        event.stopPropagation();
        try {
            await api.notifications.markResolved(notification.id);
            await loadNotifications();
        } catch (error) {
            console.error("Failed to resolve notification:", error);
        }
    };

    const unreadCount = notifications.filter((notification) => !notification.readAt).length;

    return (
        <nav
            className={`fixed top-4 md:top-6 right-4 md:right-6 z-40 flex items-center justify-between transition-all duration-700 ease-in-out pointer-events-none ${isSidebarCollapsed
                    ? "left-4 lg:left-32"
                    : "left-4 lg:left-80"
                }`}
        >
            <div className="pointer-events-auto">
                <button
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm text-on-surface transition-all hover:bg-white/20 hover:-translate-y-0.5 lg:hidden"
                    onClick={onToggleMenu}
                    type="button"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            </div>

            <div className="flex items-center gap-3 md:gap-4 pointer-events-auto ml-auto">
                <div className="relative hidden sm:block">
                    <button
                        className="relative group flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm transition-all hover:bg-white/20 hover:-translate-y-0.5"
                        onClick={() => {
                            setIsNotificationsOpen((previous) => !previous);
                            if (!isNotificationsOpen) loadNotifications();
                        }}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-gold-accent transition-colors">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-accent px-1.5 text-[9px] font-black text-black shadow-gold-glow border border-white">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotificationsOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-4 z-20 w-[24rem] max-w-[calc(100vw-2rem)] origin-top-right rounded-3xl glass-premium p-3 shadow-glass-depth animate-in fade-in zoom-in duration-300">
                                <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black text-on-surface">Notifikasi</p>
                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                            {unreadCount} belum dibaca • {notifications.length} aktif
                                        </p>
                                    </div>
                                    <button
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 text-on-surface-variant transition-all hover:bg-black/10 backdrop-blur-md"
                                        onClick={loadNotifications}
                                        disabled={isLoadingNotifications}
                                        type="button"
                                    >
                                        <span className={`material-symbols-outlined text-lg ${isLoadingNotifications ? "animate-spin" : ""}`}>sync</span>
                                    </button>
                                </div>

                                <div className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                    {isLoadingNotifications && notifications.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-xs font-bold text-on-surface-variant">Memuat notifikasi...</div>
                                    ) : notifications.length > 0 ? (
                                        notifications.map((notification) => {
                                            const severityClass = notification.severity === "critical"
                                                ? "bg-rose-500/10 text-rose-600"
                                                : "bg-amber-500/10 text-amber-700";
                                            return (
                                                <div
                                                    key={notification.id}
                                                    className={`rounded-2xl px-3 py-3 transition-all hover:bg-black/5 backdrop-blur-md ${notification.readAt ? "opacity-70" : "bg-gold-accent/5"}`}
                                                >
                                                    <button
                                                        className="flex w-full items-start gap-3 text-left"
                                                        onClick={() => handleOpenNotification(notification)}
                                                        type="button"
                                                    >
                                                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${severityClass}`}>
                                                            <span className="material-symbols-outlined text-lg">priority_high</span>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex items-center gap-2">
                                                                <p className="truncate text-xs font-black text-on-surface">{notification.title}</p>
                                                                {!notification.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-accent shadow-gold-glow"></span>}
                                                                <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${severityClass}`}>
                                                                    {notification.severity}
                                                                </span>
                                                            </div>
                                                            <p className="line-clamp-2 text-[11px] font-bold leading-relaxed text-on-surface-variant">{notification.message}</p>
                                                            <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-gold-accent">{notification.actionLabel}</p>
                                                        </div>
                                                    </button>
                                                    <div className="mt-3 flex items-center justify-end gap-2 pl-12">
                                                        {!notification.readAt && (
                                                            <button
                                                                className="rounded-lg bg-black/5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-on-surface-variant transition-all hover:bg-black/10 hover:text-on-surface backdrop-blur-md"
                                                                onClick={(event) => handleMarkRead(event, notification)}
                                                                type="button"
                                                            >
                                                                Dibaca
                                                            </button>
                                                        )}
                                                        <button
                                                            className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-500 hover:text-white backdrop-blur-md"
                                                            onClick={(event) => handleMarkResolved(event, notification)}
                                                            type="button"
                                                        >
                                                            Selesai
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-10 text-center">
                                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-on-surface-variant/50 backdrop-blur-md">
                                                <span className="material-symbols-outlined text-3xl">notifications_off</span>
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-widest text-on-surface">Tidak ada notifikasi</p>
                                            <p className="mt-1 text-[10px] font-bold text-on-surface-variant">Semua data operasional aman.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="relative">
                    <button
                        className="flex items-center gap-3 rounded-full bg-white/10 backdrop-blur-md border border-white/15 shadow-sm p-1.5 pr-5 transition-all hover:bg-white/20 hover:-translate-y-0.5"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        type="button"
                    >
                        <div className="relative shrink-0">
                            <img
                                alt="Profile"
                                className="h-9 w-9 md:h-10 md:w-10 rounded-full object-cover ring-2 ring-white/50 shadow-sm bg-white"
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(roleConfig.profileTitle)}&background=f1f5f9&color=94a3b8&bold=true`}
                            />
                        </div>
                        <div className="hidden text-left md:block">
                            <p className="text-xs font-black text-on-surface tracking-tight leading-none">{roleConfig.profileTitle}</p>
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gold-accent mt-0.5">
                                {roleConfig.profileSubtitle}
                            </p>
                        </div>
                    </button>

                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="absolute right-0 top-full mt-4 md:mt-6 z-20 w-64 md:w-72 origin-top-right rounded-3xl glass-premium p-3 shadow-glass-depth animate-in fade-in zoom-in duration-300">
                                <div className="px-5 py-4 border-b border-black/5 mb-2">
                                    <p className="text-sm font-black text-on-surface">{roleConfig.profileTitle}</p>
                                    <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-0.5">{roleConfig.profileSubtitle}</p>
                                </div>
                                
                                <div className="px-2 mb-2 pb-2 border-b border-black/5">
                                    <button 
                                        onClick={() => { setIsProfileOpen(false); onEditProfile(); }}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-on-surface hover:bg-black/5 transition-all backdrop-blur-md"
                                    >
                                        <span className="material-symbols-outlined text-lg opacity-80">manage_accounts</span>
                                        <span>Edit Profile</span>
                                    </button>
                                </div>

                                <button
                                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all"
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        onLogout?.();
                                    }}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-lg">logout</span>
                                    <span>Keluar Sesi</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

function Sidebar({ isCollapsed, onToggle, activeSection, onNavigate, roleConfig }) {
    const handleSectionClick = (event, sectionKey) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate(sectionKey);
    };

    return (
        <aside
            className={`fixed left-4 lg:left-6 top-4 md:top-6 bottom-4 md:bottom-6 z-50 hidden lg:flex flex-col rounded-3xl glass-sidebar shadow-glass-depth transition-all duration-700 ease-in-out ${isCollapsed ? "w-24" : "w-72"
                }`}
        >
            <button
                onClick={onToggle}
                className={`w-full py-8 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] group focus:outline-none flex items-center ${isCollapsed ? "justify-center px-0" : "px-8 lg:px-10"}`}
            >
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gold-gradient shadow-gold-glow shrink-0">
                        <img alt="" className="h-7 w-7 object-contain" src="/logo-kima.png" />
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden whitespace-nowrap text-left animate-in fade-in slide-in-from-left-4 duration-500">
                            <p className="text-xl font-black text-on-surface tracking-tighter leading-none">KIMA</p>
                            <p className="text-[9px] font-bold text-gold-accent uppercase tracking-[0.2em] mt-1">ARCHIVE</p>
                        </div>
                    )}
                </div>
            </button>

            <nav className="flex-grow px-4 lg:px-6 space-y-2 mt-2 overflow-y-auto no-scrollbar">
                {roleConfig.menuItems.map((item) => {
                    const isActive = activeSection === item.key;
                    const href = getSectionPath(item.key, roleConfig.key);
                    return (
                        <a
                            key={item.key}
                            href={href}
                            title={isCollapsed ? item.label : ""}
                            className={`flex items-center rounded-2xl transition-all duration-300 group ${isCollapsed ? "justify-center h-12 w-12 mx-auto" : "gap-4 px-5 py-3.5"
                                } ${isActive
                                    ? "active-glow-gold text-on-surface font-black"
                                    : "text-on-surface-variant hover:text-on-surface hover:bg-black/5"
                                }`}
                            onClick={(event) => handleSectionClick(event, item.key)}
                        >
                            <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${isActive ? "text-gold-accent" : "group-hover:scale-110"}`}>{item.icon}</span>
                            {!isCollapsed && <span className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap animate-in fade-in duration-500">{item.label}</span>}
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
}

function MobileDropdownMenu({ activeSection, onNavigate, onClose, roleConfig }) {
    return (
        <div className="fixed inset-0 z-50 p-4 lg:hidden">
            <div className="fixed inset-0 bg-black/20 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative h-fit w-full rounded-3xl glass-premium p-6 shadow-glass-depth">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gold-gradient">
                            <img alt="" className="h-6 w-6 object-contain" src="/logo-kima.png" />
                        </div>
                        <p className="text-lg font-black text-on-surface">KIMA</p>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-xl bg-black/[0.03]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <nav className="space-y-2">
                    {roleConfig.menuItems.map((item) => {
                        const isActive = activeSection === item.key;
                        return (
                            <button
                                key={item.key}
                                className={`flex w-full items-center gap-4 rounded-xl px-6 py-4 transition-all ${isActive ? "bg-white/60 font-black" : "text-on-surface-variant hover:bg-white/40"
                                    }`}
                                onClick={() => { onNavigate(item.key); onClose(); }}
                            >
                                <span className={`material-symbols-outlined ${isActive ? "text-gold-accent" : ""}`}>{item.icon}</span>
                                <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}