// Supabase Edge Function: Monitoring API
// Handles billing monitoring and alerts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1];

    // Route: GET /monitoring/billing
    if (req.method === "GET" && endpoint === "billing") {
      const year = url.searchParams.get("year");
      const isp = url.searchParams.get("isp");
      const status = url.searchParams.get("status");

      let query = supabaseClient
        .from("invoices")
        .select(`
          *,
          customer:customers(
            id,
            name,
            customer_code,
            isp_name,
            status
          ),
          contract:contracts(
            contract_number
          )
        `)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });

      if (year) {
        query = query.eq("period_year", parseInt(year));
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data: invoices, error } = await query;

      if (error) throw error;

      // Filter by ISP if provided
      let filtered = invoices;
      if (isp) {
        filtered = invoices?.filter((inv: any) =>
          inv.customer?.isp_name?.toLowerCase().includes(isp.toLowerCase())
        );
      }

      return new Response(JSON.stringify(filtered), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: GET /monitoring/alerts
    if (req.method === "GET" && endpoint === "alerts") {
      const year = url.searchParams.get("year");
      const currentYear = year ? parseInt(year) : new Date().getFullYear();

      // Get customers with missing documents or expiring contracts
      const { data: customers, error: customersError } = await supabaseClient
        .from("customers")
        .select(`
          id,
          name,
          customer_code,
          status,
          contracts:contracts(
            id,
            contract_number,
            end_date,
            status
          ),
          documents:documents(count)
        `)
        .eq("status", "aktif");

      if (customersError) throw customersError;

      const alerts = [];
      const today = new Date();

      for (const customer of customers || []) {
        // Alert: No contract
        if (!customer.contracts || customer.contracts.length === 0) {
          alerts.push({
            type: "no_contract",
            severity: "high",
            customerId: customer.id,
            customerName: customer.name,
            message: "Customer tidak memiliki kontrak",
          });
        }

        // Alert: Contract expiring soon (within 30 days)
        const activeContracts = customer.contracts?.filter((c: any) => c.status === "aktif");
        for (const contract of activeContracts || []) {
          const endDate = new Date(contract.end_date);
          const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            alerts.push({
              type: "contract_expiring",
              severity: "warning",
              customerId: customer.id,
              customerName: customer.name,
              contractNumber: contract.contract_number,
              daysLeft: daysUntilExpiry,
              message: `Kontrak akan berakhir dalam ${daysUntilExpiry} hari`,
            });
          }

          if (daysUntilExpiry <= 0) {
            alerts.push({
              type: "contract_expired",
              severity: "high",
              customerId: customer.id,
              customerName: customer.name,
              contractNumber: contract.contract_number,
              message: "Kontrak sudah berakhir",
            });
          }
        }

        // Alert: No documents
        if (customer.documents?.[0]?.count === 0) {
          alerts.push({
            type: "no_documents",
            severity: "medium",
            customerId: customer.id,
            customerName: customer.name,
            message: "Customer tidak memiliki dokumen",
          });
        }
      }

      return new Response(JSON.stringify(alerts), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route: GET /monitoring/insights
    if (req.method === "GET" && endpoint === "insights") {
      const year = url.searchParams.get("year");
      const currentYear = year ? parseInt(year) : new Date().getFullYear();

      // Get summary statistics
      const { data: customers, error: customersError } = await supabaseClient
        .from("customers")
        .select("id, status");

      const { data: invoices, error: invoicesError } = await supabaseClient
        .from("invoices")
        .select("status, amount, period_year")
        .eq("period_year", currentYear);

      const { data: contracts, error: contractsError } = await supabaseClient
        .from("contracts")
        .select("status");

      if (customersError || invoicesError || contractsError) {
        throw customersError || invoicesError || contractsError;
      }

      const insights = {
        totalCustomers: customers?.length || 0,
        activeCustomers: customers?.filter((c: any) => c.status === "aktif").length || 0,
        inactiveCustomers: customers?.filter((c: any) => c.status === "nonaktif").length || 0,
        totalContracts: contracts?.length || 0,
        activeContracts: contracts?.filter((c: any) => c.status === "aktif").length || 0,
        totalInvoices: invoices?.length || 0,
        paidInvoices: invoices?.filter((i: any) => i.status === "lunas").length || 0,
        unpaidInvoices: invoices?.filter((i: any) => i.status === "belum_bayar").length || 0,
        overdueInvoices: invoices?.filter((i: any) => i.status === "terlambat").length || 0,
        totalRevenue: invoices
          ?.filter((i: any) => i.status === "lunas")
          .reduce((sum: number, i: any) => sum + parseFloat(i.amount || 0), 0) || 0,
        pendingRevenue: invoices
          ?.filter((i: any) => i.status !== "lunas")
          .reduce((sum: number, i: any) => sum + parseFloat(i.amount || 0), 0) || 0,
      };

      return new Response(JSON.stringify(insights), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Route not found
    return new Response(JSON.stringify({ error: "Route not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 404,
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
