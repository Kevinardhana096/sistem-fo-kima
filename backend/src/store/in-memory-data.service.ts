import { Injectable } from '@nestjs/common';
import {
  BillingUnit,
  Contract,
  ContractStatus,
  ContractVersion,
  CoreAllocationType,
  Customer,
  CustomerStatus,
  DocumentRecord,
  DocumentType,
  Invoice,
  InvoiceStatus,
  Isp,
  IspContractRow,
  IspPackageType,
  IspRenewalStatus,
  IspStatus,
  MonitoringAlert,
  MonitoringBillingRow,
  TenantIspMembership,
  TenantTodoCategory,
  TenantTodoItem,
  TenantTodoSummary,
  TimelineEvent,
} from '../shared/types/domain.types';

interface CreateCustomerInput {
  name: string;
  status: CustomerStatus;
  activationFeeAmount: number;
  activationFeePaidAt: string | null;
  ispName: string;
}

interface UpdateCustomerInput {
  name?: string;
  status?: CustomerStatus;
  activationFeeAmount?: number;
  activationFeePaidAt?: string | null;
  ispName?: string;
}

interface CreateIspInput {
  name: string;
  status: IspStatus;
  contractReference: string | null;
  contractStartDate?: string | null;
  contractPeriodStart?: string | null;
  contractPeriodEnd?: string | null;
  paket: IspPackageType;
  jumlah: number;
}

interface UpdateIspInput {
  name?: string;
  status?: IspStatus;
  contractReference?: string | null;
  contractStartDate?: string | null;
  contractPeriodStart?: string | null;
  contractPeriodEnd?: string | null;
  paket?: IspPackageType;
  jumlah?: number;
}

interface CreateContractInput {
  contractNumber?: string;
  startDate: string;
  endDate: string;
  coreType: CoreAllocationType;
  coreTotal: number;
  sharingRatio: string | null;
  billingEvery: number;
  billingUnit: BillingUnit;
}

interface UpdateContractInput {
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  coreType?: CoreAllocationType;
  coreTotal?: number;
  sharingRatio?: string | null;
  status?: ContractStatus;
  billingEvery?: number;
  billingUnit?: BillingUnit;
}

interface CreateContractVersionInput {
  startDate: string;
  endDate: string;
  coreType?: CoreAllocationType;
  coreTotal?: number;
  sharedCoreRatio?: string | null;
  bakDocumentId?: number | null;
}

interface UpsertInvoiceInput {
  customerId: number;
  contractId: number | null;
  contractVersionId?: number | null;
  contractNumber?: string | null;
  invoiceNumber?: string | null;
  periodMonth: number;
  periodYear: number;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  dueDate?: string | null;
  amount: number;
  status?: InvoiceStatus;
  documentId?: number | null;
  paidAt?: string | null;
  invoiceFileUrl?: string | null;
  paymentProofFileUrl?: string | null;
}

interface CreateDocumentInput {
  customerId: number;
  contractId: number | null;
  contractVersionId: number | null;
  contractNumber: string | null;
  jenisDokumen: DocumentType;
  nomorDokumen: string | null;
  tanggalDokumen: string;
  fileUrl: string;
}

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

const nowIso = (): string => new Date().toISOString();
const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const addDays = (value: string, days: number): string => {
  const next = parseDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return toIsoDate(next);
};

