import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingUnit, CoreAllocationType, CustomerStatus, InvoiceStatus, RouteFlowStatus } from '../shared/types/domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, CreateInvoiceDraftDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const addDays = (value: string, days: number): string => {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const buildCustomerCode = (customerId: number): string =>
  `CUST-${String(10000 + customerId).padStart(5, '0')}`;

const buildContractNumber = (contractId: number, contractYear: number): string =>
  `CTR-${contractYear}-${String(contractId).padStart(4, '0')}`;

const buildInvoiceNumber = (
  customerCode: string,
  periodYear: number,
  periodMonth: number,
  invoiceId: number,
): string => {
  const compactCode = customerCode.replace('CUST-', '');
  return `INV-${periodYear}${String(periodMonth).padStart(2, '0')}-${compactCode}-${String(invoiceId).padStart(3, '0')}`;
};

@Injectable()
export class PrismaCustomersWriteService {
  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return (
      this.prisma.isEnabled() && process.env.CUSTOMERS_WRITE_SOURCE === 'prisma'
    );
  }

  async create(payload: CreateCustomerDto): Promise<number> {
    const name = this.normalizeRequiredString(payload?.name, 'name');
    const status = this.parseStatus(payload?.status) ?? CustomerStatus.Aktif;
    const activationFeeAmount = this.parseActivationFeeAmount(
      payload?.activationFeeAmount,
      0,
    );
    const activationFeePaidAt = this.parseActivationFeePaidAt(
      payload?.activationFeePaidAt,
    );
    const resolvedIspIds = await this.resolveIspIdsFromPayload(payload, {
      requireAtLeastOne: true,
    });
    const resolvedIsps = await this.prisma.isp.findMany({
      where: { id: { in: resolvedIspIds } },
      orderBy: { name: 'asc' },
    });

    const contractNumber = this.parseOptionalContractNumber(
      payload?.contractNumber,
    );
    const contractPeriod = this.parseContractPeriod(
      payload?.contractStartDate,
      payload?.contractEndDate,
    );

    if (!contractPeriod) {
      throw new BadRequestException(
        'Tenant wajib memiliki periode kontrak untuk membuat kontrak awal.',
      );
    }

    if (payload?.invoiceDrafts?.length && !contractPeriod) {
      throw new BadRequestException(
        'invoiceDrafts require contractStartDate and contractEndDate.',
      );
    }

    const technical = this.parseTenantTechnical(
      payload?.paket,
      payload?.jumlah ?? payload?.contractCoreTotal,
      payload?.contractSharingRatio,
    );
    const billing = this.parseBillingSettings(payload);

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const createdCustomer = await tx.customer.create({
        data: {
          customerCode: `TMP-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          ispName:
            resolvedIsps[0]?.name ??
            this.normalizeRequiredString(payload?.ispName, 'ispName'),
          name,
          status,
          activationFeeAmount,
          activationFeePaidAt: activationFeePaidAt
            ? new Date(`${activationFeePaidAt}T00:00:00.000Z`)
            : null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const customerCode = buildCustomerCode(createdCustomer.id);
      await tx.customer.update({
        where: { id: createdCustomer.id },
        data: { customerCode },
      });

      await tx.customerIspMembership.createMany({
        data: resolvedIspIds.map((ispId) => ({
          customerId: createdCustomer.id,
          ispId,
          createdAt: now,
          updatedAt: now,
        })),
      });

      await tx.customerRouteVersion.create({
        data: {
          customerId: createdCustomer.id,
          versionNumber: 1,
          flowStatus: RouteFlowStatus.Aktif,
          changeMode: 'initial',
          changeNote: 'Versi awal jalur tenant.',
          basedOnVersionId: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const createdContract = await tx.contract.create({
        data: {
          customerId: createdCustomer.id,
          contractNumber:
            contractNumber ??
            `TMP-CTR-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          startDate: new Date(`${contractPeriod.startDate}T00:00:00.000Z`),
          endDate: new Date(`${contractPeriod.endDate}T00:00:00.000Z`),
          coreType: technical.coreType,
          coreTotal: technical.coreTotal,
          sharingRatio:
            technical.coreType === CoreAllocationType.SharingCore
              ? (technical.sharingRatio ?? '1:2')
              : null,
          status: 'expired',
          billingEvery: billing.billingEvery,
          billingUnit: billing.billingUnit,
          createdAt: now,
          updatedAt: now,
        },
      });

      if (!contractNumber) {
        await tx.contract.update({
          where: { id: createdContract.id },
          data: {
            contractNumber: buildContractNumber(
              createdContract.id,
              Number(contractPeriod.startDate.slice(0, 4)),
            ),
          },
        });
      }

      const finalContract = await tx.contract.findUniqueOrThrow({
        where: { id: createdContract.id },
      });

      const version = await tx.contractVersion.create({
        data: {
          contractId: finalContract.id,
          customerId: createdCustomer.id,
          versionNumber: 1,
          startDate: new Date(`${contractPeriod.startDate}T00:00:00.000Z`),
          endDate: new Date(`${contractPeriod.endDate}T00:00:00.000Z`),
          coreType: technical.coreType,
          coreTotal: technical.coreTotal,
          sharedCoreRatio: technical.sharingRatio,
          bakDocumentId: null,
          createdAt: now,
          updatedAt: now,
        },
      });

      if (Array.isArray(payload?.invoiceDrafts) && payload.invoiceDrafts.length > 0) {
        await this.persistInvoiceDrafts(
          tx,
          createdCustomer.id,
          customerCode,
          finalContract.id,
          finalContract.contractNumber,
          version.id,
          payload.invoiceDrafts,
        );
      } else {
        await this.generateInvoicesForPeriod(tx, {
          customerId: createdCustomer.id,
          customerCode,
          contractId: finalContract.id,
          contractNumber: finalContract.contractNumber,
          contractVersionId: version.id,
          periodStartDate: contractPeriod.startDate,
          periodEndDate: contractPeriod.endDate,
          billingEvery: billing.billingEvery,
          billingUnit: billing.billingUnit,
        });
      }

      return createdCustomer.id;
    });
  }

  async update(customerId: number, payload: UpdateCustomerDto): Promise<number> {
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        ispMemberships: {
          include: { isp: true },
        },
      },
    });

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const activationFeeLocked = Boolean(existingCustomer.activationFeePaidAt);

    if (activationFeeLocked) {
      if (
        payload.activationFeeAmount !== undefined &&
        Number(payload.activationFeeAmount) !==
          Number(existingCustomer.activationFeeAmount)
      ) {
        throw new BadRequestException(
          'Biaya aktivasi sudah terbayar dan tidak dapat diubah lagi.',
        );
      }

      if (
        payload.activationFeePaidAt !== undefined &&
        payload.activationFeePaidAt !==
          existingCustomer.activationFeePaidAt?.toISOString().slice(0, 10)
      ) {
        throw new BadRequestException(
          'Tanggal pembayaran aktivasi sudah terkunci dan tidak dapat diubah.',
        );
      }
    }

    const updates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      updates.name = this.normalizeRequiredString(payload.name, 'name');
    }

    if (payload.status !== undefined) {
      updates.status = this.parseStatus(payload.status);
    }

    if (payload.activationFeeAmount !== undefined && !activationFeeLocked) {
      updates.activationFeeAmount = this.parseActivationFeeAmount(
        payload.activationFeeAmount,
      );
    }

    if (payload.activationFeePaidAt !== undefined && !activationFeeLocked) {
      const parsedPaidAt = this.parseActivationFeePaidAt(
        payload.activationFeePaidAt,
      );
      updates.activationFeePaidAt = parsedPaidAt
        ? new Date(`${parsedPaidAt}T00:00:00.000Z`)
        : null;
    }

    const shouldUpdateMemberships =
      payload.ispName !== undefined ||
      payload.ispIds !== undefined ||
      payload.newIspNames !== undefined;

    return this.prisma.$transaction(async (tx) => {
      if (shouldUpdateMemberships) {
        const nextIspIds = await this.resolveIspIdsFromPayload(
          {
            ...payload,
            ispName: payload.ispName ?? existingCustomer.ispName,
          },
          { requireAtLeastOne: true },
          tx,
        );

        await tx.customerIspMembership.deleteMany({
          where: { customerId },
        });

        await tx.customerIspMembership.createMany({
          data: nextIspIds.map((ispId) => ({
            customerId,
            ispId,
          })),
        });

        const nextPrimaryIsp = await tx.isp.findFirst({
          where: { id: { in: nextIspIds } },
          orderBy: { name: 'asc' },
        });

        if (nextPrimaryIsp) {
          updates.ispName = nextPrimaryIsp.name;
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: updates,
        });
      }

      return customerId;
    });
  }

  private async persistInvoiceDrafts(
    tx: any,
    customerId: number,
    customerCode: string,
    contractId: number,
    contractNumber: string,
    contractVersionId: number,
    drafts?: CreateInvoiceDraftDto[],
  ): Promise<void> {
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return;
    }

    for (const [index, draft] of drafts.entries()) {
      if (!draft || typeof draft !== 'object') {
        throw new BadRequestException(`invoiceDrafts[${index}] is invalid.`);
      }

      const periodStartDate = this.parseIsoDateString(
        draft.periodStartDate,
        `invoiceDrafts[${index}].periodStartDate`,
      );
      const periodEndDate = this.parseIsoDateString(
        draft.periodEndDate,
        `invoiceDrafts[${index}].periodEndDate`,
      );

      if (periodStartDate > periodEndDate) {
        throw new BadRequestException(
          `invoiceDrafts[${index}] periodStartDate must be <= periodEndDate.`,
        );
      }

      const amount = Number(draft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException(
          `invoiceDrafts[${index}] amount must be a positive number.`,
        );
      }

      const periodYear = Number(periodStartDate.slice(0, 4));
      const periodMonth = Number(periodStartDate.slice(5, 7));
      const paidAt = draft.paidAt
        ? this.parseIsoDateString(draft.paidAt, `invoiceDrafts[${index}].paidAt`)
        : null;

      const created = await tx.invoice.create({
        data: {
          customerId,
          invoiceNumber:
            this.parseOptionalContractNumber(draft.invoiceNumber) ??
            `TMP-INV-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          contractId,
          contractVersionId,
          contractNumber,
          periodMonth,
          periodYear,
          periodStartDate: new Date(`${periodStartDate}T00:00:00.000Z`),
          periodEndDate: new Date(`${periodEndDate}T00:00:00.000Z`),
          dueDate: new Date(`${addDays(periodEndDate, 10)}T00:00:00.000Z`),
          amount: Math.round(amount),
          status:
            paidAt && draft.paymentProofFileUrl
              ? InvoiceStatus.Lunas
              : InvoiceStatus.BelumDitagih,
          scheduleVersion: 1,
          scheduleStatus: 'active',
          documentId: null,
          paidAt: paidAt ? new Date(`${paidAt}T00:00:00.000Z`) : null,
          invoiceFileUrl: draft.invoiceFileUrl ?? null,
          paymentProofFileUrl: draft.paymentProofFileUrl ?? null,
        },
      });

      if (!draft.invoiceNumber) {
        await tx.invoice.update({
          where: { id: created.id },
          data: {
            invoiceNumber: buildInvoiceNumber(
              customerCode,
              periodYear,
              periodMonth,
              created.id,
            ),
          },
        });
      }
    }
  }

  private async generateInvoicesForPeriod(
    tx: any,
    params: {
      customerId: number;
      customerCode: string;
      contractId: number;
      contractNumber: string;
      contractVersionId: number;
      periodStartDate: string;
      periodEndDate: string;
      billingEvery: number;
      billingUnit: BillingUnit;
    },
  ): Promise<void> {
    let cursor = params.periodStartDate;
    let guard = 0;

    while (cursor <= params.periodEndDate && guard < 240) {
      guard += 1;
      const nextCursor = this.shiftByBillingCycle(
        cursor,
        params.billingEvery,
        params.billingUnit,
      );

      if (!nextCursor || nextCursor <= cursor) {
        break;
      }

      const calculatedEnd = addDays(nextCursor, -1);
      const invoiceEndDate =
        calculatedEnd < params.periodEndDate
          ? calculatedEnd
          : params.periodEndDate;
      const periodYear = Number(cursor.slice(0, 4));
      const periodMonth = Number(cursor.slice(5, 7));

      const created = await tx.invoice.create({
        data: {
          customerId: params.customerId,
          invoiceNumber: `TMP-INV-${Date.now()}-${Math.round(Math.random() * 1000)}`,
          contractId: params.contractId,
          contractVersionId: params.contractVersionId,
          contractNumber: params.contractNumber,
          periodMonth,
          periodYear,
          periodStartDate: new Date(`${cursor}T00:00:00.000Z`),
          periodEndDate: new Date(`${invoiceEndDate}T00:00:00.000Z`),
          dueDate: new Date(`${addDays(invoiceEndDate, 10)}T00:00:00.000Z`),
          amount: 0,
          status: InvoiceStatus.BelumDitagih,
          scheduleVersion: 1,
          scheduleStatus: 'active',
        },
      });

      await tx.invoice.update({
        where: { id: created.id },
        data: {
          invoiceNumber: buildInvoiceNumber(
            params.customerCode,
            periodYear,
            periodMonth,
            created.id,
          ),
        },
      });

      cursor = nextCursor;
    }
  }

  private async resolveIspIdsFromPayload(
    payload: {
      ispName?: unknown;
      ispIds?: unknown;
      newIspNames?: unknown;
    },
    options: {
      requireAtLeastOne: boolean;
    },
    tx: any = this.prisma,
  ): Promise<number[]> {
    const resolvedIds = new Set<number>();

    if (Array.isArray(payload?.ispIds)) {
      for (const value of payload.ispIds) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          continue;
        }

        const existingIsp = await tx.isp.findUnique({ where: { id: parsed } });
        if (existingIsp) {
          resolvedIds.add(parsed);
        }
      }
    }

    const newNames: string[] = [];

    if (Array.isArray(payload?.newIspNames)) {
      payload.newIspNames
        .map((value) => this.normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value))
        .forEach((name) => newNames.push(name));
    }

    const ispNameRaw = this.normalizeOptionalString(payload?.ispName);
    if (ispNameRaw) {
      ispNameRaw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((name) => newNames.push(name));
    }

    for (const name of newNames) {
      const existingIsp = await tx.isp.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (!existingIsp) {
        throw new BadRequestException(
          `ISP "${name}" belum terdaftar. Tambahkan ISP terlebih dahulu.`,
        );
      }

      resolvedIds.add(existingIsp.id);
    }

    if (options.requireAtLeastOne && resolvedIds.size === 0) {
      throw new BadRequestException('At least one ISP is required.');
    }

    return Array.from(resolvedIds);
  }

  private normalizeRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${fieldName} must be a non-empty string.`);
    }

    return value.trim();
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      return String(value).trim() || null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private parseStatus(value: unknown): CustomerStatus {
    if (value !== CustomerStatus.Aktif && value !== CustomerStatus.Nonaktif) {
      throw new BadRequestException('status must be aktif or nonaktif.');
    }

    return value;
  }

  private parseActivationFeeAmount(value: unknown, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }

      throw new BadRequestException(
        'activationFeeAmount must be provided for this operation.',
      );
    }

    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException(
        'activationFeeAmount must be a non-negative number.',
      );
    }

    return Math.round(amount);
  }

  private parseActivationFeePaidAt(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return this.parseIsoDateString(value, 'activationFeePaidAt');
  }

  private parseContractPeriod(
    contractStartDate: unknown,
    contractEndDate: unknown,
  ): { startDate: string; endDate: string } | null {
    const hasStartDate = !(
      contractStartDate === undefined ||
      contractStartDate === null ||
      contractStartDate === ''
    );
    const hasEndDate = !(
      contractEndDate === undefined ||
      contractEndDate === null ||
      contractEndDate === ''
    );

    if (!hasStartDate && !hasEndDate) {
      return null;
    }

    if (!hasStartDate || !hasEndDate) {
      throw new BadRequestException(
        'contractStartDate and contractEndDate must be provided together.',
      );
    }

    const startDate = this.parseIsoDateString(
      contractStartDate,
      'contractStartDate',
    );
    const endDate = this.parseIsoDateString(contractEndDate, 'contractEndDate');

    if (startDate > endDate) {
      throw new BadRequestException(
        'contractStartDate must be less than or equal to contractEndDate.',
      );
    }

    return { startDate, endDate };
  }

  private parseTenantTechnical(
    paket: unknown,
    jumlah: unknown,
    contractSharingRatio: unknown,
  ): {
    coreType: CoreAllocationType;
    coreTotal: number;
    sharingRatio: string | null;
  } {
    if (paket === 'core') {
      return {
        coreType: CoreAllocationType.Core,
        coreTotal: this.parseCoreTotal(jumlah, 1),
        sharingRatio: null,
      };
    }

    return {
      coreType: CoreAllocationType.SharingCore,
      coreTotal: 1,
      sharingRatio: this.parseSharingRatio(contractSharingRatio, '1:8'),
    };
  }

  private parseCoreTotal(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const total = Number(value);
    if (!Number.isFinite(total) || total <= 0) {
      throw new BadRequestException(
        'contractCoreTotal must be a number greater than 0.',
      );
    }

    return Math.round(total);
  }

  private parseSharingRatio(value: unknown, fallback: string): string {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('contractSharingRatio must be a string.');
    }

    const normalized = value.trim().replace(/\s+/g, '');
    if (!/^[1-9]\d*:[1-9]\d*$/.test(normalized)) {
      throw new BadRequestException(
        'contractSharingRatio must use ratio format A:B with positive integers.',
      );
    }

    return normalized;
  }

  private parseBillingSettings(payload: CreateCustomerDto): {
    billingEvery: number;
    billingUnit: BillingUnit;
  } {
    const mode = payload?.billingPeriodMode;

    if (mode === '3bulanan') {
      return {
        billingEvery: 3,
        billingUnit: BillingUnit.Bulan,
      };
    }

    if (mode === 'custom') {
      return {
        billingEvery: this.parseBillingEvery(payload?.billingCustomEvery, 1),
        billingUnit: this.parseBillingUnit(
          payload?.billingCustomUnit,
          BillingUnit.Bulan,
        ),
      };
    }

    return {
      billingEvery: 1,
      billingUnit: BillingUnit.Bulan,
    };
  }

  private parseBillingEvery(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('billingEvery must be a positive number.');
    }

    return Math.round(parsed);
  }

  private parseBillingUnit(value: unknown, fallback: BillingUnit): BillingUnit {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    if (
      value !== BillingUnit.Hari &&
      value !== BillingUnit.Bulan &&
      value !== BillingUnit.Tahun
    ) {
      throw new BadRequestException(
        'billingUnit must be hari, bulan, or tahun.',
      );
    }

    return value;
  }

  private parseIsoDateString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} must be a string date.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `${fieldName} must be in YYYY-MM-DD format.`,
      );
    }

    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${fieldName} is invalid.`);
    }

    return value;
  }

  private parseOptionalContractNumber(value: unknown): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('contractNumber must be a string.');
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return normalized;
  }

  private shiftByBillingCycle(
    value: string,
    every: number,
    unit: BillingUnit,
  ): string {
    const next = new Date(`${value}T00:00:00.000Z`);

    if (unit === BillingUnit.Hari) {
      next.setUTCDate(next.getUTCDate() + every);
    } else if (unit === BillingUnit.Tahun) {
      next.setUTCFullYear(next.getUTCFullYear() + every);
    } else {
      next.setUTCMonth(next.getUTCMonth() + every);
    }

    return next.toISOString().slice(0, 10);
  }
}
