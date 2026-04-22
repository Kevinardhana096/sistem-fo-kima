import {
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

@Controller('api/isps')
export class IspsController {
    constructor(private readonly ispsService: IspsService) { }

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
        @Body() payload: any,
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
        @Body() payload: { fileDataUrl?: string; fileName?: string; followUpId?: number | string },
        @UploadedFile() file: any,
    ) {
        return this.ispsService.uploadRenewalFile(
            ispId,
            rowId,
            payload?.fileDataUrl?.trim() || file?.originalname || 'perpanjangan.pdf',
            payload?.fileName?.trim() || file?.originalname || 'perpanjangan.pdf',
            payload?.followUpId ? Number(payload.followUpId) : undefined,
        );
    }

    @Post(':ispId/contract-rows/:rowId/response')
    @UseInterceptors(FileInterceptor('file'))
    respondRenewal(
        @Param('ispId', ParseIntPipe) ispId: number,
        @Param('rowId', ParseIntPipe) rowId: number,
        @Body() payload: { decision: 'lanjut' | 'tidak'; fileDataUrl?: string; fileName?: string; followUpId?: number | string },
        @UploadedFile() file: any,
    ) {
        return this.ispsService.respondRenewal(ispId, rowId, {
            decision: payload.decision,
            fileUrl: payload?.fileDataUrl?.trim() || file?.originalname || 'tanggapan.pdf',
            fileName: payload?.fileName?.trim() || file?.originalname || 'tanggapan.pdf',
            followUpId: payload?.followUpId ? Number(payload.followUpId) : undefined,
        });
    }

    @Post(':ispId/contract-rows/:rowId/bak')
    @UseInterceptors(FileInterceptor('file'))
    uploadBakFile(
        @Param('ispId', ParseIntPipe) ispId: number,
        @Param('rowId', ParseIntPipe) rowId: number,
        @Body() payload: { fileDataUrl?: string; fileName?: string },
        @UploadedFile() file: any,
    ) {
        return this.ispsService.uploadBakFile(
            ispId,
            rowId,
            payload?.fileDataUrl?.trim() || file?.originalname || 'bak.pdf',
            payload?.fileName?.trim() || file?.originalname || 'bak.pdf',
        );
    }
}
