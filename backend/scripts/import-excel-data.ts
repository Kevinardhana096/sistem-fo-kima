import * as dotenv from 'dotenv';
import * as path from 'path';
// Load env BEFORE importing PrismaClient
dotenv.config({ path: path.join(__dirname, '../.env') });

import { PrismaClient, CustomerStatus, CoreAllocationType, IspStatus, IspPackageType, InvoiceStatus } from '@prisma/client';
import * as fs from 'fs';

async function main() {
  const prisma = new PrismaClient();

  const dataPath = path.join(__dirname, 'import-data.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  const sheet = jsonData.sheets.find((s: any) => s.name === 'Mulai Juni 24');
  if (!sheet) {
    console.error('Sheet "Mulai Juni 24" not found');
    return;
  }

  console.log(`Starting import for ${sheet.rows.length} rows...`);

  for (const row of sheet.rows) {
    const v = row.values;
    const ispName = v.C;
    const customerName = v.D;
    const contractNumber = v.E;
    const startDate = v.F ? new Date(v.F) : new Date();
    const endDate = v.H ? new Date(v.H) : new Date();
    const coreTotal = v.I === '-' ? 0 : parseInt(v.I) || 0;
    const sharingRatio = v.J === '-' ? null : v.J;
    const invoiceNumber = v.K;
    const statusStr = v.L;
    const monthlyAmount = v.M || 0;
    const activationFee = v.O || 0;

    try {
      const isp = await prisma.isp.upsert({
        where: { name: ispName },
        update: {},
        create: {
          name: ispName,
          status: IspStatus.aktif,
          paket: coreTotal > 0 ? IspPackageType.core : IspPackageType.shared,
          jumlah: coreTotal > 0 ? coreTotal : 1,
        },
      });

      let customer = await prisma.customer.findFirst({
        where: { name: customerName },
      });

      if (!customer) {
        const count = await prisma.customer.count();
        customer = await prisma.customer.create({
          data: {
            name: customerName,
            customerCode: `CUST-${(count + 1).toString().padStart(4, '0')}`,
            ispName: ispName,
            status: CustomerStatus.aktif,
            activationFeeAmount: activationFee,
            activationFeePaidAt: activationFee > 0 ? startDate : null,
          },
        });
      }

      await prisma.customerIspMembership.upsert({
        where: {
          customerId_ispId: {
            customerId: customer.id,
            ispId: isp.id,
          },
        },
        update: {},
        create: {
          customerId: customer.id,
          ispId: isp.id,
        },
      });

      const contract = await prisma.contract.upsert({
        where: { contractNumber: contractNumber },
        update: {},
        create: {
          customerId: customer.id,
          contractNumber: contractNumber,
          startDate: startDate,
          endDate: endDate,
          coreType: coreTotal > 0 ? CoreAllocationType.core : CoreAllocationType.sharing_core,
          coreTotal: coreTotal,
          sharingRatio: sharingRatio,
          billingEvery: 1,
          billingUnit: 'bulan',
        },
      });

      await prisma.contractVersion.upsert({
        where: {
          contractId_versionNumber: {
            contractId: contract.id,
            versionNumber: 1,
          },
        },
        update: {},
        create: {
          contractId: contract.id,
          customerId: customer.id,
          versionNumber: 1,
          startDate: startDate,
          endDate: endDate,
          coreType: contract.coreType,
          coreTotal: coreTotal,
          sharedCoreRatio: sharingRatio,
        },
      });

      if (invoiceNumber && invoiceNumber !== '-') {
        const invoiceNumbers = invoiceNumber.split(',').map((s: string) => s.trim());
        for (const invNum of invoiceNumbers) {
          const existingInv = await prisma.invoice.findFirst({
            where: { invoiceNumber: invNum, customerId: customer.id }
          });
          
          if (!existingInv) {
            await prisma.invoice.create({
              data: {
                customerId: customer.id,
                contractId: contract.id,
                invoiceNumber: invNum,
                amount: monthlyAmount,
                periodMonth: startDate.getMonth() + 1,
                periodYear: startDate.getFullYear(),
                status: statusStr === 'Lunas' ? InvoiceStatus.lunas : InvoiceStatus.belum_bayar,
                paidAt: statusStr === 'Lunas' ? startDate : null,
              },
            });
          }
        }
      }

      console.log(`Successfully imported: ${customerName} (${ispName})`);
    } catch (err) {
      console.error(`Error importing row for ${customerName}:`, err);
    }
  }

  await prisma.$disconnect();
  console.log('Import finished.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
