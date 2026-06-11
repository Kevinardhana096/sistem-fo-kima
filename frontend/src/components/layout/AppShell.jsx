import { useState, useEffect } from "react";
import { getSectionPath } from "../../app/routes";
import { getRoleConfig } from "../../roles";
import api from "../../lib/api";
import { requestAppNavigation } from "../../app/navigation-events";
import { supabase, updateCurrentUserProfile } from "../../lib/supabase";

const AUTH_TRANSITION_EVENT = "sistem-fo-kima:auth-transition";
const TRANSITION_STATE_KEY = "__sistemFoKimaTransitionState";
const DEFAULT_TRANSITION_STATE = {
    logout: false,
    page: false,
    title: "Memuat Halaman",
    description: "Menyiapkan tampilan tujuan...",
};

function getRuntimeTransitionState() {
    if (typeof window === "undefined") return DEFAULT_TRANSITION_STATE;
    return window[TRANSITION_STATE_KEY] ?? DEFAULT_TRANSITION_STATE;
}

export default function AppShell({
    activeSection,
    onNavigate,
    onLogout,
    children,
    hideSidebar = false,
    full = false,
    currentRole = "admin",
    onNavigatePath,
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [authUser, setAuthUser] = useState(null);
    const [profileForm, setProfileForm] = useState({
        displayName: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [profileStatus, setProfileStatus] = useState({ type: "", message: "" });
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isLogoutTransitioning, setIsLogoutTransitioning] = useState(() => getRuntimeTransitionState().logout);
    const [isPageTransitioning, setIsPageTransitioning] = useState(() => getRuntimeTransitionState().page);
    const [pageTransitionTitle, setPageTransitionTitle] = useState(() => getRuntimeTransitionState().title);
    const [pageTransitionDescription, setPageTransitionDescription] = useState(() => getRuntimeTransitionState().description);
    const isTransitioningAuth = isLogoutTransitioning || isPageTransitioning;

    // Initialize state from localStorage to ensure persistence
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem("sidebar_collapsed");
        return saved === "true";
    });

    const roleConfig = getRoleConfig(currentRole);
    const profileDisplayName = authUser?.user_metadata?.display_name
        || authUser?.user_metadata?.username
        || roleConfig.profileTitle;
    const profileAvatarName = profileDisplayName || roleConfig.profileTitle;

    const handleMobileNavigate = (sectionKey) => {
        onNavigate(sectionKey);
        setIsMobileMenuOpen(false);
    };

    // Effect to save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("sidebar_collapsed", String(isSidebarCollapsed));
    }, [isSidebarCollapsed]);

    useEffect(() => {
        const syncAuthTransition = (event) => {
            const transitionState = event?.detail ?? getRuntimeTransitionState();

            setIsLogoutTransitioning(Boolean(transitionState.logout));
            setIsPageTransitioning(Boolean(transitionState.page));
            setPageTransitionTitle(transitionState.title || DEFAULT_TRANSITION_STATE.title);
            setPageTransitionDescription(transitionState.description || DEFAULT_TRANSITION_STATE.description);
        };

        syncAuthTransition();
        window.addEventListener(AUTH_TRANSITION_EVENT, syncAuthTransition);
        return () => window.removeEventListener(AUTH_TRANSITION_EVENT, syncAuthTransition);
    }, []);

    useEffect(() => {
        let isActive = true;

        void supabase.auth.getSession().then(({ data }) => {
            if (isActive) setAuthUser(data?.session?.user ?? null);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setAuthUser(nextSession?.user ?? null);
        });

        return () => {
            isActive = false;
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const openEditProfile = () => {
        setProfileForm({
            displayName: profileDisplayName,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        });
        setProfileStatus({ type: "", message: "" });
        setIsEditModalOpen(true);
    };

    const updateProfileField = (key, value) => {
        setProfileForm((previous) => ({ ...previous, [key]: value }));
        setProfileStatus({ type: "", message: "" });
    };

    const handleSaveProfile = async (event) => {
        event.preventDefault();

        const displayName = profileForm.displayName.trim();
        const hasPasswordChange = Boolean(profileForm.newPassword || profileForm.confirmPassword || profileForm.currentPassword);

        if (!displayName) {
            setProfileStatus({ type: "error", message: "Username wajib diisi." });
            return;
        }

        if (hasPasswordChange) {
            if (!profileForm.currentPassword) {
                setProfileStatus({ type: "error", message: "Password lama wajib diisi untuk mengubah password." });
                return;
            }
            if (profileForm.newPassword.length < 8) {
                setProfileStatus({ type: "error", message: "Password baru minimal 8 karakter." });
                return;
            }
            if (profileForm.newPassword !== profileForm.confirmPassword) {
                setProfileStatus({ type: "error", message: "Konfirmasi password baru tidak sama." });
                return;
            }
        }

        setIsSavingProfile(true);
        try {
            const { user } = await updateCurrentUserProfile({
                displayName,
                email: authUser?.email,
                currentPassword: hasPasswordChange ? profileForm.currentPassword : "",
                password: hasPasswordChange ? profileForm.newPassword : "",
            });
            setAuthUser(user ?? null);
            setProfileForm((previous) => ({
                ...previous,
                displayName,
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            }));
            setProfileStatus({ type: "success", message: "Profile berhasil diperbarui." });
        } catch (error) {
            setProfileStatus({
                type: "error",
                message: error instanceof Error ? error.message : "Gagal memperbarui profile.",
            });
        } finally {
            setIsSavingProfile(false);
        }
    };

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

            <TopNav
                hasSidebar={!hideSidebar}
                isSidebarCollapsed={isSidebarCollapsed}
                isMobileMenuOpen={isMobileMenuOpen}
                onToggleMenu={() => setIsMobileMenuOpen((prev) => !prev)}
                onCloseMenu={() => setIsMobileMenuOpen(false)}
                onNavigate={handleMobileNavigate}
                onNavigatePath={onNavigatePath}
                activeSection={activeSection}
                onLogout={onLogout}
                roleConfig={roleConfig}
                profileDisplayName={profileDisplayName}
                profileAvatarName={profileAvatarName}
                onEditProfile={openEditProfile}
                isTransitioningAuth={isTransitioningAuth}
            />

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
                className={`relative z-10 min-h-screen anim-layout-sidebar px-4 sm:px-6 md:px-8 lg:px-10 pb-10 pt-16 lg:pt-20 ${hideSidebar ? "" : (isSidebarCollapsed ? "lg:ml-24" : "lg:ml-60")
                    }`}
            >
                <div className="mx-auto max-w-[1600px]">
                    {children}
                </div>
            </main>

            {isTransitioningAuth && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-6 backdrop-blur-md">
                    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-950/85 px-6 py-8 text-center shadow-2xl">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold-accent border-t-transparent" />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-accent/80">
                                {isLogoutTransitioning ? "Mengakhiri Sesi" : pageTransitionTitle}
                            </p>
                            <p className="mt-2 text-sm font-bold text-on-surface-variant">
                                {isLogoutTransitioning
                                    ? "Menyiapkan keluar dan memuat ulang halaman login..."
                                    : pageTransitionDescription}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm rounded-2xl glass-premium anim-popover p-6 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-black text-on-surface">Edit Profile</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 anim-surface">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-5">
                            <div className="relative">
                                <img
                                    alt="Profile"
                                    className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10 shadow-xl bg-white"
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileAvatarName)}&background=f1f5f9&color=94a3b8&bold=true&size=128`}
                                />
                            </div>
                        </div>

                        <form className="space-y-4" onSubmit={handleSaveProfile}>
                            {profileStatus.message && (
                                <div
                                    className={`rounded-xl border px-3 py-2 text-[10px] font-bold leading-relaxed ${
                                        profileStatus.type === "success"
                                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                            : "border-red-400/25 bg-red-500/10 text-red-200"
                                    }`}
                                >
                                    {profileStatus.message}
                                </div>
                            )}
                            <div>
                                <label className="block text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={profileForm.displayName}
                                    onChange={(event) => updateProfileField("displayName", event.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-[background-color,border-color,box-shadow] duration-200"
                                />
                            </div>

                            <div className="pt-3 border-t border-white/10">
                                <p className="text-[9px] font-black text-on-surface uppercase tracking-widest mb-2.5">Ubah Password</p>
                                <div className="space-y-2.5">
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Password Lama</label>
                                        <input
                                            type="password"
                                            value={profileForm.currentPassword}
                                            onChange={(event) => updateProfileField("currentPassword", event.target.value)}
                                            placeholder="Masukkan password saat ini"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Password Baru</label>
                                        <input
                                            type="password"
                                            value={profileForm.newPassword}
                                            onChange={(event) => updateProfileField("newPassword", event.target.value)}
                                            placeholder="Masukkan password baru"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[8px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Konfirmasi Password Baru</label>
                                        <input
                                            type="password"
                                            value={profileForm.confirmPassword}
                                            onChange={(event) => updateProfileField("confirmPassword", event.target.value)}
                                            placeholder="Ulangi password baru"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-gold-accent/50 transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/30"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-[11px] bg-white/5 text-on-surface hover:bg-white/10 anim-surface"
                                    disabled={isSavingProfile}
                                    type="button"
                                >
                                    Batal
                                </button>
                                <button
                                    className="flex-1 py-2.5 rounded-xl font-black text-[11px] bg-gold-accent text-white shadow-gold-glow hover:opacity-90 transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-55"
                                    disabled={isSavingProfile}
                                    type="submit"
                                >
                                    {isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function TopNav({
    hasSidebar = true,
    isSidebarCollapsed,
    isMobileMenuOpen,
    onToggleMenu,
    onCloseMenu,
    onNavigate,
    onNavigatePath,
    activeSection,
    onLogout,
    roleConfig,
    profileDisplayName,
    profileAvatarName,
    onEditProfile,
    isTransitioningAuth = false,
}) {
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
            if (onNavigatePath) {
                onNavigatePath(notification.targetPath);
            } else {
                requestAppNavigation(notification.targetPath);
            }
        }
    };



    const unreadCount = notifications.filter((notification) => !notification.readAt).length;

    return (
        <nav
            className={`fixed top-4 md:top-5 right-4 md:right-6 z-[2020] flex items-start justify-between anim-layout-sidebar pointer-events-none ${!hasSidebar
                    ? "left-4"
                    : isSidebarCollapsed
                    ? "left-4 lg:left-24"
                    : "left-4 lg:left-60"
                }`}
        >
            <div className="pointer-events-auto">
                {hasSidebar && (
                    <div className="relative">
                        <button
                            className="group flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm anim-surface hover:bg-white/20 lg:hidden"
                            onClick={onToggleMenu}
                            type="button"
                        >
                            <span className="material-symbols-outlined text-lg text-on-surface-variant group-hover:text-gold-accent transition-colors">menu</span>
                        </button>
                        {isMobileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-[2025]" onClick={onCloseMenu}></div>
                                <div className="!absolute left-0 top-full z-[2030] mt-3 w-56 origin-top-left rounded-2xl glass-premium border border-white/10 p-3 shadow-glass-depth animate-in fade-in zoom-in-95 duration-200">
                                    {/* Header / Logo */}
                                    <div className="flex items-center gap-2.5 px-2 py-1.5 border-b border-white/10 mb-2">
                                        <div className="h-6 w-6 flex items-center justify-center rounded-lg bg-gold-accent shadow-gold-glow">
                                            <img alt="Kima" className="h-4 w-4 object-contain" src="/logo-kima.png" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[11px] font-black text-on-surface leading-none">KIMA</p>
                                            <p className="text-[7px] font-bold text-gold-accent uppercase tracking-widest mt-0.5">ARCHIVE</p>
                                        </div>
                                    </div>
                                    <nav className="space-y-1">
                                        {roleConfig.menuItems.map((item) => {
                                            const isActive = activeSection === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left anim-surface transition-all duration-200 ${
                                                        isActive
                                                            ? "active-glow-gold text-on-surface font-black"
                                                            : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                                                    }`}
                                                    onClick={() => { onNavigate(item.key); onCloseMenu(); }}
                                                >
                                                    <span className={`material-symbols-outlined text-base transition-transform duration-200 ${
                                                        isActive ? "text-gold-accent" : "text-on-surface-variant"
                                                    }`}>{item.icon}</span>
                                                    <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
                                                </button>
                                            );
                                        })}
                                    </nav>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute right-0 top-0 z-[2020] flex items-start gap-3 pointer-events-auto">
                <div className="relative shrink-0">
                    <button
                        className="relative group flex h-11 w-11 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm anim-surface hover:bg-white/20"
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
                            <div className="fixed inset-0 z-[2025]" onClick={() => setIsNotificationsOpen(false)}></div>
                            <div className="!fixed left-6 right-6 max-w-md mx-auto top-[72px] md:!absolute md:right-0 md:left-auto md:mx-0 md:top-full md:mt-3 md:w-[24rem] md:max-w-none z-[2030] origin-top md:origin-top-right rounded-2xl glass-premium border border-white/10 p-0 shadow-glass-depth animate-in fade-in slide-in-from-top-3 duration-300 ease-out">
                                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black text-on-surface">Notifikasi</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-on-surface-variant/70 tracking-wide">Notifikasi akan hilang jika telah dibuka.</p>
                                    </div>
                                    <button
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-on-surface-variant anim-surface hover:bg-white/10 backdrop-blur-md"
                                        onClick={loadNotifications}
                                        disabled={isLoadingNotifications}
                                        type="button"
                                    >
                                        <span className={`material-symbols-outlined text-lg ${isLoadingNotifications ? "animate-spin" : ""}`}>sync</span>
                                    </button>
                                </div>

                                <div className="p-3">
                                    <div className="h-[20rem] min-h-[15rem] max-h-[80vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
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
                                                        className={`rounded-xl px-3 py-2.5 anim-surface hover:bg-white/10 backdrop-blur-md ${notification.readAt ? "opacity-70" : "bg-gold-accent/10"}`}
                                                    >
                                                        <div className="flex w-full items-center gap-3 text-left">
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
                                                                    <p className="line-clamp-2 text-[10px] font-bold leading-tight text-on-surface-variant group-hover:text-white/80 transition-colors">{notification.message}</p>
                                                                </button>

                                                                <div className="mt-0.5 flex items-center justify-end">
                                                                    <button
                                                                        onClick={() => handleOpenNotification(notification)}
                                                                        className="rounded-md bg-gold-accent/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-gold-accent border border-gold-accent/20 hover:bg-gold-accent hover:text-black transition-all shadow-sm focus:outline-none"
                                                                        type="button"
                                                                    >
                                                                        {notification.actionLabel}
                                                                    </button>
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
                            </div>
                        </>
                    )}
                </div>

                <div className="relative shrink-0">
                    <button
                        className="flex h-11 w-11 md:h-10 md:w-auto shrink-0 items-center justify-center md:justify-start gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm p-1.5 md:p-1 md:pr-4 anim-surface hover:bg-white/20"
                        onClick={() => {
                            setIsProfileOpen((previous) => !previous);
                            setIsNotificationsOpen(false);
                        }}
                        type="button"
                    >
                        <div className="relative shrink-0">
                            <img
                                alt="Profile"
                                className="h-8 w-8 rounded-lg object-cover ring-2 ring-white/50 shadow-sm bg-white"
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileAvatarName)}&background=f1f5f9&color=94a3b8&bold=true`}
                            />
                        </div>
                        <div className="hidden text-left md:block">
                            <p className="text-[10px] font-black text-on-surface tracking-tight leading-none">{profileDisplayName}</p>
                            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-gold-accent mt-0.5">
                                {roleConfig.profileSubtitle}
                            </p>
                        </div>
                    </button>

                    {isProfileOpen && (
                        <>
                            <div className="fixed inset-0 z-[2025]" onClick={() => setIsProfileOpen(false)}></div>
                            <div className="!absolute right-0 top-full z-[2030] mt-3 w-52 origin-top-right rounded-2xl glass-premium anim-popover p-2 shadow-glass-depth animate-in fade-in zoom-in duration-300 md:w-56">
                                <div className="px-3 py-3 border-b border-white/10 mb-1.5">
                                    <p className="text-xs font-black text-on-surface truncate">{profileDisplayName}</p>
                                    <p className="text-[9px] font-bold text-on-surface-variant uppercase mt-0.5 truncate">{roleConfig.profileSubtitle}</p>
                                </div>

                                {roleConfig.key !== 'isp' && (
                                    <div className="px-1.5 mb-1.5 pb-1.5 border-b border-white/10">
                                    <button
                                        onClick={() => { setIsProfileOpen(false); onEditProfile(); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold text-on-surface hover:bg-white/10 anim-surface"
                                    >
                                        <span className="material-symbols-outlined text-base opacity-80">manage_accounts</span>
                                        <span>Edit Profile</span>
                                    </button>
                                    </div>
                                )}

                                <button
                                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold text-rose-400 hover:bg-rose-500/10 anim-surface disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        onLogout?.();
                                    }}
                                    disabled={isTransitioningAuth}
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
            className={`fixed left-4 lg:left-6 top-4 md:top-5 bottom-4 md:bottom-5 z-[2010] hidden lg:flex flex-col rounded-[20px] glass-sidebar shadow-glass-depth anim-layout-sidebar ${isCollapsed ? "w-16" : "w-52"
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
                className={`w-full py-5 transition-[transform,padding] duration-300 hover:scale-[1.02] active:scale-[0.98] group focus:outline-none flex items-center ${isCollapsed ? "justify-center px-0" : "px-4 lg:px-5"}`}
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
                            className={`flex items-center rounded-lg anim-surface group ${isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2"
                                } ${isActive
                                    ? "active-glow-gold text-on-surface font-black"
                                    : "text-on-surface-variant hover:text-on-surface hover:bg-black/5"
                                }`}
                            onClick={(event) => handleSectionClick(event, item.key)}
                        >
                            <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${isActive ? "text-gold-accent" : "group-hover:scale-110"}`}>{item.icon}</span>
                            {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap animate-in fade-in duration-500">{item.label}</span>}
                        </a>
                    );
                })}
            </nav>
        </aside>
    );
}
