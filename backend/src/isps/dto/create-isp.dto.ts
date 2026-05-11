import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { IspPackageType, IspStatus } from '../../shared/types/domain.types';

export class CreateIspDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(IspStatus)
  status?: IspStatus;

  @IsOptional()
  @IsString()
  contractReference?: string | null;

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
  @IsString()
  bakFileDataUrl?: string | null;

  @IsOptional()
  @IsString()
  bakFileName?: string | null;

  @IsOptional()
  @IsString()
  contractFileDataUrl?: string | null;

  @IsOptional()
  @IsString()
  contractFileName?: string | null;

  @IsOptional()
  @IsEnum(IspPackageType)
  paket?: IspPackageType;

  @IsOptional()
  @IsInt()
  jumlah?: number;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  userEmail?: string | null;

  @IsOptional()
  @IsString()
  userPassword?: string | null;
}
