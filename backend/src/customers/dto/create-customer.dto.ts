import {
    BillingUnit,
    CoreAllocationType,
    CustomerStatus,
} from '../../shared/types/domain.types';

export interface CreateInvoiceDraftDto {
    periodStartDate: string;
    periodEndDate: string;
    invoiceNumber?: string;
    amount: number;
    paidAt?: string | null;
    invoiceFileUrl?: string | null;
    paymentProofFileUrl?: string | null;
}

export class CreateCustomerDto {
    name!: string;
    ispName!: string;
    ispIds?: number[];
    newIspNames?: string[];
    status?: CustomerStatus;
    activationFeeAmount?: number;
    activationFeePaidAt?: string | null;
    contractNumber?: string | null;
    contractStartDate?: string | null;
    contractEndDate?: string | null;
    paket?: 'core' | 'shared';
    jumlah?: number;
    contractCoreTotal?: number;
    contractSharingRatio?: string;
    billingPeriodMode?: 'bulanan' | '3bulanan' | 'custom';
    billingCustomEvery?: number;
    billingCustomUnit?: BillingUnit;
    invoiceDrafts?: CreateInvoiceDraftDto[];
}
