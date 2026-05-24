// insert-indomarco-db.js
// Node script to seed contracts and invoices for PT Indomarco Prismatama (Kima 10) via Supabase REST API

const fetch = require('node-fetch');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role for admin access

const headers = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

// Helper to POST to a table
async function insert(table, payload) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Error inserting into ${table}:`, err);
    process.exit(1);
  }
  return await res.json();
}

(async () => {
  // 1. Find customer ID for Indomarco (created by UI script)
  const custRes = await fetch(`${supabaseUrl}/rest/v1/customers?name=eq.PT%20Indomarco%20Prismatama%20(Kima%2010)`, { headers });
  const customers = await custRes.json();
  if (customers.length === 0) {
    console.error('Customer not found. Ensure UI registration succeeded.');
    process.exit(1);
  }
  const customerId = customers[0].id;

  const contracts = [
    { start_date: '2022-10-22', end_date: '2023-10-21', code: 'KIMA.BAK-10/DBO/FO/XII/2022', invoice_code: '079/INV.FO/XII/2022' },
    { start_date: '2023-10-22', end_date: '2024-10-21', code: 'KIMA.BAK-49/DBO/FO/X/2023', invoice_code: 'INV-020/KIMA/FO/VI/2024' },
    { start_date: '2024-10-22', end_date: '2025-10-21', code: 'KIMA.BAK-64/DBO/FO/X/2024', invoice_code: 'INV-021/KIMA/FO/I/2025' },
    { start_date: '2025-10-22', end_date: '2026-10-21', code: 'KIMA.BAK-52/DBO/FO/XI/2025', invoice_code: '106/FO/11/25' },
  ];

  for (const c of contracts) {
    // Insert contract (assuming table "contracts")
    const contract = await insert('contracts', {
      customer_id: customerId,
      start_date: c.start_date,
      end_date: c.end_date,
      contract_code: c.code,
      invoice_code: c.invoice_code,
      package: 'SHARING_CORE',
      ratio: '1/32',
      status: 'expired', // will be treated as expired for past periods
    });
    const contractId = contract[0].id;
    // Generate 12 monthly invoices per contract
    const invoices = [];
    const start = new Date(c.start_date);
    for (let i = 0; i < 12; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(start.getMonth() + i);
      const iso = dueDate.toISOString().split('T')[0];
      invoices.push({
        contract_id: contractId,
        due_date: iso,
        amount: 250000,
        status: 'lunas',
        description: `Invoice ${i + 1}`,
      });
    }
    await insert('invoices', invoices);
    console.log(`Contract ${c.code} seeded with 12 invoices`);
  }
  console.log('All contracts and invoices seeded successfully');
})();
