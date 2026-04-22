import { PrismaClient } from '@prisma/client';
import { InMemoryDataService } from '../src/store/in-memory-data.service';

const prisma = new PrismaClient();

const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);
const toDateOnly = (value: string | null | undefined) =>
  value ? new Date(`${value}T00:00:00.000Z`) : null;

async function resetSequences() {
  const sequenceMappings = [
    ['customers', 'id'],
    ['isps', 'id'],
    ['customer_isp_memberships', 'id'],
    ['isp_contract_rows', 'id'],
    ['isp_renewal_follow_ups', 'id'],
    ['contracts', 'id'],
    ['contract_versions', 'id'],
    ['documents', 'id'],
    ['invoices', 'id'],
    ['invoice_follow_ups', 'id'],
    ['customer_route_versions', 'id'],
    ['customer_route_points', 'id'],
    ['customer_route_history', 'id'],
  ] as const;

  for (const [tableName, idColumn] of sequenceMappings) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', '${idColumn}'), COALESCE((SELECT MAX("${idColumn}") FROM "${tableName}"), 1), true);`,
    );
  }
}

async function clearTables() {
  await prisma.invoiceFollowUp.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contractVersion.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.customerRouteHistory.deleteMany();
  await prisma.customerRoutePoint.deleteMany();
  await prisma.customerRouteVersion.deleteMany();
  await prisma.ispRenewalFollowUp.deleteMany();
  await prisma.ispContractRow.deleteMany();
  await prisma.customerIspMembership.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.isp.deleteMany();
}

