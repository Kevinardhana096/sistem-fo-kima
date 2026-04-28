import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ContractStatus,
  CustomerStatus,
  IspPackageType,
  IspRenewalFollowUpSource,
  IspRenewalFollowUpStatus,
  IspRenewalStatus,
  IspStatus,
} from '../shared/types/domain.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIspDto } from './dto/create-isp.dto';
import { UpdateIspDto } from './dto/update-isp.dto';

type PrismaTx = Prisma.TransactionClient;
type IspRecord = Prisma.IspGetPayload<object>;
type IspContractRowWithFollowUps = Prisma.IspContractRowGetPayload<{
  include: {
    renewalFollowUps: true;
  };
}>;
type IspRenewalFollowUpRecord = Prisma.IspRenewalFollowUpGetPayload<object>;
type IspMembershipWithCustomer = Prisma.CustomerIspMembershipGetPayload<{
  include: {
    customer: {
      include: {
        contracts: {
          include: {
            versions: true;
          };
        };
        invoices: true;
      };
    };
  };
}>;
type IspRecordWithCustomers = Prisma.IspGetPayload<{
  include: {
    customerMemberships: {
      include: {
        customer: {
          include: {
            contracts: {
              orderBy: {
                id: 'desc';
              };
              include: {
                versions: {
                  orderBy: {
                    versionNumber: 'desc';
                  };
                };
              };
            };
            invoices: {
              where: {
                scheduleStatus: 'active';
              };
            };
          };
        };
      };
    };
  };
}>;
type IspTenantRecord = IspMembershipWithCustomer['customer'];
type IspTenantContractRecord = IspTenantRecord['contracts'][number];
type IspTenantContractVersionRecord =
  IspTenantContractRecord['versions'][number];
type CustomerIspMembershipWithIsp = Prisma.CustomerIspMembershipGetPayload<{
  include: {
    isp: true;
  };
}>;

const toIsoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const toIsoTimestamp = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class PrismaIspsService {
  constructor(private readonly prisma: PrismaService) {}

  isEnabled(): boolean {
    return this.prisma.isEnabled() && process.env.ISPS_SOURCE === 'prisma';
  }

  async listIsps() {
    const isps = await this.prisma.isp.findMany({
      orderBy: { name: 'asc' },
      include: {
        customerMemberships: {
          include: {
            customer: {
              include: {
                contracts: {
                  orderBy: { id: 'desc' },
                  include: {
                    versions: {
                      orderBy: { versionNumber: 'desc' },
                    },
                  },
                },
                invoices: {
                  where: { scheduleStatus: 'active' },
                },
              },
            },
          },
        },
      },
    });

    return isps.map((isp) => {
      const summary = this.getIspOperationalSummaryFromRecord(isp);

      return {
        ...this.mapIsp(isp),
        tenantCount: summary.tenantCount,
        tenantsMissingBak: summary.tenantsMissingBak,
        tenantsUnpaid: summary.tenantsUnpaid,
        tenantsExpiringContract: summary.tenantsExpiringContract,
      };
    });
  }

  async getIspDetail(ispId: number) {
    const isp = await this.getIspRecordOrThrow(ispId);
    const tenants = this.mapIspTenantsFromRecord(isp);
    const summary = this.getIspOperationalSummaryFromRecord(isp);
    const contractRows = await this.listIspContractRowsInternal(ispId);

    return {
      ...this.mapIsp(isp),
      summary,
      tenants,
      contractRows,
    };
  }

  async getIspContractRows(ispId: number) {
    await this.ensureIspExists(ispId);
    return this.listIspContractRowsInternal(ispId);
  }

  async updateContractRow(
    ispId: number,
    rowId: number,
    payload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
        include: {
          renewalFollowUps: {
            orderBy: { splitOrder: 'asc' },
          },
        },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      const updates: Record<string, unknown> = {};
      if (payload.contractReference !== undefined) {
        updates.contractReference = this.normalizeRequiredString(
          payload.contractReference,
          'contractReference',
        );
      }
      if (payload.periodStart !== undefined) {
        updates.periodStart = this.parseOptionalIsoDate(
          payload.periodStart,
          'periodStart',
        )
          ? parseDate(
              this.parseOptionalIsoDate(payload.periodStart, 'periodStart')!,
            )
          : null;
      }
      if (payload.periodEnd !== undefined) {
        updates.periodEnd = this.parseOptionalIsoDate(
          payload.periodEnd,
          'periodEnd',
        )
          ? parseDate(
              this.parseOptionalIsoDate(payload.periodEnd, 'periodEnd')!,
            )
          : null;
      }

      const nextPeriodStart = toIsoDate(
        (updates.periodStart as Date | undefined) ?? row.periodStart,
      );
      const nextPeriodEnd = toIsoDate(
        (updates.periodEnd as Date | undefined) ?? row.periodEnd,
      );

      if (
        row.renewalStatus === 'needs_completion' &&
        nextPeriodStart &&
        nextPeriodEnd
      ) {
        updates.renewalStatus = IspRenewalStatus.Active;
      }

      await tx.ispContractRow.update({
        where: { id: rowId },
        data: updates,
      });

      await this.syncRenewalFollowUpsForRow(tx, rowId);
      await this.syncIspContractSnapshotFromRows(tx, ispId);

      return this.getMappedRow(tx, rowId);
    });
  }

  async uploadRenewalFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
    followUpId?: number | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      const followUp = await this.resolveTargetFollowUp(tx, rowId, followUpId);
      await tx.ispRenewalFollowUp.update({
        where: { id: followUp.id },
        data: {
          renewalFileUrl: fileUrl,
          renewalFileName: fileName,
          status: IspRenewalFollowUpStatus.PendingResponse,
        },
      });

      await this.syncRenewalMirrorFields(tx, rowId);
      await tx.ispContractRow.update({
        where: { id: rowId },
        data: {
          renewalStatus: IspRenewalStatus.Pending,
        },
      });
      await this.syncIspContractSnapshotFromRows(tx, ispId);

      return this.getMappedRow(tx, rowId);
    });
  }

  async respondRenewal(
    ispId: number,
    rowId: number,
    payload: {
      decision: 'lanjut' | 'tidak';
      fileUrl: string;
      fileName: string;
      followUpId?: number | null;
    },
  ) {
    if (!payload.decision || !['lanjut', 'tidak'].includes(payload.decision)) {
      throw new BadRequestException('Decision must be "lanjut" or "tidak".');
    }

    if (!payload.fileUrl) {
      throw new BadRequestException('Response file is required.');
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      const followUp = await this.resolveTargetFollowUp(
        tx,
        rowId,
        payload.followUpId,
      );

      await tx.ispRenewalFollowUp.update({
        where: { id: followUp.id },
        data: {
          responseFileUrl: payload.fileUrl,
          responseFileName: payload.fileName,
          responseDecision: payload.decision,
          status: IspRenewalFollowUpStatus.Completed,
        },
      });

      await this.syncRenewalMirrorFields(tx, rowId);

      if (payload.decision === 'lanjut') {
        await tx.ispContractRow.update({
          where: { id: rowId },
          data: { renewalStatus: IspRenewalStatus.Renewed },
        });

        const existingDraftRow = await tx.ispContractRow.findFirst({
          where: {
            ispId,
            id: { not: rowId },
            renewalStatus: IspRenewalStatus.NeedsCompletion,
          },
          orderBy: { id: 'desc' },
        });
        const nextRow =
          existingDraftRow ??
          (await tx.ispContractRow.create({
            data: {
              ispId,
              contractReference: '',
              periodStart: null,
              periodEnd: null,
              renewalStatus: IspRenewalStatus.NeedsCompletion,
            },
          }));

        await this.syncRenewalFollowUpsForRow(tx, nextRow.id);
        await this.syncIspContractSnapshotFromRows(tx, ispId);

        return {
          updatedRow: await this.getMappedRow(tx, rowId),
          newRow: await this.getMappedRow(tx, nextRow.id),
        };
      }

      await tx.ispContractRow.update({
        where: { id: rowId },
        data: { renewalStatus: IspRenewalStatus.Terminated },
      });

      await tx.isp.update({
        where: { id: ispId },
        data: { status: IspStatus.Nonaktif },
      });

      const memberships = await tx.customerIspMembership.findMany({
        where: { ispId },
        select: { customerId: true },
      });

      if (memberships.length > 0) {
        await tx.customer.updateMany({
          where: {
            id: { in: memberships.map((membership) => membership.customerId) },
          },
          data: { status: CustomerStatus.Nonaktif },
        });
      }

      await this.syncIspContractSnapshotFromRows(tx, ispId);

      return {
        updatedRow: await this.getMappedRow(tx, rowId),
      };
    });
  }

  async addManualRenewalFollowUp(
    ispId: number,
    rowId: number,
    payload: { title?: string; description?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
        include: {
          renewalFollowUps: {
            orderBy: { splitOrder: 'asc' },
          },
        },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      await this.syncRenewalFollowUpsForRow(tx, rowId);
      const refreshed = await tx.ispContractRow.findUnique({
        where: { id: rowId },
        include: {
          renewalFollowUps: {
            orderBy: { splitOrder: 'asc' },
          },
        },
      });

      const hasInitialRenewalUpload = (refreshed?.renewalFollowUps ?? []).some(
        (item) => item.renewalFileUrl,
      );
      if (!hasInitialRenewalUpload) {
        throw new BadRequestException(
          'Unggah berkas perpanjangan pertama terlebih dahulu sebelum menambah split.',
        );
      }

      const lastFollowUp = refreshed?.renewalFollowUps ?? [];
      const nextOrder =
        (lastFollowUp[lastFollowUp.length - 1]?.splitOrder ?? 0) + 1;
      await tx.ispRenewalFollowUp.create({
        data: {
          rowId,
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

      await this.syncRenewalMirrorFields(tx, rowId);
      await this.syncIspContractSnapshotFromRows(tx, ispId);
      return this.getMappedRow(tx, rowId);
    });
  }

  async uploadBakFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      await tx.ispContractRow.update({
        where: { id: rowId },
        data: {
          bakFileUrl: fileUrl,
          bakFileName: fileName,
        },
      });

      await this.syncIspContractSnapshotFromRows(tx, ispId);
      return this.getMappedRow(tx, rowId);
    });
  }

  async createIsp(payload: CreateIspDto) {
    const name = this.normalizeRequiredString(payload.name, 'name');
    const contractReference = this.normalizeRequiredString(
      payload.contractReference,
      'contractReference',
    );
    const contractPeriodStart = this.parseOptionalIsoDate(
      payload.contractPeriodStart,
      'contractPeriodStart',
    );
    const contractPeriodEnd = this.parseOptionalIsoDate(
      payload.contractPeriodEnd,
      'contractPeriodEnd',
    );

    if (
      contractPeriodStart &&
      contractPeriodEnd &&
      contractPeriodStart > contractPeriodEnd
    ) {
      throw new BadRequestException(
        'contractPeriodEnd must be on or after contractPeriodStart.',
      );
    }

    const existingByName = await this.prisma.isp.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existingByName) {
      throw new BadRequestException('ISP with this name already exists.');
    }

    const createdIsp = await this.prisma.$transaction(async (tx) => {
      const isp = await tx.isp.create({
        data: {
          name,
          status: this.parseIspStatus(payload.status),
          contractReference,
          contractStartDate: this.parseOptionalIsoDate(
            payload.contractStartDate,
            'contractStartDate',
          )
            ? parseDate(
                this.parseOptionalIsoDate(
                  payload.contractStartDate,
                  'contractStartDate',
                )!,
              )
            : null,
          contractPeriodStart: contractPeriodStart
            ? parseDate(contractPeriodStart)
            : null,
          contractPeriodEnd: contractPeriodEnd
            ? parseDate(contractPeriodEnd)
            : null,
          paket: this.parsePackageType(payload.paket),
          jumlah: this.parseJumlah(payload.jumlah, 0),
          logoUrl: payload.logoUrl,
          contractFileUrl:
            this.normalizeOptionalString(payload.contractFileDataUrl) ?? null,
          contractFileName: payload.contractFileName?.trim() || null,
        },
      });

      const row = await tx.ispContractRow.create({
        data: {
          ispId: isp.id,
          contractReference,
          periodStart: contractPeriodStart
            ? parseDate(contractPeriodStart)
            : null,
          periodEnd: contractPeriodEnd ? parseDate(contractPeriodEnd) : null,
          bakFileUrl:
            this.normalizeOptionalString(payload.bakFileDataUrl) ?? null,
          bakFileName: payload.bakFileName?.trim() || null,
          contractFileUrl:
            this.normalizeOptionalString(payload.contractFileDataUrl) ?? null,
          contractFileName: payload.contractFileName?.trim() || null,
        },
      });

      await this.syncRenewalFollowUpsForRow(tx, row.id);
      await this.syncIspContractSnapshotFromRows(tx, isp.id);
      return isp.id;
    });

    return this.getIspDetail(createdIsp);
  }

  async updateIsp(ispId: number, payload: UpdateIspDto) {
    const existing = await this.prisma.isp.findUnique({
      where: { id: ispId },
    });
    if (!existing) {
      throw new NotFoundException('ISP not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const updates: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      updates.name = this.normalizeRequiredString(payload.name, 'name');
    }

    if (payload.status !== undefined) {
      updates.status = this.parseIspStatus(payload.status);
    }

    if (payload.contractReference !== undefined) {
      updates.contractReference = this.normalizeRequiredString(
        payload.contractReference,
        'contractReference',
      );
    }

    if (payload.contractStartDate !== undefined) {
      const value = this.parseOptionalIsoDate(
        payload.contractStartDate,
        'contractStartDate',
      );
      updates.contractStartDate = value ? parseDate(value) : null;
    }

    if (payload.contractPeriodStart !== undefined) {
      const value = this.parseOptionalIsoDate(
        payload.contractPeriodStart,
        'contractPeriodStart',
      );
      updates.contractPeriodStart = value ? parseDate(value) : null;
    }

    if (payload.contractPeriodEnd !== undefined) {
      const value = this.parseOptionalIsoDate(
        payload.contractPeriodEnd,
        'contractPeriodEnd',
      );
      updates.contractPeriodEnd = value ? parseDate(value) : null;
    }

    if (payload.paket !== undefined) {
      updates.paket = this.parsePackageType(payload.paket);
    }

    if (payload.jumlah !== undefined) {
      updates.jumlah = this.parseJumlah(payload.jumlah);
    }

    if (payload.logoUrl !== undefined) {
      updates.logoUrl = payload.logoUrl;
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No valid fields provided for update.');
    }

    await this.prisma.isp.update({
      where: { id: ispId },
      data: updates,
    });

    return this.mapIsp(
      await this.prisma.isp.findUniqueOrThrow({
        where: { id: ispId },
      }),
    );
  }

  async deleteIsp(ispId: number) {
    const existing = await this.prisma.isp.findUnique({
      where: { id: ispId },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException('ISP not found.');
    }

    await this.prisma.isp.delete({
      where: { id: ispId },
    });

    return {
      success: true,
      deletedId: existing.id,
      deletedName: existing.name,
    };
  }

  async listIspTenants(ispId: number) {
    const isp = await this.getIspRecordOrThrow(ispId);
    return this.mapIspTenantsFromRecord(isp);
  }

  async attachTenant(ispId: number, payload: { customerId?: number }) {
    await this.ensureIspExists(ispId);

    const customerId = Number(payload?.customerId);
    if (!Number.isFinite(customerId)) {
      throw new BadRequestException('customerId is required.');
    }

    await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }

      const existingMembership = await tx.customerIspMembership.findFirst({
        where: { customerId, ispId },
      });

      if (!existingMembership) {
        await tx.customerIspMembership.create({
          data: { customerId, ispId },
        });
      }

      await this.syncCustomerPrimaryIspName(tx, customerId);
    });

    return {
      ispId,
      customerId,
      isps: await this.listCustomerIsps(customerId),
    };
  }

  async removeTenant(
    ispId: number,
    customerId: number,
    payload?: {
      mode?: 'this' | 'all' | 'selected';
      ispIds?: number[];
    },
  ) {
    await this.ensureIspExists(ispId);
    await this.ensureCustomerExists(customerId);

    const mode = payload?.mode ?? 'this';

    if (mode === 'all') {
      const result = await this.prisma.$transaction(async (tx) => {
        const removed = await tx.customerIspMembership.deleteMany({
          where: { customerId },
        });
        await this.syncCustomerPrimaryIspName(tx, customerId);
        return removed.count;
      });

      return {
        mode,
        removed: result,
        isps: await this.listCustomerIsps(customerId),
      };
    }

    if (mode === 'selected') {
      const ispIds = Array.isArray(payload?.ispIds)
        ? payload.ispIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        : [];

      if (ispIds.length === 0) {
        throw new BadRequestException(
          'ispIds is required when mode is selected.',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const removed = await tx.customerIspMembership.deleteMany({
          where: {
            customerId,
            ispId: { in: ispIds },
          },
        });
        await this.syncCustomerPrimaryIspName(tx, customerId);
        return removed.count;
      });

      return {
        mode,
        removed: result,
        isps: await this.listCustomerIsps(customerId),
      };
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customerIspMembership.deleteMany({
        where: { customerId, ispId },
      });
      await this.syncCustomerPrimaryIspName(tx, customerId);
      return result.count;
    });

    return {
      mode: 'this',
      removed,
      isps: await this.listCustomerIsps(customerId),
    };
  }

  private async getIspRecordOrThrow(ispId: number) {
    const isp = await this.prisma.isp.findUnique({
      where: { id: ispId },
      include: {
        customerMemberships: {
          include: {
            customer: {
              include: {
                contracts: {
                  orderBy: { id: 'desc' },
                  include: {
                    versions: {
                      orderBy: { versionNumber: 'desc' },
                    },
                  },
                },
                invoices: {
                  where: { scheduleStatus: 'active' },
                },
              },
            },
          },
        },
      },
    });

    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    return isp;
  }

  private async ensureIspExists(ispId: number) {
    const isp = await this.prisma.isp.findUnique({
      where: { id: ispId },
      select: { id: true },
    });
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }
  }

  private async ensureCustomerExists(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
  }

  private mapIsp(isp: IspRecord) {
    return {
      id: isp.id,
      name: isp.name,
      status: isp.status,
      contractReference: isp.contractReference ?? null,
      contractStartDate: toIsoDate(isp.contractStartDate),
      contractPeriodStart: toIsoDate(isp.contractPeriodStart),
      contractPeriodEnd: toIsoDate(isp.contractPeriodEnd),
      paket: isp.paket,
      jumlah: isp.jumlah,
      billingPeriodMode: isp.billingPeriodMode ?? null,
      billingCustomEvery: isp.billingCustomEvery ?? null,
      billingCustomUnit: isp.billingCustomUnit ?? null,
      activationFeeAmount: Number(isp.activationFeeAmount ?? 0),
      activationFeePaidAt: toIsoTimestamp(isp.activationFeePaidAt),
      logoUrl: isp.logoUrl,
      contractFileUrl: isp.contractFileUrl ?? null,
      contractFileName: isp.contractFileName ?? null,
      createdAt: isp.createdAt.toISOString(),
      updatedAt: isp.updatedAt.toISOString(),
    };
  }

  private mapRenewalFollowUp(followUp: IspRenewalFollowUpRecord) {
    return {
      id: followUp.id,
      rowId: followUp.rowId,
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

  private mapIspContractRow(row: IspContractRowWithFollowUps) {
    return {
      id: row.id,
      ispId: row.ispId,
      contractReference: row.contractReference,
      periodStart: toIsoDate(row.periodStart),
      periodEnd: toIsoDate(row.periodEnd),
      renewalStatus: row.renewalStatus,
      contractFileUrl: row.contractFileUrl ?? null,
      contractFileName: row.contractFileName ?? null,
      bakFileUrl: row.bakFileUrl ?? null,
      bakFileName: row.bakFileName ?? null,
      renewalFileUrl: row.renewalFileUrl ?? null,
      renewalFileName: row.renewalFileName ?? null,
      responseFileUrl: row.responseFileUrl ?? null,
      responseFileName: row.responseFileName ?? null,
      renewalFollowUps: [...(row.renewalFollowUps ?? [])]
        .sort((left, right) => left.splitOrder - right.splitOrder)
        .map((followUp) => this.mapRenewalFollowUp(followUp)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async uploadContractRowFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.ispContractRow.findFirst({
        where: { id: rowId, ispId },
      });

      if (!row) {
        throw new NotFoundException('Contract row not found.');
      }

      await tx.ispContractRow.update({
        where: { id: rowId },
        data: {
          contractFileUrl: fileUrl,
          contractFileName: fileName,
        },
      });

      await this.syncIspContractSnapshotFromRows(tx, ispId);
      return this.getMappedRow(tx, rowId);
    });
  }

  private mapIspTenantsFromRecord(isp: IspRecordWithCustomers) {
    const tenants = [...(isp.customerMemberships ?? [])]
      .map((membership) => membership.customer)
      .sort((left, right) => left.name.localeCompare(right.name));

    return tenants.map((tenant) => {
      const contract = [...(tenant.contracts ?? [])].sort(
        (left, right) => right.id - left.id,
      )[0];
      const versions = [...(contract?.versions ?? [])].sort(
        (left, right) => right.versionNumber - left.versionNumber,
      );
      const activeVersion = this.findActiveContractVersion(
        versions.map((version) => ({
          id: version.id,
          startDate: toIsoDate(version.startDate)!,
          endDate: toIsoDate(version.endDate)!,
          bakDocumentId: version.bakDocumentId,
        })),
        (contract?.status as ContractStatus | null) ?? null,
        new Date().toISOString().slice(0, 10),
      );
      const activeVersionRecord =
        versions.find((version) => version.id === activeVersion?.id) ?? null;
      const latestVersion = versions[0] ?? null;
      const versionSnapshot = activeVersionRecord ?? latestVersion;
      const todoSummary = this.buildTenantTodoSummary(tenant, versions);

      return {
        id: tenant.id,
        customerCode: tenant.customerCode,
        ispName: tenant.ispName,
        name: tenant.name,
        status: tenant.status,
        activationFeeAmount: Number(tenant.activationFeeAmount ?? 0),
        activationFeePaidAt: toIsoTimestamp(tenant.activationFeePaidAt),
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        paket:
          versionSnapshot?.coreType === 'sharing_core' ? 'shared core' : 'core',
        jumlah:
          versionSnapshot?.coreType === 'core'
            ? (versionSnapshot?.coreTotal ?? null)
            : (versionSnapshot?.sharedCoreRatio ?? null),
        contractSharingRatio: versionSnapshot?.sharedCoreRatio ?? null,
        todoSummary,
        activeContractVersionId: activeVersionRecord?.id ?? null,
      };
    });
  }

  private buildTenantTodoSummary(
    tenant: IspTenantRecord,
    versions: IspTenantContractVersionRecord[],
  ) {
    const referenceDate = new Date().toISOString().slice(0, 10);
    const priority: Array<{ id: string }> = [];
    const needAction: Array<{ id: string }> = [];
    const info: Array<{ id: string }> = [];

    const contract = [...(tenant.contracts ?? [])].sort(
      (left, right) => right.id - left.id,
    )[0];
    const activeVersion = this.findActiveContractVersion(
      versions.map((version) => ({
        id: version.id,
        startDate: toIsoDate(version.startDate)!,
        endDate: toIsoDate(version.endDate)!,
        bakDocumentId: version.bakDocumentId,
      })),
      (contract?.status as ContractStatus | null) ?? null,
      referenceDate,
    );
    const latestVersion = versions[0] ?? null;

    if (activeVersion) {
      const daysLeft = Math.ceil(
        (parseDate(activeVersion.endDate).getTime() -
          parseDate(referenceDate).getTime()) /
          (24 * 60 * 60 * 1000),
      );

      if (daysLeft <= 90 && daysLeft >= 0) {
        priority.push({ id: 'contract_expiring_90_days' });
      }
    }

    const customerInvoices = (tenant.invoices ?? []).filter(
      (invoice) => invoice.scheduleStatus === 'active',
    );

    const overdueInvoices = customerInvoices.filter((invoice) => {
      if (!invoice.invoiceFileUrl) {
        return false;
      }

      if (invoice.status === 'terlambat') {
        return true;
      }

      const dueDate = toIsoDate(invoice.dueDate);
      return (
        invoice.status !== 'lunas' &&
        Boolean(dueDate) &&
        dueDate! < referenceDate
      );
    });

    if (overdueInvoices.length > 0) {
      priority.push({ id: 'payment_overdue' });
    }

    if (latestVersion && latestVersion.bakDocumentId === null) {
      needAction.push({ id: 'bak_missing' });
    }

    const invoicesWithoutUpload = customerInvoices.filter((invoice) => {
      const dueDate = toIsoDate(invoice.dueDate);
      if (invoice.invoiceFileUrl || !dueDate) {
        return false;
      }

      return this.addDays(dueDate, -7) <= referenceDate;
    });

    if (invoicesWithoutUpload.length > 0) {
      needAction.push({ id: 'invoice_not_uploaded' });
    }

    const pendingInvoices = customerInvoices.filter((invoice) => {
      const dueDate = toIsoDate(invoice.dueDate);
      if (!invoice.invoiceFileUrl) {
        return false;
      }
      if (invoice.status === 'lunas' || invoice.paymentProofFileUrl) {
        return false;
      }
      if (!dueDate) {
        return true;
      }
      return dueDate >= referenceDate;
    });

    if (pendingInvoices.length > 0) {
      needAction.push({ id: 'payment_pending' });
    }

    const invoicesWithoutAmount = customerInvoices.filter(
      (invoice) => Number(invoice.amount ?? 0) <= 0,
    );
    if (invoicesWithoutAmount.length > 0) {
      needAction.push({ id: 'invoice_amount_missing' });
    }

    return {
      priority: [],
      needAction: [],
      info: [],
      counts: {
        priority: priority.length,
        needAction: needAction.length,
        info: info.length,
      },
    };
  }

  private getIspOperationalSummaryFromRecord(isp: IspRecordWithCustomers) {
    const tenants = this.mapIspTenantsFromRecord(isp);
    const today = new Date().toISOString().slice(0, 10);

    let tenantsMissingBak = 0;
    let tenantsUnpaid = 0;
    let tenantsExpiringContract = 0;

    [...(isp.customerMemberships ?? [])]
      .map((membership) => membership.customer)
      .forEach((tenant) => {
        const contract = [...(tenant.contracts ?? [])].sort(
          (left, right) => right.id - left.id,
        )[0];
        const latestVersion = [...(contract?.versions ?? [])].sort(
          (left, right) => right.versionNumber - left.versionNumber,
        )[0];

        if (latestVersion && latestVersion.bakDocumentId === null) {
          tenantsMissingBak += 1;
        }

        const hasUnpaidInvoice = (tenant.invoices ?? []).some(
          (invoice) =>
            invoice.status === 'belum_bayar' || invoice.status === 'terlambat',
        );

        if (hasUnpaidInvoice) {
          tenantsUnpaid += 1;
        }

        const activeVersion = this.findActiveContractVersion(
          [...(contract?.versions ?? [])]
            .sort((left, right) => right.versionNumber - left.versionNumber)
            .map((version) => ({
              id: version.id,
              startDate: toIsoDate(version.startDate)!,
              endDate: toIsoDate(version.endDate)!,
              bakDocumentId: version.bakDocumentId,
            })),
          (contract?.status as ContractStatus | null) ?? null,
          today,
        );

        if (activeVersion) {
          const daysLeft = Math.ceil(
            (parseDate(activeVersion.endDate).getTime() -
              parseDate(today).getTime()) /
              (24 * 60 * 60 * 1000),
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

  private async listIspContractRowsInternal(ispId: number) {
    const rows = await this.prisma.ispContractRow.findMany({
      where: { ispId },
      orderBy: { id: 'asc' },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    for (const row of rows) {
      await this.prisma.$transaction(async (tx) => {
        await this.syncRenewalFollowUpsForRow(tx, row.id);
      });
    }

    const refreshedRows = await this.prisma.ispContractRow.findMany({
      where: { ispId },
      orderBy: { id: 'asc' },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    return refreshedRows.map((row) => this.mapIspContractRow(row));
  }

  private async getMappedRow(tx: PrismaTx, rowId: number) {
    const row = await tx.ispContractRow.findUniqueOrThrow({
      where: { id: rowId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });
    return this.mapIspContractRow(row);
  }

  private async syncRenewalFollowUpsForRow(tx: PrismaTx, rowId: number) {
    const row = await tx.ispContractRow.findUnique({
      where: { id: rowId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });
    if (!row) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = row.periodEnd ?? null;
    const daysLeft = endDate
      ? Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    if (
      row.renewalStatus !== 'terminated' &&
      row.renewalStatus !== 'renewed' &&
      row.renewalStatus !== 'needs_completion'
    ) {
      await this.ensureAutoFollowUp(
        tx,
        row,
        daysLeft,
        90,
        1,
        'auto_h90',
        'Peringatan Pertama',
        'Kontrak mendekati akhir masa berlaku. Unggah berkas perpanjangan atau tambah tindak lanjut.',
      );
      await this.ensureAutoFollowUp(
        tx,
        row,
        daysLeft,
        30,
        2,
        'auto_h30',
        'Peringatan Kedua',
        'Belum ada tanggapan yang selesai. Lanjutkan tindak lanjut perpanjangan pada split ini.',
      );
    }

    await this.syncRenewalMirrorFields(tx, rowId);
  }

  private async ensureAutoFollowUp(
    tx: PrismaTx,
    row: IspContractRowWithFollowUps,
    daysLeft: number | null,
    thresholdDays: number,
    splitOrder: number,
    triggerCode: string,
    title: string,
    description: string,
  ) {
    if (daysLeft === null || daysLeft > thresholdDays) {
      return;
    }

    const alreadyHandled = (row.renewalFollowUps ?? []).some(
      (followUp) =>
        followUp.splitOrder >= splitOrder ||
        followUp.triggerCode === triggerCode,
    );

    if (alreadyHandled) {
      return;
    }

    await tx.ispRenewalFollowUp.create({
      data: {
        rowId: row.id,
        splitOrder,
        source: IspRenewalFollowUpSource.Auto,
        triggerCode,
        title,
        description,
        status: IspRenewalFollowUpStatus.Warning,
      },
    });
  }

  private async resolveTargetFollowUp(
    tx: PrismaTx,
    rowId: number,
    followUpId?: number | null,
  ) {
    await this.syncRenewalFollowUpsForRow(tx, rowId);

    const row = await tx.ispContractRow.findUniqueOrThrow({
      where: { id: rowId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    if (followUpId !== undefined && followUpId !== null) {
      const matched = row.renewalFollowUps.find(
        (item) => item.id === followUpId,
      );
      if (matched) {
        return matched;
      }

      throw new NotFoundException(
        `Renewal follow-up ${followUpId} was not found for contract row ${rowId}.`,
      );
    }

    const existingPending = [...row.renewalFollowUps]
      .filter((item) => item.status !== 'completed')
      .sort((left, right) => left.splitOrder - right.splitOrder)[0];

    if (existingPending) {
      return existingPending;
    }

    const nextOrder =
      (row.renewalFollowUps[row.renewalFollowUps.length - 1]?.splitOrder ?? 0) +
      1;
    return tx.ispRenewalFollowUp.create({
      data: {
        rowId,
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

  private async syncRenewalMirrorFields(tx: PrismaTx, rowId: number) {
    const row = await tx.ispContractRow.findUniqueOrThrow({
      where: { id: rowId },
      include: {
        renewalFollowUps: {
          orderBy: { splitOrder: 'asc' },
        },
      },
    });

    const latestWithRenewal = [...row.renewalFollowUps]
      .filter((item) => item.renewalFileUrl)
      .sort((left, right) => right.splitOrder - left.splitOrder)[0];
    const latestWithResponse = [...row.renewalFollowUps]
      .filter((item) => item.responseFileUrl)
      .sort((left, right) => right.splitOrder - left.splitOrder)[0];

    let renewalStatus = row.renewalStatus;
    if (
      renewalStatus !== 'terminated' &&
      renewalStatus !== 'renewed' &&
      renewalStatus !== 'needs_completion'
    ) {
      const hasPendingResponse = row.renewalFollowUps.some(
        (item) =>
          item.status === 'pending_response' ||
          (item.renewalFileUrl && !item.responseFileUrl),
      );
      const hasWarning = row.renewalFollowUps.some(
        (item) => item.status === 'warning',
      );

      renewalStatus = hasPendingResponse
        ? IspRenewalStatus.Pending
        : hasWarning
          ? IspRenewalStatus.Warning
          : IspRenewalStatus.Active;
    }

    await tx.ispContractRow.update({
      where: { id: rowId },
      data: {
        renewalFileUrl: latestWithRenewal?.renewalFileUrl ?? null,
        renewalFileName: latestWithRenewal?.renewalFileName ?? null,
        responseFileUrl: latestWithResponse?.responseFileUrl ?? null,
        responseFileName: latestWithResponse?.responseFileName ?? null,
        renewalStatus,
      },
    });
  }

  private async syncIspContractSnapshotFromRows(tx: PrismaTx, ispId: number) {
    const latestActiveRow =
      (await tx.ispContractRow.findFirst({
        where: {
          ispId,
          renewalStatus: {
            notIn: [
              IspRenewalStatus.Terminated,
              IspRenewalStatus.NeedsCompletion,
            ],
          },
        },
        orderBy: { id: 'desc' },
      })) ??
      (await tx.ispContractRow.findFirst({
        where: {
          ispId,
          renewalStatus: { not: IspRenewalStatus.Terminated },
        },
        orderBy: { id: 'desc' },
      }));

    if (!latestActiveRow) {
      return;
    }

    const snapshotContractReference =
      latestActiveRow.contractReference?.trim() || null;
    const snapshotPeriodStart = latestActiveRow.periodStart;
    const snapshotPeriodEnd = latestActiveRow.periodEnd;

    const existingIsp = await tx.isp.findUniqueOrThrow({
      where: { id: ispId },
    });

    await tx.isp.update({
      where: {
        id: ispId,
      },
      data: {
        contractReference: snapshotContractReference,
        contractPeriodStart: snapshotPeriodStart,
        contractPeriodEnd: snapshotPeriodEnd,
        contractStartDate:
          existingIsp.contractStartDate ?? snapshotPeriodStart ?? null,
      },
    });
  }

  private async syncCustomerPrimaryIspName(tx: PrismaTx, customerId: number) {
    const memberships = await tx.customerIspMembership.findMany({
      where: { customerId },
      include: { isp: true },
      orderBy: { id: 'asc' },
    });

    const primaryIsp = [...memberships]
      .map((membership: CustomerIspMembershipWithIsp) => membership.isp)
      .sort((left, right) => left.name.localeCompare(right.name))[0];

    await tx.customer.update({
      where: { id: customerId },
      data: { ispName: primaryIsp?.name ?? '-' },
    });
  }

  private async listCustomerIsps(customerId: number) {
    const memberships = await this.prisma.customerIspMembership.findMany({
      where: { customerId },
      include: { isp: true },
      orderBy: { id: 'asc' },
    });

    return [...memberships]
      .map((membership) => this.mapIsp(membership.isp))
      .sort((left, right) => left.name.localeCompare(right.name));
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

  private addDays(value: string, days: number): string {
    const next = parseDate(value);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
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
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Optional string value must be a string.');
    }

    const normalized = value.trim();
    return normalized || null;
  }

  private parseOptionalIsoDate(value: unknown, field: string): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be a string date.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${field} must be in YYYY-MM-DD format.`);
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} is invalid.`);
    }

    return value;
  }

  private parseIspStatus(value?: IspStatus): IspStatus {
    if (!value) {
      return IspStatus.Aktif;
    }

    if (value !== IspStatus.Aktif && value !== IspStatus.Nonaktif) {
      throw new BadRequestException('status must be aktif or nonaktif.');
    }

    return value;
  }

  private parsePackageType(value?: IspPackageType): IspPackageType {
    if (!value) {
      return IspPackageType.Shared;
    }

    if (value !== IspPackageType.Core && value !== IspPackageType.Shared) {
      throw new BadRequestException('paket must be core or shared.');
    }

    return value;
  }

  private parseJumlah(value: unknown, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }

      throw new BadRequestException('jumlah is required.');
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('jumlah must be a non-negative number.');
    }

    return Math.round(parsed);
  }

  async uploadIspLogo(ispId: number, fileUrl: string) {
    const isp = await this.prisma.isp.findUnique({
      where: { id: ispId },
    });

    if (!isp) {
      throw new NotFoundException(`ISP with ID ${ispId} not found.`);
    }

    const updatedIsp = await this.prisma.isp.update({
      where: { id: ispId },
      data: {
        logoUrl: fileUrl,
      },
    });

    return {
      success: true,
      message: 'ISP logo uploaded successfully.',
      data: this.mapIsp(updatedIsp),
    };
  }

  async uploadContractFile(ispId: number, fileUrl: string, fileName: string) {
    const isp = await this.prisma.isp.findUnique({
      where: { id: ispId },
    });

    if (!isp) {
      throw new NotFoundException(`ISP with ID ${ispId} not found.`);
    }

    const updatedIsp = await this.prisma.isp.update({
      where: { id: ispId },
      data: {
        contractFileUrl: fileUrl,
        contractFileName: fileName,
      },
    });

    return {
      success: true,
      message: 'ISP contract file uploaded successfully.',
      data: this.mapIsp(updatedIsp),
    };
  }
}
