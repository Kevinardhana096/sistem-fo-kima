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
import { IspsService } from './isps.service';
import { CreateIspDto } from './dto/create-isp.dto';
import { UpdateIspDto } from './dto/update-isp.dto';
import { UploadRenewalFileDto } from './dto/upload-renewal-file.dto';
import { RespondRenewalDto } from './dto/respond-renewal.dto';
import { UploadBakFileDto } from './dto/upload-bak-file.dto';
import { UploadIspLogoDto } from './dto/upload-isp-logo.dto';
import { UploadContractFileDto } from './dto/upload-contract-file.dto';

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
  fileDataUrl: string | undefined,
  file: Express.Multer.File | undefined,
  fieldName: string,
): string => {
  const resolved = fileDataUrl?.trim() || buildUploadedFileDataUrl(file);
  if (!resolved) {
    throw new BadRequestException(`${fieldName} is required.`);
  }

  return resolved;
};

@Controller('api/isps')
export class IspsController {
  constructor(private readonly ispsService: IspsService) {}

  @Get()
  listIsps() {
    return this.ispsService.listIsps();
  }

  @Post()
  createIsp(@Body() payload: CreateIspDto) {
    return this.ispsService.createIsp(payload);
  }

  @Get(':ispId')
  getIspDetail(@Param('ispId', ParseIntPipe) ispId: number) {
    return this.ispsService.getIspDetail(ispId);
  }

  @Get(':ispId/contract-rows')
  getIspContractRows(@Param('ispId', ParseIntPipe) ispId: number) {
    return this.ispsService.getIspContractRows(ispId);
  }

  @Patch(':ispId')
  updateIsp(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Body() payload: UpdateIspDto,
  ) {
    return this.ispsService.updateIsp(ispId, payload);
  }

  @Delete(':ispId')
  deleteIsp(
    @Param('ispId', ParseIntPipe)
    ispId: number,
  ) {
    return this.ispsService.deleteIsp(ispId);
  }

  @Get(':ispId/tenants')
  listIspTenants(@Param('ispId', ParseIntPipe) ispId: number) {
    return this.ispsService.listIspTenants(ispId);
  }

  @Post(':ispId/tenants')
  attachTenant(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Body() payload: { customerId?: number },
  ) {
    return this.ispsService.attachTenant(ispId, payload);
  }

  @Delete(':ispId/tenants/:customerId')
  removeTenant(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() payload?: { mode?: 'this' | 'all' | 'selected'; ispIds?: number[] },
  ) {
    return this.ispsService.removeTenant(ispId, customerId, payload);
  }

  // New Renewal Workflow Endpoints
  @Patch(':ispId/contract-rows/:rowId')
  updateContractRow(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.ispsService.updateContractRow(ispId, rowId, payload);
  }

  @Post(':ispId/contract-rows/:rowId/follow-ups')
  addManualRenewalFollowUp(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: { title?: string; description?: string },
  ) {
    return this.ispsService.addManualRenewalFollowUp(ispId, rowId, payload);
  }

  @Post(':ispId/contract-rows/:rowId/renewal')
  @UseInterceptors(FileInterceptor('file'))
  uploadRenewalFile(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: UploadRenewalFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.uploadRenewalFile(
      ispId,
      rowId,
      resolveRequiredFileDataUrl(payload?.fileDataUrl, file, 'renewal file'),
      payload?.fileName?.trim() || file?.originalname || 'perpanjangan.pdf',
      payload.followUpId,
    );
  }

  @Post(':ispId/contract-rows/:rowId/response')
  @UseInterceptors(FileInterceptor('file'))
  respondRenewal(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: RespondRenewalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.respondRenewal(ispId, rowId, {
      decision: payload.decision,
      fileUrl: resolveRequiredFileDataUrl(
        payload?.fileDataUrl,
        file,
        'response file',
      ),
      fileName:
        payload?.fileName?.trim() || file?.originalname || 'tanggapan.pdf',
      followUpId: payload.followUpId,
    });
  }

  @Post(':ispId/contract-rows/:rowId/bak')
  @UseInterceptors(FileInterceptor('file'))
  uploadBakFile(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: UploadBakFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.uploadBakFile(
      ispId,
      rowId,
      resolveRequiredFileDataUrl(payload?.fileDataUrl, file, 'bak file'),
      payload?.fileName?.trim() || file?.originalname || 'bak.pdf',
    );
  }

  @Post(':ispId/logo')
  @UseInterceptors(FileInterceptor('file'))
  uploadIspLogo(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Body() payload: UploadIspLogoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.uploadIspLogo(
      ispId,
      resolveRequiredFileDataUrl(payload?.fileDataUrl, file, 'logo file'),
    );
  }

  @Post(':ispId/contract-file')
  @UseInterceptors(FileInterceptor('file'))
  uploadContractFile(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Body() payload: UploadContractFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.uploadContractFile(
      ispId,
      resolveRequiredFileDataUrl(payload?.fileDataUrl, file, 'contract file'),
      payload?.fileName?.trim() || file?.originalname || 'kontrak.pdf',
    );
  }

  @Post(':ispId/contract-rows/:rowId/contract-file')
  @UseInterceptors(FileInterceptor('file'))
  uploadContractRowFile(
    @Param('ispId', ParseIntPipe) ispId: number,
    @Param('rowId', ParseIntPipe) rowId: number,
    @Body() payload: UploadContractFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ispsService.uploadContractRowFile(
      ispId,
      rowId,
      resolveRequiredFileDataUrl(payload?.fileDataUrl, file, 'contract file'),
      payload?.fileName?.trim() || file?.originalname || 'kontrak.pdf',
    );
  }
}