async function seed() {
  const store = new InMemoryDataService();
  const snapshot = store.exportSnapshot();

  await clearTables();

  if (snapshot.customers.length > 0) {
    await prisma.customer.createMany({
      data: snapshot.customers.map((customer) => ({
        id: customer.id,
        customerCode: customer.customerCode,
        ispName: customer.ispName,
        name: customer.name,
        status: customer.status,
        activationFeeAmount: customer.activationFeeAmount,
        activationFeePaidAt: toDate(customer.activationFeePaidAt),
        createdAt: new Date(customer.createdAt),
        updatedAt: new Date(customer.updatedAt),
      })),
    });
  }

  if (snapshot.isps.length > 0) {
    await prisma.isp.createMany({
      data: snapshot.isps.map((isp) => ({
        id: isp.id,
        name: isp.name,
        status: isp.status,
        contractReference: isp.contractReference,
        contractStartDate: toDateOnly(isp.contractStartDate),
        contractPeriodStart: toDateOnly(isp.contractPeriodStart),
        contractPeriodEnd: toDateOnly(isp.contractPeriodEnd),
        paket: isp.paket,
        jumlah: isp.jumlah,
        billingPeriodMode: isp.billingPeriodMode ?? null,
        billingCustomEvery: isp.billingCustomEvery ?? null,
        billingCustomUnit: isp.billingCustomUnit ?? null,
        activationFeeAmount: isp.activationFeeAmount ?? 0,
        activationFeePaidAt: toDate(isp.activationFeePaidAt ?? null),
        createdAt: new Date(isp.createdAt),
        updatedAt: new Date(isp.updatedAt),
      })),
    });
  }

  if (snapshot.memberships.length > 0) {
    await prisma.customerIspMembership.createMany({
      data: snapshot.memberships.map((membership) => ({
        id: membership.id,
        customerId: membership.customerId,
        ispId: membership.ispId,
        createdAt: new Date(membership.createdAt),
        updatedAt: new Date(membership.updatedAt),
      })),
    });
  }

  if (snapshot.ispContractRows.length > 0) {
    await prisma.ispContractRow.createMany({
      data: snapshot.ispContractRows.map((row) => ({
        id: row.id,
        ispId: row.ispId,
        contractReference: row.contractReference,
        periodStart: toDateOnly(row.periodStart),
        periodEnd: toDateOnly(row.periodEnd),
        renewalStatus: row.renewalStatus,
        bakFileUrl: row.bakFileUrl,
        bakFileName: row.bakFileName,
        renewalFileUrl: row.renewalFileUrl,
        renewalFileName: row.renewalFileName,
        responseFileUrl: row.responseFileUrl,
        responseFileName: row.responseFileName,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      })),
    });

    const renewalFollowUps = snapshot.ispContractRows.flatMap((row) =>
      (row.renewalFollowUps ?? []).map((followUp) => ({
        id: followUp.id,
        rowId: followUp.rowId,
        splitOrder: followUp.splitOrder,
        source: followUp.source,
        triggerCode: followUp.triggerCode,
        title: followUp.title,
        description: followUp.description,
        status: followUp.status,
        renewalFileUrl: followUp.renewalFileUrl,
        renewalFileName: followUp.renewalFileName,
        responseFileUrl: followUp.responseFileUrl,
        responseFileName: followUp.responseFileName,
        responseDecision: followUp.responseDecision,
        createdAt: new Date(followUp.createdAt),
        updatedAt: new Date(followUp.updatedAt),
      })),
    );

    if (renewalFollowUps.length > 0) {
      await prisma.ispRenewalFollowUp.createMany({ data: renewalFollowUps });
    }
  }

  if (snapshot.contracts.length > 0) {
    await prisma.contract.createMany({
      data: snapshot.contracts.map((contract) => ({
        id: contract.id,
        customerId: contract.customerId,
        contractNumber: contract.contractNumber,
        startDate: toDateOnly(contract.startDate)!,
        endDate: toDateOnly(contract.endDate)!,
        coreType: contract.coreType,
        coreTotal: contract.coreTotal,
        sharingRatio: contract.sharingRatio ?? null,
        status: contract.status,
        billingEvery: contract.billingEvery,
        billingUnit: contract.billingUnit,
        createdAt: new Date(contract.createdAt),
        updatedAt: new Date(contract.updatedAt),
      })),
    });
  }

  if (snapshot.contractVersions.length > 0) {
    await prisma.contractVersion.createMany({
      data: snapshot.contractVersions.map((version) => ({
        id: version.id,
        contractId: version.contractId,
        customerId: version.customerId,
        versionNumber: version.versionNumber,
        startDate: toDateOnly(version.startDate)!,
        endDate: toDateOnly(version.endDate)!,
        coreType: version.coreType,
        coreTotal: version.coreTotal,
        sharedCoreRatio: version.sharedCoreRatio ?? null,
        bakDocumentId: null,
        renewalFileUrl: version.renewalFileUrl,
        renewalFileName: version.renewalFileName,
        responseFileUrl: version.responseFileUrl,
        responseFileName: version.responseFileName,
        createdAt: new Date(version.createdAt),
        updatedAt: new Date(version.updatedAt),
      })),
    });
  }

  if (snapshot.documents.length > 0) {
    await prisma.document.createMany({
      data: snapshot.documents.map((document) => ({
        id: document.id,
        customerId: document.customerId,
        contractId: document.contractId,
        contractVersionId: document.contractVersionId,
        contractNumber: document.contractNumber,
        jenisDokumen: document.jenisDokumen,
        nomorDokumen: document.nomorDokumen,
        tanggalDokumen: toDateOnly(document.tanggalDokumen)!,
        fileUrl: document.fileUrl,
        createdAt: new Date(document.createdAt),
      })),
    });

    for (const version of snapshot.contractVersions) {
      if (!version.bakDocumentId) {
        continue;
      }

      await prisma.contractVersion.update({
        where: { id: version.id },
        data: { bakDocumentId: version.bakDocumentId },
      });
    }
  }

  if (snapshot.invoices.length > 0) {
    await prisma.invoice.createMany({
      data: snapshot.invoices.map((invoice) => ({
        id: invoice.id,
        customerId: invoice.customerId,
        invoiceNumber: invoice.invoiceNumber,
        contractId: invoice.contractId,
        contractVersionId: invoice.contractVersionId ?? null,
        contractNumber: invoice.contractNumber ?? null,
        periodMonth: invoice.periodMonth,
        periodYear: invoice.periodYear,
        periodStartDate: toDateOnly(invoice.periodStartDate),
        periodEndDate: toDateOnly(invoice.periodEndDate),
        dueDate: toDateOnly(invoice.dueDate),
        amount: invoice.amount,
        status: invoice.status,
        scheduleVersion: invoice.scheduleVersion,
        scheduleStatus: invoice.scheduleStatus,
        documentId: invoice.documentId ?? null,
        paidAt: toDate(invoice.paidAt),
        invoiceFileUrl: invoice.invoiceFileUrl ?? null,
        paymentProofFileUrl: invoice.paymentProofFileUrl ?? null,
        createdAt: new Date(invoice.createdAt),
        updatedAt: new Date(invoice.updatedAt),
      })),
    });

    const invoiceFollowUps = snapshot.invoices.flatMap((invoice) =>
      (invoice.invoiceFollowUps ?? []).map((followUp) => ({
        id: followUp.id,
        invoiceId: followUp.invoiceId,
        splitOrder: followUp.splitOrder,
        source: followUp.source,
        triggerCode: followUp.triggerCode,
        title: followUp.title,
        description: followUp.description,
        status: followUp.status,
        invoiceNumber: followUp.invoiceNumber,
        invoiceFileUrl: followUp.invoiceFileUrl,
        createdAt: new Date(followUp.createdAt),
        updatedAt: new Date(followUp.updatedAt),
      })),
    );

    if (invoiceFollowUps.length > 0) {
      await prisma.invoiceFollowUp.createMany({ data: invoiceFollowUps });
    }
  }

  if (snapshot.customerRouteVersions.length > 0) {
    await prisma.customerRouteVersion.createMany({
      data: snapshot.customerRouteVersions.map((version) => ({
        id: version.id,
        customerId: version.customerId,
        versionNumber: version.versionNumber,
        flowStatus: version.flowStatus,
        changeMode: version.changeMode,
        changeNote: version.changeNote,
        basedOnVersionId: version.basedOnVersionId,
        createdAt: new Date(version.createdAt),
        updatedAt: new Date(version.updatedAt),
      })),
    });
  }

  if (snapshot.customerRoutePoints.length > 0) {
    await prisma.customerRoutePoint.createMany({
      data: snapshot.customerRoutePoints.map((point) => ({
        id: point.id,
        routeVersionId: point.routeVersionId,
        orderNumber: point.orderNumber,
        pathName: point.pathName,
        pointType: point.pointType,
        note: point.note,
        createdAt: new Date(point.createdAt),
        updatedAt: new Date(point.updatedAt),
      })),
    });
  }

  if (snapshot.customerRouteHistory.length > 0) {
    await prisma.customerRouteHistory.createMany({
      data: snapshot.customerRouteHistory.map((entry) => ({
        id: entry.id,
        customerId: entry.customerId,
        operation: entry.operation,
        note: entry.note,
        snapshotBefore: entry.snapshotBefore,
        snapshotAfter: entry.snapshotAfter,
        createdAt: new Date(entry.createdAt),
      })),
    });
  }

  await resetSequences();
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Prisma seed failed.', error);
    await prisma.$disconnect();
    process.exit(1);
  });
