import { describe, expect, it } from "vitest";
import {
    formatMonthYear,
    resolveInvoiceDueMonthIsoDate,
} from "../utils";

describe("resolveInvoiceDueMonthIsoDate", () => {
    it("returns the first day of the same month for period starts on days 1-15", () => {
        expect(resolveInvoiceDueMonthIsoDate("2026-01-01")).toBe("2026-01-01");
        expect(resolveInvoiceDueMonthIsoDate("2026-01-10")).toBe("2026-01-01");
        expect(resolveInvoiceDueMonthIsoDate("2026-01-15")).toBe("2026-01-01");
    });

    it("returns the first day of the next month for period starts from day 16 onward", () => {
        expect(resolveInvoiceDueMonthIsoDate("2026-01-16")).toBe("2026-02-01");
        expect(resolveInvoiceDueMonthIsoDate("2026-01-31")).toBe("2026-02-01");
    });

    it("rolls the technical due month into the next year when needed", () => {
        expect(resolveInvoiceDueMonthIsoDate("2026-12-16")).toBe("2027-01-01");
    });

    it("returns an empty string for invalid period starts", () => {
        expect(resolveInvoiceDueMonthIsoDate("")).toBe("");
        expect(resolveInvoiceDueMonthIsoDate("not-a-date")).toBe("");
    });
});

describe("formatMonthYear", () => {
    it("formats a technical due date as only month and year", () => {
        expect(formatMonthYear("2026-01-01")).toBe("Januari 2026");
    });
});
