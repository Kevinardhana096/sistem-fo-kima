import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingUnit,
  ContractStatus,
  CoreAllocationType,
  CustomerStatus,
  InvoiceStatus,
  Isp,
  RouteFlowStatus,
  RoutePointType,
} from '../shared/types/domain.types';
import { InMemoryDataService } from '../store/in-memory-data.service';
import { CreateContractVersionDto } from './dto/create-contract-version.dto';
import {
  CreateCustomerDto,
  CreateInvoiceDraftDto,
} from './dto/create-customer.dto';
import { CreateCustomerContractDto } from './dto/create-customer-contract.dto';
import { UpdateCustomerContractDto } from './dto/update-customer-contract.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';

const addDays = (value: string, days: number): string => {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

@Injectable()
export class CustomersService {
  constructor(private readonly store: InMemoryDataService) { }

  list() {
    return this.store.listCustomers().map((customer) => {
      const contracts = this.store.listCustomerContracts(customer.id);
      const documents = this.store.listCustomerDocuments(customer.id);
      const invoices = this.store.listCustomerInvoices(customer.id);
      const isps = this.store.listCustomerIsps(customer.id);
      const todoSummary = this.store.buildCustomerTodoSummary(customer.id);
      const contractSnapshot = this.buildCustomerContractSnapshot(customer.id);
      const activeRouteVersion = this.store.listCustomerRouteVersions(customer.id)[0] ?? null;

      return {
        ...customer,
        isps: isps.map((isp) => ({
          id: isp.id,
          name: isp.name,
          status: isp.status,
        })),
        ...contractSnapshot,
        contractCount: contracts.length,
        contractVersionCount: this.store.listCustomerContractVersions(customer.id).length,
        documentCount: documents.length,
        invoiceCount: invoices.length,
        routeStatus: activeRouteVersion?.flowStatus ?? RouteFlowStatus.Aktif,
        todoSummary,
      };
    });
  }

  create(payload: CreateCustomerDto) {
    const name = this.normalizeRequiredString(payload?.name, 'name');
    const resolvedStatus = this.parseStatus(payload?.status) ?? CustomerStatus.Aktif;

    const resolvedIspIds = this.resolveIspIdsFromPayload(payload, {
      requireAtLeastOne: true,
    });

    const resolvedIsps = resolvedIspIds
      .map((ispId) => this.store.getIspById(ispId))
      .filter((isp): isp is Isp => Boolean(isp));

    const createdCustomer = this.store.createCustomer({
      name,
      status: resolvedStatus,
      activationFeeAmount: this.parseActivationFeeAmount(payload?.activationFeeAmount, 0),
      activationFeePaidAt: this.parseActivationFeePaidAt(payload?.activationFeePaidAt),
      ispName: resolvedIsps[0]?.name ?? this.normalizeRequiredString(payload?.ispName, 'ispName'),
    });

    this.store.setCustomerIspMemberships(createdCustomer.id, resolvedIspIds);

    const contractNumber = this.parseOptionalContractNumber(payload?.contractNumber);
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

    if (contractPeriod) {
      const technical = this.parseTenantTechnical(
        payload?.paket,
        payload?.jumlah ?? payload?.contractCoreTotal,
        payload?.contractSharingRatio,
      );
      const billing = this.parseBillingSettings(payload);

      const contract = this.store.createPrimaryContract(createdCustomer.id, {
        contractNumber: contractNumber ?? null,
        startDate: contractPeriod.startDate,
        endDate: contractPeriod.endDate,
        coreType: technical.coreType,
        coreTotal: technical.coreTotal,
        sharingRatio: technical.sharingRatio,
        billingEvery: billing.billingEvery,
        billingUnit: billing.billingUnit,
      });

      const version = this.store.createContractVersion(createdCustomer.id, contract.id, {
        startDate: contractPeriod.startDate,
        endDate: contractPeriod.endDate,
        coreType: technical.coreType,
        coreTotal: technical.coreTotal,
        sharedCoreRatio: technical.sharingRatio,
        bakDocumentId: null,
      });

      if (Array.isArray(payload?.invoiceDrafts) && payload.invoiceDrafts.length > 0) {
        this.persistInvoiceDrafts(
          createdCustomer.id,
          contract.id,
          contract.contractNumber,
          version.id,
          payload?.invoiceDrafts,
        );
      } else {
        this.generateInvoicesForPeriod({
          customerId: createdCustomer.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          contractVersionId: version.id,
          periodStartDate: contractPeriod.startDate,
          periodEndDate: contractPeriod.endDate,
          billingEvery: billing.billingEvery,
          billingUnit: billing.billingUnit,
        });
      }
    }

    return this.getById(createdCustomer.id);
  }

  getById(customerId: number) {
    this.ensureCustomerExists(customerId);

    const customer = this.store.getCustomerById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const contracts = this.store.listCustomerContracts(customerId);
    const primaryContract = contracts[0] ?? null;
    const contractVersions = primaryContract
      ? this.store.listCustomerContractVersions(customerId, primaryContract.id)
      : [];
    const activeVersion = this.store.getActiveContractVersion(customerId);
    const isps = this.store.listCustomerIsps(customerId);
    const invoices = this.store.listCustomerInvoices(customerId);
    const documents = this.store.listCustomerDocuments(customerId);
    const contractSnapshot = this.buildCustomerContractSnapshot(customerId);
    const routeVersions = this.store.listCustomerRouteVersions(customerId);
    const activeRouteVersion = routeVersions[0] ?? null;
    const routeHistory = this.store.listCustomerRouteHistory(customerId);

    return {
      ...customer,
      isps: isps.map((isp) => ({
        id: isp.id,
        name: isp.name,
        status: isp.status,
      })),
      ...contractSnapshot,
      contracts,
      contractVersions,
      activeContractId: primaryContract?.id ?? null,
      activeContractVersionId: activeVersion?.id ?? null,
      invoices,
      latestDocuments: documents.slice(0, 5),
      route: {
        activeRouteId: activeRouteVersion?.id ?? null,
        activeFlowStatus: activeRouteVersion?.flowStatus ?? RouteFlowStatus.Aktif,
        points: activeRouteVersion?.points ?? [],
        versions: routeVersions,
        history: routeHistory,
      },
      todoSummary: this.store.buildCustomerTodoSummary(customerId),
      timelinePreview: this.store.listCustomerTimeline(customerId).slice(0, 5),
    };
  }

  update(customerId: number, payload: UpdateCustomerDto) {
    this.ensureCustomerExists(customerId);
    const existingCustomer = this.store.getCustomerById(customerId);

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const activationFeeLocked = Boolean(existingCustomer.activationFeePaidAt);

    if (activationFeeLocked) {
      if (
        payload.activationFeeAmount !== undefined
        && Number(payload.activationFeeAmount) !== existingCustomer.activationFeeAmount
      ) {
        throw new BadRequestException(
          'Biaya aktivasi sudah terbayar dan tidak dapat diubah lagi.',
        );
      }

      if (
        payload.activationFeePaidAt !== undefined
        && payload.activationFeePaidAt !== existingCustomer.activationFeePaidAt
      ) {
        throw new BadRequestException(
          'Tanggal pembayaran aktivasi sudah terkunci dan tidak dapat diubah.',
        );
      }
    }

    const updates: {
      name?: string;
      ispName?: string;
      status?: CustomerStatus;
      activationFeeAmount?: number;
      activationFeePaidAt?: string | null;
    } = {};

    if (payload.name !== undefined) {
      updates.name = this.normalizeRequiredString(payload.name, 'name');
    }

    if (payload.status !== undefined) {
      updates.status = this.parseStatus(payload.status);
    }

    if (payload.activationFeeAmount !== undefined && !activationFeeLocked) {
      updates.activationFeeAmount = this.parseActivationFeeAmount(payload.activationFeeAmount);
    }

    if (payload.activationFeePaidAt !== undefined && !activationFeeLocked) {
      updates.activationFeePaidAt = this.parseActivationFeePaidAt(payload.activationFeePaidAt);
    }

    const shouldUpdateMemberships =
      payload.ispName !== undefined
      || payload.ispIds !== undefined
      || payload.newIspNames !== undefined;

    if (shouldUpdateMemberships) {
      const nextIspIds = this.resolveIspIdsFromPayload(
        {
          ...payload,
          ispName: payload.ispName ?? existingCustomer.ispName,
        },
        {
          requireAtLeastOne: true,
        },
      );

      this.store.setCustomerIspMemberships(customerId, nextIspIds);

      const nextPrimaryIsp = this.store.listCustomerIsps(customerId)[0];
      if (nextPrimaryIsp) {
        updates.ispName = nextPrimaryIsp.name;
      }
    }

    if (Object.keys(updates).length > 0) {
      const updatedCustomer = this.store.updateCustomer(customerId, updates);
      if (!updatedCustomer) {
        throw new NotFoundException('Customer not found.');
      }
    }

    return this.getById(customerId);
  }

  createContract(customerId: number, payload: CreateCustomerContractDto) {
    this.ensureCustomerExists(customerId);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const contractPeriod = this.parseContractPeriod(payload?.startDate, payload?.endDate);

    if (!contractPeriod) {
      throw new BadRequestException('startDate and endDate are required.');
    }

    const existingContract = this.store.listCustomerContracts(customerId)[0];

    const technical = {
      coreType: this.parseCoreType(payload?.coreType) ?? existingContract?.coreType ?? CoreAllocationType.Core,
      coreTotal: this.parseCoreTotal(payload?.coreTotal, existingContract?.coreTotal ?? 4),
      sharingRatio: this.parseSharingRatio(
        payload?.sharedCoreRatio,
        existingContract?.sharingRatio ?? '1:2',
      ),
    };

    const billing = {
      billingEvery: this.parseBillingEvery(payload?.billingEvery, existingContract?.billingEvery ?? 1),
      billingUnit: this.parseBillingUnit(payload?.billingUnit, existingContract?.billingUnit ?? BillingUnit.Bulan),
    };

    const contract = existingContract
      ? this.store.updateCustomerContract(customerId, existingContract.id, {
        contractNumber: this.parseOptionalContractNumber(payload?.contractNumber) ?? existingContract.contractNumber,
        billingEvery: billing.billingEvery,
        billingUnit: billing.billingUnit,
      })
      : this.store.createPrimaryContract(customerId, {
        contractNumber: this.parseOptionalContractNumber(payload?.contractNumber) ?? undefined,
        startDate: contractPeriod.startDate,
        endDate: contractPeriod.endDate,
        coreType: technical.coreType,
        coreTotal: technical.coreTotal,
        sharingRatio: technical.coreType === CoreAllocationType.SharingCore
          ? technical.sharingRatio
          : null,
        billingEvery: billing.billingEvery,
        billingUnit: billing.billingUnit,
      });

    if (!contract) {
      throw new NotFoundException('Contract could not be prepared.');
    }

    const version = this.store.createContractVersion(customerId, contract.id, {
      startDate: contractPeriod.startDate,
      endDate: contractPeriod.endDate,
      coreType: technical.coreType,
      coreTotal: technical.coreTotal,
      sharedCoreRatio: technical.coreType === CoreAllocationType.SharingCore
        ? technical.sharingRatio
        : null,
      bakDocumentId: null,
    });

    return {
      contract: this.store.getCustomerContractById(customerId, contract.id),
      version,
    };
  }

  updateContract(
    customerId: number,
    contractId: number,
    payload: UpdateCustomerContractDto,
  ) {
    this.ensureCustomerExists(customerId);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const existingContract = this.store.getCustomerContractById(customerId, contractId);
    if (!existingContract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    const updates: {
      contractNumber?: string;
      startDate?: string;
      endDate?: string;
      status?: ContractStatus;
      coreType?: CoreAllocationType;
      coreTotal?: number;
      sharingRatio?: string | null;
      billingEvery?: number;
      billingUnit?: BillingUnit;
    } = {};

    if (payload.contractNumber !== undefined) {
      const normalizedContractNumber = this.normalizeRequiredString(
        payload.contractNumber,
        'contractNumber',
      );
      updates.contractNumber = normalizedContractNumber;
    }

    if (payload.startDate !== undefined) {
      updates.startDate = this.parseIsoDateString(payload.startDate, 'startDate');
    }

    if (payload.endDate !== undefined) {
      updates.endDate = this.parseIsoDateString(payload.endDate, 'endDate');
    }

    if (payload.status !== undefined) {
      updates.status = this.parseContractStatus(payload.status);
    }

    if (payload.coreType !== undefined) {
      updates.coreType = this.parseCoreType(payload.coreType) ?? existingContract.coreType;
    }

    if (payload.coreTotal !== undefined) {
      updates.coreTotal = this.parseCoreTotal(payload.coreTotal, existingContract.coreTotal);
    }

    if (payload.sharedCoreRatio !== undefined) {
      updates.sharingRatio = this.parseSharingRatio(
        payload.sharedCoreRatio,
        existingContract.sharingRatio ?? '1:2',
      );
    }

    if (payload.billingEvery !== undefined) {
      updates.billingEvery = this.parseBillingEvery(payload.billingEvery, existingContract.billingEvery);
    }

    if (payload.billingUnit !== undefined) {
      updates.billingUnit = this.parseBillingUnit(payload.billingUnit, existingContract.billingUnit);
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No valid fields provided for contract update.');
    }

    const nextStartDate = updates.startDate ?? existingContract.startDate;
    const nextEndDate = updates.endDate ?? existingContract.endDate;

    if (nextStartDate > nextEndDate) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate.',
      );
    }

    const updatedContract = this.store.updateCustomerContract(
      customerId,
      contractId,
      updates,
    );

    if (!updatedContract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    const billingChanged =
      (updates.billingEvery !== undefined && updates.billingEvery !== existingContract.billingEvery)
      || (updates.billingUnit !== undefined && updates.billingUnit !== existingContract.billingUnit);

    if (billingChanged) {
      this.restructureInvoicesForBillingChange(customerId, updatedContract);
    }

    const shouldCreateVersion =
      updates.startDate !== undefined
      || updates.endDate !== undefined
      || updates.coreType !== undefined
      || updates.coreTotal !== undefined
      || updates.sharingRatio !== undefined;

    let createdVersion: unknown = null;

    if (shouldCreateVersion) {
      createdVersion = this.store.createContractVersion(customerId, contractId, {
        startDate: nextStartDate,
        endDate: nextEndDate,
        coreType: updates.coreType ?? existingContract.coreType,
        coreTotal: updates.coreTotal ?? existingContract.coreTotal,
        sharedCoreRatio:
          (updates.coreType ?? existingContract.coreType) === CoreAllocationType.SharingCore
            ? updates.sharingRatio ?? existingContract.sharingRatio ?? '1:2'
            : null,
        bakDocumentId: null,
      });
    }

    return {
      contract: this.store.getCustomerContractById(customerId, contractId),
      version: createdVersion,
    };
  }

  listContractVersions(customerId: number, contractId: number) {
    this.ensureCustomerExists(customerId);

    const contract = this.store.getCustomerContractById(customerId, contractId);
    if (!contract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    return this.store.listCustomerContractVersions(customerId, contractId);
  }

  createContractVersion(
    customerId: number,
    contractId: number,
    payload: CreateContractVersionDto,
  ) {
    this.ensureCustomerExists(customerId);

    const contract = this.store.getCustomerContractById(customerId, contractId);
    if (!contract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    const startDate = this.parseIsoDateString(payload?.startDate, 'startDate');
    const endDate = this.parseIsoDateString(payload?.endDate, 'endDate');

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be less than or equal to endDate.');
    }

    const coreType = CoreAllocationType.SharingCore;
    const coreTotal = 1;
    const sharedCoreRatio = this.parseSharingRatio(
      payload?.sharedCoreRatio,
      contract.sharingRatio ?? '1:2',
    );

    const version = this.store.createContractVersion(customerId, contractId, {
      startDate,
      endDate,
      coreType,
      coreTotal,
      sharedCoreRatio,
      bakDocumentId:
        payload?.bakDocumentId !== undefined ? Number(payload.bakDocumentId) : null,
    });

    this.generateInvoicesForPeriod({
      customerId,
      contractId,
      contractNumber: contract.contractNumber,
      contractVersionId: version.id,
      periodStartDate: startDate,
      periodEndDate: endDate,
      billingEvery: contract.billingEvery,
      billingUnit: contract.billingUnit,
    });

    return version;
  }

  addContractVersionRenewalFollowUp(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { title?: string; description?: string },
  ) {
    this.ensureCustomerExists(customerId);
    const contract = this.store.getCustomerContractById(customerId, contractId);
    if (!contract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    const version = this.store.addManualContractVersionRenewalFollowUp(
      customerId,
      contractId,
      versionId,
      payload?.title,
      payload?.description,
    );
    if (!version) {
      throw new NotFoundException('Contract version not found for this customer.');
    }

    return version;
  }

  uploadContractVersionRenewalFile(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { fileUrl: string; fileName: string; followUpId?: number | null },
  ) {
    this.ensureCustomerExists(customerId);
    const version = this.store.uploadContractVersionRenewalFile(
      customerId,
      contractId,
      versionId,
      payload.fileUrl,
      payload.fileName,
      payload.followUpId,
    );
    if (!version) {
      throw new NotFoundException('Contract version not found for this customer.');
    }
    return version;
  }

  respondContractVersionRenewal(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { decision: 'lanjut' | 'tidak'; fileUrl: string; fileName: string; followUpId?: number | null },
  ) {
    this.ensureCustomerExists(customerId);
    if (!payload.decision || !['lanjut', 'tidak'].includes(payload.decision)) {
      throw new BadRequestException('Decision must be "lanjut" or "tidak".');
    }

    const version = this.store.respondContractVersionRenewal(
      customerId,
      contractId,
      versionId,
      payload.decision,
      payload.fileUrl,
      payload.fileName,
      payload.followUpId,
    );
    if (!version) {
      throw new NotFoundException('Contract version not found for this customer.');
    }
    return version;
  }

  updateInvoice(
    customerId: number,
    invoiceId: number,
    payload: UpdateCustomerInvoiceDto,
  ) {
    this.ensureCustomerExists(customerId);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const existingInvoice = this.store.getCustomerInvoiceById(customerId, invoiceId);
    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    const updates: {
      invoiceNumber?: string | null;
      followUpId?: number | null;
      invoiceFollowUps?: Array<{
        id: number;
        invoiceNumber?: string | null;
      }>;
      periodStartDate?: string | null;
      periodEndDate?: string | null;
      dueDate?: string | null;
      amount?: number;
      paidAt?: string | null;
      invoiceFileUrl?: string | null;
      paymentProofFileUrl?: string | null;
    } = {};

    if (payload.invoiceNumber !== undefined) {
      updates.invoiceNumber = this.parseOptionalContractNumber(payload.invoiceNumber);
    }

    if (payload.followUpId !== undefined) {
      const followUpId = Number(payload.followUpId);
      if (!Number.isFinite(followUpId)) {
        throw new BadRequestException('followUpId must be a valid number.');
      }

      updates.followUpId = followUpId;
    }

    if (payload.invoiceFollowUps !== undefined) {
      if (!Array.isArray(payload.invoiceFollowUps)) {
        throw new BadRequestException('invoiceFollowUps must be an array.');
      }

      updates.invoiceFollowUps = payload.invoiceFollowUps.map((item, index) => {
        const id = Number(item?.id);
        if (!Number.isFinite(id)) {
          throw new BadRequestException(`invoiceFollowUps[${index}].id must be a valid number.`);
        }

        return {
          id,
          invoiceNumber: item?.invoiceNumber !== undefined
            ? this.parseOptionalContractNumber(item.invoiceNumber)
            : undefined,
        };
      });
    }

    const nextPeriodStartDate = payload.periodStartDate !== undefined
      ? this.parseNullableIsoDateString(payload.periodStartDate, 'periodStartDate')
      : existingInvoice.periodStartDate ?? null;

    const nextPeriodEndDate = payload.periodEndDate !== undefined
      ? this.parseNullableIsoDateString(payload.periodEndDate, 'periodEndDate')
      : existingInvoice.periodEndDate ?? null;

    if (nextPeriodStartDate && nextPeriodEndDate && nextPeriodStartDate > nextPeriodEndDate) {
      throw new BadRequestException('periodStartDate must be less than or equal to periodEndDate.');
    }

    if (payload.periodStartDate !== undefined) {
      updates.periodStartDate = nextPeriodStartDate;
    }

    if (payload.periodEndDate !== undefined) {
      updates.periodEndDate = nextPeriodEndDate;
    }

    if (payload.dueDate !== undefined) {
      updates.dueDate = this.parseNullableIsoDateString(payload.dueDate, 'dueDate');
    }

    if (payload.amount !== undefined) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException('amount must be a non-negative number.');
      }

      updates.amount = Math.round(amount);
    }

    if (payload.invoiceFileUrl !== undefined) {
      updates.invoiceFileUrl = this.normalizeOptionalString(payload.invoiceFileUrl);
    }

    if (payload.paymentProofFileUrl !== undefined) {
      updates.paymentProofFileUrl = this.normalizeOptionalString(payload.paymentProofFileUrl);

      if (updates.paymentProofFileUrl && payload.paidAt === undefined) {
        updates.paidAt = new Date().toISOString().slice(0, 10);
      }

      if (!updates.paymentProofFileUrl && payload.paidAt === undefined) {
        updates.paidAt = null;
      }
    }

    if (payload.paidAt !== undefined) {
      updates.paidAt = this.parseNullableIsoDateString(payload.paidAt, 'paidAt');
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No valid fields provided for invoice update.');
    }

    const updatedInvoice = this.store.updateInvoice(customerId, invoiceId, updates);
    if (!updatedInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    return updatedInvoice;
  }

  addInvoiceFollowUp(
    customerId: number,
    invoiceId: number,
    payload: { title?: string; description?: string },
  ) {
    this.ensureCustomerExists(customerId);

    const existingInvoice = this.store.getCustomerInvoiceById(customerId, invoiceId);
    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    const updatedInvoice = this.store.addManualInvoiceFollowUp(
      customerId,
      invoiceId,
      this.normalizeOptionalString(payload?.title),
      this.normalizeOptionalString(payload?.description),
    );

    if (!updatedInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    return updatedInvoice;
  }

  addCustomerIsps(
    customerId: number,
    payload: {
      ispIds?: number[];
      ispNames?: string[];
    },
  ) {
    this.ensureCustomerExists(customerId);

    const nextIds = new Set<number>();

    if (Array.isArray(payload?.ispIds)) {
      payload.ispIds.forEach((value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          nextIds.add(parsed);
        }
      });
    }

    if (Array.isArray(payload?.ispNames)) {
      payload.ispNames
        .map((value) => this.normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value))
        .forEach((ispName) => {
          const isp = this.store.findOrCreateIspByName(ispName);
          nextIds.add(isp.id);
        });
    }

    if (nextIds.size === 0) {
      throw new BadRequestException('At least one ISP reference is required.');
    }

    this.store.addCustomerToIsps(customerId, Array.from(nextIds));

    return {
      customerId,
      isps: this.store.listCustomerIsps(customerId),
    };
  }

  removeCustomerIsps(
    customerId: number,
    payload: {
      mode: 'this' | 'all' | 'selected';
      ispId?: number;
      ispIds?: number[];
    },
  ) {
    this.ensureCustomerExists(customerId);

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    if (payload.mode === 'all') {
      const removed = this.store.removeCustomerFromAllIsps(customerId);
      return {
        mode: 'all',
        removed,
        isps: this.store.listCustomerIsps(customerId),
      };
    }

    if (payload.mode === 'this') {
      const ispId = Number(payload.ispId);
      if (!Number.isFinite(ispId)) {
        throw new BadRequestException('ispId is required when mode is this.');
      }

      const removed = this.store.removeCustomerFromIsp(customerId, ispId);
      return {
        mode: 'this',
        removed: removed ? 1 : 0,
        isps: this.store.listCustomerIsps(customerId),
      };
    }

    if (payload.mode === 'selected') {
      if (!Array.isArray(payload.ispIds) || payload.ispIds.length === 0) {
        throw new BadRequestException('ispIds is required when mode is selected.');
      }

      const removed = this.store.removeCustomerFromSelectedIsps(customerId, payload.ispIds);
      return {
        mode: 'selected',
        removed,
        isps: this.store.listCustomerIsps(customerId),
      };
    }

    throw new BadRequestException('mode must be this, all, or selected.');
  }

  getTodoSummary(customerId: number) {
    this.ensureCustomerExists(customerId);
    return this.store.buildCustomerTodoSummary(customerId);
  }

  getComplianceStatus(customerId: number) {
    this.ensureCustomerExists(customerId);
    return this.store.getCustomerComplianceStatus(customerId);
  }

  getTimeline(customerId: number) {
    this.ensureCustomerExists(customerId);
    return this.store.listCustomerTimeline(customerId);
  }

  getRoutes(customerId: number) {
    this.ensureCustomerExists(customerId);
    const versions = this.store.listCustomerRouteVersions(customerId);
    const activeVersion = versions[0] ?? null;
    const history = this.store.listCustomerRouteHistory(customerId);

    return {
      activeRouteId: activeVersion?.id ?? null,
      activeFlowStatus: activeVersion?.flowStatus ?? RouteFlowStatus.Aktif,
      points: activeVersion?.points ?? [],
      history,
    };
  }

  editRoute(
    customerId: number,
    payload: {
      operation: 'add' | 'update' | 'delete' | 'reorder' | 'status' | 'commit';
      pathName?: string;
      pointType?: unknown;
      note?: string | null;
      orderNumber?: number;
      pointId?: number;
      orderedPointIds?: number[];
      flowStatus?: unknown;
    },
  ) {
    this.ensureCustomerExists(customerId);
    const mutation = this.parseRouteMutationPayload(payload);

    if (mutation.operation === 'commit') {
      throw new BadRequestException('Use /routes/change for commit operation.');
    }

    return this.store.mutateCustomerRoute(customerId, mutation, {
      createNewVersion: false,
    });
  }

  changeRoute(
    customerId: number,
    payload: {
      operation: 'add' | 'update' | 'delete' | 'reorder' | 'status' | 'commit' | 'replace';
      pathName?: string;
      pointType?: unknown;
      note?: string | null;
      orderNumber?: number;
      pointId?: number;
      orderedPointIds?: number[];
      flowStatus?: unknown;
      changeNote?: string | null;
      snapshotBefore?: {
        flowStatus?: unknown;
        points?: Array<{
          orderNumber?: unknown;
          pathName?: unknown;
          pointType?: unknown;
          note?: unknown;
        }>;
      };
      snapshotAfter?: {
        flowStatus?: unknown;
        points?: Array<{
          orderNumber?: unknown;
          pathName?: unknown;
          pointType?: unknown;
          note?: unknown;
        }>;
      };
    },
  ) {
    this.ensureCustomerExists(customerId);
    const mutation = this.parseRouteMutationPayload(payload);
    const snapshotBeforeOverride = this.parseRouteSnapshot(payload?.snapshotBefore);
    const snapshotAfterOverride = this.parseRouteSnapshot(payload?.snapshotAfter);

    return this.store.mutateCustomerRoute(customerId, mutation, {
      createNewVersion: true,
      historyNote:
        this.normalizeOptionalString(payload?.changeNote)
        ?? 'Perubahan jalur dicatat melalui mode Ubah Jalur.',
      snapshotBeforeOverride,
      snapshotAfterOverride,
    });
  }

  deleteRouteHistory(customerId: number, historyId: number) {
    this.ensureCustomerExists(customerId);
    const deleted = this.store.deleteCustomerRouteHistory(customerId, historyId);
    if (!deleted) {
      throw new NotFoundException('Riwayat tidak ditemukan.');
    }
    return { success: true };
  }

  deleteAllRouteHistory(customerId: number) {
    this.ensureCustomerExists(customerId);
    const deletedCount = this.store.clearCustomerRouteHistory(customerId);
    return {
      success: true,
      deletedCount,
    };
  }

  private ensureCustomerExists(customerId: number): void {
    const customer = this.store.getCustomerById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
  }

  private normalizeRequiredString(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string.`);
    }

    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required.`);
    }

    return normalized;
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private parseStatus(value?: CustomerStatus): CustomerStatus {
    if (!value) {
      return CustomerStatus.Aktif;
    }

    if (value !== CustomerStatus.Aktif && value !== CustomerStatus.Nonaktif) {
      throw new BadRequestException('status must be aktif or nonaktif.');
    }

    return value;
  }

  private parseContractStatus(value: unknown): ContractStatus {
    if (
      value !== ContractStatus.Aktif
      && value !== ContractStatus.Expired
      && value !== ContractStatus.Terminated
    ) {
      throw new BadRequestException(
        'status must be aktif, expired, or terminated.',
      );
    }

    return value;
  }

  private parseRouteFlowStatus(value: unknown): RouteFlowStatus {
    if (
      value !== RouteFlowStatus.Aktif
      && value !== RouteFlowStatus.Nonaktif
      && value !== RouteFlowStatus.Gangguan
    ) {
      throw new BadRequestException('flowStatus must be aktif, nonaktif, or gangguan.');
    }

    return value;
  }

  private parseRoutePointType(value: unknown): RoutePointType {
    if (
      value !== RoutePointType.Awal
      && value !== RoutePointType.Transit
      && value !== RoutePointType.Tujuan
    ) {
      throw new BadRequestException('pointType must be awal, transit, or tujuan.');
    }

    return value;
  }

  private parseRouteMutationPayload(
    payload: {
      operation?: string;
      pathName?: string;
      pointType?: unknown;
      note?: string | null;
      orderNumber?: number;
      pointId?: number;
      orderedPointIds?: number[];
      flowStatus?: unknown;
    },
  ):
    | {
      operation: 'add';
      pathName: string;
      pointType: RoutePointType;
      note?: string | null;
      orderNumber?: number;
    }
    | {
      operation: 'update';
      pointId: number;
      pathName?: string;
      pointType?: RoutePointType;
      note?: string | null;
    }
    | {
      operation: 'delete';
      pointId: number;
    }
    | {
      operation: 'reorder';
      orderedPointIds: number[];
    }
    | {
      operation: 'status';
      flowStatus: RouteFlowStatus;
    }
    | {
      operation: 'commit';
    }
    | {
      operation: 'replace';
      flowStatus?: RouteFlowStatus;
      points: Array<{
        pathName: string;
        pointType: RoutePointType;
        note?: string | null;
        orderNumber: number;
      }>;
    } {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const operation = payload.operation;

    if (operation === 'add') {
      const pathName = this.normalizeRequiredString(payload.pathName, 'pathName');
      return {
        operation,
        pathName,
        pointType: this.parseRoutePointType(payload.pointType),
        note: this.normalizeOptionalString(payload.note),
        orderNumber: payload.orderNumber,
      };
    }

    if (operation === 'update') {
      const pointId = Number(payload.pointId);
      if (!Number.isFinite(pointId)) {
        throw new BadRequestException('pointId is required for update operation.');
      }

      const nextPayload: {
        operation: 'update';
        pointId: number;
        pathName?: string;
        pointType?: RoutePointType;
        note?: string | null;
      } = {
        operation,
        pointId,
      };

      if (payload.pathName !== undefined) {
        nextPayload.pathName = this.normalizeRequiredString(payload.pathName, 'pathName');
      }

      if (payload.pointType !== undefined) {
        nextPayload.pointType = this.parseRoutePointType(payload.pointType);
      }

      if (payload.note !== undefined) {
        nextPayload.note = this.normalizeOptionalString(payload.note);
      }

      if (
        nextPayload.pathName === undefined
        && nextPayload.pointType === undefined
        && nextPayload.note === undefined
      ) {
        throw new BadRequestException('At least one field must be provided for update operation.');
      }

      return nextPayload;
    }

    if (operation === 'delete') {
      const pointId = Number(payload.pointId);
      if (!Number.isFinite(pointId)) {
        throw new BadRequestException('pointId is required for delete operation.');
      }

      return {
        operation,
        pointId,
      };
    }

    if (operation === 'reorder') {
      if (!Array.isArray(payload.orderedPointIds) || payload.orderedPointIds.length === 0) {
        throw new BadRequestException('orderedPointIds is required for reorder operation.');
      }

      return {
        operation,
        orderedPointIds: payload.orderedPointIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      };
    }

    if (operation === 'status') {
      return {
        operation,
        flowStatus: this.parseRouteFlowStatus(payload.flowStatus),
      };
    }

    if (operation === 'commit') {
      return { operation };
    }

    if (operation === 'replace') {
      if (!Array.isArray(payload['points'])) {
        throw new BadRequestException('points array is required for replace operation.');
      }

      const flowStatus = payload['flowStatus'] !== undefined
        ? this.parseRouteFlowStatus(payload['flowStatus'])
        : undefined;

      const points = (payload['points'] as any[]).map((p, idx) => ({
        pathName: this.normalizeRequiredString(p.pathName, `points[${idx}].pathName`),
        pointType: this.parseRoutePointType(p.pointType),
        note: this.normalizeOptionalString(p.note),
        orderNumber: Number(p.orderNumber) || idx + 1,
      }));

      return {
        operation,
        flowStatus,
        points,
      };
    }

    throw new BadRequestException('operation must be add, update, delete, reorder, status, commit, or replace.');
  }

  private parseRouteSnapshot(
    value:
      | {
        flowStatus?: unknown;
        points?: Array<{
          orderNumber?: unknown;
          pathName?: unknown;
          pointType?: unknown;
          note?: unknown;
        }>;
      }
      | undefined,
  ):
    | {
      flowStatus: RouteFlowStatus;
      points: Array<{
        orderNumber: number;
        pathName: string;
        pointType: RoutePointType;
        note: string | null;
      }>;
    }
    | null {
    if (!value) {
      return null;
    }

    if (!Array.isArray(value.points)) {
      throw new BadRequestException('snapshot points must be an array.');
    }

    const flowStatus = this.parseRouteFlowStatus(value.flowStatus);
    const points = value.points.map((point, index) => {
      const orderNumber = Number(point?.orderNumber);
      if (!Number.isFinite(orderNumber) || orderNumber <= 0) {
        throw new BadRequestException(`snapshot points[${index}].orderNumber is invalid.`);
      }

      const pathName = this.normalizeRequiredString(point?.pathName, `snapshot points[${index}].pathName`);
      const pointType = this.parseRoutePointType(point?.pointType);
      const note = this.normalizeOptionalString(point?.note);

      return {
        orderNumber: Math.round(orderNumber),
        pathName,
        pointType,
        note,
      };
    });

    return {
      flowStatus,
      points,
    };
  }

  private parseActivationFeeAmount(
    value: unknown,
    fallback?: number,
  ): number {
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
      contractStartDate === undefined
      || contractStartDate === null
      || contractStartDate === ''
    );
    const hasEndDate = !(
      contractEndDate === undefined
      || contractEndDate === null
      || contractEndDate === ''
    );

    if (!hasStartDate && !hasEndDate) {
      return null;
    }

    if (!hasStartDate || !hasEndDate) {
      throw new BadRequestException(
        'contractStartDate and contractEndDate must be provided together.',
      );
    }

    const startDate = this.parseIsoDateString(contractStartDate, 'contractStartDate');
    const endDate = this.parseIsoDateString(contractEndDate, 'contractEndDate');

    if (startDate > endDate) {
      throw new BadRequestException(
        'contractStartDate must be less than or equal to contractEndDate.',
      );
    }

    return {
      startDate,
      endDate,
    };
  }

  private parseTenantTechnical(
    paket: unknown,
    jumlah: unknown,
    contractSharingRatio: unknown,
  ): { coreType: CoreAllocationType; coreTotal: number; sharingRatio: string | null } {
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

  private buildCustomerContractSnapshot(customerId: number): {
    paket: string | null;
    jumlah: number | string | null;
    contractSharingRatio: string | null;
    contractPeriodStart: string | null;
    contractPeriodEnd: string | null;
  } {
    const contract = this.store.listCustomerContracts(customerId)[0];
    const activeVersion = this.store.getActiveContractVersion(customerId);
    const latestVersion = contract
      ? this.store.getLatestContractVersion(contract.id)
      : undefined;
    const versionSnapshot = activeVersion ?? latestVersion;

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
      paket: versionSnapshot.coreType === CoreAllocationType.SharingCore ? 'shared core' : 'core',
      jumlah: versionSnapshot.coreType === CoreAllocationType.Core
        ? versionSnapshot.coreTotal
        : versionSnapshot.sharedCoreRatio,
      contractSharingRatio: versionSnapshot.sharedCoreRatio ?? null,
      contractPeriodStart: versionSnapshot.startDate,
      contractPeriodEnd: versionSnapshot.endDate,
    };
  }

  private parseCoreType(value: unknown): CoreAllocationType | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (value !== CoreAllocationType.Core && value !== CoreAllocationType.SharingCore) {
      throw new BadRequestException(
        'contractCoreType must be core or sharing_core.',
      );
    }

    return value;
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
        billingUnit: this.parseBillingUnit(payload?.billingCustomUnit, BillingUnit.Bulan),
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
      value !== BillingUnit.Hari
      && value !== BillingUnit.Bulan
      && value !== BillingUnit.Tahun
    ) {
      throw new BadRequestException('billingUnit must be hari, bulan, or tahun.');
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

  private parseNullableIsoDateString(value: unknown, fieldName: string): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return this.parseIsoDateString(value, fieldName);
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

  private persistInvoiceDrafts(
    customerId: number,
    contractId: number,
    contractNumber: string,
    contractVersionId: number,
    drafts?: CreateInvoiceDraftDto[],
  ): void {
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return;
    }

    drafts.forEach((draft, index) => {
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

      const paidAt = draft.paidAt ? this.parseIsoDateString(
        draft.paidAt,
        `invoiceDrafts[${index}].paidAt`,
      ) : null;

      this.store.upsertInvoice({
        customerId,
        contractId,
        contractVersionId,
        contractNumber,
        invoiceNumber: this.parseOptionalContractNumber(draft.invoiceNumber),
        periodMonth,
        periodYear,
        periodStartDate,
        periodEndDate,
        dueDate: addDays(periodEndDate, 10),
        amount,
        status: paidAt && draft.paymentProofFileUrl ? InvoiceStatus.Lunas : undefined,
        paidAt,
        documentId: null,
        invoiceFileUrl: draft.invoiceFileUrl ?? null,
        paymentProofFileUrl: draft.paymentProofFileUrl ?? null,
      });
    });
  }

  private generateInvoicesForPeriod(params: {
    customerId: number;
    contractId: number;
    contractNumber: string;
    contractVersionId: number;
    periodStartDate: string;
    periodEndDate: string;
    billingEvery: number;
    billingUnit: BillingUnit;
    scheduleVersion?: number;
    scheduleStatus?: 'active' | 'history';
  }): void {
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
      const invoiceEndDate = calculatedEnd < params.periodEndDate
        ? calculatedEnd
        : params.periodEndDate;
      const periodYear = Number(cursor.slice(0, 4));
      const periodMonth = Number(cursor.slice(5, 7));

      this.store.upsertInvoice({
        customerId: params.customerId,
        contractId: params.contractId,
        contractVersionId: params.contractVersionId,
        contractNumber: params.contractNumber,
        periodMonth,
        periodYear,
        periodStartDate: cursor,
        periodEndDate: invoiceEndDate,
        dueDate: addDays(invoiceEndDate, 10),
        amount: 0,
        scheduleVersion: params.scheduleVersion,
        scheduleStatus: params.scheduleStatus,
      });

      cursor = nextCursor;
    }
  }

  private restructureInvoicesForBillingChange(
    customerId: number,
    contract: {
      id: number;
      contractNumber: string;
      billingEvery: number;
      billingUnit: BillingUnit;
      startDate: string;
      endDate: string;
    },
  ): void {
    const invoices = this.store.listCustomerInvoices(customerId);
    const activeVersion = this.store.getActiveContractVersion(customerId)
      ?? this.store.getLatestContractVersion(contract.id);

    if (!activeVersion) {
      return;
    }

    const paidInvoices = invoices
      .filter((invoice) => invoice.scheduleStatus === 'active' && invoice.status === InvoiceStatus.Lunas)
      .sort((left, right) => {
        const leftEnd = left.periodEndDate ?? left.periodStartDate ?? '';
        const rightEnd = right.periodEndDate ?? right.periodStartDate ?? '';
        return leftEnd.localeCompare(rightEnd);
      });

    const unpaidActiveInvoices = invoices.filter(
      (invoice) => invoice.scheduleStatus === 'active' && invoice.status !== InvoiceStatus.Lunas,
    );

    if (unpaidActiveInvoices.length === 0) {
      return;
    }

    const lastPaidPeriodEnd = paidInvoices.at(-1)?.periodEndDate
      ?? paidInvoices.at(-1)?.periodStartDate
      ?? null;

    const restructureStartDate = lastPaidPeriodEnd
      ? addDays(lastPaidPeriodEnd, 1)
      : activeVersion.startDate;

    const restructureEndDate = activeVersion.endDate;

    if (restructureStartDate > restructureEndDate) {
      this.store.archiveCustomerInvoices(
        customerId,
        (invoice) => invoice.scheduleStatus === 'active' && invoice.status === InvoiceStatus.Lunas,
      );
      this.store.removeCustomerInvoices(
        customerId,
        (invoice) => invoice.scheduleStatus === 'active' && invoice.status !== InvoiceStatus.Lunas,
      );
      return;
    }

    const nextScheduleVersion = this.store.getNextInvoiceScheduleVersion(customerId);
    this.store.archiveCustomerInvoices(
      customerId,
      (invoice) => invoice.scheduleStatus === 'active' && invoice.status === InvoiceStatus.Lunas,
    );
    this.store.removeCustomerInvoices(
      customerId,
      (invoice) => invoice.scheduleStatus === 'active' && invoice.status !== InvoiceStatus.Lunas,
    );

    this.generateInvoicesForPeriod({
      customerId,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractVersionId: activeVersion.id,
      periodStartDate: restructureStartDate,
      periodEndDate: restructureEndDate,
      billingEvery: contract.billingEvery,
      billingUnit: contract.billingUnit,
      scheduleVersion: nextScheduleVersion,
      scheduleStatus: 'active',
    });
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

  private resolveIspIdsFromPayload(
    payload: {
      ispName?: unknown;
      ispIds?: unknown;
      newIspNames?: unknown;
    },
    options: {
      requireAtLeastOne: boolean;
    },
  ): number[] {
    const resolvedIds = new Set<number>();

    if (Array.isArray(payload?.ispIds)) {
      payload.ispIds.forEach((value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && this.store.getIspById(parsed)) {
          resolvedIds.add(parsed);
        }
      });
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

    newNames.forEach((name) => {
      const existingIsp = this.store.getIspByName(name);
      if (!existingIsp) {
        throw new BadRequestException(
          `ISP "${name}" belum terdaftar. Tambahkan ISP terlebih dahulu.`,
        );
      }

      resolvedIds.add(existingIsp.id);
    });

    if (options.requireAtLeastOne && resolvedIds.size === 0) {
      throw new BadRequestException('At least one ISP is required.');
    }

    return Array.from(resolvedIds);
  }
}
