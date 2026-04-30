import { BadRequestException, Injectable } from '@nestjs/common';
import { RouteFlowStatus, RoutePointType } from '../shared/types/domain.types';
import { CreateContractVersionDto } from './dto/create-contract-version.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerContractDto } from './dto/create-customer-contract.dto';
import { PrismaCustomersReadService } from './prisma-customers-read.service';
import { PrismaCustomersWriteService } from './prisma-customers-write.service';
import { UpdateCustomerContractDto } from './dto/update-customer-contract.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';
import {
  ChangeCustomerRouteDto,
  EditCustomerRouteDto,
} from './dto/route-mutations.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prismaRead: PrismaCustomersReadService,
    private readonly prismaWrite: PrismaCustomersWriteService,
  ) {}

  async list() {
    return this.prismaRead.list();
  }

  async create(payload: CreateCustomerDto) {
    const customerId = await this.prismaWrite.create(payload);
    return this.prismaRead.getById(customerId);
  }

  async getById(customerId: number) {
    return this.prismaRead.getById(customerId);
  }

  async update(customerId: number, payload: UpdateCustomerDto) {
    const updatedCustomerId = await this.prismaWrite.update(
      customerId,
      payload,
    );
    return this.prismaRead.getById(updatedCustomerId);
  }

  async archive(customerId: number) {
    const archivedCustomerId = await this.prismaWrite.archive(customerId);
    return this.prismaRead.getById(archivedCustomerId);
  }

  async createContract(customerId: number, payload: CreateCustomerContractDto) {
    return this.prismaWrite.createContract(customerId, payload);
  }

  async updateContract(
    customerId: number,
    contractId: number,
    payload: UpdateCustomerContractDto,
  ) {
    return this.prismaWrite.updateContract(customerId, contractId, payload);
  }

  async listContractVersions(customerId: number, contractId: number) {
    return this.prismaWrite.listContractVersions(customerId, contractId);
  }

  async createContractVersion(
    customerId: number,
    contractId: number,
    payload: CreateContractVersionDto,
  ) {
    return this.prismaWrite.createContractVersion(
      customerId,
      contractId,
      payload,
    );
  }

  async addContractVersionRenewalFollowUp(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { title?: string; description?: string },
  ) {
    return this.prismaWrite.addContractVersionRenewalFollowUp(
      customerId,
      contractId,
      versionId,
      payload,
    );
  }

  async uploadContractVersionRenewalFile(
    customerId: number,
    contractId: number,
    versionId: number,
    payload: { fileUrl: string; fileName: string; followUpId?: number | null },
  ) {
    return this.prismaWrite.uploadContractVersionRenewalFile(
      customerId,
      contractId,
      versionId,
      payload,
    );
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
    return this.prismaWrite.respondContractVersionRenewal(
      customerId,
      contractId,
      versionId,
      payload,
    );
  }

  async updateInvoice(
    customerId: number,
    invoiceId: number,
    payload: UpdateCustomerInvoiceDto,
  ) {
    return this.prismaWrite.updateInvoice(customerId, invoiceId, payload);
  }

  async addInvoiceFollowUp(
    customerId: number,
    invoiceId: number,
    payload: { title?: string; description?: string },
  ) {
    return this.prismaWrite.addInvoiceFollowUp(customerId, invoiceId, payload);
  }

  async addCustomerIsps(
    customerId: number,
    payload: {
      ispIds?: number[];
      ispNames?: string[];
    },
  ) {
    return this.prismaWrite.addCustomerIsps(customerId, payload);
  }

  async removeCustomerIsps(
    customerId: number,
    payload: {
      mode: 'this' | 'all' | 'selected';
      ispId?: number;
      ispIds?: number[];
    },
  ) {
    return this.prismaWrite.removeCustomerIsps(customerId, payload);
  }

  async changeRoute(customerId: number, payload: ChangeCustomerRouteDto) {
    return this.prismaWrite.changeRoute(customerId, payload);
  }

  async editRoute(customerId: number, payload: EditCustomerRouteDto) {
    return this.prismaWrite.editRoute(customerId, payload);
  }

  getTodoSummary(customerId: number) {
    return this.prismaRead.getTodoSummary(customerId);
  }

  getComplianceStatus(customerId: number) {
    return this.prismaRead.getComplianceStatus(customerId);
  }

  getTimeline(customerId: number) {
    return this.prismaRead.getTimeline(customerId);
  }

  async deleteRouteHistory(customerId: number, historyId: number) {
    return this.prismaWrite.deleteRouteHistory(customerId, historyId);
  }

  async deleteAllRouteHistory(customerId: number) {
    return this.prismaWrite.deleteAllRouteHistory(customerId);
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

  private parseRouteFlowStatus(value: unknown): RouteFlowStatus {
    if (
      value !== RouteFlowStatus.Aktif &&
      value !== RouteFlowStatus.Nonaktif &&
      value !== RouteFlowStatus.Gangguan
    ) {
      throw new BadRequestException(
        'flowStatus must be aktif, nonaktif, or gangguan.',
      );
    }

    return value;
  }

  private parseRoutePointType(value: unknown): RoutePointType {
    if (
      value !== RoutePointType.Awal &&
      value !== RoutePointType.Transit &&
      value !== RoutePointType.Tujuan
    ) {
      throw new BadRequestException(
        'pointType must be awal, transit, or tujuan.',
      );
    }

    return value;
  }
}
