const NAVIGATION_STATE_KEY = "__sistemFoKimaNavigationState";
const NAVIGATION_STACK_STORAGE_KEY = "__sistemFoKimaNavigationStack";

function getCurrentPathKey(pathname = "", search = "") {
    return `${pathname}${search}`;
}

function createNavigationEntryId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `nav-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getNavigationHistoryState(historyState = null) {
    if (!historyState || typeof historyState !== "object") {
        return null;
    }

    const entryId = String(historyState?.[NAVIGATION_STATE_KEY]?.entryId ?? "").trim();
    return entryId ? { entryId } : null;
}

function normalizeSnapshot(snapshot) {
    const entries = Array.isArray(snapshot?.entries)
        ? snapshot.entries
            .map((entry) => {
                const id = String(entry?.id ?? "").trim();
                const path = String(entry?.path ?? "").trim();
                if (!id || !path) return null;
                return { id, path };
            })
            .filter(Boolean)
        : [];

    const currentIndex = Number.isInteger(snapshot?.currentIndex)
        ? snapshot.currentIndex
        : entries.length - 1;

    if (entries.length === 0) {
        return { entries: [], currentIndex: -1 };
    }

    return {
        entries,
        currentIndex: Math.min(Math.max(currentIndex, 0), entries.length - 1),
    };
}

export function readNavigationHistorySnapshot() {
    if (typeof window === "undefined") {
        return { entries: [], currentIndex: -1 };
    }

    try {
        const rawValue = window.sessionStorage.getItem(NAVIGATION_STACK_STORAGE_KEY);
        if (!rawValue) {
            return { entries: [], currentIndex: -1 };
        }

        return normalizeSnapshot(JSON.parse(rawValue));
    } catch {
        return { entries: [], currentIndex: -1 };
    }
}

function writeNavigationHistorySnapshot(snapshot) {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.setItem(
            NAVIGATION_STACK_STORAGE_KEY,
            JSON.stringify(normalizeSnapshot(snapshot)),
        );
    } catch {
        // Ignore storage failures and keep navigation working.
    }
}

function ensureNavigationEntryId(pathKey) {
    if (typeof window === "undefined") {
        return null;
    }

    const navigationState = getNavigationHistoryState(window.history.state ?? {});
    if (navigationState?.entryId) {
        return navigationState.entryId;
    }

    const entryId = createNavigationEntryId();
    window.history.replaceState(
        {
            [NAVIGATION_STATE_KEY]: {
                entryId,
            },
        },
        "",
        pathKey,
    );

    return entryId;
}

export function syncNavigationHistoryForCurrentLocation() {
    if (typeof window === "undefined") {
        return { entries: [], currentIndex: -1 };
    }

    const currentPath = getCurrentPathKey(window.location.pathname, window.location.search);
    const entryId = ensureNavigationEntryId(currentPath);
    const snapshot = readNavigationHistorySnapshot();

    if (!entryId) {
        const nextSnapshot = { entries: [{ id: createNavigationEntryId(), path: currentPath }], currentIndex: 0 };
        writeNavigationHistorySnapshot(nextSnapshot);
        return nextSnapshot;
    }

    const matchedIndex = snapshot.entries.findIndex((entry) => entry.id === entryId);
    if (matchedIndex >= 0) {
        const nextSnapshot = {
            entries: snapshot.entries.map((entry, index) => (
                index === matchedIndex ? { ...entry, path: currentPath } : entry
            )),
            currentIndex: matchedIndex,
        };
        writeNavigationHistorySnapshot(nextSnapshot);
        return nextSnapshot;
    }

    const nextSnapshot = {
        entries: [{ id: entryId, path: currentPath }],
        currentIndex: 0,
    };
    writeNavigationHistorySnapshot(nextSnapshot);
    return nextSnapshot;
}

export function recordNavigationHistory(targetPath, { replace = false } = {}) {
    if (typeof window === "undefined") {
        return { entries: [], currentIndex: -1 };
    }

    const nextUrl = new URL(targetPath, window.location.origin);
    const nextPath = getCurrentPathKey(nextUrl.pathname, nextUrl.search);
    const currentNavigationState = getNavigationHistoryState(window.history.state ?? {});
    const snapshot = readNavigationHistorySnapshot();
    const currentEntryId = currentNavigationState?.entryId ?? null;
    const nextEntryId = replace
        ? (currentEntryId ?? createNavigationEntryId())
        : createNavigationEntryId();

    let nextSnapshot;

    if (replace) {
        nextSnapshot = snapshot.entries.length > 0 && snapshot.currentIndex >= 0
            ? {
                entries: snapshot.entries.map((entry, index) => (
                    index === snapshot.currentIndex
                        ? { id: nextEntryId, path: nextPath }
                        : entry
                )),
                currentIndex: snapshot.currentIndex,
            }
            : {
                entries: [{ id: nextEntryId, path: nextPath }],
                currentIndex: 0,
            };

        window.history.replaceState({
            [NAVIGATION_STATE_KEY]: {
                entryId: nextEntryId,
            },
        }, "", nextPath);
    } else {
        const baseEntries = snapshot.entries.slice(0, snapshot.currentIndex + 1);
        const nextEntries = [
            ...baseEntries,
            { id: nextEntryId, path: nextPath },
        ];

        nextSnapshot = {
            entries: nextEntries,
            currentIndex: nextEntries.length - 1,
        };

        window.history.pushState({
            [NAVIGATION_STATE_KEY]: {
                entryId: nextEntryId,
            },
        }, "", nextPath);
    }

    writeNavigationHistorySnapshot(nextSnapshot);
    return nextSnapshot;
}

export function syncNavigationHistoryAfterPopState() {
    if (typeof window === "undefined") {
        return { entries: [], currentIndex: -1 };
    }

    const currentPath = getCurrentPathKey(window.location.pathname, window.location.search);
    const historyState = window.history.state ?? {};
    const navigationState = getNavigationHistoryState(historyState);
    const snapshot = readNavigationHistorySnapshot();

    if (!navigationState?.entryId) {
        return syncNavigationHistoryForCurrentLocation();
    }

    const matchedIndex = snapshot.entries.findIndex((entry) => entry.id === navigationState.entryId);
    if (matchedIndex >= 0) {
        const nextSnapshot = {
            entries: snapshot.entries.map((entry, index) => (
                index === matchedIndex ? { ...entry, path: currentPath } : entry
            )),
            currentIndex: matchedIndex,
        };
        writeNavigationHistorySnapshot(nextSnapshot);
        return nextSnapshot;
    }

    return syncNavigationHistoryForCurrentLocation();
}

export function canNavigateBackInApp() {
    return readNavigationHistorySnapshot().currentIndex > 0;
}
