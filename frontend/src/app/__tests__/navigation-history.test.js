import { beforeEach, describe, expect, it } from "vitest";
import {
    canNavigateBackInApp,
    readNavigationHistorySnapshot,
    recordNavigationHistory,
    syncNavigationHistoryAfterPopState,
    syncNavigationHistoryForCurrentLocation,
} from "../navigation-history";

describe("navigation history", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState({}, "", "/customers");
    });

    it("initializes the current location as the first navigation entry", () => {
        const snapshot = syncNavigationHistoryForCurrentLocation();

        expect(snapshot.currentIndex).toBe(0);
        expect(snapshot.entries).toHaveLength(1);
        expect(snapshot.entries[0].path).toBe("/customers");
        expect(canNavigateBackInApp()).toBe(false);
    });

    it("tracks pushed navigation and replaces the active entry when requested", () => {
        syncNavigationHistoryForCurrentLocation();

        recordNavigationHistory("/customers/10?tab=overview");
        recordNavigationHistory("/customers/10?tab=jalur", { replace: true });

        const snapshot = readNavigationHistorySnapshot();

        expect(snapshot.currentIndex).toBe(1);
        expect(snapshot.entries).toHaveLength(2);
        expect(snapshot.entries[0].path).toBe("/customers");
        expect(snapshot.entries[1].path).toBe("/customers/10?tab=jalur");
    });

    it("restores the stack when the browser moves back to a previous entry", () => {
        syncNavigationHistoryForCurrentLocation();

        recordNavigationHistory("/customers/10?tab=overview");
        recordNavigationHistory("/customers/10?tab=jalur");

        let snapshot = readNavigationHistorySnapshot();
        const previousEntryId = snapshot.entries[1].id;

        window.history.replaceState(
            {
                __sistemFoKimaNavigationState: {
                    entryId: previousEntryId,
                },
            },
            "",
            "/customers/10?tab=overview",
        );

        snapshot = syncNavigationHistoryAfterPopState();

        expect(snapshot.currentIndex).toBe(1);
        expect(snapshot.entries[1].path).toBe("/customers/10?tab=overview");
        expect(canNavigateBackInApp()).toBe(true);
    });
});

