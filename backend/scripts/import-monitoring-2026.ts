import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient, CustomerStatus, CoreAllocationType, IspStatus, IspPackageType, InvoiceStatus, ContractStatus, BillingUnit } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';

// Load env BEFORE importing PrismaClient
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const dataPath = path.join(__dirname, 'monitoring_update_20_april_2026.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`File not found: ${dataPath}`);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  console.log('--- Step 1: Import Master Data from "Mulai Juni 24" ---');
  const masterSheet = jsonData.sheets.find((s: any) => s.name === 'Mulai Juni 24');
  if (masterSheet) {
    await importMasterData(masterSheet);
  } else {
    console.warn('Sheet "Mulai Juni 24" not found, skipping master data import.');
  }

  console.log('\n--- Step 2: Import Billing History from "Bulanan" ---');
  const monthlySheet = jsonData.sheets.find((s: any) => s.name === 'Bulanan');
  if (monthlySheet) {
    await importMonthlyBilling(monthlySheet);
  } else {
    console.warn('Sheet "Bulanan" not found, skipping billing history import.');
  }

  console.log('\n--- Import Completed ---');
}

async function importMasterData(sheet: any) {
  console.log(`Processing ${sheet.rows.length} rows from master sheet...`);

  // Skip header rows (usually first 2 rows based on JSON)
  const rows = sheet.rows.filter((r: any) => typeof r.values.B === 'number');

  for (const row of rows) {
    const v = row.values;
    const ispName = v.C;
    const customerName = v.D;
    const contractNumber = v.E;
    const startDate = v.F ? new Date(v.F) : null;
    const endDate = v.H ? new Date(v.H) : null;
    const coreTotal = v.I === '-' ? 0 : (typeof v.I === 'number' ? v.I : parseInt(v.I) || 0);
    const sharingRatio = v.J === '-' ? null : v.J;
    const invoiceNumber = v.K;
    const statusStr = v.L;
    const monthlyAmount = v.M || 0;
    const activationFee = v.O || 0;

    if (!ispName || !customerName) continue;

    try {
      // 1. Upsert ISP
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

      // 2. Upsert Customer
      let customer = await prisma.customer.findFirst({
        where: { name: customerName },
      });

      if (!customer) {
        const count = await prisma.customer.count();
        customer = await prisma.customer.create({
          data: {
            name: customerName,
            customerCode: `CUST-${(count + 1000).toString().padStart(5, '0')}`,
            ispName: ispName,
            status: CustomerStatus.aktif,
            activationFeeAmount: activationFee,
            activationFeePaidAt: activationFee > 0 && startDate ? startDate : null,
          },
        });
      }

      // 3. Membership
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

      // 4. Contract
      if (contractNumber && contractNumber !== '-') {
        const contract = await prisma.contract.upsert({
          where: { contractNumber: contractNumber },
          update: {
              endDate: endDate || undefined,
              status: ContractStatus.aktif
          },
          create: {
            customerId: customer.id,
            contractNumber: contractNumber,
            startDate: startDate || new Date(),
            endDate: endDate || new Date(),
            coreType: coreTotal > 0 ? CoreAllocationType.core : CoreAllocationType.sharing_core,
            coreTotal: coreTotal,
            sharingRatio: sharingRatio,
            billingEvery: 1,
            billingUnit: BillingUnit.bulan,
            status: ContractStatus.aktif
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
            startDate: startDate || new Date(),
            endDate: endDate || new Date(),
            coreType: contract.coreType,
            coreTotal: coreTotal,
            sharedCoreRatio: sharingRatio,
          },
        });

        // 5. Initial Invoice if present
        if (invoiceNumber && invoiceNumber !== '-') {
          const invNums = String(invoiceNumber).split(',').map(s => s.trim());
          for (const invNum of invNums) {
              await prisma.invoice.upsert({
                  where: { id: -1 }, // Force findFirst/create pattern since we don't have ID
                  update: {},
                  create: {
                      customerId: customer.id,
                      contractId: contract.id,
                      invoiceNumber: invNum,
                      amount: monthlyAmount,
                      periodMonth: startDate ? startDate.getMonth() + 1 : 1,
                      periodYear: startDate ? startDate.getFullYear() : 2024,
                      status: statusStr === 'Lunas' ? InvoiceStatus.lunas : InvoiceStatus.belum_bayar,
                      paidAt: statusStr === 'Lunas' && startDate ? startDate : null,
                  }
              });
          }
        }
      }

      console.log(`[Master] Imported: ${customerName}`);
    } catch (err) {
      console.error(`[Master] Error row ${v.B}:`, err);
    }
  }
}

async function importMonthlyBilling(sheet: any) {
  // Mapping columns to Month/Year
  // Based on reading the file:
  // Q-AB: 2022 (Jan-Dec)
  // AC-AN: 2023 (Jan-Dec)
  // AO-AZ: 2024 (Jan-Dec)
  // BA-BL: 2025 (Jan-Dec)
  // BM-BX: 2026 (Jan-Dec)
  // BY-CJ: 2027 (Jan-Dec)
  
  const yearMapping: any = {
    2022: ['Q','R','S','T','U','V','W','X','Y','Z','AA','AB'],
    2023: ['AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN'],
    2024: ['AO','AP','AQ','AR','AS','AT','AU','AV','AW','AX','AY','AZ'],
    2025: ['BA','BB','BC','BD','BE','BF','BG','BH','BI','BJ','BK','BL'],
    2026: ['BM','BN','BO','BP','BQ','BR','BS','BT','BU','BV','BW','BX'],
    2027: ['BY','BZ','CA','CB','CC','CD','CE','CF','CG','CH','CI','CJ']
  };

  const rows = sheet.rows.filter((r: any) => typeof r.values.B === 'number' && typeof r.values.D === 'string');
  console.log(`Processing ${rows.length} rows for billing history...`);

  for (const row of rows) {
    const v = row.values;
    const customerName = v.D;
    // Skip if customerName is empty or just a placeholder
    if (!customerName || customerName.trim() === '' || typeof customerName !== 'string') continue;

    const customer = await prisma.customer.findFirst({
        where: { name: customerName }
    });

    if (!customer) {
        // console.warn(`[Monthly] Customer not found: ${customerName}`);
        continue;
    }

    for (const year of Object.keys(yearMapping)) {
        const columns = yearMapping[year];
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            const col = columns[monthIdx];
            const amount = v[col];

            if (amount && amount > 0) {
                const month = monthIdx + 1;
                const yearNum = parseInt(year);

                // Try to find if invoice already exists for this customer/period
                const existing = await prisma.invoice.findFirst({
                    where: {
                        customerId: customer.id,
                        periodMonth: month,
                        periodYear: yearNum
                    }
                });

                if (!existing) {
                    await prisma.invoice.create({
                        data: {
                            customerId: customer.id,
                            amount: amount,
                            periodMonth: month,
                            periodYear: yearNum,
                            status: yearNum < 2026 || (yearNum === 2026 && month < 4) ? InvoiceStatus.lunas : InvoiceStatus.belum_bayar,
                            // Defaulting past invoices to lunas for simplicity, future to belum_bayar
                        }
                    });
                } else if (existing.amount.toNumber() === 0) {
                    await prisma.invoice.update({
                        where: { id: existing.id },
                        data: { amount: amount }
                    });
                }
            }
        }
    }
    console.log(`[Monthly] Processed billing for: ${customerName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
