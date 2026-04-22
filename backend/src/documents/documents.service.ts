import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DOCUMENT_TYPE_VALUES,
  DocumentRecord,
  DocumentType,
  InvoiceStatus,
} from '../shared/types/domain.types';
import { InMemoryDataService } from '../store/in-memory-data.service';
import {
  DocumentAutomationResult,
  DocumentAutomationService,
} from '../automation/document-automation.service';
import { CreateDocumentDto } from './dto/create-document.dto';

export interface CreateDocumentResponse {
  document: DocumentRecord;
  automation: DocumentAutomationResult;
}

const REQUIRED_CONTRACT_REFERENCE_DOC_TYPES = [
  DocumentType.Penawaran,
  DocumentType.Tanggapan,
  DocumentType.HasilNego,
];

@Injectable()
export class DocumentsService {
  constructor(
    private readonly store: InMemoryDataService,
    private readonly automation: DocumentAutomationService,
  ) { }

  listByCustomer(customerId: number, rawJenisDokumen?: string): DocumentRecord[] {
    this.ensureCustomerExists(customerId);

    const jenisDokumen = rawJenisDokumen
      ? this.parseDocumentType(rawJenisDokumen)
      : undefined;

    if (rawJenisDokumen && !jenisDokumen) {
      throw new BadRequestException(
        `jenisDokumen must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}`,
      );
    }

    return this.store.listCustomerDocuments(customerId, jenisDokumen);
  }

  getById(customerId: number, documentId: number): DocumentRecord {
    this.ensureCustomerExists(customerId);

    const document = this.store.findDocumentById(documentId);
    if (!document || document.customerId !== customerId) {
      throw new NotFoundException('Document not found for this customer.');
    }

    return document;
  }

  create(customerId: number, payload: CreateDocumentDto, file?: any): CreateDocumentResponse {
    this.ensureCustomerExists(customerId);
    this.validateCreatePayload(payload);

    const jenisDokumen = this.parseDocumentType(payload.jenisDokumen);
    if (!jenisDokumen) {
      throw new BadRequestException(
        `jenisDokumen must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}`,
      );
    }

    const tanggalDokumen = payload.tanggalDokumen?.trim()
      ? this.parseIsoDateString(payload.tanggalDokumen, 'tanggalDokumen')
      : new Date().toISOString().slice(0, 10);

    const contract = this.resolveContract(customerId, payload.contractId);
    const contractVersion = this.resolveContractVersion(
      customerId,
      contract?.id ?? null,
      payload.contractVersionId,
      jenisDokumen,
    );

    const contractNumber = contract?.contractNumber ?? null;

    if (
      REQUIRED_CONTRACT_REFERENCE_DOC_TYPES.includes(jenisDokumen)
      && !contractNumber
    ) {
      throw new BadRequestException(
        'Dokumen wajib tenant harus mereferensikan nomor kontrak aktif.',
      );
    }

    if (jenisDokumen === DocumentType.BAK && !contractVersion) {
      throw new BadRequestException(
        'Dokumen BAK wajib terkait contract version.',
      );
    }

    const uploadedFileUrl = this.buildDataUrlFromUploadedFile(file);
    const normalizedFileUrl =
      typeof payload.fileUrl === 'string' && payload.fileUrl.trim().length > 0
        ? payload.fileUrl.trim()
        : uploadedFileUrl
          ?? this.buildGeneratedFileUrl(
            customerId,
            jenisDokumen,
            tanggalDokumen,
          );

    const document = this.store.createDocument({
      customerId,
      contractId: contract?.id ?? null,
      contractVersionId: contractVersion?.id ?? null,
      contractNumber,
      jenisDokumen,
      nomorDokumen: payload.nomorDokumen?.trim() || null,
      tanggalDokumen,
      fileUrl: normalizedFileUrl,
    });

    if (jenisDokumen === DocumentType.BAK && contractVersion) {
      this.store.setContractVersionBak(
        contractVersion.contractId,
        contractVersion.id,
        document.id,
      );
    }

    if (jenisDokumen === DocumentType.Invoice) {
      this.linkInvoiceDocument(customerId, document, payload, contractVersion?.id ?? null, contractNumber);
    }

    const automation =
      jenisDokumen === DocumentType.Invoice
        ? {
          customerStatus: null,
          contractChanged: false,
          invoiceChanged: true,
          actions: [
            'Invoice tenant diperbarui berdasarkan dokumen upload.',
            'Status invoice dihitung otomatis dari file invoice dan bukti bayar.',
          ],
        }
        : jenisDokumen === DocumentType.BAK
          ? {
            customerStatus: null,
            contractChanged: true,
            invoiceChanged: false,
            actions: ['BAK terhubung ke contract version terkait.'],
          }
          : this.automation.apply(document);

    return {
      document,
      automation,
    };
  }

  delete(customerId: number, documentId: number): { deleted: boolean } {
    this.ensureCustomerExists(customerId);

    const deleted = this.store.deleteCustomerDocument(customerId, documentId);
    if (!deleted) {
      throw new NotFoundException('Document not found for this customer.');
    }

    return { deleted: true };
  }

