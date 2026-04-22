import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContractStatus,
  CoreAllocationType,
  CustomerStatus,
  InvoiceStatus,
  RouteFlowStatus,
  TenantTodoCategory,
  TenantTodoItem,
} from '../shared/types/domain.types';

const toIsoTimestamp = (value: Date): string => value.toISOString();
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const nowIso = (): string => new Date().toISOString();
const addDays = (value: string, days: number): string => {
  const next = parseDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate(next);
};
const toNumber = (value: unknown): number => Number(value ?? 0);

const monthLabel = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

@Injectable()
export class PrismaCustomersReadService {
  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return (
      this.prisma.isEnabled() && process.env.CUSTOMERS_READ_SOURCE === 'prisma'
    );
  }

  async list() {
    const customers = await this.prisma.customer.findMany({
      orderBy: { name: 'asc' },
      include: {
        ispMemberships: {
          include: {
            isp: true,
          },
        },
        contracts: {
          orderBy: { id: 'desc' },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        documents: true,
        invoices: {
          include: {
            followUps: true,
          },
        },
        routeVersions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            points: {
              orderBy: { orderNumber: 'asc' },
            },
          },
        },
      },
    });

    return customers.map((customer) => {
      const mapped = this.mapCustomerRecord(customer);
      const todoSummary = this.buildCustomerTodoSummary(mapped);
      const contractSnapshot = this.buildCustomerContractSnapshot(mapped);
      const activeRouteVersion = mapped.routeVersions[0] ?? null;

      return {
        ...mapped.customer,
        isps: mapped.isps.map((isp) => ({
          id: isp.id,
          name: isp.name,
          status: isp.status,
        })),
        ...contractSnapshot,
        contractCount: mapped.contracts.length,
        contractVersionCount: mapped.contractVersions.length,
        documentCount: mapped.documents.length,
        invoiceCount: mapped.invoices.length,
        routeStatus: activeRouteVersion?.flowStatus ?? RouteFlowStatus.Aktif,
        todoSummary,
      };
    });
  }

  async getById(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        ispMemberships: {
          include: {
            isp: true,
          },
        },
        contracts: {
          orderBy: { id: 'desc' },
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        documents: true,
        invoices: {
          include: {
            followUps: true,
          },
        },
        routeVersions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            points: {
              orderBy: { orderNumber: 'asc' },
            },
          },
        },
        routeHistoryEntries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const mapped = this.mapCustomerRecord(customer);
    const contractSnapshot = this.buildCustomerContractSnapshot(mapped);
    const activeRouteVersion = mapped.routeVersions[0] ?? null;
    const timeline = this.listCustomerTimeline(mapped);

    return {
      ...mapped.customer,
      isps: mapped.isps.map((isp) => ({
        id: isp.id,
        name: isp.name,
        status: isp.status,
      })),
      ...contractSnapshot,
      contracts: mapped.contracts,
      contractVersions: mapped.contractVersions,
      activeContractId: mapped.primaryContract?.id ?? null,
      activeContractVersionId: mapped.activeVersion?.id ?? null,
      invoices: mapped.invoices,
      latestDocuments: mapped.documents.slice(0, 5),
      route: {
        activeRouteId: activeRouteVersion?.id ?? null,
        activeFlowStatus:
          activeRouteVersion?.flowStatus ?? RouteFlowStatus.Aktif,
        points: activeRouteVersion?.points ?? [],
        versions: mapped.routeVersions,
        history: mapped.routeHistory,
      },
      todoSummary: this.buildCustomerTodoSummary(mapped),
      timelinePreview: timeline.slice(0, 5),
    };
  }

  private mapCustomerRecord(customer: any) {
    const isps = [...(customer.ispMemberships ?? [])]
      .map((membership) => membership.isp)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((isp) => ({
        id: isp.id,
        name: isp.name,
        status: isp.status,
        contractReference: isp.contractReference,
        contractStartDate: isp.contractStartDate
          ? toIsoDate(isp.contractStartDate)
          : null,
        contractPeriodStart: isp.contractPeriodStart
          ? toIsoDate(isp.contractPeriodStart)
          : null,
        contractPeriodEnd: isp.contractPeriodEnd
          ? toIsoDate(isp.contractPeriodEnd)
          : null,
        paket: isp.paket,
        jumlah: isp.jumlah,
        billingPeriodMode: isp.billingPeriodMode,
        billingCustomEvery: isp.billingCustomEvery,
        billingCustomUnit: isp.billingCustomUnit,
        activationFeeAmount: toNumber(isp.activationFeeAmount),
        activationFeePaidAt: isp.activationFeePaidAt
          ? toIsoTimestamp(isp.activationFeePaidAt)
          : null,
        createdAt: toIsoTimestamp(isp.createdAt),
        updatedAt: toIsoTimestamp(isp.updatedAt),
      }));

    const contracts = [...(customer.contracts ?? [])]
      .sort((left, right) => right.id - left.id)
      .map((contract) => ({
        id: contract.id,
        customerId: contract.customerId,
        contractNumber: contract.contractNumber,
        startDate: toIsoDate(contract.startDate),
        endDate: toIsoDate(contract.endDate),
        coreType: contract.coreType,
        coreTotal: contract.coreTotal,
        sharingRatio: contract.sharingRatio,
        status: contract.status,
        billingEvery: contract.billingEvery,
        billingUnit: contract.billingUnit,
        createdAt: toIsoTimestamp(contract.createdAt),
        updatedAt: toIsoTimestamp(contract.updatedAt),
      }));

    const primaryContract = contracts[0] ?? null;
    const primaryContractRecord =
      (customer.contracts ?? []).find((contract) => contract.id === primaryContract?.id) ??
      null;

    const contractVersions = [...(primaryContractRecord?.versions ?? [])]
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .map((version) => ({
        id: version.id,
        contractId: version.contractId,
        customerId: version.customerId,
        versionNumber: version.versionNumber,
        startDate: toIsoDate(version.startDate),
        endDate: toIsoDate(version.endDate),
        coreType: version.coreType,
        coreTotal: version.coreTotal,
        sharedCoreRatio: version.sharedCoreRatio,
        bakDocumentId: version.bakDocumentId,
        renewalFileUrl: version.renewalFileUrl,
        renewalFileName: version.renewalFileName,
        responseFileUrl: version.responseFileUrl,
        responseFileName: version.responseFileName,
        renewalFollowUps: [],
        createdAt: toIsoTimestamp(version.createdAt),
        updatedAt: toIsoTimestamp(version.updatedAt),
      }));

    const documents = [...(customer.documents ?? [])]
      .map((document) => ({
        id: document.id,
        customerId: document.customerId,
        contractId: document.contractId,
        contractVersionId: document.contractVersionId,
        contractNumber: document.contractNumber,
        jenisDokumen: document.jenisDokumen,
        nomorDokumen: document.nomorDokumen,
        tanggalDokumen: toIsoDate(document.tanggalDokumen),
        fileUrl: document.fileUrl,
        createdAt: toIsoTimestamp(document.createdAt),
      }))
      .sort(
        (left, right) =>
          parseDate(right.tanggalDokumen).getTime() -
          parseDate(left.tanggalDokumen).getTime(),
      );

    const invoices = [...(customer.invoices ?? [])]
      .map((invoice) => ({
        id: invoice.id,
        customerId: invoice.customerId,
        invoiceNumber: invoice.invoiceNumber,
        contractId: invoice.contractId,
        contractVersionId: invoice.contractVersionId,
        contractNumber: invoice.contractNumber,
        periodMonth: invoice.periodMonth,
        periodYear: invoice.periodYear,
        periodStartDate: invoice.periodStartDate
          ? toIsoDate(invoice.periodStartDate)
          : null,
        periodEndDate: invoice.periodEndDate
          ? toIsoDate(invoice.periodEndDate)
          : null,
        dueDate: invoice.dueDate ? toIsoDate(invoice.dueDate) : null,
        amount: toNumber(invoice.amount),
        status: invoice.status,
        scheduleVersion: invoice.scheduleVersion,
        scheduleStatus: invoice.scheduleStatus,
        documentId: invoice.documentId,
        paidAt: invoice.paidAt ? toIsoTimestamp(invoice.paidAt) : null,
        invoiceFileUrl: invoice.invoiceFileUrl,
        paymentProofFileUrl: invoice.paymentProofFileUrl,
        invoiceFollowUps: [...(invoice.followUps ?? [])]
          .sort((left, right) => left.splitOrder - right.splitOrder)
          .map((followUp) => ({
            id: followUp.id,
            invoiceId: followUp.invoiceId,
            splitOrder: followUp.splitOrder,
            source: followUp.source,
            triggerCode: followUp.triggerCode,
            title: followUp.title,
            description: followUp.description,
            status: followUp.status,
            invoiceNumber: followUp.invoiceNumber,
            invoiceFileUrl: followUp.invoiceFileUrl,
            createdAt: toIsoTimestamp(followUp.createdAt),
            updatedAt: toIsoTimestamp(followUp.updatedAt),
          })),
        createdAt: toIsoTimestamp(invoice.createdAt),
        updatedAt: toIsoTimestamp(invoice.updatedAt),
      }))
      .sort((left, right) => {
        if (left.scheduleStatus !== right.scheduleStatus) {
          return left.scheduleStatus === 'active' ? -1 : 1;
        }

        if (left.scheduleVersion !== right.scheduleVersion) {
          return right.scheduleVersion - left.scheduleVersion;
        }

        if (left.periodYear === right.periodYear) {
          return right.periodMonth - left.periodMonth;
        }

        return right.periodYear - left.periodYear;
      });

    const routeVersions = [...(customer.routeVersions ?? [])]
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .map((version) => ({
        id: version.id,
        customerId: version.customerId,
        versionNumber: version.versionNumber,
        flowStatus: version.flowStatus,
        changeMode: version.changeMode,
        changeNote: version.changeNote,
        basedOnVersionId: version.basedOnVersionId,
        createdAt: toIsoTimestamp(version.createdAt),
        updatedAt: toIsoTimestamp(version.updatedAt),
        points: [...(version.points ?? [])]
          .sort((left, right) => left.orderNumber - right.orderNumber)
          .map((point) => ({
            id: point.id,
            routeVersionId: point.routeVersionId,
            orderNumber: point.orderNumber,
            pathName: point.pathName,
            pointType: point.pointType,
            note: point.note,
            createdAt: toIsoTimestamp(point.createdAt),
            updatedAt: toIsoTimestamp(point.updatedAt),
          })),
      }));

    const routeHistory = [...(customer.routeHistoryEntries ?? [])].map((entry) => ({
      id: entry.id,
      customerId: entry.customerId,
      operation: entry.operation,
      note: entry.note,
      snapshotBefore: entry.snapshotBefore,
      snapshotAfter: entry.snapshotAfter,
      createdAt: toIsoTimestamp(entry.createdAt),
    }));

    const customerRecord = {
      id: customer.id,
      customerCode: customer.customerCode,
      ispName: customer.ispName,
      name: customer.name,
      status: customer.status as CustomerStatus,
      activationFeeAmount: toNumber(customer.activationFeeAmount),
      activationFeePaidAt: customer.activationFeePaidAt
        ? toIsoTimestamp(customer.activationFeePaidAt)
        : null,
      createdAt: toIsoTimestamp(customer.createdAt),
      updatedAt: toIsoTimestamp(customer.updatedAt),
    };

    const referenceDate = toIsoDate(new Date());
    const activeVersion = this.findActiveContractVersion(
      contractVersions,
      primaryContract?.status ?? null,
      referenceDate,
    );

    return {
      customer: customerRecord,
      isps,
      contracts,
      primaryContract,
      contractVersions,
      activeVersion,
      documents,
      invoices,
      routeVersions,
      routeHistory,
    };
  }

  private buildCustomerContractSnapshot(mapped: any) {
    const versionSnapshot = mapped.activeVersion ?? mapped.contractVersions[0] ?? null;

    if (!versionSnapshot) {
      return {
        paket: null,
        jumlah: null,
        contractSharingRatio: null,
        contractPeriodStart: null,
        contractPeriodEnd: null,
      };
    }

    return {
      paket:
        versionSnapshot.coreType === CoreAllocationType.SharingCore
          ? 'shared core'
          : 'core',
      jumlah:
        versionSnapshot.coreType === CoreAllocationType.Core
          ? versionSnapshot.coreTotal
          : versionSnapshot.sharedCoreRatio,
      contractSharingRatio: versionSnapshot.sharedCoreRatio ?? null,
      contractPeriodStart: versionSnapshot.startDate,
      contractPeriodEnd: versionSnapshot.endDate,
    };
  }

  private listCustomerTimeline(mapped: any) {
    const documentEvents = mapped.documents.map((document) => ({
      id: `document-${document.id}`,
      customerId: mapped.customer.id,
      date: document.tanggalDokumen,
      type: 'document',
      title: `Dokumen ${document.jenisDokumen} diunggah`,
      description: document.nomorDokumen
        ? `No. ${document.nomorDokumen}`
        : 'Dokumen tanpa nomor.',
    }));

    const contractEvents = mapped.contracts.map((contract) => ({
      id: `contract-${contract.id}`,
      customerId: mapped.customer.id,
      date: contract.startDate,
      type: 'contract',
      title: `Kontrak induk ${contract.contractNumber}`,
      description: `Periode ${contract.startDate} s.d ${contract.endDate}`,
    }));

    const contractVersionEvents = mapped.contractVersions.map((version) => ({
      id: `contract-version-${version.id}`,
      customerId: mapped.customer.id,
      date: version.startDate,
      type: 'contract_version',
      title: `Versi kontrak #${version.versionNumber}`,
      description: version.bakDocumentId
        ? `Periode ${version.startDate} s.d ${version.endDate} (BAK tersedia)`
        : `Periode ${version.startDate} s.d ${version.endDate} (BAK belum tersedia)`,
    }));

    const invoiceEvents = mapped.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      customerId: mapped.customer.id,
      date: `${invoice.periodYear}-${String(invoice.periodMonth).padStart(2, '0')}-01`,
      type: 'invoice',
      title: `Invoice ${invoice.status}`,
      description: `${monthLabel[invoice.periodMonth]} ${invoice.periodYear} - Rp ${invoice.amount.toLocaleString('id-ID')}`,
    }));

    const paymentEvents = mapped.invoices
      .filter((invoice) => invoice.paidAt && invoice.paymentProofFileUrl)
      .map((invoice) => ({
        id: `payment-${invoice.id}`,
        customerId: mapped.customer.id,
        date: invoice.paidAt,
        type: 'payment',
        title: `Pembayaran invoice ${invoice.invoiceNumber ?? `#${invoice.id}`}`,
        description: `Pembayaran terkonfirmasi sebesar Rp ${invoice.amount.toLocaleString('id-ID')}`,
      }));

    return [
      ...documentEvents,
      ...contractEvents,
      ...contractVersionEvents,
      ...invoiceEvents,
      ...paymentEvents,
    ].sort(
      (left, right) =>
        parseDate(right.date).getTime() - parseDate(left.date).getTime(),
    );
  }

  private buildCustomerTodoSummary(mapped: any, referenceDate = toIsoDate(new Date())) {
    const priority: TenantTodoItem[] = [];
    const needAction: TenantTodoItem[] = [];
    const info: TenantTodoItem[] = [];
    const customerId = mapped.customer.id;
    const customerInvoices = mapped.invoices.filter(
      (invoice) => invoice.scheduleStatus === 'active',
    );
    const activeVersion = this.findActiveContractVersion(
      mapped.contractVersions,
      mapped.primaryContract?.status ?? null,
      referenceDate,
    );
    const latestVersion = mapped.contractVersions[0] ?? null;
    const nowDate = parseDate(referenceDate);

    if (activeVersion) {
      const daysLeft = Math.ceil(
        (parseDate(activeVersion.endDate).getTime() - nowDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );

      if (daysLeft <= 90 && daysLeft >= 0) {
        priority.push(
          this.createTodoItem({
            customerId,
            category: 'priority',
            code: 'contract_expiring_90_days',
            title: 'Kontrak mendekati berakhir',
            message: 'Kontrak akan habis, buat surat perpanjangan.',
            dueDate: activeVersion.endDate,
          }),
        );
      }
    }

    const overdueInvoices = customerInvoices.filter((invoice) => {
      if (!invoice.invoiceFileUrl) {
        return false;
      }

      if (invoice.status === InvoiceStatus.Terlambat) {
        return true;
      }

      if (
        invoice.status !== InvoiceStatus.Lunas &&
        invoice.dueDate &&
        invoice.dueDate < referenceDate
      ) {
        return true;
      }

      return false;
    });

    if (overdueInvoices.length > 0) {
      const oldestDueDate =
        overdueInvoices
          .map((invoice) => invoice.dueDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;

      priority.push(
        this.createTodoItem({
          customerId,
          category: 'priority',
          code: 'payment_overdue',
          title: 'Pembayaran overdue',
          message: `${overdueInvoices.length} invoice overdue dan perlu follow-up pembayaran.`,
          dueDate: oldestDueDate,
        }),
      );
    }

    if (latestVersion && latestVersion.bakDocumentId === null) {
      needAction.push(
        this.createTodoItem({
          customerId,
          category: 'need_action',
          code: 'bak_missing',
          title: 'BAK belum diunggah',
          message: `Versi kontrak terbaru (${latestVersion.versionNumber}) belum memiliki BAK dan kontrak belum aktif.`,
          dueDate: latestVersion.endDate,
        }),
      );
    }

    const invoicesWithoutUpload = customerInvoices.filter((invoice) => {
      if (invoice.invoiceFileUrl || !invoice.dueDate) {
        return false;
      }

      return addDays(invoice.dueDate, -7) <= referenceDate;
    });

    if (invoicesWithoutUpload.length > 0) {
      const nearestDueDate =
        invoicesWithoutUpload
          .map((invoice) => invoice.dueDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;

      needAction.push(
        this.createTodoItem({
          customerId,
          category: 'need_action',
          code: 'invoice_not_uploaded',
          title: 'Peringatan upload invoice',
          message: `${invoicesWithoutUpload.length} invoice mendekati jatuh tempo dan belum diunggah.`,
          dueDate: nearestDueDate,
        }),
      );
    }

    const pendingInvoices = customerInvoices.filter((invoice) => {
      if (!invoice.invoiceFileUrl) {
        return false;
      }

      if (
        invoice.status === InvoiceStatus.Lunas ||
        invoice.paymentProofFileUrl
      ) {
        return false;
      }

      if (!invoice.dueDate) {
        return true;
      }

      return invoice.dueDate >= referenceDate;
    });

    if (pendingInvoices.length > 0) {
      const nearestDueDate =
        pendingInvoices
          .map((invoice) => invoice.dueDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;

      needAction.push(
        this.createTodoItem({
          customerId,
          category: 'need_action',
          code: 'payment_pending',
          title: 'Pending pembayaran',
          message: `${pendingInvoices.length} invoice pending menunggu pembayaran.`,
          dueDate: nearestDueDate,
        }),
      );
    }

    const invoicesWithoutAmount = customerInvoices.filter(
      (invoice) => Number(invoice.amount ?? 0) <= 0,
    );

    if (invoicesWithoutAmount.length > 0) {
      const nearestDueDate =
        invoicesWithoutAmount
          .map((invoice) => invoice.dueDate)
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;

      needAction.push(
        this.createTodoItem({
          customerId,
          category: 'need_action',
          code: 'invoice_amount_missing',
          title: 'Jumlah tagihan belum diinput',
          message: `${invoicesWithoutAmount.length} invoice belum diinput jumlah tagihannya.`,
          dueDate: nearestDueDate,
        }),
      );
    }

    const recentEvents = this.listCustomerTimeline(mapped).slice(0, 3);
    recentEvents.forEach((event) => {
      info.push(
        this.createTodoItem({
          customerId,
          category: 'info',
          code: 'recent_activity',
          title: 'Aktivitas terbaru',
          message: `${event.title} (${toIsoDate(parseDate(event.date))})`,
          dueDate: null,
        }),
      );
    });

    return {
      priority,
      needAction,
      info,
      counts: {
        priority: priority.length,
        needAction: needAction.length,
        info: info.length,
      },
    };
  }

  private findActiveContractVersion(
    contractVersions: Array<{
      id: number;
      startDate: string;
      endDate: string;
      bakDocumentId: number | null;
    }>,
    contractStatus: ContractStatus | null,
    referenceDate: string,
  ) {
    if (contractStatus === ContractStatus.Terminated) {
      return undefined;
    }

    return contractVersions.find(
      (version) =>
        version.bakDocumentId !== null &&
        version.startDate <= referenceDate &&
        version.endDate >= referenceDate,
    );
  }

  private createTodoItem(payload: {
    customerId: number;
    category: TenantTodoCategory;
    code: TenantTodoItem['code'];
    title: string;
    message: string;
    dueDate: string | null;
  }): TenantTodoItem {
    return {
      id: `${payload.category}-${payload.code}-${payload.customerId}-${Date.now()}-${Math.round(
        Math.random() * 1000,
      )}`,
      customerId: payload.customerId,
      category: payload.category,
      code: payload.code,
      title: payload.title,
      message: payload.message,
      dueDate: payload.dueDate,
      createdAt: nowIso(),
    };
  }
}
