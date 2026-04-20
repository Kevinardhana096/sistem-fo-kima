import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateContractVersionDto } from './dto/create-contract-version.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateCustomerContractDto } from './dto/create-customer-contract.dto';
import { UpdateCustomerContractDto } from './dto/update-customer-contract.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerInvoiceDto } from './dto/update-customer-invoice.dto';

@Controller('api/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

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
    return this.customersService.updateContract(customerId, contractId, payload);
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
    return this.customersService.createContractVersion(customerId, contractId, payload);
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
    @Body() payload: { mode: 'this' | 'all' | 'selected'; ispId?: number; ispIds?: number[] },
  ) {
    return this.customersService.removeCustomerIsps(customerId, payload);
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
}