  private linkInvoiceDocument(
    customerId: number,
    document: DocumentRecord,
    payload: CreateDocumentDto,
    contractVersionId: number | null,
    contractNumber: string | null,
  ): void {
    const tanggalDokumen = document.tanggalDokumen;
    const periodYear = Number(tanggalDokumen.slice(0, 4));
    const periodMonth = Number(tanggalDokumen.slice(5, 7));

    const existingInvoice = payload.invoiceId
      ? this.store.getCustomerInvoiceById(customerId, Number(payload.invoiceId))
      : this.store
        .listCustomerInvoices(customerId)
        .find(
          (invoice) => invoice.periodYear === periodYear && invoice.periodMonth === periodMonth,
        );

    const invoiceFileUrl =
      typeof payload.invoiceFileUrl === 'string'
        ? (payload.invoiceFileUrl.trim().length > 0
          ? payload.invoiceFileUrl.trim()
          : null)
        : existingInvoice?.invoiceFileUrl ?? document.fileUrl;

    const hasIncomingPaymentProof =
      typeof payload.paymentProofFileUrl === 'string' && payload.paymentProofFileUrl.trim().length > 0;

    const paymentProofFileUrl =
      hasIncomingPaymentProof
        ? payload.paymentProofFileUrl!.trim()
        : existingInvoice?.paymentProofFileUrl ?? null;

    const targetAmount = Number(existingInvoice?.amount ?? 0);
    const dueDate = existingInvoice?.dueDate ?? this.shiftDate(tanggalDokumen, 10);

    this.store.upsertInvoice({
      customerId,
      contractId: document.contractId,
      contractVersionId,
      contractNumber,
      invoiceNumber: payload.nomorDokumen?.trim() || existingInvoice?.invoiceNumber || null,
      periodMonth,
      periodYear,
      periodStartDate: existingInvoice?.periodStartDate ?? `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`,
      periodEndDate: existingInvoice?.periodEndDate ?? this.lastDayOfMonth(periodYear, periodMonth),
      dueDate,
      amount: targetAmount,
      status: paymentProofFileUrl ? InvoiceStatus.Lunas : undefined,
      documentId: document.id,
      paidAt: paymentProofFileUrl
        ? (hasIncomingPaymentProof
          ? tanggalDokumen
          : existingInvoice?.paidAt ?? tanggalDokumen)
        : null,
      invoiceFileUrl,
      paymentProofFileUrl,
    });
  }

  private resolveContract(customerId: number, payloadContractId?: number | string | null) {
    const customerContracts = this.store.listCustomerContracts(customerId);

    if (payloadContractId === undefined || payloadContractId === null) {
      return customerContracts[0] ?? null;
    }

    const normalizedContractId = Number(payloadContractId);
    const matched = customerContracts.find((contract) => contract.id === normalizedContractId);

    if (!matched) {
      throw new BadRequestException('contractId does not belong to the customer.');
    }

    return matched;
  }

  private resolveContractVersion(
    customerId: number,
    contractId: number | null,
    payloadContractVersionId: number | string | null | undefined,
    jenisDokumen: DocumentType,
  ) {
    if (contractId === null) {
      return null;
    }

    if (payloadContractVersionId !== undefined && payloadContractVersionId !== null) {
      const matched = this.store.getCustomerContractVersionById(
        customerId,
        contractId,
        Number(payloadContractVersionId),
      );

      if (!matched) {
        throw new BadRequestException(
          'contractVersionId does not belong to the provided contract/customer.',
        );
      }

      return matched;
    }

    if (jenisDokumen !== DocumentType.BAK) {
      return this.store.listCustomerContractVersions(customerId, contractId)[0] ?? null;
    }

    return this.store.listCustomerContractVersions(customerId, contractId)[0] ?? null;
  }

  private ensureCustomerExists(customerId: number): void {
    const customer = this.store.getCustomerById(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
  }

  private validateCreatePayload(payload: CreateDocumentDto): void {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    if (!payload.jenisDokumen) {
      throw new BadRequestException('jenisDokumen is required.');
    }

    if (payload.tanggalDokumen !== undefined && payload.tanggalDokumen !== null && payload.tanggalDokumen !== '') {
      this.parseIsoDateString(payload.tanggalDokumen, 'tanggalDokumen');
    }
  }

  private buildDataUrlFromUploadedFile(file?: any): string | null {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      return null;
    }

    const mimeType =
      typeof file.mimetype === 'string' && file.mimetype.trim().length > 0
        ? file.mimetype.trim()
        : 'application/octet-stream';

    return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
  }

  private parseIsoDateString(value: string, fieldName: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        `${fieldName} must be in YYYY-MM-DD format.`,
      );
    }

    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`${fieldName} is invalid.`);
    }

    return value;
  }

  private parseDocumentType(value: string): DocumentType | undefined {
    return DOCUMENT_TYPE_VALUES.find((type) => type === value) as
      | DocumentType
      | undefined;
  }

  private buildGeneratedFileUrl(
    customerId: number,
    jenisDokumen: DocumentType,
    tanggalDokumen: string,
  ): string {
    const compactDate = tanggalDokumen.replaceAll('-', '');
    const token = Date.now().toString(36);
    return `internal://customer-${customerId}/${jenisDokumen}/${compactDate}-${token}.pdf`;
  }

  private shiftDate(value: string, days: number): string {
    const next = new Date(`${value}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  private lastDayOfMonth(year: number, month: number): string {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
}
