import { IspPackageType, IspStatus } from '../../shared/types/domain.types';

export class CreateIspDto {
    name!: string;
    status?: IspStatus;
    contractReference!: string;
    contractStartDate?: string | null;
    contractPeriodStart?: string | null;
    contractPeriodEnd?: string | null;
    bakFileName?: string | null;
    paket?: IspPackageType;
    jumlah?: number;
}
