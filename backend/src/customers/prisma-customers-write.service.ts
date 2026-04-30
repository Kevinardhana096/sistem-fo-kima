import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BillingUnit,
  ContractStatus,
  CoreAllocationType,
  CustomerStatus,
  InvoiceFollowUpSource,
  InvoiceFollowUpStatus,
  InvoiceStatus,
  IspPackageType,
  IspRenewalFollowUpSource,
  IspRenewalFollowUpStatus,
  IspStatus,
  RouteFlowStatus,
} from '../shared/types/domain.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  CreateInvoiceDraftDto,
} from './dto/create-customer.dto';
import { CreateContractVersionDto } from './dto/create-contract-version.dto';
import { CreateCustomerContractDto } from './dto/create-customer-contract.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerContractDto } from './dto/update-customer-contract.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';
import {
  ChangeCustomerRouteDto,
  EditCustomerRouteDto,
} from './dto/route-mutations.dto';

type PrismaTx = Prisma.TransactionClient;
type PrismaExecutor = PrismaTx | PrismaService;
type ContractRenewalFollowUpRecord =
  Prisma.ContractVersionRenewalFollowUpGetPayload<object>;
type ContractRecord = Prisma.ContractGetPayload<object>;
type ContractVersionRecord = Prisma.ContractVersionGetPayload<object> & {
  renewalFollowUps?: ContractRenewalFollowUpRecord[];
};
type CustomerIspMembershipWithIsp = Prisma.CustomerIspMembershipGetPayload<{
  include: {
    isp: true;
  };
}>;
type ContractVersionWithRenewalFollowUps = Prisma.ContractVersionGetPayload<{
  include: {
    renewalFollowUps: {
      orderBy: {
        splitOrder: 'asc';
      };
    };
  };
}>;
type InvoiceWithFollowUps = Prisma.InvoiceGetPayload<{
  include: {
    followUps: {
      orderBy: {
        splitOrder: 'asc';
      };
    };
  };
}>;

