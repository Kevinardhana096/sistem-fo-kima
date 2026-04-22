import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IspPackageType,
  IspStatus,
} from '../shared/types/domain.types';
import { InMemoryDataService } from '../store/in-memory-data.service';
import { CreateIspDto } from './dto/create-isp.dto';
import { UpdateIspDto } from './dto/update-isp.dto';

@Injectable()
export class IspsService {
  constructor(private readonly store: InMemoryDataService) { }

  listIsps() {
    return this.store.listIsps().map((isp) => {
      const summary = this.store.getIspOperationalSummary(isp.id);

      return {
        ...isp,
        tenantCount: summary.tenantCount,
        tenantsMissingBak: summary.tenantsMissingBak,
        tenantsUnpaid: summary.tenantsUnpaid,
        tenantsExpiringContract: summary.tenantsExpiringContract,
      };
    });
  }

  getIspDetail(ispId: number) {
    const isp = this.store.getIspById(ispId);
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    const tenants = this.store.listIspTenants(ispId).map((tenant) => {
      const todoSummary = this.store.buildCustomerTodoSummary(tenant.id);
      const contract = this.store.listCustomerContracts(tenant.id)[0];
      const activeVersion = this.store.getActiveContractVersion(tenant.id);
      const latestVersion = contract
        ? this.store.getLatestContractVersion(contract.id)
        : undefined;
      const versionSnapshot = activeVersion ?? latestVersion;

      return {
        ...tenant,
        paket: versionSnapshot?.coreType === 'sharing_core' ? 'shared core' : 'core',
        jumlah: versionSnapshot?.coreType === 'core'
          ? versionSnapshot?.coreTotal ?? null
          : versionSnapshot?.sharedCoreRatio ?? null,
        contractSharingRatio: versionSnapshot?.sharedCoreRatio ?? null,
        todoSummary,
        activeContractVersionId: activeVersion?.id ?? null,
      };
    });

    const summary = this.store.getIspOperationalSummary(ispId);
    const contractRows = this.store.listIspContractRows(ispId);

    return {
      ...isp,
      summary,
      tenants,
      contractRows,
    };
  }

  getIspContractRows(ispId: number) {
    const isp = this.store.getIspById(ispId);
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    return this.store.listIspContractRows(ispId);
  }

  updateContractRow(ispId: number, rowId: number, payload: any) {
    const row = this.store.getIspContractRowById(rowId);
    if (!row || row.ispId !== ispId) {
      throw new NotFoundException('Contract row not found.');
    }

    const updates: any = {};
    if (payload.contractReference !== undefined) updates.contractReference = payload.contractReference;
    if (payload.periodStart !== undefined) updates.periodStart = this.parseOptionalIsoDate(payload.periodStart, 'periodStart');
    if (payload.periodEnd !== undefined) updates.periodEnd = this.parseOptionalIsoDate(payload.periodEnd, 'periodEnd');

    return this.store.updateIspContractRow(rowId, updates);
  }

  uploadRenewalFile(ispId: number, rowId: number, fileUrl: string, fileName: string, followUpId?: number | null) {
    const row = this.store.getIspContractRowById(rowId);
    if (!row || row.ispId !== ispId) {
      throw new NotFoundException('Contract row not found.');
    }

    return this.store.uploadIspContractRenewalFile(rowId, fileUrl, fileName, followUpId);
  }

  respondRenewal(ispId: number, rowId: number, payload: { decision: 'lanjut' | 'tidak'; fileUrl: string; fileName: string; followUpId?: number | null }) {
    const row = this.store.getIspContractRowById(rowId);
    if (!row || row.ispId !== ispId) {
      throw new NotFoundException('Contract row not found.');
    }

    if (!payload.decision || !['lanjut', 'tidak'].includes(payload.decision)) {
      throw new BadRequestException('Decision must be "lanjut" or "tidak".');
    }

    if (!payload.fileUrl) {
      throw new BadRequestException('Response file is required.');
    }

    return this.store.respondIspContractRenewal(rowId, payload.decision, payload.fileUrl, payload.fileName, payload.followUpId);
  }

  addManualRenewalFollowUp(
    ispId: number,
    rowId: number,
    payload: { title?: string; description?: string },
  ) {
    const row = this.store.getIspContractRowById(rowId);
    if (!row || row.ispId !== ispId) {
      throw new NotFoundException('Contract row not found.');
    }

    return this.store.addManualIspContractRenewalFollowUp(rowId, payload.title, payload.description);
  }

  uploadBakFile(ispId: number, rowId: number, fileUrl: string, fileName: string) {
    const row = this.store.getIspContractRowById(rowId);
    if (!row || row.ispId !== ispId) {
      throw new NotFoundException('Contract row not found.');
    }

    return this.store.uploadIspContractBak(rowId, fileUrl, fileName);
  }

