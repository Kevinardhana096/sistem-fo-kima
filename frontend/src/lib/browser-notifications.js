const NOTIFICATION_SEEN_PREFIX = "sistem-fo-kima:browser-notification-seen";
const MAX_SEEN_IDS = 250;

export const getBrowserNotificationSupport = () => {
  if (typeof window === "undefined") {
    return {
      isSupported: false,
      permission: "default",
      reason: "Browser tidak mendukung notifikasi.",
    };
  }

  if (!("Notification" in window)) {
    return {
      isSupported: false,
      permission: "default",
      reason: "Browser tidak mendukung notifikasi.",
    };
  }

  if (!window.isSecureContext) {
    return {
      isSupported: false,
      permission: Notification.permission,
      reason: "Notifikasi membutuhkan HTTPS atau localhost.",
    };
  }

  return {
    isSupported: true,
    permission: Notification.permission,
    reason: "",
  };
};

export const registerNotificationServiceWorker = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register("/service-worker.js");
  } catch (error) {
    console.error("Failed to register notification service worker:", error);
    return null;
  }
};

export const requestBrowserNotificationPermission = async () => {
  const support = getBrowserNotificationSupport();
  if (!support.isSupported) return support;

  if (Notification.permission !== "default") {
    return {
      ...support,
      permission: Notification.permission,
    };
  }

  const permission = await Notification.requestPermission();
  return {
    ...support,
    permission,
  };
};

const normalizeUserKey = (userId) => String(userId || "anonymous");

const getSeenStorageKey = (userId) => `${NOTIFICATION_SEEN_PREFIX}:${normalizeUserKey(userId)}`;

const parseSeenIds = (userId) => {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(getSeenStorageKey(userId));
    const parsed = JSON.parse(rawValue || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
};

const writeSeenIds = (userId, ids) => {
  if (typeof window === "undefined") return;

  const uniqueIds = Array.from(new Set(ids.filter(Boolean).map(String))).slice(-MAX_SEEN_IDS);
  try {
    window.localStorage.setItem(getSeenStorageKey(userId), JSON.stringify(uniqueIds));
  } catch {
    // localStorage can be unavailable in strict privacy modes.
  }
};

export const rememberBrowserNotificationIds = (notifications, userId) => {
  const ids = (Array.isArray(notifications) ? notifications : [])
    .map((notification) => notification?.id)
    .filter(Boolean);
  if (ids.length === 0) return;

  writeSeenIds(userId, [...parseSeenIds(userId), ...ids]);
};

const getNotificationOptions = (notification) => ({
  body: notification?.message || "Ada notifikasi operasional baru.",
  icon: "/logo-kima.png",
  badge: "/logo-kima.png",
  tag: String(notification?.id || "sistem-fo-kima-notification"),
  data: {
    targetPath: notification?.targetPath || "/todos",
  },
});

export const showBrowserNotification = async (notification) => {
  const support = getBrowserNotificationSupport();
  if (!support.isSupported || support.permission !== "granted") return false;

  const title = notification?.title || "Notifikasi KIMA";
  const options = getNotificationOptions(notification);

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
  }

  const browserNotification = new Notification(title, options);
  browserNotification.onclick = () => {
    window.focus();
    const targetPath = options.data?.targetPath;
    if (targetPath) window.location.assign(targetPath);
  };
  return true;
};

export const notifyNewUnreadBrowserNotifications = async (notifications, userId) => {
  const support = getBrowserNotificationSupport();
  const activeNotifications = (Array.isArray(notifications) ? notifications : [])
    .filter((notification) => notification?.id && !notification.readAt && !notification.resolvedAt);

  if (activeNotifications.length === 0) return;

  if (!support.isSupported || support.permission !== "granted") {
    rememberBrowserNotificationIds(activeNotifications, userId);
    return;
  }

  const seenIds = new Set(parseSeenIds(userId));
  const newNotifications = activeNotifications.filter((notification) => !seenIds.has(String(notification.id)));
  if (newNotifications.length === 0) return;

  const notificationsToShow = newNotifications.slice(0, 3);
  await Promise.all(notificationsToShow.map((notification) => showBrowserNotification(notification)));
  rememberBrowserNotificationIds(activeNotifications, userId);
};
