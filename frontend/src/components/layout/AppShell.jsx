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
                className={`relative z-10 min-h-screen transition-all duration-700 ease-in-out px-4 sm:px-6 md:px-8 lg:px-10 pb-10 pt-20 lg:pt-24 ${hideSidebar ? "" : (isSidebarCollapsed ? "lg:ml-24" : "lg:ml-60")
                    }`}
            >
                <div className="mx-auto max-w-[1600px]">
                    {children}
                </div>
            </main>

            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm rounded-2xl glass-premium p-6 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-on-surface">Edit Profile</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-5">
                            <div className="relative group cursor-pointer">
                                <img
                                    alt="Profile"
                                    className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10 shadow-xl bg-white transition-all group-hover:opacity-70"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(roleConfig.profileTitle)}&background=f1f5f9&color=94a3b8&bold=true&size=128`}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="h-8 w-8 bg-black/50 backdrop-blur-md rounded-xl flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-sm">photo_camera</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[9px] font-bold text-gold-accent uppercase tracking-widest mt-3 cursor-pointer hover:underline">Ubah Foto Profil</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Username</label>
                                <input type="text" defaultValue={roleConfig.profileTitle} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-all" />
                            </div>
                            
                            <div className="pt-3 border-t border-white/10">
                                <p className="text-[9px] font-black text-on-surface uppercase tracking-widest mb-2.5">Ubah Password</p>
                                <div className="space-y-2.5">
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Password Lama</label>
                                        <input type="password" placeholder="Masukkan password saat ini" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-all placeholder:text-white/30" />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Password Baru</label>
                                        <input type="password" placeholder="Masukkan password baru" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-all placeholder:text-white/30" />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Konfirmasi Password Baru</label>
                                        <input type="password" placeholder="Ulangi password baru" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-all placeholder:text-white/30" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-bold text-[11px] bg-white/5 text-on-surface hover:bg-white/10 transition-all">
                                Batal
                            </button>
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl font-black text-[11px] bg-gold-accent text-white shadow-gold-glow hover:opacity-90 transition-all">
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
        } catch {
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

    const unreadCount = notifications.filter((notification) => !notification.readAt).length;

    return (
        <nav
            className={`fixed top-4 md:top-5 right-4 md:right-6 z-40 flex items-start justify-between transition-all duration-700 ease-in-out pointer-events-none ${isSidebarCollapsed
                    ? "left-4 lg:left-24"
                    : "left-4 lg:left-60"
                }`}
        >
            <div className="pointer-events-auto">
                <button
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm text-on-surface transition-all hover:bg-white/20 lg:hidden"
                    onClick={onToggleMenu}
                    type="button"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            </div>

            <div className="absolute right-0 top-0 z-50 flex items-start gap-3 pointer-events-auto">
                <div className="relative hidden shrink-0 sm:block">
                    <button
                        className="relative group flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm transition-all hover:bg-white/20"
                        onClick={() => {
                            setIsNotificationsOpen((previous) => !previous);
                            setIsProfileOpen(false);
                            if (!isNotificationsOpen) loadNotifications();
                        }}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-lg text-on-surface-variant group-hover:text-gold-accent transition-colors">notifications</span>
                        {unreadCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-accent px-1.5 text-[9px] font-black text-black shadow-gold-glow border border-white">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotificationsOpen && (
                        <>
                            <div className="fixed inset-0 z-50" onClick={() => setIsNotificationsOpen(false)}></div>
                            <div className="!absolute right-0 top-full z-[60] mt-3 w-[24rem] max-w-[calc(100vw-2rem)] origin-top-right rounded-3xl glass-premium p-3 shadow-glass-depth animate-in fade-in zoom-in duration-300">
                                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black text-on-surface">Notifikasi</p>
                                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                                            {unreadCount} belum dibaca • {notifications.length} aktif
                                        </p>
                                    </div>
                                    <button
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-on-surface-variant transition-all hover:bg-white/10 backdrop-blur-md"
                                        onClick={loadNotifications}
                                        disabled={isLoadingNotifications}
                                        type="button"
                                    >
                                        <span className={`material-symbols-outlined text-lg ${isLoadingNotifications ? "animate-spin" : ""}`}>sync</span>
                                    </button>
                                </div>

                                <div className="mt-2 h-[20rem] min-h-[15rem] max-h-[80vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
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
                                                    className={`rounded-xl px-3 py-2.5 transition-all hover:bg-white/10 backdrop-blur-md ${notification.readAt ? "opacity-70" : "bg-gold-accent/10"}`}
                                                >
                                                    <div className="flex w-full items-start gap-3 text-left">
                                                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${severityClass}`}>
                                                            <span className="material-symbols-outlined text-base">priority_high</span>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <button 
                                                                onClick={() => handleOpenNotification(notification)}
                                                                className="w-full text-left group focus:outline-none"
                                                                type="button"
                                                            >
                                                                <div className="mb-1 flex items-center gap-2">
                                                                    <p className="truncate text-[11px] font-black text-on-surface group-hover:text-gold-accent transition-colors">{notification.title}</p>
                                                                    {!notification.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-accent shadow-gold-glow"></span>}
                                                                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${severityClass}`}>
                                                                        {notification.severity}
                                                                    </span>
                                                                </div>
                                                                <p className="line-clamp-2 text-[10px] font-bold leading-relaxed text-on-surface-variant group-hover:text-white/80 transition-colors">{notification.message}</p>
                                                            </button>
                                                            
                                                            <div className="mt-1.5 flex items-center justify-between">
                                                                <button
                                                                    onClick={() => handleOpenNotification(notification)}
                                                                    className="text-[8px] font-black uppercase tracking-widest text-gold-accent hover:underline focus:outline-none"
                                                                    type="button"
                                                                >
                                                                    {notification.actionLabel}
                                                                </button>
                                                                <div className="flex items-center gap-1.5">
                                                                    {!notification.readAt && (
                                                                        <button
                                                                            className="rounded-md bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-on-surface-variant transition-all hover:bg-white/10 hover:text-white backdrop-blur-md"
                                                                            onClick={(event) => handleMarkRead(event, notification)}
                                                                            type="button"
                                                                        >
                                                                            Dibaca
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-10 text-center">
                                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-on-surface-variant/50 backdrop-blur-md">
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

                <div className="relative shrink-0">
                    <button
                        className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 shadow-sm p-1 pr-4 transition-all hover:bg-white/20"
                        onClick={() => {
                            setIsProfileOpen((previous) => !previous);
                            setIsNotificationsOpen(false);
                        }}
                        type="button"
                    >
                        <div className="relative shrink-0">
                            <img
                                alt="Profile"
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-white/50 shadow-sm bg-white"
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(roleConfig.profileTitle)}&background=f1f5f9&color=94a3b8&bold=true`}
                            />
                        </div>
                        <div className="hidden text-left md:block">
                            <p className="text-[10px] font-black text-on-surface tracking-tight leading-none">{roleConfig.profileTitle}</p>
                            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-gold-accent mt-0.5">
                                {roleConfig.profileSubtitle}
                            </p>
                        </div>
                    </button>

                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-50" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="!absolute right-0 top-full z-[60] mt-3 w-52 origin-top-right rounded-2xl glass-premium p-2 shadow-glass-depth animate-in fade-in zoom-in duration-300 md:w-56">
                                <div className="px-3 py-3 border-b border-white/10 mb-1.5">
                                    <p className="text-xs font-black text-on-surface truncate">{roleConfig.profileTitle}</p>
                                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mt-0.5 truncate">{roleConfig.profileSubtitle}</p>
                                </div>
                                
                                <div className="px-1.5 mb-1.5 pb-1.5 border-b border-white/10">
                                    <button 
                                        onClick={() => { setIsProfileOpen(false); onEditProfile(); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-on-surface hover:bg-white/10 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-base opacity-80">manage_accounts</span>
                                        <span>Edit Profile</span>
                                    </button>
                                </div>

                                <button
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        onLogout?.();
                                    }}
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-base opacity-80">logout</span>
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
            className={`fixed left-4 lg:left-6 top-4 md:top-5 bottom-4 md:bottom-5 z-50 hidden lg:flex flex-col rounded-[20px] glass-sidebar shadow-glass-depth transition-all duration-700 ease-in-out ${isCollapsed ? "w-16" : "w-52"
                }`}
        >
            <button
                aria-label={isCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
                className={`sidebar-collapse-hint ${isCollapsed ? "sidebar-collapse-hint--collapsed" : "sidebar-collapse-hint--expanded"}`}
                onClick={onToggle}
                title={isCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
                type="button"
            >
                <span className="material-symbols-outlined" style={{ fontSize: "32px" }}>
                    {isCollapsed ? "chevron_right" : "chevron_left"}
                </span>
            </button>

            <button
                onClick={onToggle}
                className={`w-full py-5 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] group focus:outline-none flex items-center ${isCollapsed ? "justify-center px-0" : "px-4 lg:px-5"}`}
                title={isCollapsed ? "Buka sidebar" : "Ciutkan sidebar"}
                type="button"
            >
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 flex items-center justify-center rounded-xl bg-gold-accent shadow-gold-glow shrink-0">
                        <img alt="" className="h-5 w-5 object-contain" src="/logo-kima.png" />
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden whitespace-nowrap text-left animate-in fade-in slide-in-from-left-4 duration-500">
                            <p className="text-lg font-black text-on-surface tracking-tighter leading-none">KIMA</p>
                            <p className="text-[8px] font-bold text-gold-accent uppercase tracking-[0.2em] mt-1">ARCHIVE</p>
                        </div>
                    )}
                </div>
            </button>

            <nav className="flex-grow px-2 lg:px-3 space-y-1 mt-1 overflow-y-auto no-scrollbar">
                {roleConfig.menuItems.map((item) => {
                    const isActive = activeSection === item.key;
                    const href = getSectionPath(item.key, roleConfig.key);
                    return (
                        <a
                            key={item.key}
                            href={href}
                            title={isCollapsed ? item.label : ""}
                            className={`flex items-center rounded-lg transition-all duration-300 group ${isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2"
                                } ${isActive
                                    ? "active-glow-gold text-on-surface font-black"
                                    : "text-on-surface-variant hover:text-on-surface hover:bg-black/5"
                                }`}
                            onClick={(event) => handleSectionClick(event, item.key)}
                        >
                            <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isActive ? "text-gold-accent" : "group-hover:scale-110"}`}>{item.icon}</span>
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap animate-in fade-in duration-500">{item.label}</span>}
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
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gold-accent">
                            <img alt="" className="h-6 w-6 object-contain" src="/logo-kima.png" />
                        </div>
                        <p className="text-lg font-black text-on-surface">KIMA</p>
                    </div>
                    <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <nav className="space-y-2">
                    {roleConfig.menuItems.map((item) => {
                        const isActive = activeSection === item.key;
                        return (
                            <button
                                key={item.key}
                                className={`flex w-full items-center gap-4 rounded-xl px-6 py-4 transition-all ${isActive ? "bg-white/10 font-black text-white" : "text-on-surface-variant hover:bg-white/5"
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
