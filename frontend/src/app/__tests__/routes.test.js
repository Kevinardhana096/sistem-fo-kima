import { describe, expect, it, vi } from "vitest";
import { getAppPaths, parseAppRoute } from "../routes";
import { APP_ROLES, canAccessRoute } from "../../roles";
import { APP_NAVIGATION_EVENT, requestAppNavigation } from "../navigation-events";

describe("routing registry", () => {
    it("encodes and decodes dynamic route segments", () => {
        const paths = getAppPaths(APP_ROLES.admin);
        const encodedPath = paths.customerDetail("CUST/ABC 01", { tab: "documents", ispId: 7 });

        expect(encodedPath).toBe("/customers/CUST%2FABC%2001?tab=documents&isp=7");
        expect(parseAppRoute(encodedPath.split("?")[0], "?tab=documents&isp=7", APP_ROLES.admin)).toEqual({
            type: "customer-detail",
            sectionKey: "customers",
            customerId: "CUST/ABC 01",
            initialTab: "documents",
            contextIspId: "7",
        });
    });

    it("preserves ISP context on tenant detail routes for the App-level ownership guard", () => {
        const routeWithoutContext = parseAppRoute("/customers/10", "", APP_ROLES.isp);
        const routeWithContext = parseAppRoute("/customers/10", "?isp=3", APP_ROLES.isp);

        expect(canAccessRoute(APP_ROLES.isp, routeWithoutContext)).toBe(true);
        expect(routeWithoutContext.contextIspId).toBeNull();
        expect(canAccessRoute(APP_ROLES.isp, routeWithContext)).toBe(true);
        expect(routeWithContext.contextIspId).toBe("3");
    });

    it("parses the ISP self placeholder so App can resolve it after ISP data loads", () => {
        expect(parseAppRoute("/isps/me", "", APP_ROLES.isp)).toEqual({
            type: "isp-detail",
            sectionKey: "isp-detail",
            ispId: "me",
            initialTab: "overview",
        });
    });

    it("does not expose admin-only sections through the ISP route registry", () => {
        const route = parseAppRoute("/monitoring", "", APP_ROLES.isp);

        expect(route).toEqual({ type: "not-found", sectionKey: "isp-detail" });
        expect(canAccessRoute(APP_ROLES.isp, route)).toBe(true);
    });
});

describe("requestAppNavigation", () => {
    it("dispatches a central navigation request instead of mutating history directly", () => {
        const listener = vi.fn();
        window.addEventListener(APP_NAVIGATION_EVENT, listener);

        expect(requestAppNavigation("/customers/10?isp=3", { replace: true })).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail).toEqual({
            targetPath: "/customers/10?isp=3",
            options: { replace: true },
        });

        window.removeEventListener(APP_NAVIGATION_EVENT, listener);
    });
});
