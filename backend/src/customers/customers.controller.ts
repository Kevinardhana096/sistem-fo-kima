import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { CreateContractVersionDto } from './dto/create-contract-version.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerContractDto } from './dto/create-customer-contract.dto';
import { RespondContractVersionRenewalDto } from './dto/respond-contract-version-renewal.dto';
import { UploadContractVersionRenewalFileDto } from './dto/upload-contract-version-renewal-file.dto';
import { UpdateCustomerContractDto } from './dto/update-customer-contract.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';
import {
  ChangeCustomerRouteDto,
  EditCustomerRouteDto,
} from './dto/route-mutations.dto';

const buildUploadedFileDataUrl = (file?: Express.Multer.File): string => {
  const mimeType =
    typeof file?.mimetype === 'string' && file.mimetype.trim().length > 0
      ? file.mimetype.trim()
      : 'application/octet-stream';

  return file?.buffer
    ? `data:${mimeType};base64,${file.buffer.toString('base64')}`
    : '';
};

const resolveRequiredFileDataUrl = (
  file: Express.Multer.File | undefined,
  fieldName: string,
): string => {
  const fileUrl = buildUploadedFileDataUrl(file);
  if (!fileUrl) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return fileUrl;
};

@Controller('api/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list() {
    return this.customersService.list();
  }

  @Post()
  create(@Body() payload: CreateCustomerDto) {
    return this.customersService.create(payload);
  }

  @Get(':customerId')
  getById(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.getById(customerId);
  }

  @Patch(':customerId/archive')
  archive(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.archive(customerId);
  }

  @Patch(':customerId')
  update(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload: UpdateCustomerDto,
  ) {
    return this.customersService.update(customerId, payload);
  }

  @Patch(':customerId/invoices/:invoiceId')
  updateInvoice(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
    @Body() payload: UpdateCustomerInvoiceDto,
  ) {
    return this.customersService.updateInvoice(customerId, invoiceId, payload);
  }

  @Post(':customerId/invoices/:invoiceId/follow-ups')
  addInvoiceFollowUp(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
    @Body() payload: { title?: string; description?: string },
  ) {
    return this.customersService.addInvoiceFollowUp(
      customerId,
      invoiceId,
      payload,
    );
  }

  @Post(':customerId/contracts')
  createContract(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload: CreateCustomerContractDto,
  ) {
    return this.customersService.createContract(customerId, payload);
  }

  @Patch(':customerId/contracts/:contractId')
  updateContract(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Body() payload: UpdateCustomerContractDto,
  ) {
    return this.customersService.updateContract(
      customerId,
      contractId,
      payload,
    );
  }

  @Get(':customerId/contracts/:contractId/versions')
  listContractVersions(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.customersService.listContractVersions(customerId, contractId);
  }

  @Post(':customerId/contracts/:contractId/versions')
  createContractVersion(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Body() payload: CreateContractVersionDto,
  ) {
    return this.customersService.createContractVersion(
      customerId,
      contractId,
      payload,
    );
  }

  @Post(':customerId/contracts/:contractId/versions/:versionId/follow-ups')
  addContractVersionRenewalFollowUp(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() payload: { title?: string; description?: string },
  ) {
    return this.customersService.addContractVersionRenewalFollowUp(
      customerId,
      contractId,
      versionId,
      payload,
    );
  }

  @Post(':customerId/contracts/:contractId/versions/:versionId/renewal')
  @UseInterceptors(FileInterceptor('file'))
  uploadContractVersionRenewalFile(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() payload: UploadContractVersionRenewalFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.customersService.uploadContractVersionRenewalFile(
      customerId,
      contractId,
      versionId,
      {
        fileUrl: resolveRequiredFileDataUrl(file, 'renewal file'),
        fileName: file?.originalname || 'perpanjangan.pdf',
        followUpId: payload.followUpId,
      },
    );
  }

  @Post(':customerId/contracts/:contractId/versions/:versionId/response')
  @UseInterceptors(FileInterceptor('file'))
  respondContractVersionRenewal(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() payload: RespondContractVersionRenewalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.customersService.respondContractVersionRenewal(
      customerId,
      contractId,
      versionId,
      {
        decision: payload.decision,
        fileUrl: resolveRequiredFileDataUrl(file, 'response file'),
        fileName: file?.originalname || 'tanggapan.pdf',
        followUpId: payload.followUpId,
      },
    );
  }

  @Post(':customerId/isps')
  addCustomerIsps(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload: { ispIds?: number[]; ispNames?: string[] },
  ) {
    return this.customersService.addCustomerIsps(customerId, payload);
  }

  @Post(':customerId/isps/remove')
  removeCustomerIsps(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body()
    payload: {
      mode: 'this' | 'all' | 'selected';
      ispId?: number;
      ispIds?: number[];
    },
  ) {
    return this.customersService.removeCustomerIsps(customerId, payload);
  }

  @Post(':customerId/routes/change')
  changeRoute(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload: ChangeCustomerRouteDto,
  ) {
    return this.customersService.changeRoute(customerId, payload);
  }

  @Post(':customerId/routes/edit')
  editRoute(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload: EditCustomerRouteDto,
  ) {
    return this.customersService.editRoute(customerId, payload);
  }

  @Get(':customerId/todo-summary')
  getTodoSummary(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.getTodoSummary(customerId);
  }

  @Get(':customerId/compliance-status')
  getComplianceStatus(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.getComplianceStatus(customerId);
  }

  @Get(':customerId/timeline')
  getTimeline(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.getTimeline(customerId);
  }

  @Delete(':customerId/routes/history/:historyId')
  deleteRouteHistory(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('historyId', ParseIntPipe) historyId: number,
  ) {
    return this.customersService.deleteRouteHistory(customerId, historyId);
  }

  @Delete(':customerId/routes/history')
  deleteAllRouteHistory(@Param('customerId', ParseIntPipe) customerId: number) {
    return this.customersService.deleteAllRouteHistory(customerId);
  }
}
