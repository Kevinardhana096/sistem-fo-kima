import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BillingUnit, CustomerStatus } from '../../shared/types/domain.types';

export class CreateInvoiceDraftDto {
  @IsOptional()
  @IsString()
  invoiceNumber?: string | null;

  @IsDateString()
  periodStartDate: string;

  @IsDateString()
  periodEndDate: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  invoiceFileUrl?: string | null;

  @IsOptional()
  @IsString()
  paymentProofFileUrl?: string | null;

  @IsOptional()
  @IsDateString()
  paidAt?: string | null;
}

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  ispName?: string;

  @IsOptional()
  @IsArray()
  ispIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  newIspNames?: string[];

  @IsString()
  name: string;

  @IsEnum(CustomerStatus)
  status: CustomerStatus;

  @IsOptional()
  @IsNumber()
  activationFeeAmount?: number;

  @IsOptional()
  @IsDateString()
  activationFeePaidAt?: string | null;

  @IsOptional()
  @IsString()
  contractNumber?: string | null;

  @IsOptional()
  @IsDateString()
  contractStartDate?: string | null;

  @IsOptional()
  @IsDateString()
  contractPeriodStart?: string | null;

  @IsOptional()
  @IsDateString()
  contractPeriodEnd?: string | null;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string | null;

  @IsOptional()
  @IsIn(['core', 'shared'])
  paket?: 'core' | 'shared';

  @IsOptional()
  @IsNumber()
  jumlah?: number;

  @IsOptional()
  @IsNumber()
  contractCoreTotal?: number;

  @IsOptional()
  @IsString()
  contractSharingRatio?: string | null;

  @IsOptional()
  @IsIn(['bulanan', '3bulanan', 'custom'])
  billingPeriodMode?: 'bulanan' | '3bulanan' | 'custom';

  @IsOptional()
  @IsInt()
  billingCustomEvery?: number;

  @IsOptional()
  @IsEnum(BillingUnit)
  billingCustomUnit?: BillingUnit;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceDraftDto)
  invoiceDrafts?: CreateInvoiceDraftDto[];
}