const addDays = (value: string, days: number): string => {
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const toIsoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const toIsoTimestamp = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const buildCustomerCode = (customerId: number): string =>
  `CUST-${String(10000 + customerId).padStart(5, '0')}`;

const buildContractNumber = (
  contractId: number,
  contractYear: number,
): string => `CTR-${contractYear}-${String(contractId).padStart(4, '0')}`;

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

      if (
        Array.isArray(payload?.invoiceDrafts) &&
        payload.invoiceDrafts.length > 0
      ) {
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

  async update(
    customerId: number,
    payload: UpdateCustomerDto,
  ): Promise<number> {
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

  async archive(customerId: number): Promise<number> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        status: CustomerStatus.Arsip,
        updatedAt: new Date(),
      },
    });

    return customerId;
  }

  async createContract(customerId: number, payload: CreateCustomerContractDto) {
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const contractPeriod = this.parseContractPeriod(
      payload?.startDate,
      payload?.endDate,
    );

    if (!contractPeriod) {
      throw new BadRequestException('startDate and endDate are required.');
    }

    const existingContract = await this.prisma.contract.findFirst({
      where: { customerId },
      orderBy: { id: 'desc' },
    });

    const technical = {
      coreType:
        this.parseCoreType(payload?.coreType) ??
        (existingContract?.coreType as CoreAllocationType | undefined) ??
        CoreAllocationType.Core,
      coreTotal: this.parseCoreTotal(
        payload?.coreTotal,
        existingContract?.coreTotal ?? 4,
      ),
      sharingRatio: this.parseSharingRatio(
        payload?.sharedCoreRatio,
        existingContract?.sharingRatio ?? '1:2',
      ),
    };

    const billing = {
      billingEvery: this.parseBillingEvery(
        payload?.billingEvery,
        existingContract?.billingEvery ?? 1,
      ),
      billingUnit: this.parseBillingUnit(
        payload?.billingUnit,
        (existingContract?.billingUnit as BillingUnit | undefined) ??
          BillingUnit.Bulan,
      ),
    };

    return this.prisma.$transaction(async (tx) => {
      let contract = existingContract
        ? await tx.contract.update({
            where: { id: existingContract.id },
            data: {
              contractNumber:
                this.parseOptionalContractNumber(payload?.contractNumber) ??
                existingContract.contractNumber,
              billingEvery: billing.billingEvery,
              billingUnit: billing.billingUnit,
            },
          })
        : await tx.contract.create({
            data: {
              customerId,
              contractNumber:
                this.parseOptionalContractNumber(payload?.contractNumber) ??
                `TMP-CTR-${Date.now()}-${Math.round(Math.random() * 1000)}`,
              startDate: new Date(`${contractPeriod.startDate}T00:00:00.000Z`),
              endDate: new Date(`${contractPeriod.endDate}T00:00:00.000Z`),
              coreType: technical.coreType,
              coreTotal: technical.coreTotal,
              sharingRatio:
                technical.coreType === CoreAllocationType.SharingCore
                  ? technical.sharingRatio
                  : null,
              status: ContractStatus.Expired,
              billingEvery: billing.billingEvery,
              billingUnit: billing.billingUnit,
            },
          });

      if (!existingContract && !payload?.contractNumber) {
        contract = await tx.contract.update({
          where: { id: contract.id },
          data: {
            contractNumber: buildContractNumber(
              contract.id,
              Number(contractPeriod.startDate.slice(0, 4)),
            ),
          },
        });
      }

      const version = await this.createContractVersionRecord(tx, {
        customerId,
        contractId: contract.id,
        startDate: contractPeriod.startDate,
        endDate: contractPeriod.endDate,
        coreType: technical.coreType,
        coreTotal: technical.coreTotal,
        sharedCoreRatio:
          technical.coreType === CoreAllocationType.SharingCore
            ? technical.sharingRatio
            : null,
        bakDocumentId: null,
      });

      await this.refreshContractStatus(tx, contract.id);

      const refreshedContract = await tx.contract.findUniqueOrThrow({
        where: { id: contract.id },
      });

      return {
        contract: this.mapContract(refreshedContract),
        version: this.mapContractVersion(version),
      };
    });
  }

  async updateContract(
    customerId: number,
    contractId: number,
    payload: UpdateCustomerContractDto,
  ) {
    const existingContract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        customerId,
      },
    });

    if (!existingContract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
    });

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
      updates.contractNumber = this.normalizeRequiredString(
        payload.contractNumber,
        'contractNumber',
      );
    }

    if (payload.startDate !== undefined) {
      updates.startDate = this.parseIsoDateString(
        payload.startDate,
        'startDate',
      );
    }

    if (payload.endDate !== undefined) {
      updates.endDate = this.parseIsoDateString(payload.endDate, 'endDate');
    }

    if (payload.status !== undefined) {
      updates.status = this.parseContractStatus(payload.status);
    }

    if (payload.coreType !== undefined) {
      updates.coreType =
        this.parseCoreType(payload.coreType) ??
        (existingContract.coreType as CoreAllocationType);
    }

    if (payload.coreTotal !== undefined) {
      updates.coreTotal = this.parseCoreTotal(
        payload.coreTotal,
        existingContract.coreTotal,
      );
    }

    if (payload.sharedCoreRatio !== undefined) {
      updates.sharingRatio = this.parseSharingRatio(
        payload.sharedCoreRatio,
        existingContract.sharingRatio ?? '1:2',
      );
    }

    if (payload.billingEvery !== undefined) {
      updates.billingEvery = this.parseBillingEvery(
        payload.billingEvery,
        existingContract.billingEvery,
      );
    }

    if (payload.billingUnit !== undefined) {
      updates.billingUnit = this.parseBillingUnit(
        payload.billingUnit,
        existingContract.billingUnit as BillingUnit,
      );
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'No valid fields provided for contract update.',
      );
    }

    const nextStartDate =
      updates.startDate ?? toIsoDate(existingContract.startDate);
    const nextEndDate = updates.endDate ?? toIsoDate(existingContract.endDate);

    if (!nextStartDate || !nextEndDate || nextStartDate > nextEndDate) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          ...(updates.contractNumber !== undefined
            ? { contractNumber: updates.contractNumber }
            : {}),
          ...(updates.startDate !== undefined
            ? {
                startDate: new Date(`${updates.startDate}T00:00:00.000Z`),
              }
            : {}),
          ...(updates.endDate !== undefined
            ? {
                endDate: new Date(`${updates.endDate}T00:00:00.000Z`),
              }
            : {}),
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          ...(updates.coreType !== undefined
            ? { coreType: updates.coreType }
            : {}),
          ...(updates.coreTotal !== undefined
            ? { coreTotal: updates.coreTotal }
            : {}),
          ...(updates.sharingRatio !== undefined
            ? { sharingRatio: updates.sharingRatio }
            : {}),
          ...(updates.billingEvery !== undefined
            ? { billingEvery: updates.billingEvery }
            : {}),
          ...(updates.billingUnit !== undefined
            ? { billingUnit: updates.billingUnit }
            : {}),
        },
      });

      const billingChanged =
        (updates.billingEvery !== undefined &&
          updates.billingEvery !== existingContract.billingEvery) ||
        (updates.billingUnit !== undefined &&
          String(updates.billingUnit) !== existingContract.billingUnit);

      if (billingChanged) {
        await this.restructureInvoicesForBillingChange(tx, {
          customerId,
          customerCode: customer.customerCode,
          contractId,
          contractNumber: updatedContract.contractNumber,
          billingEvery: updatedContract.billingEvery,
          billingUnit: updatedContract.billingUnit as BillingUnit,
        });
      }

      const shouldCreateVersion =
        updates.startDate !== undefined ||
        updates.endDate !== undefined ||
        updates.coreType !== undefined ||
        updates.coreTotal !== undefined ||
        updates.sharingRatio !== undefined;

      let createdVersion: ContractVersionRecord | null = null;

      if (shouldCreateVersion) {
        const latestVersion = await tx.contractVersion.findFirst({
          where: { contractId },
          orderBy: { versionNumber: 'desc' },
        });

        if (
          latestVersion &&
          nextStartDate <= toIsoDate(latestVersion.startDate)!
        ) {
          createdVersion = await tx.contractVersion.update({
            where: { id: latestVersion.id },
            data: {
              startDate: new Date(`${nextStartDate}T00:00:00.000Z`),
              endDate: new Date(`${nextEndDate}T00:00:00.000Z`),
              coreType:
                updates.coreType ??
                (existingContract.coreType as CoreAllocationType),
              coreTotal: updates.coreTotal ?? existingContract.coreTotal,
              sharedCoreRatio:
                (updates.coreType ??
                  (existingContract.coreType as CoreAllocationType)) ===
                CoreAllocationType.SharingCore
                  ? (updates.sharingRatio ??
                    latestVersion.sharedCoreRatio ??
                    existingContract.sharingRatio ??
                    '1:2')
                  : null,
            },
          });
        } else {
          createdVersion = await this.createContractVersionRecord(tx, {
            customerId,
            contractId,
            startDate: nextStartDate,
            endDate: nextEndDate,
            coreType:
              updates.coreType ??
              (existingContract.coreType as CoreAllocationType),
            coreTotal: updates.coreTotal ?? existingContract.coreTotal,
            sharedCoreRatio:
              (updates.coreType ??
                (existingContract.coreType as CoreAllocationType)) ===
              CoreAllocationType.SharingCore
                ? (updates.sharingRatio ??
                  existingContract.sharingRatio ??
                  '1:2')
                : null,
            bakDocumentId: null,
          });
        }
      }

      await this.refreshContractStatus(tx, contractId);

      const refreshedContract = await tx.contract.findUniqueOrThrow({
        where: { id: contractId },
      });

      return {
        contract: this.mapContract(refreshedContract),
        version: createdVersion
          ? this.mapContractVersion(createdVersion)
          : null,
      };
    });
  }

  async listContractVersions(customerId: number, contractId: number) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        customerId,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    return contract.versions.map((version) => this.mapContractVersion(version));
  }

  async createContractVersion(
    customerId: number,
    contractId: number,
    payload: CreateContractVersionDto,
  ) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        customerId,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found for this customer.');
    }

    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
    });

    const startDate = this.parseIsoDateString(payload?.startDate, 'startDate');
    const endDate = this.parseIsoDateString(payload?.endDate, 'endDate');

    if (startDate > endDate) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate.',
      );
    }

    const coreType = CoreAllocationType.SharingCore;
    const coreTotal = 1;
    const sharedCoreRatio = this.parseSharingRatio(
      payload?.sharedCoreRatio,
      contract.sharingRatio ?? '1:2',
    );

    return this.prisma.$transaction(async (tx) => {
      const version = await this.createContractVersionRecord(tx, {
        customerId,
        contractId,
        startDate,
        endDate,
        coreType,
        coreTotal,
        sharedCoreRatio,
        bakDocumentId:
          payload?.bakDocumentId !== undefined
            ? Number(payload.bakDocumentId)
            : null,
      });

      await this.generateInvoicesForPeriod(tx, {
        customerId,
        customerCode: customer.customerCode,
        contractId,
        contractNumber: contract.contractNumber,
        contractVersionId: version.id,
        periodStartDate: startDate,
        periodEndDate: endDate,
        billingEvery: contract.billingEvery,
        billingUnit: contract.billingUnit as BillingUnit,
      });

      await this.refreshContractStatus(tx, contractId);
      return this.mapContractVersion(version);
    });
  }

  async addContractVersionRenewalFollowUp(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { title?: string; description?: string },
  ) {
    const version = await this.prisma.contractVersion.findFirst({
      where: {
        id: versionId,
        customerId,
        contractId,
      },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(
        'Contract version not found for this customer.',
      );
    }

    const hasInitialRenewalUpload = version.renewalFollowUps.some(
      (item) => item.renewalFileUrl,
    );
    if (!hasInitialRenewalUpload) {
      throw new BadRequestException(
        'Unggah berkas perpanjangan pertama terlebih dahulu sebelum menambah split.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const refreshed = await tx.contractVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          renewalFollowUps: {
            orderBy: { splitOrder: 'asc' },
          },
        },
      });

      const nextOrder =
        (refreshed.renewalFollowUps.at(-1)?.splitOrder ?? 0) + 1;
      await tx.contractVersionRenewalFollowUp.create({
        data: {
          versionId,
          splitOrder: nextOrder,
          source: IspRenewalFollowUpSource.Manual,
          triggerCode: null,
          title: payload.title?.trim() || `Split Manual ${nextOrder}`,
          description:
            payload.description?.trim() ||
            'Tindak lanjut manual ditambahkan oleh pengguna.',
          status: IspRenewalFollowUpStatus.Warning,
        },
      });

      await this.syncContractRenewalFollowUpsForVersion(tx, versionId);
      return this.getMappedContractVersion(tx, versionId);
    });
  }

  async uploadContractVersionRenewalFile(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { fileUrl: string; fileName: string; followUpId?: number | null },
  ) {
    if (!payload.fileUrl) {
      throw new BadRequestException('Renewal file is required.');
    }

    const version = await this.prisma.contractVersion.findFirst({
      where: {
        id: versionId,
        customerId,
        contractId,
      },
    });

    if (!version) {
      throw new NotFoundException(
        'Contract version not found for this customer.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const followUp = await this.resolveTargetContractFollowUp(
        tx,
        versionId,
        payload.followUpId,
      );

      await tx.contractVersionRenewalFollowUp.update({
        where: { id: followUp.id },
        data: {
          renewalFileUrl: payload.fileUrl,
          renewalFileName: payload.fileName,
          status: IspRenewalFollowUpStatus.PendingResponse,
        },
      });

      await this.syncContractRenewalFollowUpsForVersion(tx, versionId);
      return this.getMappedContractVersion(tx, versionId);
    });
  }

  async respondContractVersionRenewal(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: {
      decision: 'lanjut' | 'tidak';
      fileUrl: string;
      fileName: string;
      followUpId?: number | null;
    },
  ) {
    const version = await this.prisma.contractVersion.findFirst({
      where: {
        id: versionId,
        customerId,
        contractId,
      },
    });

    if (!version) {
      throw new NotFoundException(
        'Contract version not found for this customer.',
      );
    }

    if (!payload.decision || !['lanjut', 'tidak'].includes(payload.decision)) {
      throw new BadRequestException('Decision must be "lanjut" or "tidak".');
    }

    if (!payload.fileUrl) {
      throw new BadRequestException('Response file is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const followUp = await this.resolveTargetContractFollowUp(
        tx,
        versionId,
        payload.followUpId,
      );

      await tx.contractVersionRenewalFollowUp.update({
        where: { id: followUp.id },
        data: {
          responseFileUrl: payload.fileUrl,
          responseFileName: payload.fileName,
          responseDecision: payload.decision,
          status: IspRenewalFollowUpStatus.Completed,
        },
      });

      await this.syncContractRenewalFollowUpsForVersion(tx, versionId);
      return this.getMappedContractVersion(tx, versionId);
    });
  }

  async addCustomerIsps(
    customerId: number,
    payload: {
      ispIds?: number[];
      ispNames?: string[];
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const nextIds = new Set<number>();

    if (Array.isArray(payload?.ispIds)) {
      payload.ispIds.forEach((value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          nextIds.add(parsed);
        }
      });
    }

    const normalizedNames = Array.isArray(payload?.ispNames)
      ? payload.ispNames
          .map((value) => this.normalizeOptionalString(value))
          .filter((value): value is string => Boolean(value))
      : [];

    return this.prisma.$transaction(async (tx) => {
      for (const ispName of normalizedNames) {
        const existingIsp = await tx.isp.findFirst({
          where: { name: { equals: ispName, mode: 'insensitive' } },
        });

        if (existingIsp) {
          nextIds.add(existingIsp.id);
          continue;
        }

        const createdIsp = await tx.isp.create({
          data: {
            name: ispName,
            status: IspStatus.Aktif,
            contractReference: `AUTO-${Date.now()}`,
            contractStartDate: null,
            contractPeriodStart: null,
            contractPeriodEnd: null,
            paket: IspPackageType.Shared,
            jumlah: 0,
            billingPeriodMode: null,
            billingCustomEvery: null,
            billingCustomUnit: null,
            activationFeeAmount: 0,
            activationFeePaidAt: null,
          },
        });
        nextIds.add(createdIsp.id);
      }

      if (nextIds.size === 0) {
        throw new BadRequestException(
          'At least one ISP reference is required.',
        );
      }

      const existingMemberships = await tx.customerIspMembership.findMany({
        where: { customerId },
        select: { ispId: true },
      });
      const existingIspIds = new Set(
        existingMemberships.map((item) => item.ispId),
      );

      const validIsps = await tx.isp.findMany({
        where: {
          id: { in: Array.from(nextIds) },
        },
        orderBy: { name: 'asc' },
      });

      for (const isp of validIsps) {
        if (existingIspIds.has(isp.id)) {
          continue;
        }

        await tx.customerIspMembership.create({
          data: {
            customerId,
            ispId: isp.id,
          },
        });
      }

      await this.syncPrimaryIspForCustomer(tx, customerId);

      return {
        customerId,
        isps: await this.listCustomerIsps(tx, customerId),
      };
    });
  }

  async removeCustomerIsps(
    customerId: number,
    payload: {
      mode: 'this' | 'all' | 'selected';
      ispId?: number;
      ispIds?: number[];
    },
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (payload.mode === 'all') {
        const removed = await tx.customerIspMembership.deleteMany({
          where: { customerId },
        });
        await this.syncPrimaryIspForCustomer(tx, customerId);
        return {
          mode: 'all',
          removed: removed.count,
          isps: await this.listCustomerIsps(tx, customerId),
        };
      }

      if (payload.mode === 'this') {
        const ispId = Number(payload.ispId);
        if (!Number.isFinite(ispId)) {
          throw new BadRequestException('ispId is required when mode is this.');
        }

        const removed = await tx.customerIspMembership.deleteMany({
          where: { customerId, ispId },
        });
        await this.syncPrimaryIspForCustomer(tx, customerId);
        return {
          mode: 'this',
          removed: removed.count,
          isps: await this.listCustomerIsps(tx, customerId),
        };
      }

      if (payload.mode === 'selected') {
        if (!Array.isArray(payload.ispIds) || payload.ispIds.length === 0) {
          throw new BadRequestException(
            'ispIds is required when mode is selected.',
          );
        }

        const selectedIds = payload.ispIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));

        const removed = await tx.customerIspMembership.deleteMany({
          where: {
            customerId,
            ispId: { in: selectedIds },
          },
        });
        await this.syncPrimaryIspForCustomer(tx, customerId);
        return {
          mode: 'selected',
          removed: removed.count,
          isps: await this.listCustomerIsps(tx, customerId),
        };
      }

      throw new BadRequestException('mode must be this, all, or selected.');
    });
  }

  async updateInvoice(
    customerId: number,
    invoiceId: number,
    payload: UpdateCustomerInvoiceDto,
  ) {
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId,
      },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
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
      updates.invoiceNumber = this.parseOptionalContractNumber(
        payload.invoiceNumber,
      );
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
          throw new BadRequestException(
            `invoiceFollowUps[${index}].id must be a valid number.`,
          );
        }

        return {
          id,
          invoiceNumber:
            item?.invoiceNumber !== undefined
              ? this.parseOptionalContractNumber(item.invoiceNumber)
              : undefined,
        };
      });
    }

    const nextPeriodStartDate =
      payload.periodStartDate !== undefined
        ? this.parseNullableIsoDateString(
            payload.periodStartDate,
            'periodStartDate',
          )
        : (toIsoDate(existingInvoice.periodStartDate) ?? null);

    const nextPeriodEndDate =
      payload.periodEndDate !== undefined
        ? this.parseNullableIsoDateString(
            payload.periodEndDate,
            'periodEndDate',
          )
        : (toIsoDate(existingInvoice.periodEndDate) ?? null);

    if (
      nextPeriodStartDate &&
      nextPeriodEndDate &&
      nextPeriodStartDate > nextPeriodEndDate
    ) {
      throw new BadRequestException(
        'periodStartDate must be less than or equal to periodEndDate.',
      );
    }

    if (payload.periodStartDate !== undefined) {
      updates.periodStartDate = nextPeriodStartDate;
    }

    if (payload.periodEndDate !== undefined) {
      updates.periodEndDate = nextPeriodEndDate;
    }

    if (payload.dueDate !== undefined) {
      updates.dueDate = this.parseNullableIsoDateString(
        payload.dueDate,
        'dueDate',
      );
    }

    if (payload.amount !== undefined) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException('amount must be a non-negative number.');
      }

      updates.amount = Math.round(amount);
    }

    if (payload.invoiceFileUrl !== undefined) {
      updates.invoiceFileUrl = this.normalizeOptionalString(
        payload.invoiceFileUrl,
      );
    }

    if (payload.paymentProofFileUrl !== undefined) {
      updates.paymentProofFileUrl = this.normalizeOptionalString(
        payload.paymentProofFileUrl,
      );

      if (updates.paymentProofFileUrl && payload.paidAt === undefined) {
        updates.paidAt = new Date().toISOString().slice(0, 10);
      }

      if (!updates.paymentProofFileUrl && payload.paidAt === undefined) {
        updates.paidAt = null;
      }
    }

    if (payload.paidAt !== undefined) {
      updates.paidAt = this.parseNullableIsoDateString(
        payload.paidAt,
        'paidAt',
      );
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException(
        'No valid fields provided for invoice update.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (Array.isArray(updates.invoiceFollowUps)) {
        for (const followUpUpdate of updates.invoiceFollowUps) {
          const followUp = await tx.invoiceFollowUp.findFirst({
            where: {
              id: followUpUpdate.id,
              invoiceId,
            },
          });
          if (!followUp) {
            continue;
          }

          if (followUpUpdate.invoiceNumber !== undefined) {
            await tx.invoiceFollowUp.update({
              where: { id: followUp.id },
              data: {
                invoiceNumber: followUpUpdate.invoiceNumber,
              },
            });
          }
        }
      }

      if (
        updates.invoiceNumber !== undefined ||
        updates.invoiceFileUrl !== undefined
      ) {
        const followUp = await this.resolveTargetInvoiceFollowUp(
          tx,
          invoiceId,
          updates.followUpId,
        );

        await tx.invoiceFollowUp.update({
          where: { id: followUp.id },
          data: {
            ...(updates.invoiceNumber !== undefined
              ? { invoiceNumber: updates.invoiceNumber }
              : {}),
            ...(updates.invoiceFileUrl !== undefined
              ? {
                  invoiceFileUrl: updates.invoiceFileUrl,
                  status: updates.invoiceFileUrl
                    ? InvoiceFollowUpStatus.Sent
                    : InvoiceFollowUpStatus.Warning,
                }
              : {}),
          },
        });
      }

      if (updates.paymentProofFileUrl !== undefined) {
        const invoiceWithFollowUps = await tx.invoice.findUniqueOrThrow({
          where: { id: invoiceId },
          include: {
            followUps: true,
          },
        });

        const hasUploadedInvoice = invoiceWithFollowUps.followUps.some(
          (item) => item.invoiceFileUrl,
        );
        if (updates.paymentProofFileUrl && !hasUploadedInvoice) {
          throw new BadRequestException(
            'Upload invoice terlebih dahulu sebelum upload bukti bayar.',
          );
        }
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(updates.amount !== undefined ? { amount: updates.amount } : {}),
          ...(updates.periodStartDate !== undefined
            ? {
                periodStartDate: updates.periodStartDate
                  ? new Date(`${updates.periodStartDate}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(updates.periodEndDate !== undefined
            ? {
                periodEndDate: updates.periodEndDate
                  ? new Date(`${updates.periodEndDate}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(updates.dueDate !== undefined
            ? {
                dueDate: updates.dueDate
                  ? new Date(`${updates.dueDate}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(updates.paidAt !== undefined
            ? {
                paidAt: updates.paidAt
                  ? new Date(`${updates.paidAt}T00:00:00.000Z`)
                  : null,
              }
            : {}),
          ...(updates.paymentProofFileUrl !== undefined
            ? { paymentProofFileUrl: updates.paymentProofFileUrl }
            : {}),
        },
      });

      await this.syncInvoiceFollowUps(tx, invoiceId);
      return this.getMappedInvoice(tx, invoiceId);
    });
  }

  async addInvoiceFollowUp(
    customerId: number,
    invoiceId: number,
    payload: { title?: string; description?: string },
  ) {
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId,
      },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found for this customer.');
    }

    if (existingInvoice.paymentProofFileUrl) {
      throw new BadRequestException(
        'Bukti bayar sudah diunggah. Split invoice tambahan tidak diperlukan.',
      );
    }

    const hasInitialUpload = existingInvoice.followUps.some(
      (item) => item.invoiceFileUrl,
    );
    if (!hasInitialUpload) {
      throw new BadRequestException(
        'Upload invoice pertama terlebih dahulu sebelum menambah split.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: {
          followUps: {
            orderBy: { splitOrder: 'asc' },
          },
        },
      });

      const nextOrder = (invoice.followUps.at(-1)?.splitOrder ?? 0) + 1;
      await tx.invoiceFollowUp.create({
        data: {
          invoiceId,
          splitOrder: nextOrder,
          source: InvoiceFollowUpSource.Manual,
          triggerCode: null,
          title: payload.title?.trim() || `Split Manual ${nextOrder}`,
          description:
            payload.description?.trim() ||
            'Tindak lanjut penagihan manual ditambahkan oleh pengguna.',
          status: InvoiceFollowUpStatus.Warning,
          invoiceNumber: null,
          invoiceFileUrl: null,
        },
      });

      await this.syncInvoiceFollowUps(tx, invoiceId);
      return this.getMappedInvoice(tx, invoiceId);
    });
  }

  private async persistInvoiceDrafts(
    tx: PrismaTx,
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
        ? this.parseIsoDateString(
            draft.paidAt,
            `invoiceDrafts[${index}].paidAt`,
          )
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
    tx: PrismaTx,
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
      scheduleVersion?: number;
      scheduleStatus?: 'active' | 'history';
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
          scheduleVersion: params.scheduleVersion ?? 1,
          scheduleStatus: params.scheduleStatus ?? 'active',
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

  private mapContractRenewalFollowUp(followUp: ContractRenewalFollowUpRecord) {
    return {
      id: followUp.id,
      rowId: followUp.versionId,
      splitOrder: followUp.splitOrder,
      source: followUp.source,
      triggerCode: followUp.triggerCode ?? null,
      title: followUp.title,
      description: followUp.description,
      status: followUp.status,
      renewalFileUrl: followUp.renewalFileUrl ?? null,
      renewalFileName: followUp.renewalFileName ?? null,
      responseFileUrl: followUp.responseFileUrl ?? null,
      responseFileName: followUp.responseFileName ?? null,
      responseDecision: followUp.responseDecision ?? null,
      createdAt: followUp.createdAt.toISOString(),
      updatedAt: followUp.updatedAt.toISOString(),
    };
  }

  private async listCustomerIsps(tx: PrismaTx, customerId: number) {
    const memberships = await tx.customerIspMembership.findMany({
      where: { customerId },
      include: {
        isp: true,
      },
      orderBy: {
        isp: { name: 'asc' },
      },
    });

    return memberships.map((membership: CustomerIspMembershipWithIsp) => ({
      id: membership.isp.id,
      name: membership.isp.name,
      status: membership.isp.status,
      contractReference: membership.isp.contractReference,
      contractStartDate: toIsoDate(membership.isp.contractStartDate),
      contractPeriodStart: toIsoDate(membership.isp.contractPeriodStart),
      contractPeriodEnd: toIsoDate(membership.isp.contractPeriodEnd),
      paket: membership.isp.paket,
      jumlah: membership.isp.jumlah,
      billingPeriodMode: membership.isp.billingPeriodMode ?? null,
      billingCustomEvery: membership.isp.billingCustomEvery ?? null,
      billingCustomUnit: membership.isp.billingCustomUnit ?? null,
      activationFeeAmount: Number(membership.isp.activationFeeAmount ?? 0),
      activationFeePaidAt: toIsoTimestamp(membership.isp.activationFeePaidAt),
      createdAt: membership.isp.createdAt.toISOString(),
      updatedAt: membership.isp.updatedAt.toISOString(),
    }));
  }

  private mapContract(contract: ContractRecord) {
    return {
      id: contract.id,
      customerId: contract.customerId,
      contractNumber: contract.contractNumber,
      startDate: toIsoDate(contract.startDate),
      endDate: toIsoDate(contract.endDate),
      coreType: contract.coreType,
      coreTotal: contract.coreTotal,
      sharingRatio: contract.sharingRatio ?? null,
      status: contract.status,
      billingEvery: contract.billingEvery,
      billingUnit: contract.billingUnit,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    };
  }

  private mapContractVersion(version: ContractVersionRecord) {
    return {
      id: version.id,
      contractId: version.contractId,
      customerId: version.customerId,
      versionNumber: version.versionNumber,
      startDate: toIsoDate(version.startDate),
      endDate: toIsoDate(version.endDate),
      coreType: version.coreType,
      coreTotal: version.coreTotal,
      sharedCoreRatio: version.sharedCoreRatio ?? null,
      bakDocumentId: version.bakDocumentId ?? null,
      renewalFileUrl: version.renewalFileUrl ?? null,
      renewalFileName: version.renewalFileName ?? null,
      responseFileUrl: version.responseFileUrl ?? null,
      responseFileName: version.responseFileName ?? null,
      renewalFollowUps: [...(version.renewalFollowUps ?? [])]
        .sort((left, right) => left.splitOrder - right.splitOrder)
        .map((followUp) => this.mapContractRenewalFollowUp(followUp)),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  private async getMappedContractVersion(tx: PrismaTx, versionId: number) {
    const version = await tx.contractVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    return this.mapContractVersion(version);
  }

  private async syncPrimaryIspForCustomer(
    tx: PrismaTx,
    customerId: number,
  ): Promise<void> {
    const primaryMembership = await tx.customerIspMembership.findFirst({
      where: { customerId },
      include: { isp: true },
      orderBy: {
        isp: { name: 'asc' },
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: {
        ispName: primaryMembership?.isp.name ?? '-',
      },
    });
  }

  private async createContractVersionRecord(
    tx: PrismaTx,
    params: {
      customerId: number;
      contractId: number;
      startDate: string;
      endDate: string;
      coreType: CoreAllocationType;
      coreTotal: number;
      sharedCoreRatio: string | null;
      bakDocumentId: number | null;
    },
  ) {
    const latestVersion = await tx.contractVersion.findFirst({
      where: { contractId: params.contractId },
      orderBy: { versionNumber: 'desc' },
    });

    if (
      latestVersion &&
      params.startDate <= toIsoDate(latestVersion.startDate)!
    ) {
      throw new BadRequestException(
        'New contract version must start after the latest version start date.',
      );
    }

    if (
      latestVersion &&
      params.startDate <= toIsoDate(latestVersion.endDate)!
    ) {
      await tx.contractVersion.update({
        where: { id: latestVersion.id },
        data: {
          endDate: new Date(`${addDays(params.startDate, -1)}T00:00:00.000Z`),
        },
      });
    }

    return tx.contractVersion.create({
      data: {
        contractId: params.contractId,
        customerId: params.customerId,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        startDate: new Date(`${params.startDate}T00:00:00.000Z`),
        endDate: new Date(`${params.endDate}T00:00:00.000Z`),
        coreType: params.coreType,
        coreTotal: params.coreTotal,
        sharedCoreRatio:
          params.coreType === CoreAllocationType.Core
            ? null
            : (params.sharedCoreRatio ?? '1:2'),
        bakDocumentId: params.bakDocumentId,
      },
    });
  }

  private async refreshContractStatus(
    tx: PrismaTx,
    contractId: number,
  ): Promise<void> {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!contract || contract.status === 'terminated') {
      return;
    }

    const latestVersion = contract.versions[0];
    if (!latestVersion) {
      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.Expired },
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const latestEndDate = toIsoDate(latestVersion.endDate);

    if (latestEndDate && latestEndDate < today) {
      await tx.contract.update({
        where: { id: contractId },
        data: { status: ContractStatus.Expired },
      });
      return;
    }

    await tx.contract.update({
      where: { id: contractId },
      data: {
        status: latestVersion.bakDocumentId
          ? ContractStatus.Aktif
          : ContractStatus.Expired,
      },
    });
  }

  private async syncContractRenewalFollowUpsForVersion(
    tx: PrismaTx,
    versionId: number,
  ): Promise<void> {
    const version = await tx.contractVersion.findUnique({
      where: { id: versionId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!version) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = version.endDate ?? null;
    const daysLeft = endDate
      ? Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    await this.ensureAutoContractFollowUp(
      tx,
      version,
      daysLeft,
      90,
      1,
      'auto_h90',
      'Peringatan Pertama',
      'Kontrak tenant mendekati akhir masa berlaku. Unggah berkas perpanjangan atau tambah tindak lanjut.',
    );
    await this.ensureAutoContractFollowUp(
      tx,
      version,
      daysLeft,
      30,
      2,
      'auto_h30',
      'Peringatan Kedua',
      'Belum ada tanggapan yang selesai. Lanjutkan tindak lanjut perpanjangan pada split ini.',
    );

    await this.syncContractRenewalMirrorFields(tx, versionId);
  }

  private async ensureAutoContractFollowUp(
    tx: PrismaTx,
    version: ContractVersionWithRenewalFollowUps,
    daysLeft: number | null,
    thresholdDays: number,
    splitOrder: number,
    triggerCode: string,
    title: string,
    description: string,
  ): Promise<void> {
    if (daysLeft === null || daysLeft > thresholdDays) {
      return;
    }

    const alreadyHandled = (version.renewalFollowUps ?? []).some(
      (followUp) =>
        followUp.splitOrder >= splitOrder ||
        followUp.triggerCode === triggerCode,
    );
    if (alreadyHandled) {
      return;
    }

    await tx.contractVersionRenewalFollowUp.create({
      data: {
        versionId: version.id,
        splitOrder,
        source: IspRenewalFollowUpSource.Auto,
        triggerCode,
        title,
        description,
        status: IspRenewalFollowUpStatus.Warning,
      },
    });
  }

  private async resolveTargetContractFollowUp(
    tx: PrismaTx,
    versionId: number,
    followUpId?: number | null,
  ) {
    await this.syncContractRenewalFollowUpsForVersion(tx, versionId);

    const version = await tx.contractVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (followUpId !== undefined && followUpId !== null) {
      const matched = version.renewalFollowUps.find(
        (item) => item.id === followUpId,
      );
      if (matched) {
        return matched;
      }

      throw new NotFoundException(
        `Renewal follow-up ${followUpId} was not found for contract version ${versionId}.`,
      );
    }

    const existingPending = [...version.renewalFollowUps]
      .filter((item) => item.status !== 'completed')
      .sort((left, right) => left.splitOrder - right.splitOrder)[0];
    if (existingPending) {
      return existingPending;
    }

    const nextOrder = (version.renewalFollowUps.at(-1)?.splitOrder ?? 0) + 1;
    return tx.contractVersionRenewalFollowUp.create({
      data: {
        versionId,
        splitOrder: nextOrder,
        source: IspRenewalFollowUpSource.Upload,
        triggerCode: null,
        title: `Upload Perpanjangan ${nextOrder}`,
        description:
          'Berkas perpanjangan diunggah tanpa menunggu trigger otomatis.',
        status: IspRenewalFollowUpStatus.PendingResponse,
      },
    });
  }

  private async syncContractRenewalMirrorFields(
    tx: PrismaTx,
    versionId: number,
  ): Promise<void> {
    const version = await tx.contractVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    const latestWithRenewal = [...version.renewalFollowUps]
      .filter((item) => item.renewalFileUrl)
      .sort((left, right) => right.splitOrder - left.splitOrder)[0];
    const latestWithResponse = [...version.renewalFollowUps]
      .filter((item) => item.responseFileUrl)
      .sort((left, right) => right.splitOrder - left.splitOrder)[0];

    await tx.contractVersion.update({
      where: { id: versionId },
      data: {
        renewalFileUrl: latestWithRenewal?.renewalFileUrl ?? null,
        renewalFileName: latestWithRenewal?.renewalFileName ?? null,
        responseFileUrl: latestWithResponse?.responseFileUrl ?? null,
        responseFileName: latestWithResponse?.responseFileName ?? null,
      },
    });
  }

  private async restructureInvoicesForBillingChange(
    tx: PrismaTx,
    params: {
      customerId: number;
      customerCode: string;
      contractId: number;
      contractNumber: string;
      billingEvery: number;
      billingUnit: BillingUnit;
    },
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const activeVersion =
      (await tx.contractVersion.findFirst({
        where: {
          customerId: params.customerId,
          contractId: params.contractId,
          bakDocumentId: { not: null },
          startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
          endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
        orderBy: { versionNumber: 'desc' },
      })) ??
      (await tx.contractVersion.findFirst({
        where: {
          customerId: params.customerId,
          contractId: params.contractId,
        },
        orderBy: { versionNumber: 'desc' },
      }));

    if (!activeVersion) {
      return;
    }

    const paidInvoices = await tx.invoice.findMany({
      where: {
        customerId: params.customerId,
        scheduleStatus: 'active',
        status: InvoiceStatus.Lunas,
      },
      orderBy: [{ periodEndDate: 'asc' }, { periodStartDate: 'asc' }],
    });

    const unpaidActiveInvoices = await tx.invoice.findMany({
      where: {
        customerId: params.customerId,
        scheduleStatus: 'active',
        status: { not: InvoiceStatus.Lunas },
      },
    });

    if (unpaidActiveInvoices.length === 0) {
      return;
    }

    const lastPaidInvoice = paidInvoices.at(-1);
    const lastPaidPeriodEnd =
      toIsoDate(lastPaidInvoice?.periodEndDate) ??
      toIsoDate(lastPaidInvoice?.periodStartDate);
    const restructureStartDate = lastPaidPeriodEnd
      ? addDays(lastPaidPeriodEnd, 1)
      : toIsoDate(activeVersion.startDate)!;
    const restructureEndDate = toIsoDate(activeVersion.endDate)!;

    await tx.invoice.updateMany({
      where: {
        customerId: params.customerId,
        scheduleStatus: 'active',
        status: InvoiceStatus.Lunas,
      },
      data: { scheduleStatus: 'history' },
    });

    await tx.invoice.deleteMany({
      where: {
        customerId: params.customerId,
        scheduleStatus: 'active',
        status: { not: InvoiceStatus.Lunas },
      },
    });

    if (restructureStartDate > restructureEndDate) {
      return;
    }

    const maxSchedule = await tx.invoice.aggregate({
      where: { customerId: params.customerId },
      _max: { scheduleVersion: true },
    });

    await this.generateInvoicesForPeriod(tx, {
      customerId: params.customerId,
      customerCode: params.customerCode,
      contractId: params.contractId,
      contractNumber: params.contractNumber,
      contractVersionId: activeVersion.id,
      periodStartDate: restructureStartDate,
      periodEndDate: restructureEndDate,
      billingEvery: params.billingEvery,
      billingUnit: params.billingUnit,
      scheduleVersion: (maxSchedule._max.scheduleVersion ?? 0) + 1,
      scheduleStatus: 'active',
    });
  }

  private async getMappedInvoice(tx: PrismaTx, invoiceId: number) {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    return {
      id: invoice.id,
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber ?? null,
      contractId: invoice.contractId ?? null,
      contractVersionId: invoice.contractVersionId ?? null,
      contractNumber: invoice.contractNumber ?? null,
      periodMonth: invoice.periodMonth,
      periodYear: invoice.periodYear,
      periodStartDate: toIsoDate(invoice.periodStartDate),
      periodEndDate: toIsoDate(invoice.periodEndDate),
      dueDate: toIsoDate(invoice.dueDate),
      amount: Number(invoice.amount ?? 0),
      status: invoice.status,
      scheduleVersion: invoice.scheduleVersion,
      scheduleStatus: invoice.scheduleStatus,
      documentId: invoice.documentId ?? null,
      paidAt: toIsoTimestamp(invoice.paidAt),
      invoiceFileUrl: invoice.invoiceFileUrl ?? null,
      paymentProofFileUrl: invoice.paymentProofFileUrl ?? null,
      invoiceFollowUps: invoice.followUps.map((followUp) => ({
        id: followUp.id,
        invoiceId: followUp.invoiceId,
        splitOrder: followUp.splitOrder,
        source: followUp.source,
        triggerCode: followUp.triggerCode ?? null,
        title: followUp.title,
        description: followUp.description,
        status: followUp.status,
        invoiceNumber: followUp.invoiceNumber ?? null,
        invoiceFileUrl: followUp.invoiceFileUrl ?? null,
        createdAt: followUp.createdAt.toISOString(),
        updatedAt: followUp.updatedAt.toISOString(),
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  private async syncInvoiceFollowUps(
    tx: PrismaTx,
    invoiceId: number,
  ): Promise<void> {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!invoice) {
      return;
    }

    const hasLegacyUpload = Boolean(invoice.invoiceFileUrl);
    const hasUploadedFollowUp = invoice.followUps.some(
      (item) => item.invoiceFileUrl,
    );

    if (hasLegacyUpload && !hasUploadedFollowUp) {
      await tx.invoiceFollowUp.create({
        data: {
          invoiceId: invoice.id,
          splitOrder: 1,
          source: InvoiceFollowUpSource.Upload,
          triggerCode: 'legacy_initial',
          title: 'Invoice Awal',
          description:
            'Split awal hasil sinkronisasi dari data invoice yang sudah ada.',
          status: invoice.paymentProofFileUrl
            ? InvoiceFollowUpStatus.Completed
            : InvoiceFollowUpStatus.Sent,
          invoiceNumber: invoice.invoiceNumber ?? null,
          invoiceFileUrl: invoice.invoiceFileUrl ?? null,
        },
      });
    }

    const refreshedInvoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (!refreshedInvoice) {
      return;
    }

    if (refreshedInvoice.paymentProofFileUrl) {
      await tx.invoiceFollowUp.updateMany({
        where: { invoiceId },
        data: { status: InvoiceFollowUpStatus.Completed },
      });
      await this.syncInvoiceMirrorFields(tx, invoiceId);
      return;
    }

    const hasInitialUpload = refreshedInvoice.followUps.some(
      (item) => item.invoiceFileUrl,
    );
    if (hasInitialUpload && refreshedInvoice.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = refreshedInvoice.dueDate;
      const daysPastDue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      await this.ensureAutoInvoiceFollowUp(
        tx,
        refreshedInvoice,
        daysPastDue,
        1,
        2,
        'auto_overdue_d1',
        'Peringatan Pertama',
        'Pembayaran melewati jatuh tempo. Unggah invoice peringatan pertama untuk tindak lanjut penagihan.',
      );
      await this.ensureAutoInvoiceFollowUp(
        tx,
        refreshedInvoice,
        daysPastDue,
        7,
        3,
        'auto_overdue_d7',
        'Peringatan Kedua',
        'Pembayaran belum diselesaikan lebih dari 7 hari setelah jatuh tempo. Lanjutkan dengan invoice peringatan berikutnya.',
      );
    }

    await this.syncInvoiceMirrorFields(tx, invoiceId);
  }

  private async ensureAutoInvoiceFollowUp(
    tx: PrismaTx,
    invoice: InvoiceWithFollowUps,
    daysPastDue: number,
    thresholdDays: number,
    splitOrder: number,
    triggerCode: string,
    title: string,
    description: string,
  ): Promise<void> {
    if (daysPastDue < thresholdDays) {
      return;
    }

    const alreadyHandled = invoice.followUps.some(
      (followUp) =>
        followUp.splitOrder >= splitOrder ||
        followUp.triggerCode === triggerCode,
    );
    if (alreadyHandled) {
      return;
    }

    await tx.invoiceFollowUp.create({
      data: {
        invoiceId: invoice.id,
        splitOrder,
        source: InvoiceFollowUpSource.Auto,
        triggerCode,
        title,
        description,
        status: InvoiceFollowUpStatus.Warning,
        invoiceNumber: null,
        invoiceFileUrl: null,
      },
    });
  }

  private async resolveTargetInvoiceFollowUp(
    tx: PrismaTx,
    invoiceId: number,
    followUpId?: number | null,
  ) {
    await this.syncInvoiceFollowUps(tx, invoiceId);

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (followUpId !== undefined && followUpId !== null) {
      const matched = invoice.followUps.find((item) => item.id === followUpId);
      if (matched) {
        return matched;
      }

      throw new NotFoundException(
        `Invoice follow-up ${followUpId} was not found for invoice ${invoiceId}.`,
      );
    }

    const existingPending = [...invoice.followUps]
      .filter((item) => item.status !== 'completed')
      .sort((left, right) => left.splitOrder - right.splitOrder)[0];

    if (existingPending) {
      return existingPending;
    }

    const nextOrder = (invoice.followUps.at(-1)?.splitOrder ?? 0) + 1;
    return tx.invoiceFollowUp.create({
      data: {
        invoiceId: invoice.id,
        splitOrder: nextOrder,
        source: InvoiceFollowUpSource.Upload,
        triggerCode: null,
        title: nextOrder === 1 ? 'Invoice Awal' : `Invoice Split ${nextOrder}`,
        description:
          nextOrder === 1
            ? 'Invoice awal diunggah untuk pembayaran ini.'
            : 'Invoice tambahan diunggah tanpa menunggu trigger otomatis.',
        status: InvoiceFollowUpStatus.Warning,
        invoiceNumber: null,
        invoiceFileUrl: null,
      },
    });
  }

  private async syncInvoiceMirrorFields(
    tx: PrismaTx,
    invoiceId: number,
  ): Promise<void> {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: {
        followUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    const latestWithInvoice = [...invoice.followUps]
      .filter((item) => item.invoiceFileUrl)
      .sort((left, right) => right.splitOrder - left.splitOrder)[0];

    if (invoice.paymentProofFileUrl) {
      await tx.invoiceFollowUp.updateMany({
        where: { invoiceId },
        data: { status: InvoiceFollowUpStatus.Completed },
      });
    } else {
      for (const followUp of invoice.followUps) {
        await tx.invoiceFollowUp.update({
          where: { id: followUp.id },
          data: {
            status: followUp.invoiceFileUrl
              ? InvoiceFollowUpStatus.Sent
              : followUp.status === 'completed'
                ? InvoiceFollowUpStatus.Completed
                : InvoiceFollowUpStatus.Warning,
          },
        });
      }
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: latestWithInvoice?.invoiceNumber ?? null,
        invoiceFileUrl: latestWithInvoice?.invoiceFileUrl ?? null,
        status: this.deriveInvoiceStatus({
          paidAt: toIsoTimestamp(invoice.paidAt),
          paymentProofFileUrl: invoice.paymentProofFileUrl,
          invoiceFileUrl: latestWithInvoice?.invoiceFileUrl ?? null,
          dueDate: toIsoDate(invoice.dueDate),
        }),
      },
    });
  }

  private deriveInvoiceStatus(invoice: {
    paidAt?: string | null;
    paymentProofFileUrl?: string | null;
    invoiceFileUrl?: string | null;
    dueDate?: string | null;
  }): InvoiceStatus {
    const today = new Date().toISOString().slice(0, 10);

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

  private async resolveIspIdsFromPayload(
    payload: {
      ispName?: unknown;
      ispIds?: unknown;
      newIspNames?: unknown;
    },
    options: {
      requireAtLeastOne: boolean;
    },
    tx: PrismaExecutor = this.prisma,
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

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value).trim() || null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private parseStatus(value: unknown): CustomerStatus {
    if (
      value !== CustomerStatus.Aktif &&
      value !== CustomerStatus.Nonaktif &&
      value !== CustomerStatus.Arsip
    ) {
      throw new BadRequestException(
        'status must be aktif, nonaktif, or arsip.',
      );
    }

    return value as CustomerStatus;
  }

  private parseContractStatus(value: unknown): ContractStatus {
    if (
      value !== ContractStatus.Aktif &&
      value !== ContractStatus.Expired &&
      value !== ContractStatus.Terminated
    ) {
      throw new BadRequestException(
        'status must be aktif, expired, or terminated.',
      );
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

  private parseCoreType(value: unknown): CoreAllocationType | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (
      value !== CoreAllocationType.Core &&
      value !== CoreAllocationType.SharingCore
    ) {
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

  private parseNullableIsoDateString(
    value: unknown,
    fieldName: string,
  ): string | null {
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

  async changeRoute(
    customerId: number,
    payload: ChangeCustomerRouteDto,
  ): Promise<number> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const latestVersion = await tx.customerRouteVersion.findFirst({
        where: { customerId },
        orderBy: { versionNumber: 'desc' },
        include: {
          points: {
            orderBy: { orderNumber: 'asc' },
          },
        },
      });

      const nextVersionNumber = latestVersion
        ? latestVersion.versionNumber + 1
        : 1;

      const now = new Date();

      const newVersion = await tx.customerRouteVersion.create({
        data: {
          customerId,
          versionNumber: nextVersionNumber,
          flowStatus: payload.flowStatus,
          changeMode: 'ubah_jalur',
          changeNote: payload.changeNote,
          basedOnVersionId: latestVersion?.id ?? null,
          createdAt: now,
          updatedAt: now,
          points: {
            create: payload.points.map((p) => ({
              pathName: p.pathName,
              pointType: p.pointType,
              note: p.note ?? null,
              orderNumber: p.orderNumber ?? 0,
              createdAt: now,
              updatedAt: now,
            })),
          },
        },
        include: {
          points: {
            orderBy: { orderNumber: 'asc' },
          },
        },
      });

      const snapshotBefore = latestVersion
        ? {
            flowStatus: latestVersion.flowStatus,
            points: latestVersion.points.map((p) => ({
              orderNumber: p.orderNumber,
              pathName: p.pathName,
              pointType: p.pointType,
              note: p.note,
            })),
          }
        : {
            flowStatus: RouteFlowStatus.Aktif,
            points: [],
          };

      const snapshotAfter = {
        flowStatus: newVersion.flowStatus,
        points: newVersion.points.map((p) => ({
          orderNumber: p.orderNumber,
          pathName: p.pathName,
          pointType: p.pointType,
          note: p.note,
        })),
      };

      await tx.customerRouteHistory.create({
        data: {
          customerId,
          operation: 'replace',
          note: payload.changeNote,
          snapshotBefore: snapshotBefore as object,
          snapshotAfter: snapshotAfter as object,
          createdAt: now,
        },
      });

      return customerId;
    });
  }

  async editRoute(
    customerId: number,
    payload: EditCustomerRouteDto,
  ): Promise<number> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      let activeVersion = await tx.customerRouteVersion.findFirst({
        where: { customerId },
        orderBy: { versionNumber: 'desc' },
      });

      if (!activeVersion) {
        const now = new Date();
        activeVersion = await tx.customerRouteVersion.create({
          data: {
            customerId,
            versionNumber: 1,
            flowStatus: RouteFlowStatus.Aktif,
            changeMode: 'initial',
            changeNote: 'Inisiasi otomatis melalui edit cepat.',
            basedOnVersionId: null,
            createdAt: now,
            updatedAt: now,
          },
        });
      } else {
        await tx.customerRouteVersion.update({
          where: { id: activeVersion.id },
          data: { updatedAt: new Date() },
        });
      }

      switch (payload.operation) {
        case 'add':
          if (!payload.pathName || !payload.pointType) {
            throw new BadRequestException(
              'pathName and pointType are required for add operation.',
            );
          }
          const existingPointsCount = await tx.customerRoutePoint.count({
            where: { routeVersionId: activeVersion.id },
          });
          await tx.customerRoutePoint.create({
            data: {
              routeVersionId: activeVersion.id,
              pathName: payload.pathName,
              pointType: payload.pointType,
              note: payload.note ?? null,
              orderNumber: existingPointsCount + 1,
            },
          });
          break;

        case 'update':
          if (!payload.pointId) {
            throw new BadRequestException('pointId is required for update operation.');
          }
          const updateData: any = {};
          if (payload.pathName !== undefined) updateData.pathName = payload.pathName;
          if (payload.pointType !== undefined) updateData.pointType = payload.pointType;
          if (payload.note !== undefined) updateData.note = payload.note;

          await tx.customerRoutePoint.update({
            where: { id: payload.pointId },
            data: updateData,
          });
          break;

        case 'delete':
          if (!payload.pointId) {
            throw new BadRequestException('pointId is required for delete operation.');
          }
          await tx.customerRoutePoint.delete({
            where: { id: payload.pointId },
          });
          break;

        case 'reorder':
          if (
            !payload.orderedPointIds ||
            !Array.isArray(payload.orderedPointIds)
          ) {
            throw new BadRequestException(
              'orderedPointIds array is required for reorder operation.',
            );
          }
          for (let i = 0; i < payload.orderedPointIds.length; i++) {
            await tx.customerRoutePoint.update({
              where: { id: payload.orderedPointIds[i] },
              data: { orderNumber: i + 1 },
            });
          }
          break;

        case 'status':
          if (!payload.flowStatus) {
            throw new BadRequestException('flowStatus is required for status operation.');
          }
          await tx.customerRouteVersion.update({
            where: { id: activeVersion.id },
            data: { flowStatus: payload.flowStatus },
          });
          break;

        default:
          throw new BadRequestException('Invalid operation.');
      }

      return customerId;
    });
  }

  async deleteRouteHistory(customerId: number, historyId: number): Promise<{ deletedId: number }> {
    const history = await this.prisma.customerRouteHistory.findFirst({
      where: { id: historyId, customerId },
    });

    if (!history) {
      throw new NotFoundException('Route history not found.');
    }

    await this.prisma.customerRouteHistory.delete({
      where: { id: historyId },
    });

    return { deletedId: historyId };
  }

  async deleteAllRouteHistory(customerId: number): Promise<{ deletedCount: number }> {
    const result = await this.prisma.customerRouteHistory.deleteMany({
      where: { customerId },
    });

    return { deletedCount: result.count };
  }
}
