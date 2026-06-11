export const APP_NAVIGATION_EVENT = "sistem-fo-kima:navigate";

export function requestAppNavigation(targetPath, options = {}) {
    if (typeof window === "undefined" || !targetPath) {
        return false;
    }

    window.dispatchEvent(new CustomEvent(APP_NAVIGATION_EVENT, {
        detail: {
            targetPath,
            options,
        },
    }));
    return true;
}
