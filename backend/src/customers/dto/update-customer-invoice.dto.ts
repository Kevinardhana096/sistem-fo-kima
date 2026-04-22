export class UpdateCustomerInvoiceDto {
    invoiceNumber?: string | null;
    followUpId?: number | null;
    invoiceFollowUps?: Array<{
        id: number;
        invoiceNumber?: string | null;
    }>;
    periodStartDate?: string | null;
    periodEndDate?: string | null;
    dueDate?: string | null;
    amount?: number;
    paidAt?: string | null;
    invoiceFileUrl?: string | null;
    paymentProofFileUrl?: string | null;
}