const addMonths = (value: string, months: number): string => {
  const next = parseDate(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return toIsoDate(next);
};

const addYears = (value: string, years: number): string => {
  const next = parseDate(value);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return toIsoDate(next);
};

const normalizeNameKey = (value: string): string => value.trim().toLowerCase();

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
export class InMemoryDataService {
  private readonly customers: Customer[] = [];
  private readonly isps: Isp[] = [];
  private readonly memberships: TenantIspMembership[] = [];
  private readonly contracts: Contract[] = [];
  private readonly contractVersions: ContractVersion[] = [];
  private readonly invoices: Invoice[] = [];
  private readonly documents: DocumentRecord[] = [];
  private readonly ispContractRows: IspContractRow[] = [];

  private nextCustomerId = 1;
  private nextIspId = 1;
  private nextMembershipId = 1;
  private nextContractId = 1;
  private nextContractVersionId = 1;
  private nextInvoiceId = 1;
  private nextDocumentId = 1;
  private nextIspContractRowId = 1;

  constructor() {
    this.seed();
  }

  listCustomers(): Customer[] {
    return this.customers
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((customer) => this.cloneCustomer(this.applyPrimaryIspToCustomer(customer)));
  }

  getCustomerById(customerId: number): Customer | undefined {
    const customer = this.customers.find((item) => item.id === customerId);
    if (!customer) {
      return undefined;
    }

    return this.cloneCustomer(this.applyPrimaryIspToCustomer(customer));
  }

  createCustomer(input: CreateCustomerInput): Customer {
    const createdAt = nowIso();
    const customer: Customer = {
      id: this.nextCustomerId,
      customerCode: buildCustomerCode(this.nextCustomerId),
      ispName: input.ispName,
      name: input.name,
      status: input.status,
      activationFeeAmount: input.activationFeeAmount,
      activationFeePaidAt: input.activationFeePaidAt,
      createdAt,
      updatedAt: createdAt,
    };

    this.nextCustomerId += 1;
    this.customers.push(customer);

    return this.cloneCustomer(customer);
  }

  updateCustomer(customerId: number, updates: UpdateCustomerInput): Customer | undefined {
    const customer = this.customers.find((item) => item.id === customerId);
    if (!customer) {
      return undefined;
    }

    if (updates.name !== undefined) {
      customer.name = updates.name;
    }

    if (updates.status !== undefined) {
      customer.status = updates.status;
    }

    if (updates.activationFeeAmount !== undefined) {
      customer.activationFeeAmount = updates.activationFeeAmount;
    }

    if (updates.activationFeePaidAt !== undefined) {
      customer.activationFeePaidAt = updates.activationFeePaidAt;
    }

    if (updates.ispName !== undefined) {
      customer.ispName = updates.ispName;
    }

    customer.updatedAt = nowIso();
    return this.cloneCustomer(this.applyPrimaryIspToCustomer(customer));
  }

  updateCustomerStatus(customerId: number, status: CustomerStatus): Customer | undefined {
    return this.updateCustomer(customerId, { status });
  }

  listIsps(): Isp[] {
    return this.isps
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((item) => this.cloneIsp(item));
  }

  getIspById(ispId: number): Isp | undefined {
    const isp = this.isps.find((item) => item.id === ispId);
    return isp ? this.cloneIsp(isp) : undefined;
  }

  getIspByName(name: string): Isp | undefined {
    const nameKey = normalizeNameKey(name);
    const isp = this.isps.find((item) => normalizeNameKey(item.name) === nameKey);
    return isp ? this.cloneIsp(isp) : undefined;
  }

  findOrCreateIspByName(name: string): Isp {
    const existing = this.getIspByName(name);
    if (existing) {
      return existing;
    }

    return this.createIsp({
      name,
      status: IspStatus.Aktif,
      contractReference: `AUTO-${Date.now()}`,
      contractStartDate: null,
      contractPeriodStart: null,
      contractPeriodEnd: null,
      paket: IspPackageType.Shared,
      jumlah: 0,
    });
  }

  createIsp(input: CreateIspInput): Isp {
    const createdAt = nowIso();
    const isp: Isp = {
      id: this.nextIspId,
      name: input.name,
      status: input.status,
      contractReference: input.contractReference,
      contractStartDate: input.contractStartDate ?? null,
      contractPeriodStart: input.contractPeriodStart ?? null,
      contractPeriodEnd: input.contractPeriodEnd ?? null,
      paket: input.paket,
      jumlah: input.jumlah,
      createdAt,
      updatedAt: createdAt,
    };

    this.nextIspId += 1;
    this.isps.push(isp);
    return this.cloneIsp(isp);
  }

  updateIsp(ispId: number, updates: UpdateIspInput): Isp | undefined {
    const isp = this.isps.find((item) => item.id === ispId);
    if (!isp) {
      return undefined;
    }

    if (updates.name !== undefined) {
      isp.name = updates.name;
    }

    if (updates.status !== undefined) {
      isp.status = updates.status;
    }

    if (updates.contractReference !== undefined) {
      isp.contractReference = updates.contractReference;
    }

    if (updates.contractStartDate !== undefined) {
      isp.contractStartDate = updates.contractStartDate;
    }

    if (updates.contractPeriodStart !== undefined) {
      isp.contractPeriodStart = updates.contractPeriodStart;
    }

    if (updates.contractPeriodEnd !== undefined) {
      isp.contractPeriodEnd = updates.contractPeriodEnd;
    }

    if (updates.paket !== undefined) {
      isp.paket = updates.paket;
    }

    if (updates.jumlah !== undefined) {
      isp.jumlah = updates.jumlah;
    }

    isp.updatedAt = nowIso();

    this.customers.forEach((customer) => {
      this.applyPrimaryIspToCustomer(customer);
    });

    return this.cloneIsp(isp);
  }

  listCustomerIspMemberships(customerId: number): TenantIspMembership[] {
    return this.memberships
      .filter((membership) => membership.customerId === customerId)
      .sort((left, right) => left.id - right.id)
      .map((membership) => this.cloneMembership(membership));
  }

  listCustomerIsps(customerId: number): Isp[] {
    const ispIdSet = new Set(
      this.memberships
        .filter((membership) => membership.customerId === customerId)
        .map((membership) => membership.ispId),
    );

    return this.isps
      .filter((isp) => ispIdSet.has(isp.id))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((isp) => this.cloneIsp(isp));
  }

  listIspTenants(ispId: number): Customer[] {
    const customerIds = new Set(
      this.memberships
        .filter((membership) => membership.ispId === ispId)
        .map((membership) => membership.customerId),
    );

    return this.customers
      .filter((customer) => customerIds.has(customer.id))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((customer) => this.cloneCustomer(this.applyPrimaryIspToCustomer(customer)));
  }

  setCustomerIspMemberships(customerId: number, ispIds: number[]): void {
    const uniqueIspIds = Array.from(
      new Set(
        ispIds
          .filter((value) => Number.isFinite(value))
          .map((value) => Number(value))
          .filter((value) => this.isps.some((isp) => isp.id === value)),
      ),
    );

    for (let index = this.memberships.length - 1; index >= 0; index -= 1) {
      if (this.memberships[index].customerId === customerId) {
        this.memberships.splice(index, 1);
      }
    }

    uniqueIspIds.forEach((ispId) => {
      const timestamp = nowIso();
      this.memberships.push({
        id: this.nextMembershipId,
        customerId,
        ispId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      this.nextMembershipId += 1;
    });

    const customer = this.customers.find((item) => item.id === customerId);
    if (customer) {
      this.applyPrimaryIspToCustomer(customer);
      customer.updatedAt = nowIso();
    }
  }

  addCustomerToIsps(customerId: number, ispIds: number[]): void {
    const existingIspIds = new Set(
      this.memberships
        .filter((membership) => membership.customerId === customerId)
        .map((membership) => membership.ispId),
    );

    const nextIspIds = Array.from(new Set(ispIds.map((value) => Number(value)))).filter(
      (value) => Number.isFinite(value) && this.isps.some((isp) => isp.id === value),
    );

    nextIspIds.forEach((ispId) => {
      if (existingIspIds.has(ispId)) {
        return;
      }

      const timestamp = nowIso();
      this.memberships.push({
        id: this.nextMembershipId,
        customerId,
        ispId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      this.nextMembershipId += 1;
    });

    const customer = this.customers.find((item) => item.id === customerId);
    if (customer) {
      this.applyPrimaryIspToCustomer(customer);
      customer.updatedAt = nowIso();
    }
  }

  removeCustomerFromIsp(customerId: number, ispId: number): boolean {
    const beforeLength = this.memberships.length;

    for (let index = this.memberships.length - 1; index >= 0; index -= 1) {
      const membership = this.memberships[index];
      if (membership.customerId === customerId && membership.ispId === ispId) {
        this.memberships.splice(index, 1);
      }
    }

    const changed = beforeLength !== this.memberships.length;
    if (changed) {
      const customer = this.customers.find((item) => item.id === customerId);
      if (customer) {
        this.applyPrimaryIspToCustomer(customer);
        customer.updatedAt = nowIso();
      }
    }

    return changed;
  }

  removeCustomerFromAllIsps(customerId: number): number {
    const beforeLength = this.memberships.length;

    for (let index = this.memberships.length - 1; index >= 0; index -= 1) {
      if (this.memberships[index].customerId === customerId) {
        this.memberships.splice(index, 1);
      }
    }

    const removedCount = beforeLength - this.memberships.length;

    const customer = this.customers.find((item) => item.id === customerId);
    if (customer) {
      customer.ispName = '-';
      customer.updatedAt = nowIso();
    }

    return removedCount;
  }

  removeCustomerFromSelectedIsps(customerId: number, ispIds: number[]): number {
    const ispIdSet = new Set(ispIds.map((value) => Number(value)));
    const beforeLength = this.memberships.length;

    for (let index = this.memberships.length - 1; index >= 0; index -= 1) {
      const membership = this.memberships[index];
      if (membership.customerId === customerId && ispIdSet.has(membership.ispId)) {
        this.memberships.splice(index, 1);
      }
    }

    const removedCount = beforeLength - this.memberships.length;
    if (removedCount > 0) {
      const customer = this.customers.find((item) => item.id === customerId);
      if (customer) {
        this.applyPrimaryIspToCustomer(customer);
        customer.updatedAt = nowIso();
      }
    }

    return removedCount;
  }

  listCustomerContracts(customerId: number): Contract[] {
    return this.contracts
      .filter((contract) => contract.customerId === customerId)
      .sort((left, right) => right.id - left.id)
      .map((contract) => this.cloneContract(contract));
  }

  getCustomerContractById(customerId: number, contractId: number): Contract | undefined {
    const contract = this.contracts.find(
      (item) => item.customerId === customerId && item.id === contractId,
    );

    return contract ? this.cloneContract(contract) : undefined;
  }

  createPrimaryContract(customerId: number, input: CreateContractInput): Contract {
    const existing = this.contracts.find((contract) => contract.customerId === customerId);
    if (existing) {
      return this.cloneContract(existing);
    }

    const now = nowIso();
    const createdContract: Contract = {
      id: this.nextContractId,
      customerId,
      contractNumber: input.contractNumber?.trim()
        ? input.contractNumber.trim()
        : buildContractNumber(this.nextContractId, parseDate(input.startDate).getUTCFullYear()),
      startDate: input.startDate,
      endDate: input.endDate,
      coreType: input.coreType,
      coreTotal: input.coreTotal,
      sharingRatio: input.coreType === CoreAllocationType.SharingCore
        ? input.sharingRatio ?? '1:2'
        : null,
      status: ContractStatus.Expired,
      billingEvery: input.billingEvery,
      billingUnit: input.billingUnit,
      createdAt: now,
      updatedAt: now,
    };

    this.nextContractId += 1;
    this.contracts.push(createdContract);

    return this.cloneContract(createdContract);
  }

  updateCustomerContract(
    customerId: number,
    contractId: number,
    updates: UpdateContractInput,
  ): Contract | undefined {
    const contract = this.contracts.find(
      (item) => item.customerId === customerId && item.id === contractId,
    );

    if (!contract) {
      return undefined;
    }

    if (updates.contractNumber !== undefined) {
      contract.contractNumber = updates.contractNumber;
    }

    if (updates.startDate !== undefined) {
      contract.startDate = updates.startDate;
    }

    if (updates.endDate !== undefined) {
      contract.endDate = updates.endDate;
    }

    if (updates.coreType !== undefined) {
      contract.coreType = updates.coreType;
    }

    if (updates.coreTotal !== undefined) {
      contract.coreTotal = updates.coreTotal;
    }

    if (updates.sharingRatio !== undefined) {
      contract.sharingRatio = updates.sharingRatio;
    }

    if (updates.billingEvery !== undefined) {
      contract.billingEvery = updates.billingEvery;
    }

    if (updates.billingUnit !== undefined) {
      contract.billingUnit = updates.billingUnit;
    }

    if (updates.status !== undefined) {
      contract.status = updates.status;
    }

    contract.updatedAt = nowIso();

    if (contract.status !== ContractStatus.Terminated) {
      this.refreshContractStatus(contract.id);
    }

    return this.cloneContract(contract);
  }

  getActiveContract(
    customerId: number,
    referenceDate = toIsoDate(new Date()),
  ): Contract | undefined {
    const contract = this.contracts.find((item) => item.customerId === customerId);
    if (!contract || contract.status === ContractStatus.Terminated) {
      return undefined;
    }

    const activeVersion = this.getActiveContractVersion(customerId, referenceDate);
    if (!activeVersion) {
      return undefined;
    }

    return this.cloneContract({
      ...contract,
      startDate: activeVersion.startDate,
      endDate: activeVersion.endDate,
      coreType: activeVersion.coreType,
      coreTotal: activeVersion.coreTotal,
      sharingRatio: activeVersion.sharedCoreRatio,
      status: ContractStatus.Aktif,
    });
  }

  terminateActiveContracts(customerId: number, terminatedAt: string): Contract[] {
    const contract = this.contracts.find((item) => item.customerId === customerId);
    if (!contract) {
      return [];
    }

    contract.status = ContractStatus.Terminated;
    contract.endDate = terminatedAt;
    contract.updatedAt = nowIso();

    const latestVersion = this.getLatestContractVersion(contract.id);
    if (latestVersion && latestVersion.endDate > terminatedAt) {
      latestVersion.endDate = terminatedAt;
      latestVersion.updatedAt = nowIso();
    }

    return [this.cloneContract(contract)];
  }

  extendActiveContract(
    customerId: number,
    extensionMonths: number,
    referenceDate: string,
  ): { contract: Contract; created: boolean } {
    let contract = this.contracts.find((item) => item.customerId === customerId);

    if (!contract) {
      const createdContract = this.createPrimaryContract(customerId, {
        contractNumber: undefined,
        startDate: referenceDate,
        endDate: addMonths(referenceDate, extensionMonths),
        coreType: CoreAllocationType.Core,
        coreTotal: 4,
        sharingRatio: null,
        billingEvery: 1,
        billingUnit: BillingUnit.Bulan,
      });
      return {
        contract: createdContract,
        created: true,
      };
    }

    const latestVersion = this.getLatestContractVersion(contract.id);

    if (latestVersion) {
      latestVersion.endDate = addMonths(latestVersion.endDate, extensionMonths);
      latestVersion.updatedAt = nowIso();
      contract.endDate = latestVersion.endDate;
      contract.updatedAt = nowIso();
      this.refreshContractStatus(contract.id);
      return {
        contract: this.cloneContract(contract),
        created: false,
      };
    }

    this.createContractVersion(customerId, contract.id, {
      startDate: referenceDate,
      endDate: addMonths(referenceDate, extensionMonths),
      coreType: contract.coreType,
      coreTotal: contract.coreTotal,
      sharedCoreRatio: contract.sharingRatio ?? null,
      bakDocumentId: null,
    });

    return {
      contract: this.cloneContract(contract),
      created: false,
    };
  }

  createContractRevision(customerId: number, startDate: string): Contract {
    let contract = this.contracts.find((item) => item.customerId === customerId);

    if (!contract) {
      contract = this.createPrimaryContract(customerId, {
        contractNumber: undefined,
        startDate,
        endDate: addYears(startDate, 1),
        coreType: CoreAllocationType.Core,
        coreTotal: 4,
        sharingRatio: null,
        billingEvery: 1,
        billingUnit: BillingUnit.Bulan,
      });
      return contract;
    }

    const latestVersion = this.getLatestContractVersion(contract.id);

    this.createContractVersion(customerId, contract.id, {
      startDate,
      endDate: addYears(startDate, 1),
      coreType: latestVersion?.coreType ?? contract.coreType,
      coreTotal: latestVersion?.coreTotal ?? contract.coreTotal,
      sharedCoreRatio: latestVersion?.sharedCoreRatio ?? contract.sharingRatio ?? null,
      bakDocumentId: null,
    });

    const refreshed = this.contracts.find((item) => item.id === contract.id);
    return this.cloneContract(refreshed ?? contract);
  }

  listCustomerContractVersions(customerId: number, contractId?: number): ContractVersion[] {
    return this.contractVersions
      .filter((version) => {
        if (version.customerId !== customerId) {
          return false;
        }

        if (contractId !== undefined && version.contractId !== contractId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (left.contractId === right.contractId) {
          return right.versionNumber - left.versionNumber;
        }

        return right.contractId - left.contractId;
      })
      .map((version) => this.cloneContractVersion(version));
  }

  getContractVersionById(versionId: number): ContractVersion | undefined {
    const version = this.contractVersions.find((item) => item.id === versionId);
    return version ? this.cloneContractVersion(version) : undefined;
  }

  getCustomerContractVersionById(
    customerId: number,
    contractId: number,
    versionId: number,
  ): ContractVersion | undefined {
    const version = this.contractVersions.find(
      (item) =>
        item.customerId === customerId && item.contractId === contractId && item.id === versionId,
    );

    return version ? this.cloneContractVersion(version) : undefined;
  }

  getLatestContractVersion(contractId: number): ContractVersion | undefined {
    const version = this.contractVersions
      .filter((item) => item.contractId === contractId)
      .sort((left, right) => right.versionNumber - left.versionNumber)[0];

    return version;
  }

  getActiveContractVersion(
    customerId: number,
    referenceDate = toIsoDate(new Date()),
  ): ContractVersion | undefined {
    const contract = this.contracts.find((item) => item.customerId === customerId);
    if (!contract || contract.status === ContractStatus.Terminated) {
      return undefined;
    }

    const versions = this.contractVersions
      .filter((item) => item.contractId === contract.id)
      .sort((left, right) => right.versionNumber - left.versionNumber);

    return versions.find(
      (version) =>
        version.bakDocumentId !== null
        && version.startDate <= referenceDate
        && version.endDate >= referenceDate,
    );
  }

  createContractVersion(
    customerId: number,
    contractId: number,
    input: CreateContractVersionInput,
  ): ContractVersion {
    const contract = this.contracts.find(
      (item) => item.id === contractId && item.customerId === customerId,
    );

    if (!contract) {
      throw new Error('Contract not found for customer.');
    }

    const latestVersion = this.getLatestContractVersion(contract.id);
    if (latestVersion && input.startDate <= latestVersion.startDate) {
      throw new Error('New contract version must start after the latest version start date.');
    }

    if (latestVersion && input.startDate <= latestVersion.endDate) {
      latestVersion.endDate = addDays(input.startDate, -1);
      latestVersion.updatedAt = nowIso();
    }

    const createdAt = nowIso();
    const createdVersion: ContractVersion = {
      id: this.nextContractVersionId,
      contractId: contract.id,
      customerId,
      versionNumber: latestVersion ? latestVersion.versionNumber + 1 : 1,
      startDate: input.startDate,
      endDate: input.endDate,
      coreType: input.coreType ?? latestVersion?.coreType ?? contract.coreType,
      coreTotal: input.coreTotal ?? latestVersion?.coreTotal ?? contract.coreTotal,
      sharedCoreRatio: input.coreType === CoreAllocationType.Core
        ? null
        : input.sharedCoreRatio
        ?? latestVersion?.sharedCoreRatio
        ?? contract.sharingRatio
        ?? '1:2',
      bakDocumentId: input.bakDocumentId ?? null,
      createdAt,
      updatedAt: createdAt,
    };

    this.nextContractVersionId += 1;
    this.contractVersions.push(createdVersion);
    contract.updatedAt = nowIso();

    this.refreshContractStatus(contract.id);

    return this.cloneContractVersion(createdVersion);
  }

  setContractVersionBak(
    contractId: number,
    versionId: number,
    bakDocumentId: number | null,
  ): ContractVersion | undefined {
    const version = this.contractVersions.find(
      (item) => item.contractId === contractId && item.id === versionId,
    );

    if (!version) {
      return undefined;
    }

    version.bakDocumentId = bakDocumentId;
    version.updatedAt = nowIso();

    this.refreshContractStatus(contractId);

    return this.cloneContractVersion(version);
  }

  upsertInvoice(input: UpsertInvoiceInput): { invoice: Invoice; created: boolean } {
    const existing = this.invoices.find(
      (invoice) =>
        invoice.customerId === input.customerId
        && invoice.periodMonth === input.periodMonth
        && invoice.periodYear === input.periodYear,
    );

    if (existing) {
      existing.contractId = input.contractId;
      existing.contractVersionId =
        input.contractVersionId !== undefined ? input.contractVersionId : existing.contractVersionId;
      existing.contractNumber =
        input.contractNumber !== undefined ? input.contractNumber : existing.contractNumber;

      if (input.invoiceNumber !== undefined) {
        existing.invoiceNumber = input.invoiceNumber;
      } else if (!existing.invoiceNumber) {
        existing.invoiceNumber = this.generateInvoiceNumber(
          existing.customerId,
          existing.periodYear,
          existing.periodMonth,
          existing.id,
        );
      }

      existing.periodStartDate =
        input.periodStartDate !== undefined ? input.periodStartDate : existing.periodStartDate;
      existing.periodEndDate =
        input.periodEndDate !== undefined ? input.periodEndDate : existing.periodEndDate;
      existing.dueDate = input.dueDate !== undefined ? input.dueDate : existing.dueDate;
      existing.amount = Number.isFinite(input.amount) ? Math.round(input.amount) : existing.amount;
      existing.documentId = input.documentId !== undefined ? input.documentId : existing.documentId;
      existing.paidAt = input.paidAt !== undefined ? input.paidAt : existing.paidAt;
      existing.invoiceFileUrl =
        input.invoiceFileUrl !== undefined ? input.invoiceFileUrl : existing.invoiceFileUrl;
      existing.paymentProofFileUrl =
        input.paymentProofFileUrl !== undefined
          ? input.paymentProofFileUrl
          : existing.paymentProofFileUrl;

      existing.status = input.status ?? this.deriveInvoiceStatus(existing);
      existing.updatedAt = nowIso();

      return {
        invoice: this.cloneInvoice(existing),
        created: false,
      };
    }

    const createdAt = nowIso();

    const createdInvoice: Invoice = {
      id: this.nextInvoiceId,
      customerId: input.customerId,
      invoiceNumber:
        input.invoiceNumber
        ?? this.generateInvoiceNumber(
          input.customerId,
          input.periodYear,
          input.periodMonth,
          this.nextInvoiceId,
        ),
      contractId: input.contractId,
      contractVersionId: input.contractVersionId ?? null,
      contractNumber: input.contractNumber ?? null,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      periodStartDate: input.periodStartDate ?? null,
      periodEndDate: input.periodEndDate ?? null,
      dueDate: input.dueDate ?? null,
      amount: Math.round(input.amount),
      status: InvoiceStatus.BelumDitagih,
      documentId: input.documentId ?? null,
      paidAt: input.paidAt ?? null,
      invoiceFileUrl: input.invoiceFileUrl ?? null,
      paymentProofFileUrl: input.paymentProofFileUrl ?? null,
      createdAt,
      updatedAt: createdAt,
    };

    createdInvoice.status = input.status ?? this.deriveInvoiceStatus(createdInvoice);

    this.nextInvoiceId += 1;
    this.invoices.push(createdInvoice);

    return {
      invoice: this.cloneInvoice(createdInvoice),
      created: true,
    };
  }

  updateInvoice(
    customerId: number,
    invoiceId: number,
    updates: Partial<Invoice>,
  ): Invoice | undefined {
    const invoice = this.invoices.find(
      (item) => item.id === invoiceId && item.customerId === customerId,
    );

    if (!invoice) {
      return undefined;
    }

    if (updates.invoiceNumber !== undefined) {
      invoice.invoiceNumber = updates.invoiceNumber;
    }

    if (updates.amount !== undefined) {
      invoice.amount = Math.round(Number(updates.amount));
    }

    if (updates.documentId !== undefined) {
      invoice.documentId = updates.documentId;
    }

    if (updates.contractId !== undefined) {
      invoice.contractId = updates.contractId;
    }

    if (updates.contractVersionId !== undefined) {
      invoice.contractVersionId = updates.contractVersionId;
    }

    if (updates.contractNumber !== undefined) {
      invoice.contractNumber = updates.contractNumber;
    }

    if (updates.periodStartDate !== undefined) {
      invoice.periodStartDate = updates.periodStartDate;
    }

    if (updates.periodEndDate !== undefined) {
      invoice.periodEndDate = updates.periodEndDate;
    }

    if (updates.dueDate !== undefined) {
      invoice.dueDate = updates.dueDate;
    }

    if (updates.paidAt !== undefined) {
      invoice.paidAt = updates.paidAt;
    }

    if (updates.invoiceFileUrl !== undefined) {
      invoice.invoiceFileUrl = updates.invoiceFileUrl;
    }

    if (updates.paymentProofFileUrl !== undefined) {
      invoice.paymentProofFileUrl = updates.paymentProofFileUrl;

      if (!updates.paymentProofFileUrl && updates.paidAt === undefined) {
        invoice.paidAt = null;
      }

      if (updates.paymentProofFileUrl && updates.paidAt === undefined) {
        invoice.paidAt = toIsoDate(new Date());
      }
    }

    invoice.status = updates.status ?? this.deriveInvoiceStatus(invoice);
    invoice.updatedAt = nowIso();

    return this.cloneInvoice(invoice);
  }

  listCustomerInvoices(customerId: number): Invoice[] {
    return this.invoices
      .filter((invoice) => invoice.customerId === customerId)
      .sort((left, right) => {
        if (left.periodYear === right.periodYear) {
          return right.periodMonth - left.periodMonth;
        }

        return right.periodYear - left.periodYear;
      })
      .map((invoice) => this.cloneInvoice(invoice));
  }

  getCustomerInvoiceById(customerId: number, invoiceId: number): Invoice | undefined {
    const invoice = this.invoices.find(
      (item) => item.customerId === customerId && item.id === invoiceId,
    );

    return invoice ? this.cloneInvoice(invoice) : undefined;
  }

  listCustomerDocuments(customerId: number, jenisDokumen?: DocumentType): DocumentRecord[] {
    return this.documents
      .filter(
        (document) =>
          document.customerId === customerId
          && (!jenisDokumen || document.jenisDokumen === jenisDokumen),
      )
      .sort(
        (left, right) => parseDate(right.tanggalDokumen).getTime() - parseDate(left.tanggalDokumen).getTime(),
      )
      .map((document) => this.cloneDocument(document));
  }

  findDocumentById(documentId: number): DocumentRecord | undefined {
    const document = this.documents.find((item) => item.id === documentId);
    return document ? this.cloneDocument(document) : undefined;
  }

  createDocument(input: CreateDocumentInput): DocumentRecord {
    const document: DocumentRecord = {
      id: this.nextDocumentId,
      customerId: input.customerId,
      contractId: input.contractId,
      contractVersionId: input.contractVersionId,
      contractNumber: input.contractNumber,
      jenisDokumen: input.jenisDokumen,
      nomorDokumen: input.nomorDokumen,
      tanggalDokumen: input.tanggalDokumen,
      fileUrl: input.fileUrl,
      createdAt: nowIso(),
    };

    this.nextDocumentId += 1;
    this.documents.push(document);

    return this.cloneDocument(document);
  }

  deleteCustomerDocument(customerId: number, documentId: number): boolean {
    const targetIndex = this.documents.findIndex(
      (document) => document.id === documentId && document.customerId === customerId,
    );

    if (targetIndex < 0) {
      return false;
    }

    this.documents.splice(targetIndex, 1);

    this.invoices.forEach((invoice) => {
      if (invoice.documentId === documentId) {
        invoice.documentId = null;
        invoice.invoiceFileUrl = null;
        invoice.status = this.deriveInvoiceStatus(invoice);
        invoice.updatedAt = nowIso();
      }
    });

    this.contractVersions.forEach((version) => {
      if (version.bakDocumentId === documentId) {
        version.bakDocumentId = null;
        version.updatedAt = nowIso();
        this.refreshContractStatus(version.contractId);
      }
    });

    return true;
  }

  getCustomerComplianceStatus(customerId: number): {
    hasContract: boolean;
    hasInvoiceCurrentMonth: boolean;
    contractExpiringIn30Days: boolean;
    hasTerminationDocument: boolean;
    hasActivationFeePaid: boolean;
    activationFeeAmount: number;
    activationFeePaidAt: string | null;
    warnings: string[];
    todoSummary: TenantTodoSummary;
  } {
    const customer = this.customers.find((item) => item.id === customerId);
    const today = toIsoDate(new Date());
    const nowDate = parseDate(today);
    const currentMonth = nowDate.getUTCMonth() + 1;
    const currentYear = nowDate.getUTCFullYear();

    const activeContract = this.getActiveContract(customerId, today);
    const activeVersion = this.getActiveContractVersion(customerId, today);

    const hasContract = Boolean(activeContract);

    const currentMonthInvoice = this.invoices.find(
      (invoice) =>
        invoice.customerId === customerId
        && invoice.periodMonth === currentMonth
        && invoice.periodYear === currentYear,
    );

    const hasInvoiceCurrentMonth = Boolean(
      currentMonthInvoice
      && currentMonthInvoice.invoiceFileUrl
      && currentMonthInvoice.paymentProofFileUrl,
    );

    const hasTerminationDocument = this.documents.some(
      (document) =>
        document.customerId === customerId && document.jenisDokumen === DocumentType.Pemutusan,
    );

    const hasActivationFeePaid = Boolean(customer?.activationFeePaidAt);
    const activationFeeAmount = Number(customer?.activationFeeAmount ?? 0);
    const activationFeePaidAt = customer?.activationFeePaidAt ?? null;

    const contractExpiringIn30Days = Boolean(
      activeVersion
      && Math.ceil(
        (parseDate(activeVersion.endDate).getTime() - nowDate.getTime())
        / (24 * 60 * 60 * 1000),
      ) <= 30
      && parseDate(activeVersion.endDate).getTime() >= nowDate.getTime(),
    );

    const todoSummary = this.buildCustomerTodoSummary(customerId, today);
    const warnings = [
      ...todoSummary.priority,
      ...todoSummary.needAction,
    ]
      .map((item) => item.message)
      .slice(0, 10);

    return {
      hasContract,
      hasInvoiceCurrentMonth,
      contractExpiringIn30Days,
      hasTerminationDocument,
      hasActivationFeePaid,
      activationFeeAmount,
      activationFeePaidAt,
      warnings,
      todoSummary,
    };
  }

  buildCustomerTodoSummary(
    customerId: number,
    referenceDate = toIsoDate(new Date()),
  ): TenantTodoSummary {
    const priority: TenantTodoItem[] = [];
    const needAction: TenantTodoItem[] = [];
    const info: TenantTodoItem[] = [];

    const contract = this.contracts.find((item) => item.customerId === customerId);
    const activeVersion = this.getActiveContractVersion(customerId, referenceDate);
    const latestVersion = contract ? this.getLatestContractVersion(contract.id) : undefined;

    const nowDate = parseDate(referenceDate);

    if (activeVersion) {
      const daysLeft = Math.ceil(
        (parseDate(activeVersion.endDate).getTime() - nowDate.getTime())
        / (24 * 60 * 60 * 1000),
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

    const overdueInvoices = this.invoices.filter((invoice) => {
      if (invoice.customerId !== customerId) {
        return false;
      }

      if (!invoice.invoiceFileUrl) {
        return false;
      }

      if (invoice.status === InvoiceStatus.Terlambat) {
        return true;
      }

      if (
        invoice.status !== InvoiceStatus.Lunas
        && invoice.dueDate
        && invoice.dueDate < referenceDate
      ) {
        return true;
      }

      return false;
    });

    if (overdueInvoices.length > 0) {
      const oldestDueDate = overdueInvoices
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

    const invoicesWithoutUpload = this.invoices.filter((invoice) => {
      if (invoice.customerId !== customerId) {
        return false;
      }

      if (invoice.invoiceFileUrl || !invoice.dueDate) {
        return false;
      }

      // Peringatan 1: H-7 sebelum jatuh tempo invoice.
      return addDays(invoice.dueDate, -7) <= referenceDate;
    });

    if (invoicesWithoutUpload.length > 0) {
      const nearestDueDate = invoicesWithoutUpload
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

    const pendingInvoices = this.invoices.filter((invoice) => {
      if (invoice.customerId !== customerId) {
        return false;
      }

      if (!invoice.invoiceFileUrl) {
        return false;
      }

      if (invoice.status === InvoiceStatus.Lunas || invoice.paymentProofFileUrl) {
        return false;
      }

      if (!invoice.dueDate) {
        return true;
      }

      return invoice.dueDate >= referenceDate;
    });

    if (pendingInvoices.length > 0) {
      const nearestDueDate = pendingInvoices
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

    const invoicesWithoutAmount = this.invoices.filter((invoice) => {
      if (invoice.customerId !== customerId) {
        return false;
      }

      return Number(invoice.amount ?? 0) <= 0;
    });

    if (invoicesWithoutAmount.length > 0) {
      const nearestDueDate = invoicesWithoutAmount
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

    const recentEvents = this.listCustomerTimeline(customerId).slice(0, 3);
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

  listCustomerTimeline(customerId: number): TimelineEvent[] {
    const documentEvents: TimelineEvent[] = this.documents
      .filter((document) => document.customerId === customerId)
      .map((document) => ({
        id: `document-${document.id}`,
        customerId,
        date: document.tanggalDokumen,
        type: 'document',
        title: `Dokumen ${document.jenisDokumen} diunggah`,
        description: document.nomorDokumen
          ? `No. ${document.nomorDokumen}`
          : 'Dokumen tanpa nomor.',
      }));

    const contractEvents: TimelineEvent[] = this.contracts
      .filter((contract) => contract.customerId === customerId)
      .map((contract) => ({
        id: `contract-${contract.id}`,
        customerId,
        date: contract.startDate,
        type: 'contract',
        title: `Kontrak induk ${contract.contractNumber}`,
        description: `Periode ${contract.startDate} s.d ${contract.endDate}`,
      }));

    const contractVersionEvents: TimelineEvent[] = this.contractVersions
      .filter((version) => version.customerId === customerId)
      .map((version) => ({
        id: `contract-version-${version.id}`,
        customerId,
        date: version.startDate,
        type: 'contract_version',
        title: `Versi kontrak #${version.versionNumber}`,
        description: version.bakDocumentId
          ? `Periode ${version.startDate} s.d ${version.endDate} (BAK tersedia)`
          : `Periode ${version.startDate} s.d ${version.endDate} (BAK belum tersedia)`,
      }));

    const invoiceEvents: TimelineEvent[] = this.invoices
      .filter((invoice) => invoice.customerId === customerId)
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        customerId,
        date: `${invoice.periodYear}-${String(invoice.periodMonth).padStart(2, '0')}-01`,
        type: 'invoice',
        title: `Invoice ${invoice.status}`,
        description: `${monthLabel[invoice.periodMonth]} ${invoice.periodYear} - Rp ${invoice.amount.toLocaleString('id-ID')}`,
      }));

    const paymentEvents: TimelineEvent[] = this.invoices
      .filter(
        (invoice) =>
          invoice.customerId === customerId
          && invoice.paidAt
          && invoice.paymentProofFileUrl,
      )
      .map((invoice) => ({
        id: `payment-${invoice.id}`,
        customerId,
        date: invoice.paidAt as string,
        type: 'payment',
        title: `Pembayaran invoice ${invoice.invoiceNumber ?? `#${invoice.id}`}`,
        description: `Pembayaran terkonfirmasi sebesar Rp ${invoice.amount.toLocaleString('id-ID')}`,
      }));

    return [...documentEvents, ...contractEvents, ...contractVersionEvents, ...invoiceEvents, ...paymentEvents]
      .sort((left, right) => parseDate(right.date).getTime() - parseDate(left.date).getTime());
  }

  getMonitoringBillingRows(
    year: number,
    filters?: {
      isp?: string;
      status?: InvoiceStatus;
    },
  ): MonitoringBillingRow[] {
    const rows = this.customers
      .filter((customer) => customer.status === CustomerStatus.Aktif)
      .map((customer) => {
        const customerIsps = this.listCustomerIsps(customer.id);
        const primaryIspName = customerIsps[0]?.name ?? customer.ispName ?? '-';

        const contract = this.contracts.find((item) => item.customerId === customer.id);
        const latestVersion = contract ? this.getLatestContractVersion(contract.id) : undefined;

        const months = Array.from({ length: 12 }, (_, monthIndex) => {
          const month = monthIndex + 1;
          const invoice = this.invoices.find(
            (item) =>
              item.customerId === customer.id
              && item.periodYear === year
              && item.periodMonth === month,
          );

          return invoice ? invoice.status : InvoiceStatus.BelumDitagih;
        });

        return {
          customerId: customer.id,
          customerCode: customer.customerCode,
          ispName: primaryIspName,
          ispNames: customerIsps.map((isp) => isp.name),
          customerName: customer.name,
          customerStatus: customer.status,
          activationFeeAmount: customer.activationFeeAmount,
          activationFeePaidAt: customer.activationFeePaidAt,
          contractStart: latestVersion?.startDate ?? contract?.startDate ?? null,
          contractEnd: latestVersion?.endDate ?? contract?.endDate ?? null,
          coreType: latestVersion?.coreType ?? contract?.coreType ?? null,
          coreTotal: latestVersion?.coreTotal ?? contract?.coreTotal ?? null,
          sharingRatio: latestVersion?.sharedCoreRatio ?? contract?.sharingRatio ?? null,
          months,
        } satisfies MonitoringBillingRow;
      });

    return rows.filter((row) => {
      const normalizedIspFilter = filters?.isp?.trim().toLowerCase();
      const ispMatch = normalizedIspFilter
        ? [row.ispName, ...(row.ispNames ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(normalizedIspFilter)
        : true;
      const statusMatch = filters?.status ? row.months.includes(filters.status) : true;
      return ispMatch && statusMatch;
    });
  }

  getMonitoringInsights(year: number): {
    year: number;
    months: Array<{
      month: number;
      revenuePaid: number;
      revenueProjected: number;
      activeRentals: number;
    }>;
    totals: {
      revenuePaid: number;
      revenueProjected: number;
      estimatedProfit: number;
      averageActiveRentals: number;
    };
  } {
    const months = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;

      const monthInvoices = this.invoices.filter(
        (invoice) => invoice.periodYear === year && invoice.periodMonth === month,
      );

      const revenueProjected = monthInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.amount ?? 0),
        0,
      );
      const revenuePaid = monthInvoices
        .filter((invoice) => invoice.status === InvoiceStatus.Lunas)
        .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);

      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0));

      const activeRentals = this.contractVersions.filter((version) => {
        if (version.bakDocumentId === null) {
          return false;
        }

        const contract = this.contracts.find((item) => item.id === version.contractId);
        if (!contract || contract.status === ContractStatus.Terminated) {
          return false;
        }

        const versionStart = parseDate(version.startDate);
        const versionEnd = parseDate(version.endDate);

        return versionStart.getTime() <= monthEnd.getTime()
          && versionEnd.getTime() >= monthStart.getTime();
      }).length;

      return {
        month,
        revenuePaid,
        revenueProjected,
        activeRentals,
      };
    });

    const revenuePaid = months.reduce((sum, item) => sum + item.revenuePaid, 0);
    const revenueProjected = months.reduce((sum, item) => sum + item.revenueProjected, 0);
    const estimatedProfit = Math.round(revenuePaid * 0.28);
    const averageActiveRentals = Math.round(
      months.reduce((sum, item) => sum + item.activeRentals, 0) / months.length,
    );

    return {
      year,
      months,
      totals: {
        revenuePaid,
        revenueProjected,
        estimatedProfit,
        averageActiveRentals,
      },
    };
  }

  getMonitoringAlerts(year: number): MonitoringAlert[] {
    const today = toIsoDate(new Date());
    const currentMonth = parseDate(today).getUTCMonth() + 1;
    const currentYear = parseDate(today).getUTCFullYear();

    const alerts: MonitoringAlert[] = [];

    this.customers.forEach((customer) => {
      if (customer.status !== CustomerStatus.Aktif) {
        return;
      }

      const todoSummary = this.buildCustomerTodoSummary(customer.id, today);
      const hasContract = Boolean(this.getActiveContract(customer.id, today));

      if (!hasContract) {
        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: 'missing_contract',
          severity: 'high',
          message: 'Tenant belum memiliki kontrak aktif yang tervalidasi BAK.',
        });
      }

      const hasCurrentMonthInvoice = this.invoices.some(
        (invoice) =>
          invoice.customerId === customer.id
          && invoice.periodYear === currentYear
          && invoice.periodMonth === currentMonth
          && invoice.invoiceFileUrl,
      );

      if (!hasCurrentMonthInvoice && year === currentYear) {
        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: 'missing_invoice_current_month',
          severity: 'medium',
          message: `Invoice bulan ${monthLabel[currentMonth]} belum tersedia untuk tenant ini.`,
        });
      }

      todoSummary.priority.forEach((item) => {
        const mappedCode = item.code === 'payment_overdue'
          ? 'payment_overdue'
          : 'contract_expiring';

        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: mappedCode,
          severity: item.code === 'payment_overdue' ? 'high' : 'medium',
          message: item.message,
        });
      });

      todoSummary.needAction.forEach((item) => {
        const mappedCode = item.code === 'bak_missing'
          ? 'bak_missing'
          : 'invoice_not_uploaded';

        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: mappedCode,
          severity: mappedCode === 'bak_missing' ? 'high' : 'medium',
          message: item.message,
        });
      });

      if (!customer.activationFeePaidAt && customer.activationFeeAmount > 0) {
        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: 'activation_fee_unpaid',
          severity: 'medium',
          message: `Biaya aktivasi belum dibayar (Rp ${customer.activationFeeAmount.toLocaleString('id-ID')}).`,
        });
      }

      const hasTerminationDocument = this.documents.some(
        (document) =>
          document.customerId === customer.id
          && document.jenisDokumen === DocumentType.Pemutusan,
      );

      if (hasTerminationDocument) {
        alerts.push({
          customerId: customer.id,
          customerName: customer.name,
          code: 'has_termination_document',
          severity: 'low',
          message: 'Dokumen pemutusan ditemukan. Perlu verifikasi lanjutan.',
        });
      }
    });

    return alerts;
  }

  // ── ISP Contract Row methods ──────────────────────────────────────────

  listIspContractRows(ispId: number): IspContractRow[] {
    return this.ispContractRows
      .filter((row) => row.ispId === ispId)
      .sort((a, b) => a.id - b.id)
      .map((row) => this.cloneIspContractRow(row));
  }

  getIspContractRowById(rowId: number): IspContractRow | undefined {
    const row = this.ispContractRows.find((item) => item.id === rowId);
    return row ? this.cloneIspContractRow(row) : undefined;
  }

  createIspContractRow(input: {
    ispId: number;
    contractReference: string;
    periodStart: string | null;
    periodEnd: string | null;
    renewalStatus?: IspRenewalStatus;
    bakFileUrl?: string | null;
    bakFileName?: string | null;
  }): IspContractRow {
    const now = nowIso();
    const row: IspContractRow = {
      id: this.nextIspContractRowId,
      ispId: input.ispId,
      contractReference: input.contractReference,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      renewalStatus: input.renewalStatus ?? IspRenewalStatus.Active,
      bakFileUrl: input.bakFileUrl ?? null,
      bakFileName: input.bakFileName ?? null,
      renewalFileUrl: null,
      renewalFileName: null,
      responseFileUrl: null,
      responseFileName: null,
      createdAt: now,
      updatedAt: now,
    };
    this.nextIspContractRowId += 1;
    this.ispContractRows.push(row);
    this.syncIspContractSnapshotFromRows(input.ispId);
    return this.cloneIspContractRow(row);
  }

  updateIspContractRow(
    rowId: number,
    updates: Partial<Pick<IspContractRow, 'contractReference' | 'periodStart' | 'periodEnd' | 'bakFileUrl' | 'bakFileName'>>,
  ): IspContractRow | undefined {
    const row = this.ispContractRows.find((item) => item.id === rowId);
    if (!row) return undefined;

    if (updates.contractReference !== undefined) row.contractReference = updates.contractReference;
    if (updates.periodStart !== undefined) row.periodStart = updates.periodStart;
    if (updates.periodEnd !== undefined) row.periodEnd = updates.periodEnd;
    if (updates.bakFileUrl !== undefined) row.bakFileUrl = updates.bakFileUrl;
    if (updates.bakFileName !== undefined) row.bakFileName = updates.bakFileName;
    row.updatedAt = nowIso();

    // If this row was needs_completion, check if enough data now
    if (row.renewalStatus === IspRenewalStatus.NeedsCompletion) {
      if (row.periodStart && row.periodEnd) {
        row.renewalStatus = IspRenewalStatus.Active;
      }
    }

    this.syncIspContractSnapshotFromRows(row.ispId);

    return this.cloneIspContractRow(row);
  }

  uploadIspContractBak(
    rowId: number,
    fileUrl: string,
    fileName: string,
  ): IspContractRow | undefined {
    const row = this.ispContractRows.find((item) => item.id === rowId);
    if (!row) return undefined;

    row.bakFileUrl = fileUrl;
    row.bakFileName = fileName;
    row.updatedAt = nowIso();
    this.syncIspContractSnapshotFromRows(row.ispId);
    return this.cloneIspContractRow(row);
  }

  uploadIspContractRenewalFile(
    rowId: number,
    fileUrl: string,
    fileName: string,
  ): IspContractRow | undefined {
    const row = this.ispContractRows.find((item) => item.id === rowId);
    if (!row) return undefined;

    row.renewalFileUrl = fileUrl;
    row.renewalFileName = fileName;
    row.renewalStatus = IspRenewalStatus.Pending;
    row.updatedAt = nowIso();
    this.syncIspContractSnapshotFromRows(row.ispId);
    return this.cloneIspContractRow(row);
  }

  respondIspContractRenewal(
    rowId: number,
    decision: 'lanjut' | 'tidak',
    responseFileUrl: string,
    responseFileName: string,
  ): { updatedRow: IspContractRow; newRow?: IspContractRow } {
    const row = this.ispContractRows.find((item) => item.id === rowId);
    if (!row) throw new Error('Contract row not found.');

    row.responseFileUrl = responseFileUrl;
    row.responseFileName = responseFileName;
    row.updatedAt = nowIso();

    if (decision === 'lanjut') {
      row.renewalStatus = IspRenewalStatus.Renewed;

      // Create new contract row with empty period (needs_completion)
      const newRow = this.createIspContractRow({
        ispId: row.ispId,
        contractReference: '',
        periodStart: null,
        periodEnd: null,
        renewalStatus: IspRenewalStatus.NeedsCompletion,
      });

      return {
        updatedRow: this.cloneIspContractRow(row),
        newRow,
      };
    }

    // decision === 'tidak'
    row.renewalStatus = IspRenewalStatus.Terminated;

    // Set ISP status to nonaktif
    const isp = this.isps.find((item) => item.id === row.ispId);
    if (isp) {
      isp.status = IspStatus.Nonaktif;
      isp.updatedAt = nowIso();
    }

    this.memberships
      .filter((membership) => membership.ispId === row.ispId)
      .forEach((membership) => {
        const customer = this.customers.find((item) => item.id === membership.customerId);
        if (!customer) {
          return;
        }

        customer.status = CustomerStatus.Nonaktif;
        customer.updatedAt = nowIso();
      });

    this.syncIspContractSnapshotFromRows(row.ispId);

    return {
      updatedRow: this.cloneIspContractRow(row),
    };
  }

  getIspOperationalSummary(ispId: number): {
    tenantCount: number;
    tenantsMissingBak: number;
    tenantsUnpaid: number;
    tenantsExpiringContract: number;
  } {
    const tenants = this.listIspTenants(ispId);
    const today = toIsoDate(new Date());

    let tenantsMissingBak = 0;
    let tenantsUnpaid = 0;
    let tenantsExpiringContract = 0;

    tenants.forEach((tenant) => {
      const contract = this.contracts.find((item) => item.customerId === tenant.id);
      const latestVersion = contract ? this.getLatestContractVersion(contract.id) : undefined;

      if (latestVersion && latestVersion.bakDocumentId === null) {
        tenantsMissingBak += 1;
      }

      const hasUnpaidInvoice = this.invoices.some(
        (invoice) =>
          invoice.customerId === tenant.id
          && (invoice.status === InvoiceStatus.BelumBayar
            || invoice.status === InvoiceStatus.Terlambat),
      );

      if (hasUnpaidInvoice) {
        tenantsUnpaid += 1;
      }

      const activeVersion = this.getActiveContractVersion(tenant.id, today);
      if (activeVersion) {
        const daysLeft = Math.ceil(
          (parseDate(activeVersion.endDate).getTime() - parseDate(today).getTime())
          / (24 * 60 * 60 * 1000),
        );

        if (daysLeft <= 90 && daysLeft >= 0) {
          tenantsExpiringContract += 1;
        }
      }
    });

    return {
      tenantCount: tenants.length,
      tenantsMissingBak,
      tenantsUnpaid,
      tenantsExpiringContract,
    };
  }

  private applyPrimaryIspToCustomer(customer: Customer): Customer {
    const customerMemberships = this.memberships
      .filter((membership) => membership.customerId === customer.id)
      .sort((left, right) => left.id - right.id);

    const primaryIsp = customerMemberships
      .map((membership) => this.isps.find((isp) => isp.id === membership.ispId))
      .find((isp): isp is Isp => Boolean(isp));

    customer.ispName = primaryIsp?.name ?? customer.ispName ?? '-';

    return customer;
  }

  private syncIspContractSnapshotFromRows(ispId: number): void {
    const isp = this.isps.find((item) => item.id === ispId);
    if (!isp) {
      return;
    }

    const latestRow = this.ispContractRows
      .filter((row) => row.ispId === ispId && row.renewalStatus !== IspRenewalStatus.Terminated)
      .sort((left, right) => right.id - left.id)[0];

    if (!latestRow) {
      return;
    }

    isp.contractReference = latestRow.contractReference?.trim() || null;
    isp.contractPeriodStart = latestRow.periodStart ?? null;
    isp.contractPeriodEnd = latestRow.periodEnd ?? null;

    if (!isp.contractStartDate && latestRow.periodStart) {
      isp.contractStartDate = latestRow.periodStart;
    }

    isp.updatedAt = nowIso();
  }

  private deriveInvoiceStatus(invoice: Partial<Invoice>): InvoiceStatus {
    const today = toIsoDate(new Date());

    if (invoice.paidAt && invoice.paymentProofFileUrl) {
      return InvoiceStatus.Lunas;
    }

    if (!invoice.invoiceFileUrl) {
      return InvoiceStatus.BelumDitagih;
    }

    if (invoice.dueDate && invoice.dueDate < today) {
      return InvoiceStatus.Terlambat;
    }

    return InvoiceStatus.BelumBayar;
  }

  private refreshContractStatus(contractId: number): void {
    const contract = this.contracts.find((item) => item.id === contractId);
    if (!contract || contract.status === ContractStatus.Terminated) {
      return;
    }

    const latestVersion = this.getLatestContractVersion(contract.id);

    if (!latestVersion) {
      contract.status = ContractStatus.Expired;
      contract.updatedAt = nowIso();
      return;
    }

    const today = toIsoDate(new Date());

    if (latestVersion.endDate < today) {
      contract.status = ContractStatus.Expired;
      contract.updatedAt = nowIso();
      return;
    }

    contract.status = latestVersion.bakDocumentId ? ContractStatus.Aktif : ContractStatus.Expired;
    contract.updatedAt = nowIso();
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

  private generateInvoiceNumber(
    customerId: number,
    periodYear: number,
    periodMonth: number,
    invoiceId: number,
  ): string {
    const customer = this.customers.find((item) => item.id === customerId);
    const customerCode = customer?.customerCode ?? `CUST-${customerId}`;
    return buildInvoiceNumber(customerCode, periodYear, periodMonth, invoiceId);
  }

  private seed(): void {
    const telkom = this.createIsp({
      name: 'TELKOM INDONESIA',
      status: IspStatus.Aktif,
      contractReference: 'CTR-INDUK-TELKOM-2026',
      paket: IspPackageType.Core,
      jumlah: 12,
    });
    const biznet = this.createIsp({
      name: 'BIZNET NETWORKS',
      status: IspStatus.Aktif,
      contractReference: 'CTR-INDUK-BIZNET-2026',
      paket: IspPackageType.Shared,
      jumlah: 8,
    });
    const indosat = this.createIsp({
      name: 'INDOSAT OOREDOO',
      status: IspStatus.Aktif,
      contractReference: 'CTR-INDUK-INDOSAT-2026',
      paket: IspPackageType.Shared,
      jumlah: 6,
    });
    const moratel = this.createIsp({
      name: 'MORATELINDO',
      status: IspStatus.Aktif,
      contractReference: 'CTR-INDUK-MORATEL-2026',
      paket: IspPackageType.Core,
      jumlah: 10,
    });
    const cbn = this.createIsp({
      name: 'CBN',
      status: IspStatus.Aktif,
      contractReference: 'CTR-INDUK-CBN-2026',
      paket: IspPackageType.Shared,
      jumlah: 4,
    });
    const myrepublic = this.createIsp({
      name: 'MYREPUBLIC',
      status: IspStatus.Nonaktif,
      contractReference: 'CTR-INDUK-MYREPUBLIC-2025',
      paket: IspPackageType.Shared,
      jumlah: 3,
    });

    // Seed ISP contract rows
    // ... (rest of the code)
    this.createIspContractRow({
      ispId: telkom.id,
      contractReference: 'CTR-INDUK-TELKOM-2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
    });
    this.createIspContractRow({
      ispId: biznet.id,
      contractReference: 'CTR-INDUK-BIZNET-2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    this.createIspContractRow({
      ispId: indosat.id,
      contractReference: 'CTR-INDUK-INDOSAT-2026',
      periodStart: '2025-07-01',
      periodEnd: '2026-06-28',
    });
    this.createIspContractRow({
      ispId: moratel.id,
      contractReference: 'CTR-INDUK-MORATEL-2026',
      periodStart: '2026-01-01',
      periodEnd: '2027-01-01',
    });
    this.createIspContractRow({
      ispId: cbn.id,
      contractReference: 'CTR-INDUK-CBN-2026',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    });
    this.createIspContractRow({
      ispId: myrepublic.id,
      contractReference: 'CTR-INDUK-MYREPUBLIC-2025',
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      renewalStatus: IspRenewalStatus.Terminated,
    });

    const customer1 = this.createCustomer({
      name: 'PT Teknologi Nusantara Sejahtera',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 3500000,
      activationFeePaidAt: '2026-01-10',
      ispName: telkom.name,
    });
    const customer2 = this.createCustomer({
      name: 'Grand Atrium Mall Management',
      status: CustomerStatus.Nonaktif,
      activationFeeAmount: 2500000,
      activationFeePaidAt: null,
      ispName: biznet.name,
    });
    const customer3 = this.createCustomer({
      name: 'Bank Syariah Indonesia Tbk',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 4200000,
      activationFeePaidAt: null,
      ispName: indosat.name,
    });
    const customer4 = this.createCustomer({
      name: 'PT Global Digital Niaga',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 3000000,
      activationFeePaidAt: '2025-12-29',
      ispName: biznet.name,
    });
    const customer5 = this.createCustomer({
      name: 'PT Sinar Teknologi Retail',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 2800000,
      activationFeePaidAt: null,
      ispName: moratel.name,
    });
    const customer6 = this.createCustomer({
      name: 'RS Permata Sehat Mandiri',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 3200000,
      activationFeePaidAt: '2026-02-15',
      ispName: cbn.name,
    });
    const customer7 = this.createCustomer({
      name: 'PT Kargo Cipta Logistik',
      status: CustomerStatus.Aktif,
      activationFeeAmount: 2750000,
      activationFeePaidAt: null,
      ispName: myrepublic.name,
    });

    this.setCustomerIspMemberships(customer1.id, [telkom.id, biznet.id]);
    this.setCustomerIspMemberships(customer2.id, [biznet.id]);
    this.setCustomerIspMemberships(customer3.id, [indosat.id, telkom.id]);
    this.setCustomerIspMemberships(customer4.id, [biznet.id]);
    this.setCustomerIspMemberships(customer5.id, [moratel.id]);
    this.setCustomerIspMemberships(customer6.id, [cbn.id]);
    this.setCustomerIspMemberships(customer7.id, [myrepublic.id, biznet.id]);

    const contract1 = this.createPrimaryContract(customer1.id, {
      contractNumber: 'CTR-NAJ-2025-022',
      startDate: '2025-07-01',
      endDate: '2026-06-30',
      coreType: CoreAllocationType.Core,
      coreTotal: 12,
      sharingRatio: null,
      billingEvery: 1,
      billingUnit: BillingUnit.Bulan,
    });

    const contract3 = this.createPrimaryContract(customer3.id, {
      contractNumber: 'CTR-BSI-2025-011',
      startDate: '2025-05-01',
      endDate: '2026-04-28',
      coreType: CoreAllocationType.SharingCore,
      coreTotal: 6,
      sharingRatio: '1:2',
      billingEvery: 1,
      billingUnit: BillingUnit.Bulan,
    });

    const contract4 = this.createPrimaryContract(customer4.id, {
      contractNumber: 'CTR-GDN-2025-019',
      startDate: '2025-11-01',
      endDate: '2026-10-31',
      coreType: CoreAllocationType.Core,
      coreTotal: 24,
      sharingRatio: null,
      billingEvery: 3,
      billingUnit: BillingUnit.Bulan,
    });

    const version11 = this.createContractVersion(customer1.id, contract1.id, {
      startDate: '2025-07-01',
      endDate: '2025-12-31',
      coreType: CoreAllocationType.Core,
      coreTotal: 12,
      sharedCoreRatio: null,
      bakDocumentId: null,
    });

    const version12 = this.createContractVersion(customer1.id, contract1.id, {
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      coreType: CoreAllocationType.SharingCore,
      coreTotal: 12,
      sharedCoreRatio: '2:3',
      bakDocumentId: null,
    });

    const version31 = this.createContractVersion(customer3.id, contract3.id, {
      startDate: '2025-05-01',
      endDate: '2026-04-28',
      coreType: CoreAllocationType.SharingCore,
      coreTotal: 6,
      sharedCoreRatio: '1:2',
      bakDocumentId: null,
    });

    const bakDoc11 = this.createDocument({
      customerId: customer1.id,
      contractId: contract1.id,
      contractVersionId: version11.id,
      contractNumber: contract1.contractNumber,
      jenisDokumen: DocumentType.BAK,
      nomorDokumen: 'BAK-TNS-2025-02',
      tanggalDokumen: '2025-07-05',
      fileUrl: 'https://files.example.com/bak/bak-tns-2025-02.pdf',
    });
    this.setContractVersionBak(contract1.id, version11.id, bakDoc11.id);

    const bakDoc31 = this.createDocument({
      customerId: customer3.id,
      contractId: contract3.id,
      contractVersionId: version31.id,
      contractNumber: contract3.contractNumber,
      jenisDokumen: DocumentType.BAK,
      nomorDokumen: 'BAK-BSI-2025-01',
      tanggalDokumen: '2025-05-03',
      fileUrl: 'https://files.example.com/bak/bak-bsi-2025-01.pdf',
    });
    this.setContractVersionBak(contract3.id, version31.id, bakDoc31.id);

    this.refreshContractStatus(contract1.id);
    this.refreshContractStatus(contract3.id);
    this.refreshContractStatus(contract4.id);

    this.terminateActiveContracts(customer2.id, '2025-11-15');
  }

  private cloneCustomer(customer: Customer): Customer {
    return { ...customer };
  }

  private cloneIsp(isp: Isp): Isp {
    return { ...isp };
  }

  private cloneIspContractRow(row: IspContractRow): IspContractRow {
    return { ...row };
  }

  private cloneMembership(membership: TenantIspMembership): TenantIspMembership {
    return { ...membership };
  }

  private cloneContract(contract: Contract): Contract {
    return { ...contract };
  }

  private cloneContractVersion(version: ContractVersion): ContractVersion {
    return { ...version };
  }

  private cloneInvoice(invoice: Invoice): Invoice {
    return { ...invoice };
  }

  private cloneDocument(document: DocumentRecord): DocumentRecord {
    return { ...document };
  }
}
