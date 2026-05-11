import { Injectable } from '@nestjs/common';
import { CreateIspDto } from './dto/create-isp.dto';
import { PrismaIspsService } from './prisma-isps.service';
import { UpdateIspDto } from './dto/update-isp.dto';

@Injectable()
export class IspsService {
  constructor(private readonly prismaIsps: PrismaIspsService) {}

  async listIsps() {
    return this.prismaIsps.listIsps();
  }

  async getIspDetail(ispId: number) {
    return this.prismaIsps.getIspDetail(ispId);
  }

  async getIspContractRows(ispId: number) {
    return this.prismaIsps.getIspContractRows(ispId);
  }

  async updateContractRow(
    ispId: number,
    rowId: number,
    payload: Record<string, unknown>,
  ) {
    return this.prismaIsps.updateContractRow(ispId, rowId, payload);
  }

  async uploadRenewalFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
    followUpId?: number | null,
  ) {
    return this.prismaIsps.uploadRenewalFile(
      ispId,
      rowId,
      fileUrl,
      fileName,
      followUpId,
    );
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
    return this.prismaIsps.respondRenewal(ispId, rowId, payload);
  }

  async addManualRenewalFollowUp(
    ispId: number,
    rowId: number,
    payload: { title?: string; description?: string },
  ) {
    return this.prismaIsps.addManualRenewalFollowUp(ispId, rowId, payload);
  }

  async uploadBakFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
  ) {
    return this.prismaIsps.uploadBakFile(ispId, rowId, fileUrl, fileName);
  }

  async createIsp(payload: CreateIspDto) {
    return this.prismaIsps.createIsp(payload);
  }

  async updateIsp(ispId: number, payload: UpdateIspDto) {
    return this.prismaIsps.updateIsp(ispId, payload);
  }

  async deleteIsp(ispId: number) {
    return this.prismaIsps.deleteIsp(ispId);
  }

  async listIspTenants(ispId: number) {
    return this.prismaIsps.listIspTenants(ispId);
  }

  async attachTenant(ispId: number, payload: { customerId?: number }) {
    return this.prismaIsps.attachTenant(ispId, payload);
  }

  async removeTenant(
    ispId: number,
    customerId: number,
    payload?: {
      mode?: 'this' | 'all' | 'selected';
      ispIds?: number[];
    },
  ) {
    return this.prismaIsps.removeTenant(ispId, customerId, payload);
  }

  async uploadIspLogo(ispId: number, fileUrl: string) {
    return this.prismaIsps.uploadIspLogo(ispId, fileUrl);
  }

  async uploadContractFile(ispId: number, fileUrl: string, fileName: string) {
    return this.prismaIsps.uploadContractFile(ispId, fileUrl, fileName);
  }

  async uploadContractRowFile(
    ispId: number,
    rowId: number,
    fileUrl: string,
    fileName: string,
  ) {
    return this.prismaIsps.uploadContractRowFile(
      ispId,
      rowId,
      fileUrl,
      fileName,
    );
  }

  async getIspUser(ispId: number) {
    return this.prismaIsps.getIspUser(ispId);
  }

  async upsertIspUser(
    ispId: number,
    payload: {
      username?: string;
      email?: string;
      password?: string;
      displayName?: string;
    },
  ) {
    return this.prismaIsps.upsertIspUser(ispId, payload);
  }
}
