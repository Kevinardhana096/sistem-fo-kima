export enum DocumentType {
  Permohonan = 'permohonan',
  Penawaran = 'penawaran',
  Tanggapan = 'tanggapan',
  HasilNego = 'hasil_nego',
  BAK = 'BAK',
  Kontrak = 'kontrak',
  Invoice = 'invoice',
  Perpanjangan = 'perpanjangan',
  Pemutusan = 'pemutusan',
  Lainnya = 'lainnya',
}

export enum CustomerStatus {
  Aktif = 'aktif',
  Nonaktif = 'nonaktif',
}

export enum ContractStatus {
  Aktif = 'aktif',
  Expired = 'expired',
  Terminated = 'terminated',
}

export enum InvoiceStatus {
  Lunas = 'lunas',
  BelumBayar = 'belum_bayar',
  Terlambat = 'terlambat',
  BelumDitagih = 'belum_ditagih',
}

export enum CoreAllocationType {
  Core = 'core',
  SharingCore = 'sharing_core',
}

export enum BillingUnit {
  Hari = 'hari',
  Bulan = 'bulan',
  Tahun = 'tahun',
}

export enum IspStatus {
  Aktif = 'aktif',
  Nonaktif = 'nonaktif',
}

export enum IspPackageType {
  Core = 'core',
  Shared = 'shared',
}

export enum IspRenewalStatus {
  Active = 'active',
  Warning = 'warning',
  Pending = 'pending',
  Renewed = 'renewed',
  Terminated = 'terminated',
  NeedsCompletion = 'needs_completion',
}

export interface IspContractRow {
  id: number;
  ispId: number;
  contractReference: string;
  periodStart: string | null;
  periodEnd: string | null;
  renewalStatus: IspRenewalStatus;
  bakFileUrl: string | null;
  bakFileName: string | null;
  renewalFileUrl: string | null;
  renewalFileName: string | null;
  responseFileUrl: string | null;
  responseFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Isp {
  id: number;
  name: string;
  status: IspStatus;
  contractReference: string | null;
  contractStartDate: string | null;
  contractPeriodStart: string | null;
  contractPeriodEnd: string | null;
  paket: IspPackageType;
  jumlah: number;
  billingPeriodMode?: string | null;
  billingCustomEvery?: number | null;
  billingCustomUnit?: string | null;
  activationFeeAmount?: number;
  activationFeePaidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantIspMembership {
  id: number;
  customerId: number;
  ispId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  customerCode: string;
  // Keep ispName for backward compatibility with current frontend fields.
  ispName: string;
  name: string;
  status: CustomerStatus;
  activationFeeAmount: number;
  activationFeePaidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: number;
  customerId: number;
  contractNumber: string;
  startDate: string;
  endDate: string;
  coreType: CoreAllocationType;
  coreTotal: number;
  sharingRatio?: string | null;
  status: ContractStatus;
  billingEvery: number;
  billingUnit: BillingUnit;
  createdAt: string;
  updatedAt: string;
}

export interface ContractVersion {
  id: number;
  contractId: number;
  customerId: number;
  versionNumber: number;
  startDate: string;
  endDate: string;
  coreType: CoreAllocationType;
  coreTotal: number;
  sharedCoreRatio: string | null;
  bakDocumentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: number;
  customerId: number;
  invoiceNumber: string | null;
  contractId: number | null;
  contractVersionId: number | null;
  contractNumber: string | null;
  periodMonth: number;
  periodYear: number;
  periodStartDate: string | null;
  periodEndDate: string | null;
  dueDate: string | null;
  amount: number;
  status: InvoiceStatus;
  documentId: number | null;
  paidAt: string | null;
  invoiceFileUrl: string | null;
  paymentProofFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: number;
  customerId: number;
  contractId: number | null;
  contractVersionId: number | null;
  contractNumber: string | null;
  jenisDokumen: DocumentType;
  nomorDokumen: string | null;
  tanggalDokumen: string;
  fileUrl: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  customerId: number;
  date: string;
  type: 'document' | 'contract' | 'contract_version' | 'invoice' | 'payment' | 'todo';
  title: string;
  description: string;
}

export type TenantTodoCategory = 'priority' | 'need_action' | 'info';

export interface TenantTodoItem {
  id: string;
  customerId: number;
  category: TenantTodoCategory;
  code:
  | 'contract_expiring_90_days'
  | 'payment_overdue'
  | 'payment_pending'
  | 'bak_missing'
  | 'required_document_missing'
  | 'invoice_amount_missing'
  | 'invoice_not_uploaded'
  | 'recent_activity';
  title: string;
  message: string;
  dueDate: string | null;
  createdAt: string;
}

export interface TenantTodoSummary {
  priority: TenantTodoItem[];
  needAction: TenantTodoItem[];
  info: TenantTodoItem[];
  counts: {
    priority: number;
    needAction: number;
    info: number;
  };
}

export interface MonitoringBillingRow {
  customerId: number;
  customerCode: string;
  ispName: string;
  ispNames?: string[];
  customerName: string;
  customerStatus: CustomerStatus;
  activationFeeAmount: number;
  activationFeePaidAt: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  coreType: CoreAllocationType | null;
  coreTotal: number | null;
  sharingRatio: string | null;
  months: InvoiceStatus[];
}

export interface MonitoringAlert {
  customerId: number;
  customerName: string;
  code:
  | 'missing_contract'
  | 'contract_expiring'
  | 'payment_overdue'
  | 'bak_missing'
  | 'missing_required_document'
  | 'invoice_not_uploaded'
  | 'missing_invoice_current_month'
  | 'has_termination_document'
  | 'activation_fee_unpaid';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export const DOCUMENT_TYPE_VALUES = Object.values(DocumentType);
