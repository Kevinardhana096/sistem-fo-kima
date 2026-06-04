import { APP_ROLES } from "../../roles";

const ROLE_STORAGE_KEY = "arsip-kima.current-role";

export function normalizeAppRole(roleKey) {
    return Object.values(APP_ROLES).includes(roleKey) ? roleKey : APP_ROLES.guest;
}

export function getStoredRole() {
    if (typeof window === "undefined") {
        return APP_ROLES.guest;
    }

    return normalizeAppRole(window.localStorage.getItem(ROLE_STORAGE_KEY));
}

export function persistRole(roleKey) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(ROLE_STORAGE_KEY, normalizeAppRole(roleKey));
}
