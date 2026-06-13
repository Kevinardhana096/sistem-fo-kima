import { describe, expect, it } from "vitest";
import {
    formatMonthYear,
    getIspContractRowCoverage,
    resolveCustomerOperationalStatus,
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

describe("getIspContractRowCoverage", () => {
    it("treats ISP contract row files as uploaded document coverage", () => {
        expect(getIspContractRowCoverage([
            {
                contract_reference: "KTR-ISP-001",
                contract_start_date: "2026-01-01",
                period_start: "2026-02-01",
                period_end: "2027-01-31",
                bak_file_url: "https://storage.example.com/bak.pdf",
                contract_file_url: "https://storage.example.com/kontrak.pdf",
            },
        ])).toEqual({
            hasReference: true,
            hasStartDate: true,
            hasPeriod: true,
            hasBakFile: true,
            hasContractFile: true,
        });
    });

    it("keeps incomplete period false unless both start and end exist", () => {
        expect(getIspContractRowCoverage([
            {
                contractReference: "KTR-ISP-002",
                periodStart: "2026-02-01",
                bakFileUrl: "",
            },
        ])).toEqual({
            hasReference: true,
            hasStartDate: false,
            hasPeriod: false,
            hasBakFile: false,
            hasContractFile: false,
        });
    });
});

describe("resolveCustomerOperationalStatus", () => {
    it("uses active contract version period over stale raw customer status", () => {
        expect(resolveCustomerOperationalStatus({
            status: "expired",
            contracts: [
                {
                    id: 52,
                    status: "aktif",
                    startDate: "2025-10-09",
                    endDate: "2026-10-08",
                    versions: [
                        {
                            id: 61,
                            startDate: "2025-10-09",
                            endDate: "2026-10-08",
                        },
                    ],
                },
            ],
        }, "2026-06-12")).toBe("aktif");
    });
});
