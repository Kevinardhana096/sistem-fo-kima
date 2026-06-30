import { fireEvent, render, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../AppShell";

vi.mock("../../../roles", () => ({
    getRoleConfig: vi.fn(() => ({
        key: "admin",
        profileTitle: "Administrator",
        profileSubtitle: "Admin",
        menuItems: [
            { key: "dashboard", label: "Dashboard", icon: "dashboard" },
            { key: "customers", label: "Customers", icon: "groups" },
        ],
    })),
}));

vi.mock("../../../app/routes", () => ({
    getSectionPath: vi.fn((sectionKey) => `/${sectionKey}`),
}));

vi.mock("../../../app/navigation-events", () => ({
    requestAppNavigation: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
    updateCurrentUserProfile: vi.fn(),
}));

vi.mock("../../../lib/browser-notifications", () => ({
    getBrowserNotificationSupport: vi.fn(() => ({
        isSupported: false,
        permission: "default",
        reason: "Not supported",
    })),
    requestBrowserNotificationPermission: vi.fn(),
    showBrowserNotification: vi.fn(),
}));

vi.mock("../../../hooks/useScrollLock", () => ({
    useScrollLock: vi.fn(),
}));

describe("AppShell sidebar", () => {
    const defaultProps = {
        activeSection: "dashboard",
        currentRole: "admin",
        hideSidebar: false,
        onLogout: vi.fn(),
        onNavigate: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the sidebar open after a menu item is selected until the cursor leaves", () => {
        render(
            <AppShell {...defaultProps}>
                <div>Content</div>
            </AppShell>,
        );

        const sidebar = document.querySelector("aside div[aria-expanded]");
        expect(sidebar).toHaveAttribute("aria-expanded", "false");

        fireEvent.mouseEnter(sidebar);
        expect(sidebar).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(within(sidebar).getByRole("link", { name: /dashboard/i }));

        expect(defaultProps.onNavigate).toHaveBeenCalledWith("dashboard");
        expect(sidebar).toHaveAttribute("aria-expanded", "true");

        fireEvent.mouseLeave(sidebar);
        expect(sidebar).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps the sidebar open while keyboard focus is inside it", () => {
        render(
            <AppShell {...defaultProps}>
                <div>Content</div>
            </AppShell>,
        );

        const sidebar = document.querySelector("aside div[aria-expanded]");
        fireEvent.keyDown(window, { key: "Tab" });
        fireEvent.focus(within(sidebar).getByRole("link", { name: /dashboard/i }));

        expect(sidebar).toHaveAttribute("aria-expanded", "true");

        fireEvent.blur(within(sidebar).getByRole("link", { name: /dashboard/i }), {
            relatedTarget: document.body,
        });

        expect(sidebar).toHaveAttribute("aria-expanded", "false");
    });

    it("keeps the sidebar state untouched for modifier clicks", () => {
        render(
            <AppShell {...defaultProps}>
                <div>Content</div>
            </AppShell>,
        );

        const sidebar = document.querySelector("aside div[aria-expanded]");
        fireEvent.mouseEnter(sidebar);
        expect(sidebar).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(within(sidebar).getByRole("link", { name: /dashboard/i }), {
            ctrlKey: true,
            button: 0,
        });

        expect(defaultProps.onNavigate).not.toHaveBeenCalled();
        expect(sidebar).toHaveAttribute("aria-expanded", "true");

        fireEvent.mouseLeave(sidebar);
        expect(sidebar).toHaveAttribute("aria-expanded", "false");
    });
});
