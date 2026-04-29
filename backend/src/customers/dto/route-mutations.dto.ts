import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RouteFlowStatus, RoutePointType } from '../../shared/types/domain.types';

export class RoutePointDto {
  @IsString()
  pathName: string;

  @IsEnum(RoutePointType)
  pointType: RoutePointType;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsNumber()
  orderNumber?: number;
}

export class ChangeCustomerRouteDto {
  @IsString()
  operation: 'replace';

  @IsString()
  changeNote: string;

  @IsEnum(RouteFlowStatus)
  flowStatus: RouteFlowStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  points: RoutePointDto[];
}

export class EditCustomerRouteDto {
  @IsString()
  operation: 'add' | 'update' | 'delete' | 'reorder' | 'status';

  @IsOptional()
  @IsString()
  pathName?: string;

  @IsOptional()
  @IsEnum(RoutePointType)
  pointType?: RoutePointType;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  pointId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  orderedPointIds?: number[];

  @IsOptional()
  @IsEnum(RouteFlowStatus)
  flowStatus?: RouteFlowStatus;
}
