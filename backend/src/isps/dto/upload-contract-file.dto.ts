import { IsOptional, IsString } from 'class-validator';

export class UploadContractFileDto {
  @IsOptional()
  @IsString()
  fileDataUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