  createIsp(payload: CreateIspDto) {
    const name = this.normalizeRequiredString(payload.name, 'name');
    const contractReference = this.normalizeRequiredString(
      payload.contractReference,
      'contractReference',
    );

    const existingByName = this.store.getIspByName(name);
    if (existingByName) {
      throw new BadRequestException('ISP with this name already exists.');
    }

    const createdIsp = this.store.createIsp({
      name,
      status: this.parseIspStatus(payload.status),
      contractReference,
      contractStartDate: this.parseOptionalIsoDate(
        payload.contractStartDate,
        'contractStartDate',
      ),
      contractPeriodStart: this.parseOptionalIsoDate(
        payload.contractPeriodStart,
        'contractPeriodStart',
      ),
      contractPeriodEnd: this.parseOptionalIsoDate(
        payload.contractPeriodEnd,
        'contractPeriodEnd',
      ),
      paket: this.parsePackageType(payload.paket),
      jumlah: this.parseJumlah(payload.jumlah, 0),
    });

    this.store.createIspContractRow({
      ispId: createdIsp.id,
      contractReference,
      periodStart: this.parseOptionalIsoDate(
        payload.contractPeriodStart,
        'contractPeriodStart',
      ),
      periodEnd: this.parseOptionalIsoDate(
        payload.contractPeriodEnd,
        'contractPeriodEnd',
      ),
      bakFileUrl: payload.bakFileName?.trim() || null,
      bakFileName: payload.bakFileName?.trim() || null,
    });

    return this.getIspDetail(createdIsp.id);
  }

  updateIsp(ispId: number, payload: UpdateIspDto) {
    const existing = this.store.getIspById(ispId);
    if (!existing) {
      throw new NotFoundException('ISP not found.');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const updates: {
      name?: string;
      status?: IspStatus;
      contractReference?: string | null;
      contractStartDate?: string | null;
      contractPeriodStart?: string | null;
      contractPeriodEnd?: string | null;
      paket?: IspPackageType;
      jumlah?: number;
    } = {};

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
      updates.contractStartDate = this.parseOptionalIsoDate(
        payload.contractStartDate,
        'contractStartDate',
      );
    }

    if (payload.contractPeriodStart !== undefined) {
      updates.contractPeriodStart = this.parseOptionalIsoDate(
        payload.contractPeriodStart,
        'contractPeriodStart',
      );
    }

    if (payload.contractPeriodEnd !== undefined) {
      updates.contractPeriodEnd = this.parseOptionalIsoDate(
        payload.contractPeriodEnd,
        'contractPeriodEnd',
      );
    }

    if (payload.paket !== undefined) {
      updates.paket = this.parsePackageType(payload.paket);
    }

    if (payload.jumlah !== undefined) {
      updates.jumlah = this.parseJumlah(payload.jumlah);
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No valid fields provided for update.');
    }

    const updated = this.store.updateIsp(ispId, updates);
    if (!updated) {
      throw new NotFoundException('ISP not found.');
    }

    return updated;
  }

  listIspTenants(ispId: number) {
    const isp = this.store.getIspById(ispId);
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    return this.store.listIspTenants(ispId).map((tenant) => {
      const contract = this.store.listCustomerContracts(tenant.id)[0];
      const activeVersion = this.store.getActiveContractVersion(tenant.id);
      const latestVersion = contract
        ? this.store.getLatestContractVersion(contract.id)
        : undefined;
      const versionSnapshot = activeVersion ?? latestVersion;

      return {
        ...tenant,
        paket: versionSnapshot?.coreType === 'sharing_core' ? 'shared core' : 'core',
        jumlah: versionSnapshot?.coreType === 'core'
          ? versionSnapshot?.coreTotal ?? null
          : versionSnapshot?.sharedCoreRatio ?? null,
        contractSharingRatio: versionSnapshot?.sharedCoreRatio ?? null,
        todoSummary: this.store.buildCustomerTodoSummary(tenant.id),
      };
    });
  }

  attachTenant(ispId: number, payload: { customerId?: number }) {
    const isp = this.store.getIspById(ispId);
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    const customerId = Number(payload?.customerId);
    if (!Number.isFinite(customerId)) {
      throw new BadRequestException('customerId is required.');
    }

    const customer = this.store.getCustomerById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    this.store.addCustomerToIsps(customerId, [ispId]);

    return {
      ispId,
      customerId,
      isps: this.store.listCustomerIsps(customerId),
    };
  }

  removeTenant(
    ispId: number,
    customerId: number,
    payload?: {
      mode?: 'this' | 'all' | 'selected';
      ispIds?: number[];
    },
  ) {
    const isp = this.store.getIspById(ispId);
    if (!isp) {
      throw new NotFoundException('ISP not found.');
    }

    const customer = this.store.getCustomerById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const mode = payload?.mode ?? 'this';

    if (mode === 'all') {
      const removed = this.store.removeCustomerFromAllIsps(customerId);
      return {
        mode,
        removed,
        isps: this.store.listCustomerIsps(customerId),
      };
    }

    if (mode === 'selected') {
      const ispIds = Array.isArray(payload?.ispIds)
        ? payload.ispIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];

      if (ispIds.length === 0) {
        throw new BadRequestException('ispIds is required when mode is selected.');
      }

      const removed = this.store.removeCustomerFromSelectedIsps(customerId, ispIds);

      return {
        mode,
        removed,
        isps: this.store.listCustomerIsps(customerId),
      };
    }

    const removed = this.store.removeCustomerFromIsp(customerId, ispId);

    return {
      mode: 'this',
      removed: removed ? 1 : 0,
      isps: this.store.listCustomerIsps(customerId),
    };
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
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('contractReference must be a string.');
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
}
