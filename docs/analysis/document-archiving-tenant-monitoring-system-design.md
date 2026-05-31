# Document Archiving and Tenant Monitoring System Design

> **Catatan historis (dokumen desain awal).** Dokumen ini adalah visi desain awal sistem dan masih relevan untuk *rationale* alur bisnis (arsip berbasis pelanggan, otomatisasi dokumen, alert). Namun bagian implementasi teknis yang mengasumsikan **backend NestJS** dan **REST API kustom** (lihat §10 Backend Module Structure dan §11 API Structure) **sudah usang**: arsitektur saat ini adalah frontend React/Vite yang mengakses **Supabase secara langsung**. Untuk arsitektur dan model data yang berlaku, rujuk [PRD](../../prd/PRD-sistem-arsip-kima.md).

## 1. Objective
Design a modern internal web system that remains simple for a single operator, while keeping business flow structured and scalable.

Core scope:
- ISP tenant/customer management
- Contract lifecycle management
- Invoice and billing monitoring
- Warning letter tracking
- Customer-centric document archive

## 2. Core Principles
- Customer-centric archive: documents are grouped by customer, never global-first.
- Minimal input: dropdowns, defaults, and auto-fill over free typing.
- Business-driven documents: uploads trigger workflow/state updates.
- Operational clarity: warnings and statuses must be visible without opening many pages.
- Scalability-ready: start simple for one user, keep modular boundaries for growth.

## 3. Information Architecture
Top-level modules:
- Dashboard
- Customers
- Monitoring
- Contracts
- Invoices
- Archive Analytics (not global file dump)
- Trash

### Customer Detail is the Archive Hub
Inside each customer detail page, include tabs:
- Overview
- Contracts
- Invoices
- Documents (new mandatory archive tab)
- Activity Timeline
- Warning Letters

Important:
- Remove/avoid a global document page for operations.
- Documents are managed from customer context.

## 4. Data Model
Main required table:

```sql
documents (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  contract_id BIGINT NULL,
  jenis_dokumen document_type NOT NULL,
  nomor_dokumen VARCHAR(100) NULL,
  tanggal_dokumen DATE NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
)
```

Enum `jenis_dokumen`:
- permohonan
- penawaran
- hasil_nego
- BAK
- kontrak
- invoice
- perpanjangan
- pemutusan
- lainnya

Supporting entities (recommended):
- customers (id, name, isp, status, ...)
- contracts (id, customer_id, start_date, end_date, status, ...)
- invoices (id, customer_id, contract_id, period_month, period_year, status, amount, ...)
- warning_letters (id, customer_id, level, sent_at, status, ...)

### Indexing
Recommended indexes:
- documents(customer_id, tanggal_dokumen DESC)
- documents(jenis_dokumen)
- documents(contract_id)
- contracts(customer_id, end_date)
- invoices(customer_id, period_year, period_month)

## 5. Business Rules and Automation
Treat document uploads as domain events:

1. `jenis_dokumen = pemutusan`
- Set customer status to `nonaktif`
- Mark active contract as terminated
- Exclude customer from active monitoring rows

2. `jenis_dokumen = perpanjangan`
- Extend current contract end date or create new contract revision
- Keep customer status `aktif`
- Continue billing pipeline

3. `jenis_dokumen = kontrak`
- Create new contract entry (if no active contract) or new contract revision
- Make customer monitorable for billing

4. `jenis_dokumen = invoice`
- Create/link invoice record
- Push invoice to monthly monitoring table

## 6. Monitoring Integration
Monitoring page consumes `invoices + contract/customer status` with document-driven effects.

Examples:
- Upload invoice -> monthly billing cell appears/updates.
- Upload pemutusan -> customer removed from active rows.
- Upload perpanjangan -> contract continuity maintained in next periods.

## 7. Document Tab UI (Customer Detail)
Columns:
- Document Type
- Document Number
- Date
- File Preview/Download
- Actions

Filter chips:
- All
- Contract
- Invoice
- BAK
- Termination

Primary action:
- `Upload Document`

Visual labels:
- Contract: blue
- Invoice: green
- Termination: red

## 8. Upload Flow (Minimal)
Open modal/drawer from Customer Detail > Documents.

Fields:
- Customer (auto-filled, locked when opened from customer page)
- Document Type (enum dropdown)
- File upload
- Document Number (optional)
- Date

Save behavior:
- Upload file + persist document metadata
- Trigger automation service based on `jenis_dokumen`
- Return feedback: success + affected entities (customer/contract/invoice)

## 9. Smart Alerts
Customer-level warning badges:
- No contract uploaded
- No invoice uploaded
- Contract is about to expire (e.g., <= 30 days)
- Customer has termination document

Dashboard/Monitoring notifications:
- Missing contract documents
- Missing invoice this month
- Expiring contracts

## 10. Backend Module Structure (NestJS)
Suggested modular structure:
- `customers` module
- `contracts` module
- `invoices` module
- `documents` module
- `monitoring` module
- `automation` module (or domain service)
- `notifications` module

Key application services:
- `DocumentUploadService`
- `DocumentAutomationService`
- `MonitoringProjectionService`
- `CustomerComplianceCheckService`

## 11. API Structure (Recommended)
Customer-scoped document APIs:
- `GET /customers/:customerId/documents`
- `POST /customers/:customerId/documents`
- `GET /customers/:customerId/documents/:documentId`
- `DELETE /customers/:customerId/documents/:documentId`

Monitoring APIs:
- `GET /monitoring/billing?month=&year=&isp=&status=`
- `GET /monitoring/alerts`

Automation/status APIs:
- `GET /customers/:customerId/compliance-status`
- `GET /customers/:customerId/timeline`

## 12. Frontend Structure (React)
Recommended feature folders:
- `features/customers`
- `features/contracts`
- `features/invoices`
- `features/documents`
- `features/monitoring`
- `features/alerts`

In `features/documents`:
- `DocumentsTab.jsx`
- `DocumentUploadModal.jsx`
- `DocumentTable.jsx`
- `documentTypeBadge.tsx`

## 13. Single-User Simplicity Tactics
- Auto-fill customer and context IDs.
- Preselect current year/month in monitoring filters.
- Use status chips instead of long text.
- Keep upload form to max 5 fields.
- Add clear success toast with "what changed" summary.

## 14. Optional Enhancements
- Auto filename format:
  `{document_type}_{customer}_{yyyy-mm-dd}.pdf`
- Customer document timeline view
- Scheduled notifications for expiring contracts/missing invoices

## 15. Implementation Roadmap
Phase 1 (Core):
- Documents table + upload API
- Documents tab in customer detail
- Basic monitoring link for invoice docs

Phase 2 (Automation):
- Business triggers for pemutusan/perpanjangan/kontrak/invoice
- Customer status + contract update automation

Phase 3 (Operational Intelligence):
- Missing document warnings
- Monitoring alerts
- Timeline and notification center

---
This design keeps daily operation simple for one admin while preserving clean architecture for future expansion.
